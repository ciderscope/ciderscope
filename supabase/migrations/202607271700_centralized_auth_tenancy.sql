-- Centralized SSO ownership and direct-link sessions.
-- The provisional IFPC owner id is "ifpc" until the central SSO subject is known.

create extension if not exists pgcrypto;

alter table sessions
  add column if not exists owner_id text,
  add column if not exists owner_name text,
  add column if not exists access_mode text,
  add column if not exists share_token text;

update sessions
set owner_id = coalesce(nullif(btrim(owner_id), ''), 'ifpc'),
    owner_name = coalesce(nullif(btrim(owner_name), ''), 'IFPC'),
    access_mode = coalesce(nullif(btrim(access_mode), ''), 'scheduled'),
    share_token = coalesce(nullif(btrim(share_token), ''), encode(gen_random_bytes(24), 'hex'));

alter table sessions
  alter column owner_id set not null,
  alter column owner_name set not null,
  alter column access_mode set not null,
  alter column access_mode set default 'scheduled',
  alter column share_token set not null,
  alter column share_token set default encode(gen_random_bytes(24), 'hex');

alter table sessions
  drop constraint if exists sessions_access_mode_check;
alter table sessions
  add constraint sessions_access_mode_check check (access_mode in ('scheduled', 'link'));

create unique index if not exists sessions_share_token_key
  on sessions (share_token);
create index if not exists sessions_owner_id_idx
  on sessions (owner_id);

drop index if exists sessions_unique_name_date;
create unique index if not exists sessions_owner_name_date_key
  on sessions (owner_id, date, lower(btrim(name)));

alter table session_slots
  add column if not exists owner_id text;

update session_slots slot
set owner_id = coalesce(
  nullif(btrim(slot.owner_id), ''),
  (select session.owner_id from sessions session where session.id = slot.session_id),
  'ifpc'
);

alter table session_slots
  alter column owner_id set not null;

create index if not exists session_slots_owner_id_idx
  on session_slots (owner_id);
drop index if exists session_slots_one_open_slot_per_day;
create unique index if not exists session_slots_owner_open_day_key
  on session_slots (owner_id, slot_date)
  where deleted_at is null;

drop function if exists claim_juror_identity(text, text, text);
create function claim_juror_identity(
  p_session_id text,
  p_juror_name text,
  p_access_token_hash text,
  p_allow_link_access boolean default false
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
    from sessions session
    where session.id = p_session_id
      and (
        (p_allow_link_access and session.access_mode = 'link')
        or (
          session.access_mode = 'scheduled'
          and exists (
            select 1
            from session_slots slot
            where slot.session_id = p_session_id
              and slot.slot_date = v_today
              and slot.deleted_at is null
          )
        )
      )
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

revoke all on function claim_juror_identity(text, text, text, boolean) from public;
grant execute on function claim_juror_identity(text, text, text, boolean) to service_role;

drop function if exists list_session_catalog();
drop function if exists list_session_catalog(text, text);
create function list_session_catalog(
  p_owner_id text default null,
  p_access_mode text default null
)
returns table (
  id text,
  name text,
  date text,
  juror_count integer,
  results_visible boolean,
  product_count integer,
  question_count integer,
  answer_count bigint,
  owner_id text,
  owner_name text,
  access_mode text,
  share_token text,
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
    s.juror_count,
    s.results_visible,
    coalesce(jsonb_array_length(s.config -> 'products'), 0)::integer,
    coalesce(jsonb_array_length(s.config -> 'questions'), 0)::integer,
    count(a.session_id),
    s.owner_id,
    s.owner_name,
    s.access_mode,
    s.share_token,
    s.created_at
  from sessions s
  left join answers a on a.session_id = s.id
  where (p_owner_id is null or s.owner_id = p_owner_id)
    and (p_access_mode is null or s.access_mode = p_access_mode)
  group by s.id
  order by s.created_at desc;
$$;

revoke all on function list_session_catalog(text, text) from public;
grant execute on function list_session_catalog(text, text) to service_role;
