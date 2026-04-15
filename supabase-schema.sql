-- SensoPlatform — schéma Supabase
-- À exécuter dans l'éditeur SQL de votre projet Supabase

create table if not exists sessions (
  id text primary key,
  name text not null default '',
  date text default '',
  active boolean default false,
  juror_count int default 0,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists answers (
  session_id text references sessions(id) on delete cascade,
  juror_name text not null,
  data jsonb default '{}'::jsonb,
  updated_at timestamptz default now(),
  primary key (session_id, juror_name)
);

-- Activer Row Level Security (optionnel : à configurer selon vos besoins)
alter table sessions enable row level security;
alter table answers enable row level security;

-- Politique ouverte (à restreindre selon vos besoins d'authentification)
create policy "Lecture publique sessions" on sessions for select using (true);
create policy "Écriture publique sessions" on sessions for all using (true);
create policy "Lecture publique answers" on answers for select using (true);
create policy "Écriture publique answers" on answers for all using (true);
