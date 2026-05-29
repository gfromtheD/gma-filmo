# GMA Filmo

> **el cine es nuestro** — A streaming platform for short films by the Generación Maldita community.

GMA Filmo is an open-source web app built to showcase and stream the short-film catalogue of [Generación Maldita](https://generacionmaldita.com). It features multi-profile accounts, a curated catalogue, community ratings, and a full-screen video player backed by Cloudflare R2.

---

## Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Auth & Database | Supabase (PostgreSQL + Row Level Security) |
| Media Storage | Cloudflare R2 (video + images) |
| State management | Zustand |
| Input validation | Zod |
| Deployment target | Vercel |

---

## Features

- **Home** — Featured films and personalised recommendation carousel
- **Catalogue** — Full short-film library with collection and category filters
- **Player** — Full-screen player supporting Cloudflare R2 MP4 and YouTube embeds; remembers watch progress per profile
- **Profiles** — Up to N sub-profiles per account (kids mode, PIN lock, custom avatar)
- **Mi Espacio** — Personal watchlist, view history, and star ratings
- **Community ratings** — Aggregated scores and public reviews per film
- **Search** — Title and author search across the catalogue
- **Auth** — Email/password + Google OAuth via Supabase; guest browsing mode
- **Settings** — Account management, display preferences, account deletion

---

## Requirements

- Node.js 18+
- npm 9+ (or equivalent)
- A [Supabase](https://supabase.com) project
- A [Cloudflare R2](https://developers.cloudflare.com/r2/) bucket (for media assets)

---

## Local setup

```bash
# 1. Clone
git clone https://github.com/your-org/gma-filmo.git
cd gma-filmo

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Open .env.local and fill in the values described below

# 4. Apply database migrations
# Paste each file in supabase/migrations/ into the Supabase SQL Editor and run them
# in chronological order (by filename date prefix)

# 5. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment variables

Copy `.env.example` to `.env.local` and fill in each value:

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL — exposed to the browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key — exposed to the browser |
| `SUPABASE_URL` | Same Supabase project URL, used by server-only admin client |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — **never expose on the client** |
| `NEXT_PUBLIC_R2_PUBLIC_URL` | Base URL of your public Cloudflare R2 bucket (e.g. `https://pub-xxx.r2.dev`) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID (reserved for future direct R2 API use) |
| `CLOUDFLARE_R2_BUCKET` | R2 bucket name (reserved for future use) |
| `CLOUDFLARE_STREAM_CUSTOMER_CODE` | Cloudflare Stream customer subdomain (reserved for future use) |

---

## Database migrations

All schema and seed files live in `supabase/migrations/`. Run them in the **Supabase SQL Editor** in date order:

```text
20260523_user_activity.sql          — watchlist, progress, ratings tables
20260524_ratings_table.sql          — ratings schema refinement
20260524_watchlist_and_ratings.sql  — canonical watchlist + ratings
20260525_profile_isolation.sql      — profile_id column on all user tables
20260526_restore_peliculas.sql      — content seed data
20260526_rls_hardening.sql          — RLS policies for content + profiles tables
20260527_fix_film_scores_security_invoker.sql — fix film_scores view security
```

> All migrations are idempotent and safe to re-run.

---

## Security

- **Row Level Security (RLS)** enabled on all tables. Content tables use public-read policies; user data tables enforce `auth.uid() = user_id`.
- **HTTP security headers** set in `next.config.mjs`: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- **Input validation** with Zod on all API routes.
- **Rate limiting** on all API endpoints (in-process, fixed-window). For multi-instance deployments replace with [@upstash/ratelimit](https://github.com/upstash/ratelimit).
- **Admin client** (`SUPABASE_SERVICE_ROLE_KEY`) used only in server-side API routes that require it; public catalogue queries use the anon key.

Known open items:

- CSP uses `unsafe-inline`/`unsafe-eval` (required by Next.js App Router). Nonce-based hardening is a future improvement.
- Rate limiter is single-instance only; Upstash Redis needed for distributed enforcement.

---

## Roadmap

- [ ] Nonce-based Content Security Policy
- [ ] Distributed rate limiting (Upstash)
- [ ] Supabase type generation (`supabase gen types`) to eliminate schema drift
- [ ] Series / episode support
- [ ] Admin panel for content management
- [ ] Mobile-first UI improvements
- [ ] Improved search (full-text, filters)

---

## License

MIT © 2026 GMA Filmo. See [LICENSE](./LICENSE) for details.
