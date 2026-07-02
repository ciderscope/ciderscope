-- Promote the first waitlisted registration when a confirmed registration is cancelled.
-- Apply after 202607021700_slot_waitlist.sql.

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
  v_promoted slot_registrations%rowtype;
  v_promoted_json jsonb := null;
begin
  v_email := lower(btrim(coalesce(p_participant_email, '')));

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_email');
  end if;

  perform 1
    from session_slots
    where id = p_slot_id
    for update;

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

  if v_registration.registration_status = 'confirmed' then
    with next_waitlist as (
      select id
      from slot_registrations
      where slot_id = p_slot_id
        and status = 'active'
        and registration_status = 'waitlist'
      order by created_at asc
      for update skip locked
      limit 1
    )
    update slot_registrations r
      set registration_status = 'confirmed',
          outlook_invite_last_error = null
      from next_waitlist
      where r.id = next_waitlist.id
      returning r.* into v_promoted;

    if found then
      v_promoted_json := jsonb_build_object(
        'id', v_promoted.id,
        'slot_id', v_promoted.slot_id,
        'participant_name', v_promoted.participant_name,
        'participant_email', v_promoted.participant_email,
        'registration_status', v_promoted.registration_status,
        'outlook_event_id', v_promoted.outlook_event_id
      );
    end if;
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
    ),
    'promoted_registration', v_promoted_json
  );
end;
$$;

revoke all on function cancel_slot_registration(uuid, text) from public;
grant execute on function cancel_slot_registration(uuid, text) to service_role;
