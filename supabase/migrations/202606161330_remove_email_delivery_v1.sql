-- V1 no longer sends emails. The participant downloads the .ics after signup.

drop table if exists email_logs;

alter table if exists slot_registrations
  drop column if exists confirmation_email_sent_at,
  drop column if exists reminder_email_sent_at,
  drop column if exists cancellation_email_sent_at;
