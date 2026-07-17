-- Security hardening for sessions, juror answers and public slot registrations.
-- Apply after 202607021800_outlook_decline_webhook.sql.

alter table sessions
  add column if not exists revision bigint not null default 0,
  add column if not exists updated_at timestamptz not null default now();

alter table answers
  add column if not exists access_token_hash text,
  add column if not exists revision bigint not null default 0;

create unique index if not exists answers_access_token_hash_key
  on answers (access_token_hash)
  where access_token_hash is not null;

create index if not exists session_slots_session_date_active_idx
  on session_slots (session_id, slot_date)
  where deleted_at is null;

create table if not exists slot_registration_rate_limits (
  rate_date date not null,
  participant_email text not null,
  attempts integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (rate_date, participant_email),
  constraint slot_registration_rate_limits_attempts_positive check (attempts >= 0)
);

alter table slot_registration_rate_limits enable row level security;

create or replace function bump_session_revision()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if new.name is distinct from old.name
     or new.date is distinct from old.date
     or new.config is distinct from old.config then
    new.revision := old.revision + 1;
  else
    new.revision := old.revision;
  end if;
  return new;
end;
$$;

drop trigger if exists sessions_bump_revision on sessions;
create trigger sessions_bump_revision
before update on sessions
for each row execute function bump_session_revision();

create or replace function bump_answer_revision()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists answers_bump_revision on answers;
create trigger answers_bump_revision
before update on answers
for each row execute function bump_answer_revision();

create or replace function sync_session_juror_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id text;
begin
  v_session_id := case when tg_op = 'DELETE' then old.session_id else new.session_id end;
  update sessions
    set juror_count = (
      select count(*)::integer
      from answers
      where session_id = v_session_id
    )
    where id = v_session_id;
  return null;
end;
$$;

drop trigger if exists answers_sync_session_juror_count on answers;
create trigger answers_sync_session_juror_count
after insert or delete on answers
for each row execute function sync_session_juror_count();

create or replace function consume_slot_registration_quota(
  p_participant_email text,
  p_requested integer,
  p_daily_limit integer default 20
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_participant_email, '')));
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_attempts integer;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or p_requested <= 0
     or p_daily_limit <= 0
     or p_requested > p_daily_limit then
    return false;
  end if;

  delete from slot_registration_rate_limits
    where rate_date < v_today - 31;

  insert into slot_registration_rate_limits (rate_date, participant_email, attempts)
  values (v_today, v_email, p_requested)
  on conflict (rate_date, participant_email) do update
    set attempts = slot_registration_rate_limits.attempts + excluded.attempts,
        updated_at = now()
    where slot_registration_rate_limits.attempts + excluded.attempts <= p_daily_limit
  returning attempts into v_attempts;

  return found and v_attempts <= p_daily_limit;
end;
$$;

create or replace function claim_juror_identity(
  p_session_id text,
  p_juror_name text,
  p_access_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_juror_name, ''));
  v_answer answers%rowtype;
  v_today date := (now() at time zone 'Europe/Paris')::date;
begin
  if char_length(v_name) < 1 or char_length(v_name) > 80 then
    return jsonb_build_object('ok', false, 'code', 'invalid_name');
  end if;
  if p_access_token_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_token');
  end if;
  if not exists (
    select 1
    from session_slots
    where session_id = p_session_id
      and slot_date = v_today
      and deleted_at is null
  ) then
    return jsonb_build_object('ok', false, 'code', 'session_inactive');
  end if;

  select * into v_answer
  from answers
  where session_id = p_session_id and juror_name = v_name
  for update;

  if not found then
    insert into answers (session_id, juror_name, data, access_token_hash)
    values (p_session_id, v_name, '{}'::jsonb, p_access_token_hash)
    returning * into v_answer;
  elsif v_answer.access_token_hash is null then
    -- One-time, backward-compatible claim for answers created before this migration.
    update answers
      set access_token_hash = p_access_token_hash
      where session_id = p_session_id and juror_name = v_name
      returning * into v_answer;
  elsif v_answer.access_token_hash <> p_access_token_hash then
    return jsonb_build_object('ok', false, 'code', 'identity_in_use');
  end if;

  return jsonb_build_object(
    'ok', true,
    'data', coalesce(v_answer.data, '{}'::jsonb),
    'revision', v_answer.revision
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'identity_in_use');
end;
$$;

