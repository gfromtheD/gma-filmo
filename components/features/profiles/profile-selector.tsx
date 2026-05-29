"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { GmaIcon } from "@/components/ui/gma-icon";
import { useTransitionStore } from "@/store/use-transition-store";
import { useProfileStore, type Profile } from "@/store/use-profile-store";
import { useUserProfile } from "@/hooks/use-user-profile";
import { ProfileEditModal, type SubProfileValues } from "@/components/features/profiles/profile-edit-modal";
import { COLOR_VALUES, renderAvatar, type AvatarColor } from "@/lib/data/profile-avatars";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const serifItalic: React.CSSProperties = {
  fontFamily: "var(--font-serif), 'Instrument Serif', Georgia, serif",
  fontStyle: "italic",
};

// ─── Root ─────────────────────────────────────────────────────────────────────

export function ProfileSelector() {
  const router = useRouter();

  const profiles         = useProfileStore((s) => s.profiles);
  const addProfile       = useProfileStore((s) => s.addProfile);
  const updateProfile    = useProfileStore((s) => s.updateProfile);
  const removeProfile    = useProfileStore((s) => s.removeProfile);
  const setActiveProfile = useProfileStore((s) => s.setActiveProfile);

  const {
    displayName:    supabaseName,
    avatarColor:    supabaseColor,
    avatarImageUrl: supabaseImageUrl,
    avatarIconId:   supabaseIconId,
    isLoaded,
  } = useUserProfile();

  const [editSupabase, setEditSupabase] = useState(false);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [creatingNew,  setCreatingNew]  = useState(false);
  const [pinGate, setPinGate] = useState<{ id: string; name: string; isKids: boolean; correctPin: string } | null>(null);

  const editingSubProfile = profiles.find((p) => p.id === editingSubId) ?? null;

  // Convert a sub-profile's stored data (color keys, avatarId as icon or URL)
  // into the hex-based shape ProfileEditModal expects
  function toModalValues(p: Profile): Partial<SubProfileValues> {
    const colorHex = COLOR_VALUES[p.color as AvatarColor] ?? "#22B16B";
    const isImage  = p.avatarId.startsWith("/") || p.avatarId.startsWith("data:");
    return {
      name:       p.name,
      color:      colorHex,
      iconId:     isImage ? "" : p.avatarId,
      imageUrl:   isImage ? p.avatarId : "",
      isKids:     p.isKids,
      requirePin: p.requirePin,
      pin:        p.pin,
      autoplay:   p.autoplay,
    };
  }

  async function handleSaveSubProfile(values: SubProfileValues) {
    const colorKey = (Object.keys(COLOR_VALUES) as AvatarColor[]).find(
      (k) => COLOR_VALUES[k] === values.color,
    ) ?? "green";
    const avatarId = values.imageUrl || values.iconId || "estrella";

    if (editingSubId) {
      await updateProfile(editingSubId, {
        name: values.name, avatarId, color: colorKey,
        isKids: values.isKids, requirePin: values.requirePin,
        pin: values.pin, autoplay: values.autoplay,
      });
      setEditingSubId(null);
    } else {
      await addProfile({
        name: values.name, avatarId, color: colorKey,
        isKids: values.isKids, requirePin: values.requirePin,
        pin: values.pin, autoplay: values.autoplay,
      });
      setCreatingNew(false);
    }
  }

  async function handleDeleteSub() {
    if (!editingSubId) return;
    await removeProfile(editingSubId);
    setEditingSubId(null);
  }

  return (
    <>
      {/* Supabase (primary) profile modal */}
      {editSupabase && (
        <ProfileEditModal onClose={() => setEditSupabase(false)} />
      )}

      {/* Sub-profile modal — add or edit */}
      {(creatingNew || editingSubId !== null) && (
        <ProfileEditModal
          title={creatingNew ? "Nuevo perfil" : "Editar perfil"}
          initialValues={editingSubProfile ? toModalValues(editingSubProfile) : { autoplay: true }}
          onSave={(v) => void handleSaveSubProfile(v)}
          onDelete={editingSubId ? () => void handleDeleteSub() : undefined}
          onClose={() => { setEditingSubId(null); setCreatingNew(false); }}
        />
      )}

      {pinGate && (
        <PinGate
          name={pinGate.name}
          correctPin={pinGate.correctPin}
          onSuccess={() => {
            setActiveProfile({ id: pinGate.id, name: pinGate.name, isKids: pinGate.isKids });
            router.push("/inicio");
          }}
          onCancel={() => setPinGate(null)}
        />
      )}

      <ScreenA
        supabaseName={isLoaded ? supabaseName : null}
        supabaseColor={supabaseColor}
        supabaseImageUrl={supabaseImageUrl}
        supabaseIconId={supabaseIconId}
        profiles={profiles}
        onSelectSupabase={() => {
          setActiveProfile({ id: "__supabase__", name: supabaseName ?? "", isKids: false });
          router.push("/inicio");
        }}
        onSelectSub={(profile) => {
          if (profile.requirePin && profile.pin) {
            setPinGate({ id: profile.id, name: profile.name, isKids: profile.isKids, correctPin: profile.pin });
          } else {
            setActiveProfile({ id: profile.id, name: profile.name, isKids: profile.isKids });
            router.push("/inicio");
          }
        }}
        onEditSupabase={() => setEditSupabase(true)}
        onEditSub={(id) => setEditingSubId(id)}
        onAddProfile={() => setCreatingNew(true)}
      />
    </>
  );
}

