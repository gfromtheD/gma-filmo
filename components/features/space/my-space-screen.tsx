"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Pencil, Trash2 } from "lucide-react";
import { GmaIcon } from "@/components/ui/gma-icon";
import { PosterArt } from "@/components/ui/poster-art";
import { useWatchlist } from "@/hooks/use-watchlist";
import { useProgress } from "@/hooks/use-progress";
import { parseDuration } from "@/lib/utils";
import { useRatings, type RatingEntry } from "@/hooks/use-ratings";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useActiveProfileDisplay } from "@/hooks/use-active-profile-display";
import { ProfileEditModal, type SubProfileValues } from "@/components/features/profiles/profile-edit-modal";
import { renderAvatar, COLOR_VALUES, type AvatarColor } from "@/lib/data/profile-avatars";
import { useProfileStore } from "@/store/use-profile-store";
import type { MovieMedia } from "@/types/catalog";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONO: React.CSSProperties = {
  fontFamily: "ui-monospace, 'Cascadia Code', monospace",
};

const STAR_PATH =
  "M12 2 L15.09 8.26 L22 9.27 L17 14.14 L18.18 21.02 L12 17.77 L5.82 21.02 L7 14.14 L2 9.27 L8.91 8.26 Z";

const RATING_LABELS: Record<number, string> = {
  0.5: "No me gustó nada",  1: "Muy malo",       1.5: "Malo",
  2:   "Regular",           2.5: "Pasable",       3:   "Bien",
  3.5: "Bastante bien",     4:   "Muy bueno",     4.5: "Excelente",
  5:   "Obra maestra",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMemberSince(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

function topGenres(items: readonly MovieMedia[]): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const cat of item.categories) counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([g]) => g);
}

