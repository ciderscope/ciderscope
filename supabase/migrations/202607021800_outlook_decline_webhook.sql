-- Handle Outlook attendee declines pushed by Microsoft Graph webhooks.
-- Apply after 202607021730_promote_waitlist_on_cancel.sql.

alter table slot_registrations
  add column if not exists outlook_response_status text,
  add column if not exists outlook_response_at timestamptz;

create index if not exists slot_registrations_outlook_response_idx
  on slot_registrations (outlook_response_status, outlook_response_at)
  where outlook_response_status is not null;

create or replace function handle_outlook_attendee_decline(
  p_outlook_event_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration slot_registrations%rowtype;
  v_promoted slot_registrations%rowtype;
  v_promoted_json jsonb := null;
begin
  if char_length(btrim(coalesce(p_outlook_event_id, ''))) = 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_event_id');
  end if;

  select *
    into v_registration
    from slot_registrations
    where outlook_event_id = btrim(p_outlook_event_id)
      and status = 'active'
    for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'registration_not_found');
  end if;

  perform 1
    from session_slots
    where id = v_registration.slot_id
    for update;

  update slot_registrations
    set status = 'cancelled',
        cancelled_at = now(),
        outlook_invite_status = 'cancelled',
        outlook_invite_due_at = null,
        outlook_invite_last_error = null,
        outlook_response_status = 'declined',
        outlook_response_at = now()
    where id = v_registration.id
    returning * into v_registration;

  if v_registration.registration_status = 'confirmed' then
    with next_waitlist as (
      select id
      from slot_registrations
      where slot_id = v_registration.slot_id
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

revoke all on function handle_outlook_attendee_decline(text) from public;
grant execute on function handle_outlook_attendee_decline(text) to service_role;
