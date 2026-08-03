-- SensoPlatform — schéma Supabase
-- À exécuter dans l'éditeur SQL de votre projet Supabase

create extension if not exists pgcrypto;

create table if not exists sessions (
  id text primary key,
  owner_id text not null default 'ifpc',
  owner_name text not null default 'IFPC',
  name text not null default '',
  date text default '',
  active boolean default false,
  juror_count int default 0,
  config jsonb not null default '{}'::jsonb,
  analysis_settings jsonb not null default '{}'::jsonb,
  results_visible boolean default false,
  access_mode text not null default 'scheduled' check (access_mode in ('scheduled', 'link')),
  share_token text not null default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz default now()
);

-- Migration idempotente : ajouter la colonne sur les bases existantes.
alter table sessions add column if not exists analysis_settings jsonb not null default '{}'::jsonb;
alter table sessions add column if not exists results_visible boolean default false;
alter table sessions add column if not exists owner_id text;
alter table sessions add column if not exists owner_name text;
alter table sessions add column if not exists access_mode text;
alter table sessions add column if not exists share_token text;

create table if not exists answers (
  session_id text references sessions(id) on delete cascade,
  juror_name text not null,
  data jsonb default '{}'::jsonb,
  updated_at timestamptz default now(),
  primary key (session_id, juror_name)
);

-- Les navigateurs n'accèdent jamais directement à ces tables. Les routes serveur
-- utilisent la clé service_role et les RPC de la migration de durcissement.
alter table sessions enable row level security;
alter table answers enable row level security;

revoke all on table sessions from anon, authenticated;
revoke all on table answers from anon, authenticated;

-- Appliquer ensuite toutes les migrations de `supabase/migrations`, notamment
-- `202607171200_security_hardening.sql` (jetons de reprise, verrouillage optimiste,
-- quota d'inscription et RPC serveur).
-- Appliquer enfin `202607271700_centralized_auth_tenancy.sql`.
