-- Outlook calendar invitations for slot registrations.
-- Apply after 202606161130_session_slots.sql.

alter table session_slots
  add column if not exists outlook_event_id text,
  add column if not exists outlook_event_created_at timestamptz,
  add column if not exists outlook_event_updated_at timestamptz;

alter table slot_registrations
  add column if not exists outlook_invite_status text,
  add column if not exists outlook_invite_due_at timestamptz,
  add column if not exists outlook_invite_attempts integer,
  add column if not exists outlook_invite_sent_at timestamptz,
  add column if not exists outlook_event_id text,
  add column if not exists outlook_invite_last_error text;

update slot_registrations
set outlook_invite_status = case
      when status = 'cancelled' then 'cancelled'
      else 'pending'
    end,
    outlook_invite_due_at = case
      when status = 'cancelled' then null
      else now() + interval '15 minutes'
    end,
    outlook_invite_attempts = 0
where outlook_invite_status is null;

alter table slot_registrations
  alter column outlook_invite_status set default 'pending',
  alter column outlook_invite_status set not null,
  alter column outlook_invite_due_at set default (now() + interval '15 minutes'),
  alter column outlook_invite_attempts set default 0,
  alter column outlook_invite_attempts set not null;

do $$
begin
  alter table slot_registrations
    add constraint slot_registrations_outlook_invite_status_check
    check (
      outlook_invite_status in (
        'pending',
        'sending',
        'sent',
        'failed',
        'cancel_pending',
        'cancel_sending',
        'cancelled',
        'cancel_failed'
      )
    );
exception
  when duplicate_object then null;
end;
$$;

create index if not exists slot_registrations_outlook_due_idx
  on slot_registrations (outlook_invite_status, outlook_invite_due_at)
  where outlook_invite_status in ('pending', 'sending', 'failed', 'cancel_pending', 'cancel_sending', 'cancel_failed');

create index if not exists slot_registrations_outlook_event_idx
  on slot_registrations (outlook_event_id)
  where outlook_event_id is not null;

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
        outlook_invite_due_at = case
          when outlook_event_id is not null then now()
          else outlook_invite_due_at
        end
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
          cancelled_at = now(),
          outlook_invite_status = case
            when outlook_event_id is not null then 'cancel_pending'
            else 'cancelled'
          end,
          outlook_invite_due_at = case
            when outlook_event_id is not null then now()
            else outlook_invite_due_at
          end
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
      'session_name', v_slot.session_name,
      'outlook_event_id', v_slot.outlook_event_id
    ),
    'registrations', v_registrations
  );
end;
$$;

create or replace function claim_due_outlook_invitations(
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  with due as (
    select
      r.id,
      s.slot_date,
      s.session_name,
      s.outlook_event_id as slot_outlook_event_id
    from slot_registrations r
    join session_slots s on s.id = r.slot_id
    where r.status = 'active'
      and (
        (r.outlook_invite_status in ('pending', 'failed') and r.outlook_invite_due_at <= now())
        or (r.outlook_invite_status = 'sending' and r.outlook_invite_due_at <= now() - interval '30 minutes')
      )
      and s.deleted_at is null
    order by r.outlook_invite_due_at asc, r.created_at asc
    for update of r skip locked
    limit greatest(1, least(coalesce(p_limit, 100), 500))
  ),
  claimed as (
    update slot_registrations r
      set outlook_invite_status = 'sending',
          outlook_invite_attempts = r.outlook_invite_attempts + 1,
          outlook_invite_last_error = null
      from due
      where r.id = due.id
      returning
        r.id,
        r.slot_id,
        r.participant_name,
        r.participant_email,
        r.outlook_event_id,
        r.outlook_invite_attempts,
        due.slot_date,
        due.session_name,
        due.slot_outlook_event_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id::text,
        'slotId', slot_id::text,
        'participantName', participant_name,
        'participantEmail', participant_email,
        'outlookEventId', outlook_event_id,
        'attempts', outlook_invite_attempts,
        'slot', jsonb_build_object(
          'id', slot_id::text,
          'slotDate', slot_date::text,
          'sessionName', session_name,
          'outlookEventId', slot_outlook_event_id
        )
      )
    ),
    '[]'::jsonb
  )
  into v_result
  from claimed;

  return v_result;
end;
$$;

create or replace function claim_due_outlook_cancellations(
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  with due as (
    select
      r.id,
      s.slot_date,
      s.session_name,
      s.outlook_event_id as slot_outlook_event_id
    from slot_registrations r
    join session_slots s on s.id = r.slot_id
    where r.status = 'cancelled'
      and (
        (r.outlook_invite_status in ('cancel_pending', 'cancel_failed') and r.outlook_invite_due_at <= now())
        or (r.outlook_invite_status = 'cancel_sending' and r.outlook_invite_due_at <= now() - interval '30 minutes')
      )
      and r.outlook_event_id is not null
    order by r.outlook_invite_due_at asc, r.cancelled_at asc
    for update of r skip locked
    limit greatest(1, least(coalesce(p_limit, 100), 500))
  ),
  claimed as (
    update slot_registrations r
      set outlook_invite_status = 'cancel_sending',
          outlook_invite_attempts = r.outlook_invite_attempts + 1,
          outlook_invite_last_error = null
      from due
      where r.id = due.id
      returning
        r.id,
        r.slot_id,
        r.participant_name,
        r.participant_email,
        r.outlook_event_id,
        r.outlook_invite_attempts,
        due.slot_date,
        due.session_name,
        due.slot_outlook_event_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id::text,
        'slotId', slot_id::text,
        'participantName', participant_name,
        'participantEmail', participant_email,
        'outlookEventId', outlook_event_id,
        'attempts', outlook_invite_attempts,
        'slot', jsonb_build_object(
          'id', slot_id::text,
          'slotDate', slot_date::text,
          'sessionName', session_name,
          'outlookEventId', slot_outlook_event_id
        )
      )
    ),
    '[]'::jsonb
  )
  into v_result
  from claimed;

  return v_result;
end;
$$;

revoke all on function cancel_slot_registration(uuid, text) from public;
revoke all on function delete_session_slot(uuid, text) from public;
revoke all on function claim_due_outlook_invitations(integer) from public;
revoke all on function claim_due_outlook_cancellations(integer) from public;

grant execute on function cancel_slot_registration(uuid, text) to service_role;
grant execute on function delete_session_slot(uuid, text) to service_role;
grant execute on function claim_due_outlook_invitations(integer) to service_role;
grant execute on function claim_due_outlook_cancellations(integer) to service_role;
