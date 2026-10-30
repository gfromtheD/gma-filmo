"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { EditPencil as Pencil } from "@/components/ui/icons";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useWatchlist } from "@/hooks/use-watchlist";
import { useRatings } from "@/hooks/use-ratings";
import { useProgress } from "@/hooks/use-progress";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const COLORS = [
  { hex: "#22B16B", label: "Verde" },
  { hex: "#3B82F6", label: "Azul" },
  { hex: "#8B5CF6", label: "Violeta" },
  { hex: "#F97316", label: "Coral" },
  { hex: "#F43F5E", label: "Rosa" },
  { hex: "#F59E0B", label: "Ámbar" },
] as const;

// ─── Root ─────────────────────────────────────────────────────────────────────

export function ProfileScreen() {
  const router = useRouter();
  const { displayName, email, memberSince, avatarColor, updateDisplayName, updateAvatarColor } = useUserProfile();
  const { mediaIds }   = useWatchlist();
  const { entries: ratings }  = useRatings();
  const { entries: progress } = useProgress();

  const [editingName,  setEditingName]  = useState(false);
  const [nameInput,    setNameInput]    = useState("");
  const [colorPicker,  setColorPicker]  = useState(false);
  const [signingOut,   setSigningOut]   = useState(false);

  const ratingCount  = Object.keys(ratings).length;
  const watchedCount = Object.values(progress).filter((e) => e.currentTime > 10).length;
  const initial      = displayName[0]?.toUpperCase() ?? "U";

  function formatSince(d: Date | null) {
    if (!d) return "";
    return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  }

  function startEdit() {
    setNameInput(displayName);
    setEditingName(true);
  }

  async function saveName() {
    const trimmed = nameInput.trim();
    setEditingName(false);
    if (trimmed && trimmed !== displayName) await updateDisplayName(trimmed);
  }

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    await getSupabaseBrowserClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }, [router]);

  async function handleColorSave(hex: string) {
    setColorPicker(false);
    await updateAvatarColor(hex);
  }

  return (
    <div className="mx-auto min-w-0 max-w-[680px] px-4 py-8 sm:px-6 sm:py-12">

      {/* ── Profile card ─────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-[16px] border border-gma-border p-5 sm:p-8"
        style={{ background: "linear-gradient(135deg, var(--gma-surface-2) 0%, var(--gma-panel) 100%)" }}
      >
        <div className="pointer-events-none absolute -top-16 left-0 h-48 w-48 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #22B16B 0%, transparent 70%)" }} />

        <div className="relative flex flex-wrap items-center gap-6">
          {/* Avatar */}
          <button
            type="button"
            onClick={() => setColorPicker((o) => !o)}
            title="Cambiar color"
            aria-expanded={colorPicker}
            aria-controls="profile-color-picker"
            className="relative group shrink-0"
          >
            <div
              className="flex h-20 w-20 items-center justify-center rounded-[16px] text-[32px] font-extrabold text-[#031A0E] transition-colors"
              style={{ background: avatarColor }}
            >
              {initial}
            </div>
            <span className="absolute inset-0 flex items-center justify-center rounded-[16px] bg-black/40 opacity-100 transition-opacity md:[@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 text-[11px] font-bold text-white">
              Color
            </span>
          </button>

          {/* Info */}
          <div className="min-w-0 flex-1 basis-[160px]">
            {editingName ? (
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={() => void saveName()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void saveName();
                  if (e.key === "Escape") setEditingName(false);
                }}
                className="w-full max-w-xs rounded-[8px] border border-[#22B16B]/40 bg-gma-panel px-3 py-1.5 text-[22px] font-extrabold text-white outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={startEdit}
                className="group flex max-w-full items-start gap-2 break-words text-left text-[22px] sm:text-[24px] font-extrabold tracking-[-0.02em] text-white transition-colors hover:text-[#22B16B]"
              >
                <span className="min-w-0 break-words">{displayName}</span>
                <Pencil size={14} className="shrink-0 opacity-60 transition-opacity" />
              </button>
            )}

            <div className="mt-1 flex flex-wrap items-center gap-3 text-[13px] text-[#7C7C7C]">
              {memberSince && <span>Miembro desde {formatSince(memberSince)}</span>}
              {email && (
                <>
                  <span className="h-1 w-1 rounded-full bg-gma-border" />
                  <span className="min-w-0 break-all text-[12px] font-medium text-[#22B16B]">{email}</span>
                </>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex max-w-full flex-wrap gap-5">
            <Stat value={String(mediaIds.length)} label="en lista" />
            <Stat value={String(watchedCount)}    label="vistos" />
            <Stat value={String(ratingCount)}     label="valorados" />
          </div>
        </div>
        {/* Keep the palette in the card flow so small screens do not clip it. */}
        {colorPicker && (
          <div id="profile-color-picker" aria-label="Color del perfil" className="relative mt-5 flex max-w-full flex-wrap gap-2 rounded-[12px] border border-gma-border bg-gma-surface-2 p-3">
            {COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => void handleColorSave(c.hex)}
                aria-label={c.label}
                aria-pressed={avatarColor === c.hex}
                className="flex h-11 w-11 items-center justify-center rounded-full transition-transform hover:scale-110"
              >
                <span className="h-7 w-7 rounded-full" style={{ background: c.hex }} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Actions ─────────────────────────────────────────────────── */}
      <div className="mt-6 flex flex-col gap-2">
        <ActionRow
          icon="bookmark"
          label="Mi Espacio"
          description="Lista, historial y valoraciones"
          onClick={() => router.push("/mi-espacio")}
        />
        <ActionRow
          icon="settings"
          label="Configuración"
          description="Preferencias y cuenta"
          onClick={() => router.push("/configuracion")}
        />
        <ActionRow
          icon="user"
          label="Cambiar nombre"
          description="Edita cómo te llamamos"
          onClick={startEdit}
        />
      </div>

      {/* ── Sign out ─────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => void handleSignOut()}
        disabled={signingOut}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-[4px] border border-gma-border py-3 text-[13px] font-semibold text-[#7C7C7C] transition-colors hover:border-[#ff5252]/40 hover:text-[#ff5252] disabled:opacity-50"
      >
        {signingOut ? "Cerrando sesión…" : "Cerrar sesión"}
      </button>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 text-center">
      <span className="text-[20px] font-extrabold leading-none text-white">{value}</span>
      <span className="text-[11px] text-[#7C7C7C]">{label}</span>
    </div>
  );
}

function ActionRow({
  icon, label, description, onClick,
}: {
  icon: "bookmark" | "settings" | "user";
  label: string;
  description: string;
  onClick: () => void;
}) {
  const iconMap: Record<string, React.ReactNode> = {
    bookmark: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>,
    settings: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    user: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-[12px] border border-gma-surface bg-gma-surface-2 px-5 py-4 text-left transition-[border-color,background] hover:border-gma-border hover:bg-gma-panel"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-gma-surface text-[#7C7C7C]">
        {iconMap[icon]}
      </div>
      <div className="min-w-0 flex-1 break-words">
        <div className="text-[14px] font-semibold text-white">{label}</div>
        <div className="text-[12px] text-[#585858]">{description}</div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3A4A5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
    </button>
  );
}
