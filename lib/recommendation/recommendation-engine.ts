/**
 * GMA recommendation engine — content-based, no external services.
 *
 * Pipeline:
 *   buildUserAffinity  →  filterSeenAndRecent  →  scoreCandidate  →  diversifyResults
 *                                                              ↓
 *                                                       recommendItems
 *                                                       buildHomeRows
 */

import type { MediaItem } from "@/types/catalog";

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS — change these before touching the algorithm
// ═══════════════════════════════════════════════════════════════════════════

export const REC = {
  // Score blend weights (W_JITTER fills the remainder of 1.0)
  W_CATEGORY: 0.45,   // category overlap is the strongest signal
  W_ARTIST:   0.25,   // shared directors/actors matter
  W_RECENCY:  0.10,   // boost for newer items
  W_POPULAR:  0.05,   // tie-breaker; swap for real view counts when available
  W_JITTER:   0.15,   // session rotation — home feels fresh every visit

  // Events older than this decay toward zero influence
  AFFINITY_DECAY_DAYS: 30,

  // Filtering
  EXCLUDE_SEEN:                true,   // don't re-show completed items
  EXCLUDE_SHOWN_ON_HOME_HOURS: 8,     // suppress items shown on home in last N hours

  // Diversity: no more than this many items from the same primary category per section
  MAX_PER_CATEGORY: 2,

  // Personalisation only kicks in when the user has at least N events
  MIN_EVENTS_TO_PERSONALISE: 2,

  // Home section sizes
  COUNT_BECAUSE_YOU_WATCHED: 8,
  COUNT_NEW_FOR_YOU:         8,
  COUNT_SAME_MOOD:           8,
  COUNT_DEFAULT:             12,

  // Used for year-based recency scoring
  CURRENT_YEAR: new Date().getFullYear(),
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** One interaction record per item per user. Persist to Supabase or localStorage. */
export interface UserEvent {
  /** item.id (slug, e.g. "expanse") */
  itemId: string;
  eventType:
    | "watchedFull"     // user completed the item
    | "watchedPartial"  // user watched a meaningful chunk
    | "viewed"          // user opened the detail page
    | "watchlisted"     // user added to their list
    | "rated"           // user gave a star rating
    | "clicked";        // user tapped the card
  /** 0–1: fraction of the item watched (0 = just clicked, 1 = completed) */
  watchTimeFraction: number;
  /** 1–5 star rating, when the user rated the item */
  rating?: number;
  /** Unix timestamp ms — when this event last occurred */
  lastSeenAt: number;
  /** Unix timestamp ms — last time this item was shown on the home screen */
  shownOnHomeAt?: number;
}

/** Feed this to the engine. Build it with buildUserProfileFromSupabase below. */
export interface UserProfile {
  userId: string;
  events: UserEvent[];
}

/** Internal: computed once per recommendation call. Not exposed directly. */
interface UserAffinity {
  categoryWeights:  Record<string, number>;
  artistWeights:    Record<string, number>;
  viewedIds:        Set<string>;
  shownOnHomeAt:    Record<string, number>; // itemId → last shown timestamp ms
  /** Anchor for "Porque viste…" — the most recently watched item */
  lastWatchedItem:  MediaItem | null;
  /** Anchor for mood row — the user's most-weighted category */
  dominantCategory: string | null;
}

export interface ScoredItem {
  item:  MediaItem;
  score: number;
}

export interface HomeRow {
  /** Display label for the carousel */
  title: string;
  items: MediaItem[];
}

export interface RecommendOptions {
  count: number;
  /** Stable per-session value from sessionStorage — keeps order consistent within a session */
  sessionSeed?:    number;
  /** Set true to include already-watched items (e.g. for a "continue watching" row) */
  includeWatched?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════════════════

// Same seed+index → same value, different seed → different order
function seededRandom(seed: number, i: number): number {
  const x = Math.sin(seed * 9301 + i * 49297 + 233) * 10_000;
  return x - Math.floor(x);
}

// Recommendation seed rotates every 2 hours so home feels different across visits.
// localStorage (not sessionStorage) so it's consistent across tabs but still expires.
function getOrCreateSessionSeed(userId = "anon"): number {
  if (typeof localStorage === "undefined") return Math.random();
  const slot = Math.floor(Date.now() / (2 * 3_600_000)); // 2-hour bucket
  const KEY  = `gma-rec-seed-v3:${userId}:${slot}`;
  const stored = localStorage.getItem(KEY);
  if (stored) return parseFloat(stored);
  // Prune stale keys for this user before writing
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(`gma-rec-seed-v3:${userId}:`) && k !== KEY) localStorage.removeItem(k);
  }
  const seed = Math.random();
  localStorage.setItem(KEY, String(seed));
  return seed;
}