function groupDiaryByMonth(
  items: MovieMedia[],
  entries: Record<number, RatingEntry>,
): [string, MovieMedia[]][] {
  const groups = new Map<string, MovieMedia[]>();
  for (const item of items) {
    const ts = entries[item.numericId]?.ratedAt ?? 0;
    const d  = new Date(ts);
    // e.g. "mayo 2026"
    const key = d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return Array.from(groups.entries());
}

// ─── Stars (shared) ───────────────────────────────────────────────────────────

function StarGlyph({ fill, size }: { fill: number; size: number }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 24 24">
        <path d={STAR_PATH} fill="#2A2A2A" />
      </svg>
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${Math.min(1, Math.max(0, fill)) * 100}%` }}>
        <svg width={size} height={size} viewBox="0 0 24 24">
          <path d={STAR_PATH} fill="#22B16B" />
        </svg>
      </div>
    </div>
  );
}

function StarRating({
  value, onChange, readOnly = false, size = 18, gap = 2,
}: {
  value: number; onChange?: (v: number) => void;
  readOnly?: boolean; size?: number; gap?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const displayed = hover ?? value;
  return (
    <div className="flex items-center" style={{ gap }} onMouseLeave={() => !readOnly && setHover(null)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = Math.min(1, Math.max(0, displayed - (star - 1)));
        return (
          <div
            key={star}
            className={readOnly ? "" : "cursor-pointer"}
            onMouseMove={readOnly ? undefined : (e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setHover(e.clientX < r.left + r.width / 2 ? star - 0.5 : star);
            }}
            onClick={readOnly ? undefined : (e) => {
              const r = e.currentTarget.getBoundingClientRect();
              onChange?.(e.clientX < r.left + r.width / 2 ? star - 0.5 : star);
            }}
          >
            <StarGlyph fill={fill} size={size} />
          </div>
        );
      })}
    </div>
  );
}

// ─── Rating modal ─────────────────────────────────────────────────────────────

function RatingModal({
  item, existing, onSave, onClose,
}: {
  item: MovieMedia; existing: RatingEntry | null;
  onSave: (rating: number, review: string) => void; onClose: () => void;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [review, setReview] = useState(existing?.review ?? "");

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-[480px] rounded-[16px] border border-[#262626] p-6"
        style={{ background: "#0D0D0D", animation: "modalIn 0.25s ease both" }}
      >
        <div className="mb-5 flex items-center gap-4">
          <div className="shrink-0 overflow-hidden rounded-[6px]" style={{ width: 48, aspectRatio: "2/3" }}>
            {item.imageUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
              : <PosterArt style={item.style} title="" kind="movie" ratio="portrait" />}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[16px] font-extrabold text-white">{item.title}</h3>
            <p className="text-[12px] text-[#6D7D94]">
              Cortometraje{item.year ? ` · ${item.year}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#5A6A7E] transition-colors hover:bg-[#1A1A1A] hover:text-white">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="mb-5">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[.1em] text-[#5A6A7E]">Valoración</p>
          <StarRating value={rating} onChange={setRating} size={30} gap={6} />
          <p className="mt-2 h-4 text-[12px] text-[#22B16B]">{rating > 0 ? RATING_LABELS[rating] : ""}</p>
        </div>

        <div className="mb-5">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[.1em] text-[#5A6A7E]">
            Reseña <span className="normal-case font-normal text-[#3A3A3A]">(opcional)</span>
          </p>
          <textarea
            value={review} onChange={(e) => setReview(e.target.value)}
            placeholder="¿Qué te pareció?" rows={3}
            className="w-full resize-none rounded-[10px] border border-[#262626] bg-[#141414] px-4 py-3 text-[13px] text-white placeholder-[#5A6A7E] outline-none transition-[border-color] duration-150 focus:border-[#22B16B]/50"
          />
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-full border border-[#262626] py-2.5 text-[13px] font-semibold text-[#8A9BB0] transition-colors hover:border-[#3A3A3A] hover:text-white">
            Cancelar
          </button>
          <button type="button" disabled={rating === 0}
            onClick={() => { if (rating > 0) onSave(rating, review.trim()); }}
            className="flex-1 rounded-full bg-[#22B16B] py-2.5 text-[13px] font-bold text-[#03200F] transition-colors hover:bg-[#2AC57A] disabled:cursor-not-allowed disabled:opacity-40">
            Guardar valoración
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

interface MySpaceScreenProps {
  readonly items: readonly MovieMedia[];
}

export function MySpaceScreen({ items }: MySpaceScreenProps) {
  const router = useRouter();
  const { mediaIds, removeMedia }                                     = useWatchlist();
  const { entries: progressEntries }                                  = useProgress();
  const { entries: ratingEntries, setRating, getRating, removeRating } = useRatings();
  const { email, memberSince, updateDisplayName } = useUserProfile();
  const { displayName, avatarColor, avatarIconId, avatarImageUrl, isSubProfile } = useActiveProfileDisplay();

  // Sub-profile direct access for edits
  const activeProfile  = useProfileStore((s) => s.activeProfile);
  const profiles       = useProfileStore((s) => s.profiles);
  const updateProfile  = useProfileStore((s) => s.updateProfile);
  const subProfile     = isSubProfile ? (profiles.find((p) => p.id === activeProfile!.id) ?? null) : null;

  const [editModalOpen, setEditModalOpen] = useState(false);

  const [ratingTarget, setRatingTarget] = useState<MovieMedia | null>(null);
  const [editingName,  setEditingName]  = useState(false);
  const [nameInput,    setNameInput]    = useState("");


  function startEditName() { setNameInput(displayName); setEditingName(true); }
  async function saveName() {
    setEditingName(false);
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === displayName) return;
    if (isSubProfile && subProfile) {
      updateProfile(subProfile.id, {
        name: trimmed,
        avatarId: subProfile.avatarId,
        color:    subProfile.color,
        isKids:   subProfile.isKids,
        requirePin: subProfile.requirePin,
        autoplay:   subProfile.autoplay,
      });
    } else {
      await updateDisplayName(trimmed);
    }
  }

  const continueItems = useMemo(() => {
    return items
      .flatMap((item) => {
        const e = progressEntries[item.numericId];
        if (!e || e.currentTime <= 10 || e.completed) return [];
        const dur = parseDuration(item.runtime);
        const frac = dur > 0 ? Math.min(e.currentTime / dur, 0.94) : 0;
        if (frac <= 0) return [];
        return [{ ...item, progress: frac } as MovieMedia];
      })
      .sort((a, b) => {
        const ta = progressEntries[a.numericId]?.updatedAt ?? 0;
        const tb = progressEntries[b.numericId]?.updatedAt ?? 0;
        return tb - ta;
      });
  }, [items, progressEntries]);

  const watchlistItems = useMemo(
    () => items.filter((x) => mediaIds.includes(x.numericId)),
    [items, mediaIds],
  );

  const diaryItems = useMemo(() => {
    return items
      .filter((item) => ratingEntries[item.numericId] != null)
      .sort((a, b) => {
        const ra = ratingEntries[a.numericId]?.ratedAt ?? 0;
        const rb = ratingEntries[b.numericId]?.ratedAt ?? 0;
        return rb - ra;
      });
  }, [items, ratingEntries]);

  const avgRating = useMemo(() => {
    if (diaryItems.length === 0) return 0;
    return diaryItems.reduce((acc, item) => acc + (ratingEntries[item.numericId]?.rating ?? 0), 0) / diaryItems.length;
  }, [diaryItems, ratingEntries]);

  const hoursWatched = useMemo(() => {
    const secs = Object.values(progressEntries).reduce((s, e) => s + e.currentTime, 0);
    return Math.round(secs / 3600);
  }, [progressEntries]);

  const exploredGenres = useMemo(
    () => topGenres([...continueItems, ...watchlistItems]),
    [continueItems, watchlistItems],
  );

  const topGenre = exploredGenres[0] ?? "—";
  const diaryGroups = useMemo(
    () => groupDiaryByMonth([...diaryItems], ratingEntries),
    [diaryItems, ratingEntries],
  );

  const initial = displayName[0]?.toUpperCase() ?? "M";

  function handleSaveSubFromSpace(values: SubProfileValues) {
    if (!subProfile) return;
    const colorKey = (Object.keys(COLOR_VALUES) as AvatarColor[]).find(
      (k) => COLOR_VALUES[k] === values.color,
    ) ?? "green";
    const avatarId = values.imageUrl || values.iconId || "estrella";
    updateProfile(subProfile.id, {
      name: values.name, avatarId, color: colorKey,
      isKids: values.isKids, requirePin: values.requirePin, autoplay: values.autoplay,
    });
    setEditModalOpen(false);
  }

  return (
    <>
    {editModalOpen && (
      isSubProfile && subProfile ? (
        <ProfileEditModal
          title="Editar perfil"
          initialValues={{
            name:       subProfile.name,
            color:      avatarColor,
            iconId:     avatarIconId,
            imageUrl:   avatarImageUrl,
            isKids:     subProfile.isKids,
            requirePin: subProfile.requirePin,
            autoplay:   subProfile.autoplay,
          }}
          onSave={handleSaveSubFromSpace}
          onClose={() => setEditModalOpen(false)}
        />
      ) : (
        <ProfileEditModal onClose={() => setEditModalOpen(false)} />
      )
    )}
    <div className="mx-auto max-w-[1440px] px-6 pb-24 pt-8">

      {/* ── Profile header ────────────────────────────────────────────────── */}
      <div
        className="relative mb-6 overflow-hidden rounded-[14px] border border-[#1E1E1E] px-8 py-7"
        style={{ background: "linear-gradient(135deg, #0D0D0D 0%, #0d1520 100%)" }}
      >
        <div className="pointer-events-none absolute -top-24 left-0 h-64 w-64 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #22B16B 0%, transparent 70%)" }} />

        <div className="relative flex flex-wrap items-center gap-6">
          {/* Avatar */}
          <div className="group relative shrink-0">
            {avatarImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarImageUrl} alt="" className="h-[88px] w-[88px] rounded-full object-cover"
                style={{ boxShadow: `inset 0 0 0 1px rgba(255,255,255,.08), 0 8px 32px ${avatarColor}44` }} />
            ) : avatarIconId ? (
              <div className="h-[88px] w-[88px] overflow-hidden rounded-full"
                style={{ boxShadow: `inset 0 0 0 1px rgba(255,255,255,.08), 0 8px 32px ${avatarColor}44` }}>
                {renderAvatar(avatarIconId, avatarColor, 88) as React.ReactNode}
              </div>
            ) : (
              <div className="flex h-[88px] w-[88px] items-center justify-center rounded-full text-[36px] font-extrabold text-[#03200F]"
                style={{ background: avatarColor, boxShadow: `inset 0 0 0 1px rgba(255,255,255,.08), 0 8px 32px ${avatarColor}44` }}>
                {initial}
              </div>
            )}
            <button type="button" onClick={() => setEditModalOpen(true)} aria-label="Editar perfil"
              className="absolute inset-0 flex items-center justify-center rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              style={{ background: "rgba(0,0,0,0.55)" }}>
              <Pencil size={18} strokeWidth={1.75} className="text-white" />
            </button>
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            {editingName ? (
              <input autoFocus value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => { if (e.key === "Enter") void saveName(); if (e.key === "Escape") setEditingName(false); }}
                className="w-full max-w-xs rounded-[8px] border border-[#22B16B]/40 bg-[#141414] px-3 py-1.5 text-[22px] font-extrabold tracking-[-0.02em] text-white outline-none"
              />
            ) : (
              <button type="button" onClick={startEditName}
                className="group/name flex items-center gap-2 text-[26px] font-extrabold tracking-[-0.02em] text-white transition-colors hover:text-[#22B16B]"
                title="Editar nombre">
                {displayName}
                <Pencil size={14} className="opacity-0 transition-opacity group-hover/name:opacity-60" />
              </button>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[13px] text-[#6D7D94]">
              {!isSubProfile && memberSince && (
                <>
                  <span>Miembro desde {formatMemberSince(memberSince)}</span>
                  <span className="h-1 w-1 rounded-full bg-[#3A3A3A]" />
                </>
              )}
              {isSubProfile ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2A2A2A] bg-[#111] px-2.5 py-0.5 text-[11px] font-semibold tracking-[.06em] text-[#6D7D94]"
                  style={MONO}>
                  SUB-PERFIL
                </span>
              ) : email && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(34,177,107,.32)] bg-[rgba(34,177,107,.1)] px-2.5 py-0.5 text-[11px] font-semibold tracking-[.06em] text-[#22B16B]"
                  style={MONO}>
                  GMA FILMO
                </span>
              )}
            </div>
          </div>

          {/* Switch profile */}
          <button type="button" onClick={() => router.push("/perfiles")}
            className="flex items-center gap-1.5 rounded-full border border-[#262626] px-4 py-1.5 text-[12px] font-semibold text-[#6D7D94] transition-colors hover:border-[#22B16B]/40 hover:text-white">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Cambiar de perfil
          </button>
        </div>
      </div>

      {/* ── Stats cards ───────────────────────────────────────────────────── */}
      <div className="mb-10 grid grid-cols-4 gap-4 pb-10 border-b border-[#1A1A1A]">
        <StatCard value={String(hoursWatched)} unit="h" label="HORAS VISTAS" />
        <StatCard value={String(continueItems.length)} label="EN PROGRESO" />
        <StatCard
          value={String(diaryItems.length)}
          label="VALORADOS"
          sub={diaryItems.length > 0 ? `Media ${avgRating.toFixed(1)} ★` : undefined}
        />
        <StatCard value={topGenre} label="GÉNERO FAV" isChip />
      </div>

      {/* ── Mi Diario ─────────────────────────────────────────────────────── */}
      <SectionHead
        title="Mi Diario"
        count={diaryItems.length}
        sub={diaryItems.length > 0 ? `${diaryItems.length} entrada${diaryItems.length !== 1 ? "s" : ""}` : undefined}
      />

      {diaryItems.length > 0 ? (
        <div className="mb-14">
          {/* Column headers */}
          <div
            className="mb-1 grid items-center pb-2 text-[10px] font-bold uppercase tracking-[.14em] text-[#3A3A3A]"
            style={{ gridTemplateColumns: "64px 1fr 140px 110px 80px", gap: 20, ...MONO }}
          >
            <span />
            <span>Título</span>
            <span>Fecha</span>
            <span>Valoración</span>
            <span />
          </div>

          {diaryGroups.map(([month, groupItems], gi) => (
            <div key={month}>
              {/* Month divider */}
              <div
                className={`py-3 text-[11px] font-bold uppercase tracking-[.14em] text-[#4A5A6E] border-t border-[#1A1A1A] ${gi === 0 ? "border-t-0 pt-0" : ""}`}
                style={MONO}
              >
                {month}
              </div>

              {groupItems.map((item) => {
                const entry = ratingEntries[item.numericId]!;
                return (
                  <DiaryRow
                    key={item.id}
                    item={item}
                    entry={entry}
                    onEdit={() => setRatingTarget(item)}
                    onRemove={() => removeRating(item.numericId)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="bookmark"
          title="Tu diario está vacío"
          body="Valora los cortometrajes que hayas visto para llenar tu diario personal."
          cta="Explorar catálogo"
          onCta={() => router.push("/cortos")}
        />
      )}

      {/* ── Continuar viendo ──────────────────────────────────────────────── */}
      {continueItems.length > 0 && (
        <>
          <SectionHead title="Continuar viendo" count={continueItems.length} />
          <div className="mb-14 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {continueItems.map((item) => (
              <ContinueCard
                key={item.id} item={item}
                onPlay={() => router.push(`/ver/${item.id}`)}
                onDetail={() => router.push(`/cortos/${item.id}`)}
                onRate={() => setRatingTarget(item)}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Mis Listas ────────────────────────────────────────────────────── */}
      <SectionHead title="Mis Listas" />
      <div className="mb-14">
        {/* Ver más tarde — default list card */}
        <div className="rounded-[12px] border border-[#1E1E1E] bg-[#0D0D0D] p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[rgba(34,177,107,0.12)] text-[#22B16B]">
              <GmaIcon name="bookmark" size={17} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[16px] font-bold text-white">Ver más tarde</div>
              <div className="text-[12px] text-[#5A6A7E]" style={MONO}>
                {watchlistItems.length} {watchlistItems.length === 1 ? "corto" : "cortos"} · Lista predeterminada
              </div>
            </div>
          </div>

          {watchlistItems.length > 0 ? (
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
              {watchlistItems.map((item) => (
                <WatchlistCard
                  key={item.id} item={item}
                  isRated={ratingEntries[item.numericId] != null}
                  onNavigate={() => router.push(`/cortos/${item.id}`)}
                  onRemove={() => removeMedia(item.numericId)}
                  onRate={() => setRatingTarget(item)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-[8px] border border-dashed border-[#262626] py-12 text-center">
              <GmaIcon name="bookmark" size={22} className="mb-3 text-[#3A3A3A]" />
              <p className="text-[14px] font-semibold text-[#5A6A7E]">Aún no has guardado ningún corto</p>
              <p className="mt-1 text-[12px] text-[#3A3A3A]">Usa el botón + en cualquier cartel para añadirlo aquí</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Géneros explorados ────────────────────────────────────────────── */}
      {exploredGenres.length > 0 && (
        <>
          <SectionHead title="Géneros explorados" />
          <div className="mb-14 flex flex-wrap gap-3">
            {exploredGenres.map((g) => (
              <button key={g} type="button"
                onClick={() => router.push(`/cortos?genre=${encodeURIComponent(g)}`)}
                className="rounded-full border border-[#262626] bg-[#0D0D0D] px-5 py-2.5 text-[13px] font-semibold text-[#B8C5D4] transition-colors hover:border-[#22B16B]/50 hover:text-white">
                {g}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Rating modal ──────────────────────────────────────────────────── */}
      {ratingTarget && (
        <RatingModal
          item={ratingTarget}
          existing={getRating(ratingTarget.numericId)}
          onSave={(rating, review) => { setRating(ratingTarget.numericId, rating, review); setRatingTarget(null); }}
          onClose={() => setRatingTarget(null)}
        />
      )}
    </div>
    </>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  value, unit, label, sub, isChip,
}: {
  value: string; unit?: string; label: string; sub?: string; isChip?: boolean;
}) {
  return (
    <div className="flex min-h-[110px] flex-col gap-1.5 overflow-hidden rounded-[12px] border border-[#1A1A1A] p-5 relative"
      style={{ background: "#0F1622" }}>
      <div className="text-[10.5px] font-bold uppercase tracking-[.14em] text-[#4A5A6E]" style={MONO}>
        {label}
      </div>
      {isChip ? (
        <div className="mt-auto">
          <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(34,177,107,.32)] bg-[rgba(34,177,107,.14)] px-3 py-1.5 text-[14px] font-semibold text-[#22B16B]">
            {value}
          </span>
        </div>
      ) : (
        <div className="text-[34px] font-extrabold leading-[1.05] tracking-[-0.02em] text-white"
          style={{ fontVariantNumeric: "tabular-nums" }}>
          {value}
          {unit && <span className="ml-1.5 text-[14px] font-medium text-[#4A5A6E]">{unit}</span>}
        </div>
      )}
      {sub && <div className="mt-auto text-[12px] text-[#B8C5D4]">{sub}</div>}
    </div>
  );
}

// ─── Section head ─────────────────────────────────────────────────────────────

function SectionHead({ title, count, sub }: { title: string; count?: number; sub?: string }) {
  return (
    <div className="mb-5 flex items-baseline gap-3">
      <h2 className="text-[22px] font-extrabold tracking-[-0.015em] text-white">{title}</h2>
      {count != null && count > 0 && (
        <span className="rounded-full bg-[#1A1A1A] px-2.5 py-0.5 text-[12px] font-bold text-[#B8C5D4]" style={MONO}>
          {count}
        </span>
      )}
      {sub && <span className="text-[12px] text-[#5A6A7E]">{sub}</span>}
    </div>
  );
}

// ─── Diary row ────────────────────────────────────────────────────────────────

function DiaryRow({
  item, entry, onEdit, onRemove,
}: {
  item: MovieMedia; entry: RatingEntry; onEdit: () => void; onRemove: () => void;
}) {
  const d   = new Date(entry.ratedAt);
  const day = d.getDate();
  const mo  = d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "").toUpperCase();

  return (
    <div
      className="group grid items-center border-t border-[#1A1A1A] py-3.5 transition-colors duration-100 hover:bg-white/[0.018]"
      style={{ gridTemplateColumns: "64px 1fr 140px 110px 80px", gap: 20 }}
    >
      {/* Thumbnail */}
      <div className="h-16 w-11 shrink-0 overflow-hidden rounded-[4px] bg-[#1A2438]">
        {item.imageUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
          : <PosterArt style={item.style} title="" kind="movie" ratio="portrait" />}
      </div>

      {/* Title + meta */}
      <div className="min-w-0">
        <div className="truncate text-[15px] font-bold tracking-[-0.005em] text-white">
          {item.title}
        </div>
        <div className="mt-1 text-[12px] text-[#5A6A7E]" style={MONO}>
          {item.year || "—"}
          {item.runtime && item.runtime !== "Corto" ? ` · ${item.runtime}` : ""}
        </div>
        {entry.review && (
          <div className="mt-1.5 line-clamp-1 text-[11.5px] italic text-[#4A5A6E]">
            &ldquo;{entry.review}&rdquo;
          </div>
        )}
      </div>

      {/* Date */}
      <div className="flex flex-col gap-0.5">
        <span
          className="text-[20px] font-bold leading-none text-white"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {day}
        </span>
        <span className="text-[10.5px] uppercase tracking-[.1em] text-[#5A6A7E]" style={MONO}>
          {mo}
        </span>
      </div>

      {/* Rating */}
      <div className="flex items-center gap-2">
        <StarRating value={entry.rating} readOnly size={13} gap={2} />
        <span className="text-[12px] text-[#5A6A7E]" style={MONO}>
          {entry.rating.toFixed(1)}
        </span>
      </div>

      {/* Actions — visible on row hover */}
      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <button type="button" onClick={onEdit} title="Editar valoración"
          className="flex h-7 w-7 items-center justify-center rounded-full text-[#5A6A7E] transition-colors hover:bg-white/[0.06] hover:text-white">
          <Pencil size={13} strokeWidth={1.75} />
        </button>
        <button type="button" onClick={onRemove} title="Eliminar entrada"
          className="flex h-7 w-7 items-center justify-center rounded-full text-[#5A6A7E] transition-colors hover:bg-white/[0.06] hover:text-[#ff5252]">
          <Trash2 size={13} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

// ─── Continue card ────────────────────────────────────────────────────────────

function ContinueCard({
  item, onPlay, onDetail, onRate,
}: {
  item: MovieMedia; onPlay: () => void; onDetail: () => void; onRate: () => void;
}) {
  const pct = Math.round((item.progress ?? 0) * 100);
  return (
    <div className="group overflow-hidden rounded-[8px] border border-[#1E1E1E] bg-[#0D0D0D] transition-[border-color] duration-200 hover:border-[#22B16B]/25">
      <div className="relative" style={{ aspectRatio: "16/9" }}>
        {item.imageUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
          : <PosterArt style={item.style} title="" kind="movie" ratio="landscape" />}
        <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <button type="button" onClick={onPlay}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[#22B16B] text-[#03200F] transition-transform duration-150 hover:scale-110"
            aria-label="Reproducir">
            <GmaIcon name="play" size={20} />
          </button>
          <button type="button" onClick={onRate}
            className="rounded-full border border-white/20 bg-black/50 px-3 py-1.5 text-[12px] font-semibold text-white backdrop-blur-sm transition-colors hover:border-[#22B16B]/50 hover:text-[#22B16B]">
            Valorar
          </button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/10">
          <div className="h-full bg-[#22B16B]" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-bold text-white">{item.title}</div>
          <div className="mt-0.5 flex items-center gap-2 text-[12px] text-[#6D7D94]">
            <span>Cortometraje{item.runtime && item.runtime !== "Corto" ? ` · ${item.runtime}` : ""}</span>
            <span className="h-1 w-1 rounded-full bg-[#262626]" />
            <span className="font-semibold text-[#22B16B]">{pct}%</span>
          </div>
        </div>
        <button type="button" onClick={onDetail}
          className="shrink-0 rounded-full bg-[#1A1A1A] p-2 text-[#B8C5D4] transition-colors hover:bg-[#262626] hover:text-white"
          aria-label="Ver detalles">
          <GmaIcon name="info" size={15} />
        </button>
      </div>
    </div>
  );
}

// ─── Watchlist card ───────────────────────────────────────────────────────────

function WatchlistCard({
  item, isRated, onNavigate, onRemove, onRate,
}: {
  item: MovieMedia; isRated: boolean;
  onNavigate: () => void; onRemove: () => void; onRate: () => void;
}) {
  return (
    <div className="group relative">
      <button type="button" onClick={onNavigate}
        className="w-full overflow-hidden rounded-[6px] border border-transparent transition-[transform,border-color] duration-200 hover:-translate-y-1 hover:border-[rgba(34,177,107,0.25)]">
        {item.imageUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={item.imageUrl} alt={item.title} className="w-full rounded-[6px] object-cover" style={{ aspectRatio: "2/3" }} />
          : <PosterArt style={item.style} title={item.title} kind="movie" ratio="portrait" />}
      </button>

      <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }}
        aria-label="Quitar de Mi Lista"
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white opacity-0 backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100 hover:bg-[#ff5252]/80">
        <GmaIcon name="close" size={13} />
      </button>

      <button type="button" onClick={(e) => { e.stopPropagation(); onRate(); }}
        aria-label={isRated ? "Editar valoración" : "Valorar"}
        className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/15 bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white opacity-0 backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100 hover:border-[#22B16B]/50 hover:text-[#22B16B]">
        {isRated ? "★ Editar" : "Valorar"}
      </button>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ icon, title, body, cta, onCta }: {
  icon: "play" | "bookmark"; title: string; body: string; cta: string; onCta: () => void;
}) {
  return (
    <div className="mb-14 flex flex-col items-center justify-center rounded-[12px] border border-dashed border-[#262626] bg-[#0A0A0A] py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#1A1A1A] text-[#5A6A7E]">
        <GmaIcon name={icon} size={24} />
      </div>
      <p className="mb-1.5 text-[15px] font-bold text-white">{title}</p>
      <p className="mb-6 max-w-xs text-[13px] text-[#6D7D94]">{body}</p>
      <button type="button" onClick={onCta}
        className="rounded-full bg-[#22B16B] px-5 py-2.5 text-[13px] font-bold text-[#03200F] transition-colors hover:bg-[#2AC57A]">
        {cta}
      </button>
    </div>
  );
}
