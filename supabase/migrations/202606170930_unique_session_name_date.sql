-- Prevent duplicate sessions with the same normalized name on the same internal date.
-- If this migration fails, remove or rename existing duplicates first.

create unique index if not exists sessions_unique_name_date
  on sessions (date, lower(btrim(name)));