// Title seed is scoped to the browser session (sessionStorage).
// Cleared automatically when the user closes the tab/browser, so each new
// visit to the app gets a fresh title. Stable while navigating within the app.
function getVisitTitleSeed(): number {
  if (typeof sessionStorage === "undefined") return Math.random();
  const KEY = "gma-title-seed-visit";
  const stored = sessionStorage.getItem(KEY);
  if (stored) return parseFloat(stored);
  const seed = Math.random();
  sessionStorage.setItem(KEY, String(seed));
  return seed;
}

// Events from today = weight 1.0; older events decay exponentially toward 0
function recencyDecay(timestampMs: number, halfLifeDays: number): number {
  const ageDays = (Date.now() - timestampMs) / 86_400_000;
  return Math.exp(-ageDays / halfLifeDays);
}

// The "primary category" is used as the diversity bucket
function primaryCategory(item: MediaItem): string {
  return item.categories[0] ?? "unknown";
}

function itemArtistNames(item: MediaItem): string[] {
  return item.artistas?.map((a) => a.name) ?? [];
}

// How much an event type contributes to affinity
const EVENT_TYPE_WEIGHT: Record<UserEvent["eventType"], number> = {
  watchedFull:    1.0,
  rated:          0.9,
  watchedPartial: 0.6,
  watchlisted:    0.4,
  viewed:         0.3,
  clicked:        0.1,
};

// ═══════════════════════════════════════════════════════════════════════════
// 1. buildUserAffinity
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Turns raw event history into weighted preference maps.
 *
 * Each category/artist accumulates weight from every event that involved
 * an item which has that category/artist. Weight = event type × watch fraction
 * × time decay, so a completed item watched last week beats a click from a year ago.
 */
