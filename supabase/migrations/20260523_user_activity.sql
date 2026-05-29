-- Run this in: Supabase Dashboard → SQL Editor
--
-- Also enable anonymous sign-ins:
-- Dashboard → Authentication → Settings → "Enable anonymous sign-ins" → Save

-- ─── User watchlist ───────────────────────────────────────────────────────────
create table if not exists public.user_watchlist (
  user_id       uuid        not null references auth.users on delete cascade,
  pelicula_slug text        not null,
  added_at      timestamptz not null default now(),
  primary key (user_id, pelicula_slug)
);
alter table public.user_watchlist enable row level security;
create policy "user_watchlist_own" on public.user_watchlist
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── User progress ────────────────────────────────────────────────────────────
create table if not exists public.user_progress (
  user_id       uuid        not null references auth.users on delete cascade,
  pelicula_slug text        not null,
  watch_time    float8      not null default 0,
  duration      float8      not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (user_id, pelicula_slug)
);
alter table public.user_progress enable row level security;
create policy "user_progress_own" on public.user_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── User ratings ─────────────────────────────────────────────────────────────
create table if not exists public.user_ratings (
  user_id       uuid        not null references auth.users on delete cascade,
  pelicula_slug text        not null,
  rating        float8      not null,
  review        text        not null default '',
  rated_at      timestamptz not null default now(),
  primary key (user_id, pelicula_slug)
);
alter table public.user_ratings enable row level security;
create policy "user_ratings_own" on public.user_ratings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