// ─── Screen A: ¿Quién está viendo? ───────────────────────────────────────────

function ScreenA({
  supabaseName, supabaseColor, supabaseImageUrl, supabaseIconId,
  profiles,
  onSelectSupabase, onSelectSub, onEditSupabase, onEditSub, onAddProfile,
}: {
  supabaseName:     string | null;
  supabaseColor:    string;
  supabaseImageUrl: string;
  supabaseIconId:   string;
  profiles:         readonly Profile[];
  onSelectSupabase: () => void;
  onSelectSub:      (profile: Profile) => void;
  onEditSupabase:   () => void;
  onEditSub:        (id: string) => void;
  onAddProfile:     () => void;
}) {
  const router = useRouter();
  const supabaseColorKey = (Object.keys(COLOR_VALUES) as AvatarColor[]).find(
    (k) => COLOR_VALUES[k] === supabaseColor,
  ) ?? "green";

  const startExpand = useTransitionStore((s) => s.startExpand);

  function triggerNav(rect: DOMRect, navigate: () => void) {
    const size = Math.hypot(window.innerWidth, window.innerHeight) * 2.6;
    startExpand({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, size);
    setTimeout(navigate, 1050);
  }

  async function handleSignOut() {
    await getSupabaseBrowserClient().auth.signOut();
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "#080A0F" }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-8 pt-7">
        <GmaLogo />
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="text-[13px] font-semibold text-[#6D7D94] transition-colors hover:text-white"
        >
          Cerrar sesión
        </button>
      </div>

      {/* Center content */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-16">
        <h1 className="mb-3 text-[64px] leading-[1.05] text-white" style={serifItalic}>
          ¿Quién está viendo?
        </h1>
        <p className="mb-16 text-[18px] text-[#6D7D94]">Elige un perfil para continuar</p>

        <div className="flex flex-wrap items-start justify-center gap-10">

          {/* ── Primary Supabase profile ── */}
          {supabaseName !== null && (
            <ProfileCard
              onClick={(rect) => triggerNav(rect, onSelectSupabase)}
              onEdit={onEditSupabase}
              glowColor={supabaseColor}
              label={supabaseName}
            >
              {supabaseImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={supabaseImageUrl} alt="" className="h-full w-full object-cover" />
              ) : supabaseIconId ? (
                renderAvatar(supabaseIconId, supabaseColorKey) as React.ReactNode
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-[54px] font-extrabold"
                  style={{ background: supabaseColor, color: "#03200F" }}
                >
                  {supabaseName[0]?.toUpperCase() ?? "?"}
                </div>
              )}
            </ProfileCard>
          )}

          {/* ── Sub-profiles ── */}
          {profiles.map((profile) => {
            const colorHex = COLOR_VALUES[profile.color as AvatarColor] ?? "#22B16B";
            const isImage  = profile.avatarId.startsWith("/") || profile.avatarId.startsWith("data:");
            return (
              <ProfileCard
                key={profile.id}
                onClick={(rect) => triggerNav(rect, () => onSelectSub(profile))}
                onEdit={() => onEditSub(profile.id)}
                glowColor={colorHex}
                label={profile.name}
                badge={profile.isKids ? "niños" : undefined}
              >
                {isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatarId} alt="" className="h-full w-full object-cover" />
                ) : (
                  renderAvatar(profile.avatarId, profile.color) as React.ReactNode
                )}
              </ProfileCard>
            );
          })}

          {/* ── Add profile ── */}
          <button
            type="button"
            onClick={onAddProfile}
            className="group flex flex-col items-center gap-4"
          >
            <div className="flex h-[140px] w-[140px] items-center justify-center rounded-full border-2 border-dashed border-[#2A2A2A] transition-[border-color,background] duration-200 group-hover:border-[#22B16B]/50 group-hover:bg-[#22B16B]/5">
              <GmaIcon name="plus" size={30} className="text-[#3A3A3A] transition-colors group-hover:text-[#22B16B]/70" />
            </div>
            <div className="text-[17px] font-semibold text-[#3A3A3A] transition-colors group-hover:text-[#6D7D94]">
              Añadir perfil
            </div>
          </button>

        </div>
      </div>
    </div>
  );
}