export function buildUserAffinity(
  events:   UserEvent[],
  allItems: readonly MediaItem[],
): UserAffinity {
  const categoryWeights: Record<string, number> = {};
  const artistWeights:   Record<string, number> = {};
  const viewedIds        = new Set<string>();
  const shownOnHomeAt:   Record<string, number> = {};

  const itemById = new Map(allItems.map((item) => [item.id, item]));

  // Sort descending so the first "watched" event we encounter = most recent
  const sortedEvents = [...events].sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  let lastWatchedItem: MediaItem | null = null;

  for (const event of sortedEvents) {
    const item = itemById.get(event.itemId);
    if (!item) continue;

    const typeWeight  = EVENT_TYPE_WEIGHT[event.eventType] ?? 0.1;
    const watchBoost  = event.watchTimeFraction * 0.5;
    // Rating above 3 → positive boost; below 3 → slight negative
    const ratingBoost = event.rating != null ? (event.rating - 3) / 4 : 0;
    const decay       = recencyDecay(event.lastSeenAt, REC.AFFINITY_DECAY_DAYS);
    const weight      = (typeWeight + watchBoost + ratingBoost) * decay;

    // A click alone doesn't count as "viewed" for exclusion purposes
    if (event.eventType !== "clicked") {
      viewedIds.add(item.id);
      if (!lastWatchedItem && event.watchTimeFraction > 0.1) {
        lastWatchedItem = item;
      }
    }

    for (const cat of item.categories) {
      categoryWeights[cat] = (categoryWeights[cat] ?? 0) + weight;
    }
    for (const name of itemArtistNames(item)) {
      artistWeights[name] = (artistWeights[name] ?? 0) + weight;
    }

    if (event.shownOnHomeAt) {
      shownOnHomeAt[item.id] = Math.max(
        shownOnHomeAt[item.id] ?? 0,
        event.shownOnHomeAt,
      );
    }
  }

  const dominantCategory =
    Object.entries(categoryWeights).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;

  return {
    categoryWeights,
    artistWeights,
    viewedIds,
    shownOnHomeAt,
    lastWatchedItem,
    dominantCategory,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. filterSeenAndRecent
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Removes items that should not appear in recommendations.
 * Run this BEFORE scoring so we never waste score budget on hidden items.
 */
export function filterSeenAndRecent(
  items:    readonly MediaItem[],
  affinity: UserAffinity,
  opts: {
    excludeSeen:             boolean;
    excludeShownInLastHours: number;
  },
): MediaItem[] {
  const cutoff = Date.now() - opts.excludeShownInLastHours * 3_600_000;

  return items.filter((item) => {
    if (opts.excludeSeen && affinity.viewedIds.has(item.id)) return false;

    // Suppress items that were already shown on home in the last N hours
    const lastShown = affinity.shownOnHomeAt[item.id];
    if (lastShown && lastShown > cutoff) return false;

    return true;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. scoreCandidate
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Scores one item against the user's affinity profile.
 *
 * popularityProxy: a 0–1 number (e.g. normalised view count, or source-list
 * position as a stand-in until you have real counts).
 */
export function scoreCandidate(
  item:            MediaItem,
  affinity:        UserAffinity,
  seed:            number,
  index:           number,
  popularityProxy: number,
): number {
  // Average category weight across all of this item's categories
  const catScore =
    item.categories.reduce((s, c) => s + (affinity.categoryWeights[c] ?? 0), 0) /
    Math.max(item.categories.length, 1);

  // Average artist weight
  const artists = itemArtistNames(item);
  const artScore =
    artists.length > 0
      ? artists.reduce((s, a) => s + (affinity.artistWeights[a] ?? 0), 0) / artists.length
      : 0;

  // Items from recent years score higher; decays over ~5 years
  const yearDiff    = Math.max(0, REC.CURRENT_YEAR - item.year);
  const recencyScore = Math.exp(-yearDiff / 5);

  // Jitter is seeded: stable within a session, refreshes across sessions
  const jitter = seededRandom(seed, index) * REC.W_JITTER;

  return (
    catScore         * REC.W_CATEGORY +
    artScore         * REC.W_ARTIST   +
    recencyScore     * REC.W_RECENCY  +
    popularityProxy  * REC.W_POPULAR  +
    jitter
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. diversifyResults
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Picks items from a score-sorted list while capping how many items from
 * the same primary category can appear.
 *
 * Tradeoff: stricter cap → more variety, but might push down highly relevant items.
 * The fill pass below prevents gaps when the cap is too aggressive.
 */
export function diversifyResults(
  scored:         ScoredItem[],
  count:          number,
  maxPerCategory: number = REC.MAX_PER_CATEGORY,
): MediaItem[] {
  const selected:      MediaItem[] = [];
  const categoryCount: Record<string, number> = {};

  // First pass: respect the cap
  for (const { item } of scored) {
    if (selected.length >= count) break;
    const cat   = primaryCategory(item);
    const used  = categoryCount[cat] ?? 0;
    if (used >= maxPerCategory) continue;
    selected.push(item);
    categoryCount[cat] = used + 1;
  }

  // Fill pass: relax the cap if we're short
  if (selected.length < count) {
    const selectedIds = new Set(selected.map((i) => i.id));
    for (const { item } of scored) {
      if (selected.length >= count) break;
      if (!selectedIds.has(item.id)) {
        selected.push(item);
        selectedIds.add(item.id);
      }
    }
  }

  return selected;
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. recommendItems — main entry point
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Returns up to `options.count` personalised items, never already watched,
 * never identical-looking batches.
 *
 * Cold start: when the user has no/little history, returns a seeded shuffle
 * that's diverse by category. No personalisation — but the session seed means
 * it still feels different each visit.
 */
export function recommendItems(
  allItems: readonly MediaItem[],
  profile:  UserProfile,
  options:  RecommendOptions,
): MediaItem[] {
  const seed       = options.sessionSeed ?? getOrCreateSessionSeed(profile.userId);
  const affinity   = buildUserAffinity(profile.events, allItems);
  const hasHistory = profile.events.length >= REC.MIN_EVENTS_TO_PERSONALISE;
  const excludeSeen = options.includeWatched !== true && REC.EXCLUDE_SEEN;

  let candidates = filterSeenAndRecent(allItems, affinity, {
    excludeSeen,
    excludeShownInLastHours: REC.EXCLUDE_SHOWN_ON_HOME_HOURS,
  });

  // If filtering leaves us with too little, relax the "shown on home" constraint
  if (candidates.length < options.count) {
    candidates = allItems.filter(
      (item) => !excludeSeen || !affinity.viewedIds.has(item.id),
    );
  }

  if (!hasHistory) {
    return coldStartFallback(candidates, seed, options.count);
  }

  const total = candidates.length;
  const scored: ScoredItem[] = candidates.map((item, i) => ({
    item,
    // Position in the source array as popularity proxy (earlier = more popular)
    score: scoreCandidate(item, affinity, seed, i, 1 - i / Math.max(total - 1, 1)),
  }));

  scored.sort((a, b) => b.score - a.score);
  return diversifyResults(scored, options.count);
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. buildHomeRows
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Produces labelled carousel rows for the home screen.
 *
 *  "Porque viste «X»"   — items that share categories with the last watched item
 *  "Nuevos para ti"     — unseen items from the last 2 years (falls back to personalised)
 *  "Más de <Categoría>" — unseen items in the user's dominant taste category
 *
 * Cold start: returns a single "Lo más destacado" row with a diverse shuffle.
 */
export function buildHomeRows(
  allItems:    readonly MediaItem[],
  profile:     UserProfile,
  sessionSeed?: number,
): HomeRow[] {
  const seed       = sessionSeed ?? getOrCreateSessionSeed(profile.userId);
  const affinity   = buildUserAffinity(profile.events, allItems);
  const hasHistory = profile.events.length >= REC.MIN_EVENTS_TO_PERSONALISE;
  const unseen     = allItems.filter((item) => !affinity.viewedIds.has(item.id));
  const rows: HomeRow[] = [];

  // Tracks which item IDs have already been allocated to a row —
  // prevents the same title appearing in two carousels simultaneously
  const allocatedIds = new Set<string>();

  function allocate(items: MediaItem[]): MediaItem[] {
    const result = items.filter((item) => !allocatedIds.has(item.id));
    for (const item of result) allocatedIds.add(item.id);
    return result;
  }

  // ── "Porque viste «X»" ─────────────────────────────────────────────────
  if (hasHistory && affinity.lastWatchedItem) {
    const anchor        = affinity.lastWatchedItem;
    const anchorCats    = new Set(anchor.categories);
    const anchorArtists = itemArtistNames(anchor);

    const related = allocate(
      unseen
        .map((item, i) => {
          const catOverlap    = item.categories.filter((c) => anchorCats.has(c)).length;
          const artistOverlap = itemArtistNames(item).filter((a) => anchorArtists.includes(a)).length;
          const jitter        = seededRandom(seed, i) * 0.1;
          return { item, score: catOverlap * 0.7 + artistOverlap * 0.3 + jitter };
        })
        // Only include items with at least one category or artist overlap
        .filter(({ score }) => score > 0.1)
        .sort((a, b) => b.score - a.score)
        .slice(0, REC.COUNT_BECAUSE_YOU_WATCHED)
        .map(({ item }) => item),
    );

    if (related.length > 0) {
      rows.push({ title: `Porque viste "${anchor.title}"`, items: related });
    }
  }

  // ── Fila personalizada (título rotativo) ──────────────────────────────
  const NEW_FOR_YOU_TITLES = [
    "Nuevos para ti",
    "Creemos que te va a encantar",
    "Solo para ti",
    "Pensado para ti",
    "Justo lo que buscas",
  ];

  const recentUnseen = unseen
    .filter((item) => REC.CURRENT_YEAR - item.year <= 2)
    .sort((a, b) => b.year - a.year)
    .slice(0, REC.COUNT_NEW_FOR_YOU);

  // Fall back to personalised picks when there aren't enough recent items
  const newForYouItems = allocate(
    recentUnseen.length >= 4
      ? recentUnseen
      : recommendItems(allItems, profile, {
          count:       REC.COUNT_NEW_FOR_YOU,
          sessionSeed: seed,
        }),
  );

  if (newForYouItems.length > 0) {
    const titleSeed = getVisitTitleSeed();
    const newForYouTitle = NEW_FOR_YOU_TITLES[Math.floor(titleSeed * NEW_FOR_YOU_TITLES.length)] ?? NEW_FOR_YOU_TITLES[0]!;
    rows.push({ title: newForYouTitle, items: newForYouItems });
  }

  // ── "Más de <dominantCategory>" ────────────────────────────────────────
  if (hasHistory && affinity.dominantCategory) {
    const mood = affinity.dominantCategory;

    const moodItems = allocate(
      unseen
        .filter((item) => item.categories.includes(mood))
        .map((item, i) => ({ item, score: scoreCandidate(item, affinity, seed, i, 0.5) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, REC.COUNT_SAME_MOOD)
        .map(({ item }) => item),
    );

    if (moodItems.length > 0) {
      rows.push({ title: `Más de ${mood}`, items: moodItems });
    }
  }

  // ── Cold-start fallback ────────────────────────────────────────────────
  if (rows.length === 0) {
    rows.push({
      title: "Lo más destacado",
      items: coldStartFallback(allItems, seed, REC.COUNT_DEFAULT),
    });
  }

  return rows;
}

// ═══════════════════════════════════════════════════════════════════════════
// COLD START
// ═══════════════════════════════════════════════════════════════════════════

function coldStartFallback(
  items: readonly MediaItem[],
  seed:  number,
  count: number,
): MediaItem[] {
  // Seeded shuffle → every session sees a different order, still varied by category
  const shuffled: ScoredItem[] = items.map((item, i) => ({
    item,
    score: seededRandom(seed, i),
  }));
  shuffled.sort((a, b) => b.score - a.score);
  return diversifyResults(shuffled, count);
}

// ═══════════════════════════════════════════════════════════════════════════
// ADAPTER — converts existing GMA Supabase data into UserProfile
// ═══════════════════════════════════════════════════════════════════════════

/** Matches the shape returned by useProgress */
export interface ProgressEntry {
  currentTime: number;   // seconds watched
  completed:   boolean;
  updatedAt:   number;   // Unix ms
}

/**
 * Bridges the data you already have (useProgress + useWatchlist) into a
 * UserProfile the engine understands.
 *
 * allItems is needed to map numericId → slug (item.id).
 *
 * Tradeoff: watchTimeFraction for series is approximate because series don't
 * have a single total duration — we use 1 hour as the "one episode" proxy.
 * Swap for real episode data when available.
 */
export function buildUserProfileFromSupabase(opts: {
  userId:              string;
  allItems:            readonly MediaItem[];
  progressByNumericId: Record<number, ProgressEntry>;
  watchlistNumericIds: number[];
  ratingsBySlug?:      Record<string, number>;
  /** itemSlug → unix-ms timestamp of when it was last shown on the home screen */
  shownOnHome?:        Record<string, number>;
}): UserProfile {
  const { userId, allItems, progressByNumericId, watchlistNumericIds, ratingsBySlug = {}, shownOnHome = {} } = opts;

  const slugByNumericId = new Map(allItems.map((item) => [item.numericId, item.id]));
  const runtimeBySlug   = new Map(
    allItems
      .filter((item): item is MediaItem & { runtime: string } => "runtime" in item)
      .map((item) => [item.id, item.runtime as string]),
  );

  const events: UserEvent[] = [];

  // ── Progress events ────────────────────────────────────────────────────
  for (const [numericIdStr, entry] of Object.entries(progressByNumericId)) {
    const slug = slugByNumericId.get(Number(numericIdStr));
    if (!slug) continue;

    const runtime = runtimeBySlug.get(slug);
    let fraction: number;

    if (runtime) {
      // Movie: compute fraction from parsed duration
      const totalSec = parseDurationSeconds(runtime);
      fraction = totalSec > 0 ? Math.min(entry.currentTime / totalSec, 0.99) : 0.3;
    } else {
      // Series: treat 1 hour as "one episode watched"
      fraction = Math.min(entry.currentTime / 3600, 0.99);
    }

    events.push({
      itemId:            slug,
      eventType:         entry.completed ? "watchedFull" : entry.currentTime > 60 ? "watchedPartial" : "viewed",
      watchTimeFraction: entry.completed ? 1 : fraction,
      lastSeenAt:        entry.updatedAt,
    });
  }

  // ── Watchlist events (only add if no progress event exists) ───────────
  for (const numericId of watchlistNumericIds) {
    const slug = slugByNumericId.get(numericId);
    if (!slug) continue;
    if (events.some((e) => e.itemId === slug)) continue;
    events.push({
      itemId:            slug,
      eventType:         "watchlisted",
      watchTimeFraction: 0,
      lastSeenAt:        Date.now(),
    });
  }

  // ── Rating events (merge into existing progress events when possible) ──
  for (const [slug, rating] of Object.entries(ratingsBySlug)) {
    const existing = events.find((e) => e.itemId === slug);
    if (existing) {
      existing.rating = rating;
    } else {
      events.push({
        itemId:            slug,
        eventType:         "rated",
        watchTimeFraction: 0,
        rating,
        lastSeenAt:        Date.now(),
      });
    }
  }

  // ── Shown-on-home suppression ──────────────────────────────────────────
  for (const [slug, ts] of Object.entries(shownOnHome)) {
    const existing = events.find((e) => e.itemId === slug);
    if (existing) {
      existing.shownOnHomeAt = Math.max(existing.shownOnHomeAt ?? 0, ts);
    } else {
      events.push({
        itemId:            slug,
        eventType:         "clicked",
        watchTimeFraction: 0,
        lastSeenAt:        ts,
        shownOnHomeAt:     ts,
      });
    }
  }

  return { userId, events };
}

// Inline version of parseDuration to keep the engine self-contained
function parseDurationSeconds(runtime: string): number {
  const h = /(\d+)h/.exec(runtime);
  const m = /(\d+)m/.exec(runtime);
  return (h ? parseInt(h[1] ?? "0") * 3600 : 0) + (m ? parseInt(m[1] ?? "0") * 60 : 0);
}
