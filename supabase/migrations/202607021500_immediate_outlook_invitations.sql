-- Switch Outlook invitations from scheduled queue processing to immediate per-registration sends.
-- Apply after 202607021330_remove_ics_fallback.sql.

drop index if exists slot_registrations_outlook_due_idx;

drop function if exists claim_due_outlook_invitations(integer);
drop function if exists claim_due_outlook_cancellations(integer);

alter table slot_registrations
  alter column outlook_invite_due_at drop default;

update slot_registrations
set outlook_invite_due_at = null
where outlook_invite_due_at is not null;

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

revoke all on function cancel_slot_registration(uuid, text) from public;
revoke all on function delete_session_slot(uuid, text) from public;

grant execute on function cancel_slot_registration(uuid, text) to service_role;
grant execute on function delete_session_slot(uuid, text) to service_role;