create or replace function save_juror_answers(
  p_session_id text,
  p_juror_name text,
  p_access_token_hash text,
  p_data jsonb,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_answer answers%rowtype;
begin
  update answers
    set data = coalesce(p_data, '{}'::jsonb)
    where session_id = p_session_id
      and juror_name = btrim(p_juror_name)
      and access_token_hash = p_access_token_hash
      and revision = p_expected_revision
    returning * into v_answer;

  if found then
    return jsonb_build_object('ok', true, 'revision', v_answer.revision);
  end if;

  select * into v_answer
  from answers
  where session_id = p_session_id
    and juror_name = btrim(p_juror_name)
    and access_token_hash = p_access_token_hash;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  return jsonb_build_object(
    'ok', false,
    'code', 'revision_conflict',
    'revision', v_answer.revision,
    'data', coalesce(v_answer.data, '{}'::jsonb)
  );
end;
$$;

create or replace function claim_juror_poste(
  p_session_id text,
  p_juror_name text,
  p_access_token_hash text,
  p_day text,
  p_num integer,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_answer answers%rowtype;
begin
  if p_day not in ('mardi', 'jeudi') or p_num < 1 or p_num > 12 then
    return jsonb_build_object('ok', false, 'code', 'invalid_poste');
  end if;

  perform pg_advisory_xact_lock(hashtext(p_session_id));

  if exists (
    select 1
    from answers
    where session_id = p_session_id
      and juror_name <> btrim(p_juror_name)
      and data #>> '{_poste,day}' = p_day
      and data #>> '{_poste,num}' = p_num::text
  ) then
    return jsonb_build_object('ok', false, 'code', 'poste_taken');
  end if;

  update answers
    set data = coalesce(data, '{}'::jsonb) || jsonb_build_object(
      '_poste', jsonb_build_object('day', p_day, 'num', p_num)
    )
    where session_id = p_session_id
      and juror_name = btrim(p_juror_name)
      and access_token_hash = p_access_token_hash
      and revision = p_expected_revision
    returning * into v_answer;

  if found then
    return jsonb_build_object(
      'ok', true,
      'data', v_answer.data,
      'revision', v_answer.revision
    );
  end if;

  return jsonb_build_object('ok', false, 'code', 'revision_conflict');
end;
$$;

create or replace function list_session_catalog()
returns table (
  id text,
  name text,
  date text,
  juror_count integer,
  results_visible boolean,
  product_count integer,
  question_count integer,
  answer_count bigint,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.name,
    s.date,
    coalesce(s.juror_count, 0),
    coalesce(s.results_visible, false),
    coalesce(jsonb_array_length(s.config -> 'products'), 0),
    coalesce(jsonb_array_length(s.config -> 'questions'), 0),
    count(a.session_id),
    s.created_at
  from sessions s
  left join answers a on a.session_id = s.id
  group by s.id
  order by s.created_at desc;
$$;

create or replace function list_occupied_postes(p_session_id text)
returns table (juror_name text, day text, num integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.juror_name,
    a.data #>> '{_poste,day}' as day,
    p.poste_num as num
  from answers a
  cross join lateral (
    select case
      when (a.data #>> '{_poste,num}') ~ '^[0-9]+$'
      then (a.data #>> '{_poste,num}')::integer
    end as poste_num
  ) p
  where a.session_id = p_session_id
    and a.data #>> '{_poste,day}' in ('mardi', 'jeudi')
    and p.poste_num between 1 and 12;
$$;

-- The browser must no longer access session configurations or juror answers directly.
drop policy if exists "Lecture publique sessions" on sessions;
drop policy if exists "Écriture publique sessions" on sessions;
drop policy if exists "Lecture publique answers" on answers;
drop policy if exists "Écriture publique answers" on answers;

revoke all on table sessions from anon, authenticated;
revoke all on table answers from anon, authenticated;
revoke all on table slot_registration_rate_limits from anon, authenticated;

revoke all on function consume_slot_registration_quota(text, integer, integer) from public;
revoke all on function claim_juror_identity(text, text, text) from public;
revoke all on function save_juror_answers(text, text, text, jsonb, bigint) from public;
revoke all on function claim_juror_poste(text, text, text, text, integer, bigint) from public;
revoke all on function list_session_catalog() from public;
revoke all on function list_occupied_postes(text) from public;
revoke all on function bump_session_revision() from public;
revoke all on function bump_answer_revision() from public;
revoke all on function sync_session_juror_count() from public;

grant execute on function consume_slot_registration_quota(text, integer, integer) to service_role;
grant execute on function claim_juror_identity(text, text, text) to service_role;
grant execute on function save_juror_answers(text, text, text, jsonb, bigint) to service_role;
grant execute on function claim_juror_poste(text, text, text, text, integer, bigint) to service_role;
grant execute on function list_session_catalog() to service_role;
grant execute on function list_occupied_postes(text) to service_role;
