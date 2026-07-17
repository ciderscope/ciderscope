-- Remove the former ICS fallback status and route all active slot registrations to Outlook.

update slot_registrations
set outlook_invite_status = case
      when status = 'cancelled' then 'cancelled'
      else 'pending'
    end,
    outlook_invite_due_at = case
      when status = 'cancelled' then null
      else coalesce(outlook_invite_due_at, now() + interval '15 minutes')
    end,
    outlook_invite_last_error = null
where outlook_invite_status = 'legacy_ics';

alter table slot_registrations
  drop constraint if exists slot_registrations_outlook_invite_status_check;

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
