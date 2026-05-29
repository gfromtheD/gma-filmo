-- Fix: create watchlist + ratings tables with correct schema and RLS.
-- Run in: Supabase Dashboard → SQL Editor
--
-- Safe to run multiple times (IF NOT EXISTS / DROP IF EXISTS).

-- ─── Watchlist ────────────────────────────────────────────────────────────────

create table if not exists public.watchlist (
  id          bigint      generated always as identity primary key,
  user_id     uuid        not null references auth.users on delete cascade,
  pelicula_id int         not null,
  added_at    timestamptz not null default now(),
  unique (user_id, pelicula_id)
);

alter table public.watchlist enable row level security;

drop policy if exists "watchlist_own" on public.watchlist;
create policy "watchlist_own" on public.watchlist
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Ratings ──────────────────────────────────────────────────────────────────

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

drop policy if exists "ratings_own" on public.ratings;
create policy "ratings_own" on public.ratings
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