// ─── Shared profile card ──────────────────────────────────────────────────────

function ProfileCard({
  children, onClick, onEdit, glowColor, label, badge,
}: {
  children:  React.ReactNode;
  onClick:   (rect: DOMRect) => void;
  onEdit:    () => void;
  glowColor: string;
  label:     string;
  badge?:    string;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="group flex flex-col items-center gap-4">
      <button
        ref={btnRef}
        type="button"
        onClick={() => btnRef.current && onClick(btnRef.current.getBoundingClientRect())}
        className="relative h-[140px] w-[140px] overflow-hidden rounded-full transition-transform duration-200 group-hover:scale-105"
        style={{ boxShadow: `0 10px 40px ${glowColor}44` }}
      >
        {children}
      </button>
      <div className="flex flex-col items-center gap-2">
        <div className="text-[17px] font-semibold text-[#B8C5D4] transition-colors group-hover:text-white">
          {label}
        </div>
        {badge && (
          <div
            className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#4A5568]"
            style={{ fontFamily: "ui-monospace, monospace" }}
          >
            {badge}
          </div>
        )}
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1.5 rounded-full border border-[#2A2A2A] bg-[#111318] px-4 py-1.5 text-[12px] font-semibold text-[#6D7D94] opacity-0 transition-[opacity,border-color,color] duration-200 hover:border-[#22B16B]/40 hover:text-white group-hover:opacity-100"
        >
          <PencilIcon size={11} />
          Editar
        </button>
      </div>
    </div>
  );
}

// ─── PIN gate overlay ─────────────────────────────────────────────────────────

function PinGate({
  name, correctPin, onSuccess, onCancel,
}: {
  name:       string;
  correctPin: string;
  onSuccess:  () => void;
  onCancel:   () => void;
}) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [error,  setError]  = useState(false);
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  function handleChange(i: number, v: string) {
    const digit = v.replace(/\D/g, "").slice(-1);
    const next  = [...digits];
    next[i]     = digit;
    setDigits(next);
    setError(false);
    if (digit && i < 3) refs[i + 1]?.current?.focus();
    if (digit && i === 3) {
      const entered = [...next.slice(0, 3), digit].join("");
      if (entered === correctPin) { onSuccess(); }
      else { setError(true); setDigits(["", "", "", ""]); refs[0]?.current?.focus(); }
    }
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      refs[i - 1]?.current?.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[700] flex flex-col items-center justify-center"
      style={{ background: "#080A0F" }}
    >
      <GmaLogo />
      <div className="mt-16 flex flex-col items-center gap-6 text-center">
        <h2 className="text-[32px] font-extrabold text-white" style={serifItalic}>
          ¿Quién es {name}?
        </h2>
        <p className="text-[15px] text-[#6D7D94]">Introduce el PIN para acceder</p>

        <div className="flex gap-4 mt-2">
          {refs.map((ref, i) => (
            <input
              key={i}
              ref={ref}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digits[i] ?? ""}
              autoFocus={i === 0}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="h-16 w-16 rounded-[14px] border text-center text-[28px] font-bold text-white outline-none transition-colors"
              style={{
                background:  "#0E1016",
                borderColor: error ? "#ff5252" : digits[i] ? "#22B16B" : "#1E1E1E",
              }}
            />
          ))}
        </div>

        {error && (
          <p className="text-[13px] font-semibold text-[#ff5252]">PIN incorrecto. Inténtalo de nuevo.</p>
        )}

        <button
          type="button"
          onClick={onCancel}
          className="mt-4 text-[13px] font-semibold text-[#3A4A5A] transition-colors hover:text-[#6D7D94]"
        >
          Volver a perfiles
        </button>
      </div>
    </div>
  );
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function GmaLogo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/images/logo-gma.png" alt="GMA Filmo" className="h-10 w-auto" />
  );
}

function PencilIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}
