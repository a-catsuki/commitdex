-- Commitdex trainer profiles for the Most Wanted wall.
-- Applied remotely as migration commitdex_trainers.

create table if not exists public.commitdex_trainers (
  id bigint generated always as identity primary key,
  github_username text not null,
  github_id bigint,
  avatar_url text,
  persona_title text not null,
  dominant_type text not null,
  league text not null,
  clarity smallint not null,
  effort smallint not null,
  honesty smallint not null,
  chaos smallint not null,
  total_commits_analyzed integer not null,
  predictions jsonb not null default '[]'::jsonb,
  sample_messages jsonb not null default '[]'::jsonb,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists commitdex_trainers_github_username_key
  on public.commitdex_trainers (github_username);

alter table public.commitdex_trainers enable row level security;
