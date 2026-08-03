-- Transactional repair for duplicate sessions with server-transformed answers.

create or replace function merge_sessions(
  p_target_session_id text,
  p_source_session_id text,
  p_expected_target_revision bigint,
  p_expected_source_revision bigint,
  p_transformed_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target sessions%rowtype;
  v_source sessions%rowtype;
  v_source_answer_count integer;
  v_payload_count integer;
  v_moved_answers integer;
  v_moved_slots integer;
begin
  if p_target_session_id = p_source_session_id then
    return jsonb_build_object('ok', false, 'code', 'session_not_found');
  end if;

  select * into v_target
  from sessions
  where id = p_target_session_id
  for update;

  select * into v_source
  from sessions
  where id = p_source_session_id
  for update;

  if v_target.id is null or v_source.id is null then
    return jsonb_build_object('ok', false, 'code', 'session_not_found');
  end if;
  if v_target.revision <> p_expected_target_revision
     or v_source.revision <> p_expected_source_revision then
    return jsonb_build_object('ok', false, 'code', 'revision_conflict');
  end if;
  if coalesce(jsonb_typeof(p_transformed_answers), '') <> 'array' then
    return jsonb_build_object('ok', false, 'code', 'invalid_answers_payload');
  end if;

  perform 1
  from answers
  where session_id in (p_target_session_id, p_source_session_id)
  order by session_id, juror_name
  for update;

  select count(*)::integer into v_source_answer_count
  from answers
  where session_id = p_source_session_id;
  select jsonb_array_length(p_transformed_answers) into v_payload_count;

  if v_payload_count <> v_source_answer_count
     or exists (
       select 1
       from jsonb_array_elements(p_transformed_answers) payload
       where jsonb_typeof(payload -> 'data') <> 'object'
          or coalesce(payload ->> 'jurorName', '') = ''
          or coalesce(payload ->> 'revision', '') !~ '^[0-9]+$'
     )
     or (
       select count(distinct payload ->> 'jurorName')
       from jsonb_array_elements(p_transformed_answers) payload
     ) <> v_payload_count then
    return jsonb_build_object('ok', false, 'code', 'invalid_answers_payload');
  end if;

  if exists (
    select 1
    from answers source_answer
    where source_answer.session_id = p_source_session_id
      and not exists (
        select 1
        from jsonb_array_elements(p_transformed_answers) payload
        where payload ->> 'jurorName' = source_answer.juror_name
          and (payload ->> 'revision')::bigint = source_answer.revision
      )
  ) then
    return jsonb_build_object('ok', false, 'code', 'source_answers_changed');
  end if;

  if exists (
    select 1
    from answers source_answer
    join answers target_answer
      on target_answer.session_id = p_target_session_id
     and target_answer.juror_name = source_answer.juror_name
    where source_answer.session_id = p_source_session_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'duplicate_jurors');
  end if;

  with transformed as (
    select
      payload ->> 'jurorName' as juror_name,
      payload -> 'data' as data
    from jsonb_array_elements(p_transformed_answers) payload
  )
  update answers answer
  set session_id = p_target_session_id,
      data = transformed.data
  from transformed
  where answer.session_id = p_source_session_id
    and answer.juror_name = transformed.juror_name;
  get diagnostics v_moved_answers = row_count;

  if v_moved_answers <> v_source_answer_count then
    raise exception 'session merge answer count mismatch';
  end if;

  update session_slots
  set session_id = p_target_session_id,
      session_name = v_target.name
  where session_id = p_source_session_id;
  get diagnostics v_moved_slots = row_count;

  update sessions
  set juror_count = (
    select count(*)::integer
    from answers
    where session_id = p_target_session_id
  )
  where id = p_target_session_id;

  delete from sessions where id = p_source_session_id;

  return jsonb_build_object(
    'ok', true,
    'movedAnswers', v_moved_answers,
    'movedSlots', v_moved_slots
  );
end;
$$;

revoke all on function merge_sessions(text, text, bigint, bigint, jsonb) from public;
grant execute on function merge_sessions(text, text, bigint, bigint, jsonb) to service_role;
