-- Session slot signups for CiderScope.
-- Run this migration in Supabase SQL editor or via the Supabase CLI.

create extension if not exists pgcrypto;

create table if not exists email_domain_whitelist (
  id uuid primary key default gen_random_uuid(),
  domain text not null,
  created_by text,
  created_at timestamptz not null default now(),
  constraint email_domain_whitelist_domain_not_blank check (char_length(btrim(domain)) > 0),
  constraint email_domain_whitelist_domain_normalized check (domain = lower(btrim(domain)))
);

create unique index if not exists email_domain_whitelist_domain_key
  on email_domain_whitelist (domain);

insert into email_domain_whitelist (domain, created_by)
values ('ifpc.eu', 'migration')
on conflict (domain) do nothing;

create table if not exists session_slots (
  id uuid primary key default gen_random_uuid(),
  slot_date date not null,
  start_time time not null default time '11:30',
  end_time time not null default time '12:30',
  timezone text not null default 'Europe/Paris',
  capacity integer not null default 10,
  session_id text references sessions(id) on delete set null,
  session_name text not null,
  created_by text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint session_slots_fixed_start_time check (start_time = time '11:30'),
  constraint session_slots_fixed_end_time check (end_time = time '12:30'),
  constraint session_slots_fixed_timezone check (timezone = 'Europe/Paris'),
  constraint session_slots_fixed_capacity check (capacity = 10),
  constraint session_slots_session_name_required check (char_length(btrim(session_name)) > 0)
);

create unique index if not exists session_slots_one_open_slot_per_day
  on session_slots (slot_date)
  where deleted_at is null;

create index if not exists session_slots_slot_date_idx
  on session_slots (slot_date);

create table if not exists slot_registrations (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references session_slots(id) on delete cascade,
  participant_name text not null,
  participant_email text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  token text not null default encode(gen_random_bytes(16), 'hex'),
  constraint slot_registrations_status_check check (status in ('active', 'cancelled')),
  constraint slot_registrations_name_required check (char_length(btrim(participant_name)) > 0),
  constraint slot_registrations_email_required check (char_length(btrim(participant_email)) > 0),
  constraint slot_registrations_email_normalized check (participant_email = lower(btrim(participant_email)))
);

create unique index if not exists slot_registrations_token_key
  on slot_registrations (token);

create unique index if not exists slot_registrations_unique_active_email
  on slot_registrations (slot_id, participant_email)
  where status = 'active';

create index if not exists slot_registrations_slot_status_idx
  on slot_registrations (slot_id, status);

alter table email_domain_whitelist enable row level security;
alter table session_slots enable row level security;
alter table slot_registrations enable row level security;

create or replace function register_slot_participant(
  p_slot_id uuid,
  p_participant_name text,
  p_participant_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot session_slots%rowtype;
  v_email text;
  v_domain text;
  v_name text;
  v_count integer;
  v_existing slot_registrations%rowtype;
  v_registration slot_registrations%rowtype;
begin
  v_email := lower(btrim(coalesce(p_participant_email, '')));
  v_name := btrim(coalesce(p_participant_name, ''));

  if char_length(v_name) = 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_name');
  end if;

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_email');
  end if;

  v_domain := lower(split_part(v_email, '@', 2));
  if not exists (select 1 from email_domain_whitelist where domain = v_domain) then
    return jsonb_build_object('ok', false, 'code', 'domain_not_allowed', 'domain', v_domain);
  end if;

  select *
    into v_slot
    from session_slots
    where id = p_slot_id
    for update;

  if not found or v_slot.deleted_at is not null then
    return jsonb_build_object('ok', false, 'code', 'slot_not_found');
  end if;

  select *
    into v_existing
    from slot_registrations
    where slot_id = p_slot_id
      and participant_email = v_email
      and status = 'active'
    limit 1;

  if found then
    return jsonb_build_object(
      'ok', false,
      'code', 'already_registered',
      'participant_name', v_existing.participant_name
    );
  end if;

  select count(*)
    into v_count
    from slot_registrations
    where slot_id = p_slot_id
      and status = 'active';

  if v_count >= v_slot.capacity then
    return jsonb_build_object(
      'ok', false,
      'code', 'slot_full',
      'places_taken', v_count,
      'capacity', v_slot.capacity
    );
  end if;

  insert into slot_registrations (slot_id, participant_name, participant_email)
  values (p_slot_id, v_name, v_email)
  returning * into v_registration;

  return jsonb_build_object(
    'ok', true,
    'registration', jsonb_build_object(
      'id', v_registration.id,
      'slot_id', v_registration.slot_id,
      'participant_name', v_registration.participant_name,
      'participant_email', v_registration.participant_email,
      'created_at', v_registration.created_at,
      'token', v_registration.token
    )
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'already_registered');
end;
$$;

create or replace function cancel_slot_registration(
  p_slot_id uuid,
  p_participant_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_registration slot_registrations%rowtype;
begin
  v_email := lower(btrim(coalesce(p_participant_email, '')));

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_email');
  end if;

  select *
    into v_registration
    from slot_registrations
    where slot_id = p_slot_id
      and participant_email = v_email
      and status = 'active'
    for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_registered');
  end if;

  update slot_registrations
    set status = 'cancelled',
        cancelled_at = now()
    where id = v_registration.id
    returning * into v_registration;

  return jsonb_build_object(
    'ok', true,
    'registration', jsonb_build_object(
      'id', v_registration.id,
      'slot_id', v_registration.slot_id,
      'participant_name', v_registration.participant_name,
      'participant_email', v_registration.participant_email,
      'cancelled_at', v_registration.cancelled_at
    )
  );
end;
$$;

create or replace function delete_session_slot(
  p_slot_id uuid,
  p_deleted_by text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot session_slots%rowtype;
  v_registrations jsonb;
begin
  select *
    into v_slot
    from session_slots
    where id = p_slot_id
    for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'slot_not_found');
  end if;

  if v_slot.deleted_at is not null then
    return jsonb_build_object('ok', false, 'code', 'slot_already_deleted');
  end if;

  update session_slots
    set deleted_at = now(),
        created_by = coalesce(created_by, p_deleted_by)
    where id = p_slot_id
    returning * into v_slot;

  with cancelled as (
    update slot_registrations
      set status = 'cancelled',
          cancelled_at = now()
      where slot_id = p_slot_id
        and status = 'active'
      returning *
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'slot_id', slot_id,
        'participant_name', participant_name,
        'participant_email', participant_email,
        'cancelled_at', cancelled_at
      )
    ),
    '[]'::jsonb
  )
  into v_registrations
  from cancelled;

  return jsonb_build_object(
    'ok', true,
    'slot', jsonb_build_object(
      'id', v_slot.id,
      'slot_date', v_slot.slot_date,
      'session_id', v_slot.session_id,
      'session_name', v_slot.session_name
    ),
    'registrations', v_registrations
  );
end;
$$;

revoke all on function register_slot_participant(uuid, text, text) from public;
revoke all on function cancel_slot_registration(uuid, text) from public;
revoke all on function delete_session_slot(uuid, text) from public;

grant execute on function register_slot_participant(uuid, text, text) to service_role;
grant execute on function cancel_slot_registration(uuid, text) to service_role;
grant execute on function delete_session_slot(uuid, text) to service_role;
