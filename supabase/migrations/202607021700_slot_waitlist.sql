-- Add waitlist registrations for full physical slots.
-- Apply after 202607021500_immediate_outlook_invitations.sql.

alter table slot_registrations
  add column if not exists registration_status text;

update slot_registrations
set registration_status = 'confirmed'
where registration_status is null;

alter table slot_registrations
  alter column registration_status set default 'confirmed',
  alter column registration_status set not null;

do $$
begin
  alter table slot_registrations
    add constraint slot_registrations_registration_status_check
    check (registration_status in ('confirmed', 'waitlist'));
exception
  when duplicate_object then null;
end;
$$;

create index if not exists slot_registrations_slot_seat_status_idx
  on slot_registrations (slot_id, status, registration_status, created_at);

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
  v_registration_status text;
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
      and status = 'active'
      and registration_status = 'confirmed';

  v_registration_status := case
    when v_count >= v_slot.capacity then 'waitlist'
    else 'confirmed'
  end;

  insert into slot_registrations (
    slot_id,
    participant_name,
    participant_email,
    registration_status,
    outlook_invite_due_at
  )
  values (
    p_slot_id,
    v_name,
    v_email,
    v_registration_status,
    null
  )
  returning * into v_registration;

  return jsonb_build_object(
    'ok', true,
    'places_taken', v_count,
    'capacity', v_slot.capacity,
    'registration', jsonb_build_object(
      'id', v_registration.id,
      'slot_id', v_registration.slot_id,
      'participant_name', v_registration.participant_name,
      'participant_email', v_registration.participant_email,
      'registration_status', v_registration.registration_status,
      'created_at', v_registration.created_at,
      'token', v_registration.token,
      'outlook_event_id', v_registration.outlook_event_id
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

  update slot_registrations
    set status = 'cancelled',
        cancelled_at = now(),
        outlook_invite_status = case
          when outlook_event_id is not null then 'cancel_pending'
          else 'cancelled'
        end,
        outlook_invite_due_at = null
    where slot_id = p_slot_id
      and participant_email = v_email
      and status = 'active'
    returning * into v_registration;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_registered');
  end if;

  return jsonb_build_object(
    'ok', true,
    'registration', jsonb_build_object(
      'id', v_registration.id,
      'slot_id', v_registration.slot_id,
      'participant_name', v_registration.participant_name,
      'participant_email', v_registration.participant_email,
      'registration_status', v_registration.registration_status,
      'cancelled_at', v_registration.cancelled_at,
      'outlook_event_id', v_registration.outlook_event_id
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
          cancelled_at = now(),
          outlook_invite_status = case
            when outlook_event_id is not null then 'cancel_pending'
            else 'cancelled'
          end,
          outlook_invite_due_at = null
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
        'registration_status', registration_status,
        'cancelled_at', cancelled_at,
        'outlook_event_id', outlook_event_id
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
      'session_name', v_slot.session_name,
      'outlook_event_id', v_slot.outlook_event_id
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
