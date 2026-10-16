"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useVisibleViewport } from "@/hooks/use-visible-viewport";
import { useRouter } from "next/navigation";
import styles from "./my-space-screen.module.css";
import { Xmark as X, EditPencil as Pencil, Trash as Trash2 } from "@/components/ui/icons";
import { GmaIcon } from "@/components/ui/gma-icon";
import { PosterArt } from "@/components/ui/poster-art";
import { useWatchlist } from "@/hooks/use-watchlist";
import { useProgress } from "@/hooks/use-progress";
import { parseDuration } from "@/lib/utils";
import { useRatings, type RatingEntry } from "@/hooks/use-ratings";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useActiveProfileDisplay } from "@/hooks/use-active-profile-display";
import { ProfileEditModal, type SubProfileValues } from "@/components/features/profiles/profile-edit-modal";
import { COLOR_VALUES, type AvatarColor } from "@/lib/data/profile-avatars";
import { RemoveFromListButton } from "@/components/features/space/remove-from-list-button";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { useProfileStore } from "@/store/use-profile-store";
import type { MovieMedia } from "@/types/catalog";
import { lockPageScroll } from "@/lib/scroll-lock";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-sans)", fontVariantNumeric: "tabular-nums",
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
        <path d={STAR_PATH} fill="#2C4334" />
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
    <div
      className="flex flex-wrap items-center"
      style={{ gap }}
      role={readOnly ? undefined : "group"}
      aria-label={readOnly ? `${value} de 5 estrellas` : "Selecciona una valoración; las flechas ajustan media estrella"}
      onMouseLeave={() => !readOnly && setHover(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = Math.min(1, Math.max(0, displayed - (star - 1)));
        if (readOnly) return <div key={star}><StarGlyph fill={fill} size={size} /></div>;
        return (
          <button
            key={star}
            type="button"
            aria-label={`Valorar con ${star} ${star === 1 ? "estrella" : "estrellas"}`}
            aria-pressed={Math.ceil(value) === star}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-[#22B16B]"
            onFocus={() => setHover(null)}
            onPointerMove={(e) => {
              if (e.pointerType !== "mouse") return;
              const r = e.currentTarget.getBoundingClientRect();
              setHover(e.clientX < r.left + r.width / 2 ? star - 0.5 : star);
            }}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setHover(null);
              onChange?.(e.detail === 0 ? star : e.clientX < r.left + r.width / 2 ? star - 0.5 : star);
            }}
            onKeyDown={(e) => {
              const keys: Record<string, number> = {
                ArrowLeft: value - 0.5, ArrowDown: value - 0.5,
                ArrowRight: value + 0.5, ArrowUp: value + 0.5,
                Home: 0.5, End: 5,
              };
              const next = keys[e.key];
              if (next === undefined) return;
              e.preventDefault();
              setHover(null);
              onChange?.(Math.max(0.5, Math.min(5, next)));
            }}
          >
            <StarGlyph fill={fill} size={size} />
          </button>
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
  const viewportBounds = useVisibleViewport();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [review, setReview] = useState(existing?.review ?? "");
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const unlockScroll = lockPageScroll();
    dialogRef.current?.focus();
    return () => {
      unlockScroll();
      previous?.focus();
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea, input, [tabindex="0"]') ?? []);
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current || !dialogRef.current?.contains(document.activeElement))) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) { e.preventDefault(); first?.focus(); }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overscroll-y-contain p-4"
      style={{ ...viewportBounds, background: "rgba(0,0,0,0.75)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog" aria-modal="true" aria-label={`Valorar ${item.title}`} ref={dialogRef} tabIndex={-1}
        className="w-full max-w-[480px] max-h-[calc(100dvh-32px)] overflow-y-auto overscroll-y-contain rounded-[16px] border border-gma-border p-4 sm:p-6"
        style={{ background: "var(--gma-surface-2)", maxHeight: "calc(var(--visible-viewport-height, 100dvh) - 32px)", animation: "modalIn 0.25s ease both" }}
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
            <p className="text-[12px] text-[#7C7C7C]">
              Cortometraje{item.year ? ` · ${item.year}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar valoración"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#686868] transition-colors hover:bg-gma-surface hover:text-white">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="mb-5">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[.1em] text-[#686868]">Valoración</p>
          <StarRating value={rating} onChange={setRating} size={30} gap={6} />
          <p role="status" className="mt-2 min-h-4 text-[12px] text-[#22B16B]">{rating > 0 ? `${rating} de 5 · ${RATING_LABELS[rating] ?? ""}` : ""}</p>
        </div>

        <div className="mb-5">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[.1em] text-[#686868]">
            Reseña <span className="normal-case font-normal text-gma-line-strong">(opcional)</span>
          </p>
          <textarea
            value={review} onChange={(e) => setReview(e.target.value)}
            placeholder="¿Qué te pareció?" rows={3}
            className="w-full resize-none rounded-[10px] border border-gma-border bg-gma-panel px-4 py-3 text-base sm:text-[13px] text-white placeholder-[#686868] outline-none transition-[border-color] duration-150 focus:border-[#22B16B]/50"
          />
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="min-h-11 flex-1 rounded-full border border-gma-border px-2 py-2.5 text-[13px] font-semibold text-[#999999] transition-colors hover:border-gma-line-strong hover:text-white">
            Cancelar
          </button>
          <button type="button" disabled={rating === 0}
            onClick={() => { if (rating > 0) onSave(rating, review.trim()); }}
            className="min-h-11 flex-1 rounded-full bg-[#22B16B] px-2 py-2.5 text-[13px] font-bold text-[#03200F] transition-colors hover:bg-[#2AC57A] disabled:cursor-not-allowed disabled:opacity-40">
            Guardar valoración
          </button>
        </div>
      </div>
    </div>,
    document.body,
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
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 pb-24 pt-8" style={{ animation: "fadeIn 0.55s ease both" }}>

      {/* ── Profile header ────────────────────────────────────────────────── */}
      <div
        className="relative mb-6 overflow-hidden rounded-[14px] border border-gma-surface px-4 py-5 sm:px-8 sm:py-7"
        style={{ background: "linear-gradient(135deg, var(--gma-surface-2) 0%, var(--gma-panel) 100%)" }}
      >
        <div className="pointer-events-none absolute -top-24 left-0 h-64 w-64 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #22B16B 0%, transparent 70%)" }} />

        <div className="relative flex flex-wrap items-center gap-6">
          {/* Avatar */}
          <div className="group relative shrink-0">
            <div className="h-[88px] w-[88px] overflow-hidden rounded-full"
              style={{ boxShadow: `inset 0 0 0 1px rgba(255,255,255,.08), 0 8px 32px ${avatarColor}44` }}>
              <ProfileAvatar name={displayName} color={avatarColor} url={avatarImageUrl || null} iconId={avatarIconId || null} size="fill" />
            </div>
            <button type="button" onClick={() => setEditModalOpen(true)} aria-label="Editar perfil"
              className="absolute inset-0 flex items-center justify-center rounded-full [@media(hover:none)]:opacity-100 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
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
                className="w-full max-w-xs rounded-[8px] border border-[#22B16B]/40 bg-gma-panel px-3 py-1.5 text-[22px] font-extrabold tracking-[-0.02em] text-white outline-none"
              />
            ) : (
              <button type="button" onClick={startEditName}
                className="group/name flex min-h-11 max-w-full items-center gap-2 text-left text-xl sm:text-[26px] font-extrabold tracking-[-0.02em] text-white transition-colors hover:text-[#22B16B]"
                title="Editar nombre">
                <span className="min-w-0 break-words">{displayName}</span>
                <Pencil size={14} className="shrink-0 opacity-0 [@media(hover:none)]:opacity-60 transition-opacity group-hover/name:opacity-60" />
              </button>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[13px] text-[#7C7C7C]">
              {!isSubProfile && memberSince && (
                <>
                  <span>Miembro desde {formatMemberSince(memberSince)}</span>
                  <span className="h-1 w-1 rounded-full bg-gma-line-strong" />
                </>
              )}
              {isSubProfile ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gma-line-strong bg-[#111] px-2.5 py-0.5 text-[11px] font-semibold tracking-[.06em] text-[#7C7C7C]"
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
            className="flex min-h-11 items-center gap-1.5 rounded-full border border-gma-border px-4 py-1.5 text-[12px] font-semibold text-[#7C7C7C] transition-colors hover:border-[#22B16B]/40 hover:text-white">
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
      <div className="mb-10 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4 pb-10 border-b border-gma-surface">
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
            className="mb-1 hidden lg:grid items-center pb-2 text-[10px] font-bold uppercase tracking-[.14em] text-gma-line-strong"
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
                className={`py-3 text-[11px] font-bold uppercase tracking-[.14em] text-[#585858] border-t border-gma-surface ${gi === 0 ? "border-t-0 pt-0" : ""}`}
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
          <div className="mb-14 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))" }}>
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
        <div className="rounded-[12px] border border-gma-surface bg-gma-surface-2 p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[rgba(34,177,107,0.12)] text-[#22B16B]">
              <GmaIcon name="bookmark" size={17} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[16px] font-bold text-white">Ver más tarde</div>
              <div className="text-[12px] text-[#686868]" style={MONO}>
                {watchlistItems.length} {watchlistItems.length === 1 ? "corto" : "cortos"} · Lista predeterminada
              </div>
            </div>
          </div>

          {watchlistItems.length > 0 ? (
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 150px), 1fr))" }}>
              {watchlistItems.map((item) => (
                <WatchlistCard
                  key={item.id} item={item}
                  onNavigate={() => router.push(`/cortos/${item.id}`)}
                  onRemove={() => removeMedia(item.numericId)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-[8px] border border-dashed border-gma-border py-12 text-center">
              <GmaIcon name="bookmark" size={22} className="mb-3 text-gma-line-strong" />
              <p className="text-[14px] font-semibold text-[#686868]">Aún no has guardado ningún corto</p>
              <p className="mt-1 text-[12px] text-gma-line-strong">Usa el botón + en cualquier cartel para añadirlo aquí</p>
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
                className="min-h-11 max-w-full break-words rounded-full border border-gma-border bg-gma-surface-2 px-5 py-2.5 text-[13px] font-semibold text-[#C4C4C4] transition-colors hover:border-[#22B16B]/50 hover:text-white">
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
    <div className="flex min-h-[110px] flex-col gap-1.5 overflow-hidden rounded-[12px] border border-gma-surface p-5 relative"
      style={{ background: "var(--gma-panel)" }}>
      <div className="text-[10.5px] font-bold uppercase tracking-[.14em] text-[#585858]" style={MONO}>
        {label}
      </div>
      {isChip ? (
        <div className="mt-auto">
          <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-[rgba(34,177,107,.32)] bg-[rgba(34,177,107,.14)] px-3 py-1.5 text-[14px] font-semibold text-[#22B16B]">
            <span className="min-w-0 break-words">{value}</span>
          </span>
        </div>
      ) : (
        <div className="text-[34px] font-extrabold leading-[1.05] tracking-[-0.02em] text-white"
          style={{ fontVariantNumeric: "tabular-nums" }}>
          {value}
          {unit && <span className="ml-1.5 text-[14px] font-medium text-[#585858]">{unit}</span>}
        </div>
      )}
      {sub && <div className="mt-auto text-[12px] text-[#C4C4C4]">{sub}</div>}
    </div>
  );
}

// ─── Section head ─────────────────────────────────────────────────────────────

function SectionHead({ title, count, sub }: { title: string; count?: number; sub?: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-baseline gap-3">
      <h2 className="text-[22px] font-extrabold tracking-[-0.015em] text-white">{title}</h2>
      {count != null && count > 0 && (
        <span className="rounded-full bg-gma-surface px-2.5 py-0.5 text-[12px] font-bold text-[#C4C4C4]" style={MONO}>
          {count}
        </span>
      )}
      {sub && <span className="text-[12px] text-[#686868]">{sub}</span>}
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
      className={`${styles.diaryRow} group grid items-center border-t border-gma-surface py-3.5 transition-colors duration-100 hover:bg-white/[0.018]`}
    >
      {/* Thumbnail */}
      <div className="h-16 w-11 shrink-0 overflow-hidden rounded-[4px] bg-gma-border">
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
        <div className="mt-1 text-[12px] text-[#686868]" style={MONO}>
          {item.year || "—"}
          {item.runtime && item.runtime !== "Corto" ? ` · ${item.runtime}` : ""}
        </div>
        {entry.review && (
          <div className="mt-1.5 line-clamp-1 text-[11.5px] italic text-[#585858]">
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
        <span className="text-[10.5px] uppercase tracking-[.1em] text-[#686868]" style={MONO}>
          {mo}
        </span>
      </div>

      {/* Rating */}
      <div className="flex items-center gap-2">
        <StarRating value={entry.rating} readOnly size={13} gap={2} />
        <span className="text-[12px] text-[#686868]" style={MONO}>
          {entry.rating.toFixed(1)}
        </span>
      </div>

      {/* Actions — visible on row hover */}
      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <button type="button" onClick={onEdit} aria-label="Editar valoración" title="Editar valoración"
          className="flex h-7 w-7 items-center justify-center rounded-full text-[#686868] transition-colors hover:bg-white/[0.06] hover:text-white">
          <Pencil size={13} strokeWidth={1.75} />
        </button>
        <button type="button" onClick={onRemove} aria-label="Eliminar entrada" title="Eliminar entrada"
          className="flex h-7 w-7 items-center justify-center rounded-full text-[#686868] transition-colors hover:bg-white/[0.06] hover:text-[#ff5252]">
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
    <div className={`${styles.interactiveCard} group overflow-hidden rounded-[8px] border border-gma-surface bg-gma-surface-2 transition-[border-color] duration-200 hover:border-[#22B16B]/25`}>
      <div className="relative" style={{ aspectRatio: "16/9" }}>
        {item.imageUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
          : <PosterArt style={item.style} title="" kind="movie" ratio="landscape" />}
        <div className={`${styles.cardActions} absolute inset-0 flex items-center justify-center gap-3 bg-black/40 transition-opacity duration-200`}>
          <button type="button" onClick={onPlay}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[#22B16B] text-[#03200F] transition-transform duration-150 hover:scale-110"
            aria-label="Reproducir">
            <GmaIcon name="play" size={20} />
          </button>
          <button type="button" onClick={onRate}
            className="min-h-11 rounded-full border border-white/20 bg-black/50 px-3 py-1.5 text-[12px] font-semibold text-white backdrop-blur-sm transition-colors hover:border-[#22B16B]/50 hover:text-[#22B16B]">
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
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[#7C7C7C]">
            <span>Cortometraje{item.runtime && item.runtime !== "Corto" ? ` · ${item.runtime}` : ""}</span>
            <span className="h-1 w-1 rounded-full bg-gma-border" />
            <span className="font-semibold text-[#22B16B]">{pct}%</span>
          </div>
        </div>
        <button type="button" onClick={onDetail}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gma-surface text-[#C4C4C4] transition-colors hover:bg-gma-border hover:text-white"
          aria-label="Ver detalles">
          <GmaIcon name="info" size={15} />
        </button>
      </div>
    </div>
  );
}

// ─── Watchlist card ───────────────────────────────────────────────────────────

function WatchlistCard({
  item, onNavigate, onRemove,
}: {
  item: MovieMedia;
  onNavigate: () => void; onRemove: () => void;
}) {
  return (
    <div className={`${styles.interactiveCard} group relative`}>
      <button type="button" onClick={onNavigate}
        className={`${styles.watchlistPoster} w-full overflow-hidden rounded-[6px] border border-transparent transition-[transform,border-color] duration-200`}>
        {item.imageUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={item.imageUrl} alt={item.title} className="w-full rounded-[6px] object-cover" style={{ aspectRatio: "2/3" }} />
          : <PosterArt style={item.style} title={item.title} kind="movie" ratio="portrait" />}
      </button>

      <RemoveFromListButton onRemove={onRemove} className={`${styles.cardActions} absolute right-0 top-0 transition-opacity duration-150`} />
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ icon, title, body, cta, onCta }: {
  icon: "play" | "bookmark"; title: string; body: string; cta: string; onCta: () => void;
}) {
  return (
    <div className="mb-14 flex flex-col items-center justify-center rounded-[12px] border border-dashed border-gma-border bg-gma-surface-2 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gma-surface text-[#686868]">
        <GmaIcon name={icon} size={24} />
      </div>
      <p className="mb-1.5 text-[15px] font-bold text-white">{title}</p>
      <p className="mb-6 max-w-xs text-[13px] text-[#7C7C7C]">{body}</p>
      <button type="button" onClick={onCta}
        className="min-h-11 rounded-full bg-[#22B16B] px-5 py-2.5 text-[13px] font-bold text-[#03200F] transition-colors hover:bg-[#2AC57A]">
        {cta}
      </button>
    </div>
  );
}
