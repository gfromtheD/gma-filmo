-- Creates the `ratings` table that use-ratings.ts reads/writes.
-- Run in: Supabase Dashboard → SQL Editor

create table if not exists public.ratings (
  id          bigint      generated always as identity primary key,
  user_id     uuid        not null references auth.users on delete cascade,
  pelicula_id int         not null,
  score       float8      not null,
  comment     text        not null default '',
  rated_at    timestamptz not null default now(),
  unique (user_id, pelicula_id)
);

alter table public.ratings enable row level security;

create policy "ratings_own" on public.ratings
  for all using  (auth.uid() = user_id)
  with check     (auth.uid() = user_id);
