-- ── review_likes ─────────────────────────────────────────────────────────────
-- One like per (liker, reviewer, film). Users cannot like their own review.

create table if not exists public.review_likes (
  id               bigint      generated always as identity primary key,
  liker_user_id    uuid        not null references auth.users on delete cascade,
  reviewer_user_id uuid        not null references auth.users on delete cascade,
  pelicula_id      int         not null,
  created_at       timestamptz not null default now(),
  unique (liker_user_id, reviewer_user_id, pelicula_id),
  check  (liker_user_id != reviewer_user_id)
);

alter table public.review_likes enable row level security;

create policy "review_likes_read_all"  on public.review_likes
  for select using (true);

create policy "review_likes_write_own" on public.review_likes
  for all
  using      (auth.uid() = liker_user_id)
  with check (auth.uid() = liker_user_id);

-- ── synopsis_proposals ────────────────────────────────────────────────────────
-- Users can submit better synopsis texts for admin review.

create table if not exists public.synopsis_proposals (
  id            bigint      generated always as identity primary key,
  user_id       uuid        not null references auth.users on delete cascade,
  pelicula_id   int         not null,
  proposed_text text        not null,
  created_at    timestamptz not null default now()
);

alter table public.synopsis_proposals enable row level security;

create policy "proposals_insert_own" on public.synopsis_proposals
  for insert with check (auth.uid() = user_id);

create policy "proposals_read_own" on public.synopsis_proposals
  for select using (auth.uid() = user_id);
