"use client";

import { useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GmaIcon } from "@/components/ui/gma-icon";
import { useTransitionStore, type TransitionVariant } from "@/store/use-transition-store";
import { useProfileStore, type Profile } from "@/store/use-profile-store";
import { useUserProfile } from "@/hooks/use-user-profile";
import { ProfileEditModal, type SubProfileValues } from "@/components/features/profiles/profile-edit-modal";
import { COLOR_VALUES, isValidIconId, type AvatarColor } from "@/lib/data/profile-avatars";
import { ProfileAvatar } from "@/components/ui/profile-avatar";import { avatarContentFromId } from "@/lib/profiles/avatar";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const displayItalic: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  fontStyle: "italic",
};

// ─── Root ─────────────────────────────────────────────────────────────────────

export function ProfileSelector() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  // Optional redirect after profile selection (e.g. ?next=/mi-estudio)
  const nextUrl = searchParams.get("next") ?? "/inicio";

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

  const editingSubProfile = profiles.find((p) => p.id === editingSubId) ?? null;

  // Convert a sub-profile's stored data (color keys, avatarId as icon or URL)
  // into the hex-based shape ProfileEditModal expects
  function toModalValues(p: Profile): Partial<SubProfileValues> {
    const colorHex = COLOR_VALUES[p.color as AvatarColor] ?? "#22B16B";
    const isImage  = p.avatarId.startsWith("/") || p.avatarId.startsWith("data:");
    return {
      name:       p.name,
      color:      colorHex,
      iconId:     !isImage && isValidIconId(p.avatarId) ? p.avatarId : "",
      imageUrl:   isImage ? p.avatarId : "",
    };
  }

  async function handleSaveSubProfile(values: SubProfileValues) {
    const colorKey = (Object.keys(COLOR_VALUES) as AvatarColor[]).find(
      (k) => COLOR_VALUES[k] === values.color,
    ) ?? "green";
    // Sin foto ni icono se guarda "": el perfil muestra su inicial.
    const avatarId = values.imageUrl || values.iconId || "";

    if (editingSubId) {
      await updateProfile(editingSubId, { name: values.name, avatarId, color: colorKey });
      setEditingSubId(null);
    } else {
      await addProfile({ name: values.name, avatarId, color: colorKey });
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
          initialValues={editingSubProfile ? toModalValues(editingSubProfile) : undefined}
          onSave={(v) => void handleSaveSubProfile(v)}
          onDelete={editingSubId ? () => void handleDeleteSub() : undefined}
          onClose={() => { setEditingSubId(null); setCreatingNew(false); }}
        />
      )}

      <ScreenA
        supabaseName={isLoaded ? supabaseName : null}
        supabaseColor={supabaseColor}
        supabaseImageUrl={supabaseImageUrl}
        supabaseIconId={supabaseIconId}
        profiles={profiles}
        nextUrl={nextUrl}
        onSelectSupabase={() => {
          setActiveProfile({ id: "__supabase__", name: supabaseName ?? "" });
          router.push(nextUrl);
        }}
        onSelectSub={(profile) => {
          setActiveProfile({ id: profile.id, name: profile.name });
          router.push(nextUrl);
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
  profiles, nextUrl,
  onSelectSupabase, onSelectSub, onEditSupabase, onEditSub, onAddProfile,
}: {
  supabaseName:     string | null;
  supabaseColor:    string;
  supabaseImageUrl: string;
  supabaseIconId:   string;
  profiles:         readonly Profile[];
  nextUrl:          string;
  onSelectSupabase: () => void;
  onSelectSub:      (profile: Profile) => void;
  onEditSupabase:   () => void;
  onEditSub:        (id: string) => void;
  onAddProfile:     () => void;
}) {
  const router = useRouter();

  const startExpand = useTransitionStore((s) => s.startExpand);
  // Entrar a Mi Estudio se diferencia con la variante invertida (negro/verde)
  // de la misma animación — solo aplica al perfil principal, nunca a sub-perfiles.
  const isCreatorEntry = nextUrl.startsWith("/mi-estudio");

  // El círculo que se expande usa el color de fondo que el usuario eligió para el perfil.
  const supabaseColorHex = supabaseColor.startsWith("#")
    ? supabaseColor
    : COLOR_VALUES[supabaseColor as AvatarColor] ?? COLOR_VALUES.green;

  function triggerNav(
    rect: DOMRect, navigate: () => void, name: string, profileId: string, color: string,
    variant: TransitionVariant = "viewer",
  ) {
    const key = `gma_profile_visited_${profileId}`;
    const isFirstVisit = !localStorage.getItem(key);
    if (isFirstVisit) localStorage.setItem(key, "1");
    const size = Math.hypot(window.innerWidth, window.innerHeight) * 2.6;
    startExpand({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, size, name, isFirstVisit, variant, color);
    setTimeout(navigate, 950);
  }

  async function handleSignOut() {
    await getSupabaseBrowserClient().auth.signOut();
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col" style={{ background: "var(--gma-bg)" }}>

      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[calc(1.5rem+env(safe-area-inset-top))] sm:pl-[max(2rem,env(safe-area-inset-left))] sm:pr-[max(2rem,env(safe-area-inset-right))] sm:pt-[calc(1.75rem+env(safe-area-inset-top))]">
        <GmaLogo />
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="min-h-11 px-2 text-[13px] font-semibold text-[#7C7C7C] transition-colors hover:text-white"
        >
          Cerrar sesión
        </button>
      </div>

      {/* Center content */}
      <div className="flex flex-1 flex-col items-center justify-center pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-10 pb-[calc(3rem+env(safe-area-inset-bottom))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] sm:pb-[calc(4rem+env(safe-area-inset-bottom))]">
        <h1 className="mb-3 max-w-full break-words text-center text-[clamp(2.25rem,7vw,4rem)] leading-[1.05] text-white" style={displayItalic}>
          ¿Quién está viendo?
        </h1>
        <p className="mb-9 text-center text-[16px] text-[#7C7C7C] sm:mb-16 sm:text-[18px]">Elige un perfil para continuar</p>

        <div className="grid w-full max-w-[1000px] grid-cols-2 justify-items-center gap-x-4 gap-y-8 sm:flex sm:flex-wrap sm:items-start sm:justify-center sm:gap-10">

          {/* ── Primary Supabase profile ── */}
          {supabaseName !== null && (
            <ProfileCard
              onClick={(rect) => triggerNav(rect, onSelectSupabase, supabaseName ?? "", "__supabase__", supabaseColorHex, isCreatorEntry ? "creator" : "viewer")}
              onEdit={onEditSupabase}
              glowColor={supabaseColor}
              label={supabaseName}
            >
              <ProfileAvatar name={supabaseName} color={supabaseColor} url={supabaseImageUrl || null} iconId={supabaseIconId || null} size="fill" />
            </ProfileCard>
          )}

          {/* ── Sub-profiles ── */}
          {profiles.map((profile) => {
            const colorHex = COLOR_VALUES[profile.color as AvatarColor] ?? "#22B16B";
            const content = avatarContentFromId(profile.avatarId) ?? { kind: "initial" as const };
            return (
              <ProfileCard
                key={profile.id}
                onClick={(rect) => triggerNav(rect, () => onSelectSub(profile), profile.name, profile.id, colorHex)}
                onEdit={() => onEditSub(profile.id)}
                glowColor={colorHex}
                label={profile.name}
              >
                <ProfileAvatar name={profile.name} color={profile.color} url={content.kind === "image" ? content.src : null} iconId={content.kind === "icon" ? content.iconId : null} size="fill" />
              </ProfileCard>
            );
          })}

          {/* ── Add profile ── */}
          <button
            type="button"
            onClick={onAddProfile}
            className="group flex w-full min-w-0 max-w-[140px] flex-col items-center gap-3 sm:gap-4"
          >
            <div className="flex h-[104px] w-[104px] sm:h-[140px] sm:w-[140px] items-center justify-center rounded-full border-2 border-dashed border-gma-line-strong transition-[border-color,background] duration-200 group-hover:border-[#22B16B]/50 group-hover:bg-[#22B16B]/5">
              <GmaIcon name="plus" size={30} className="text-gma-line-strong transition-colors group-hover:text-[#22B16B]/70" />
            </div>
            <div className="max-w-full break-words text-center text-[15px] font-semibold text-[#7C7C7C] sm:text-[17px] transition-colors group-hover:text-[#7C7C7C]">
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
  children, onClick, onEdit, glowColor, label,
}: {
  children:  React.ReactNode;
  onClick:   (rect: DOMRect) => void;
  onEdit:    () => void;
  glowColor: string;
  label:     string;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="group flex w-full min-w-0 max-w-[140px] flex-col items-center gap-3 sm:gap-4">
      <button
        ref={btnRef}
        type="button"
        onClick={() => btnRef.current && onClick(btnRef.current.getBoundingClientRect())}
        aria-label={`Entrar como ${label}`}
        className="relative h-[104px] w-[104px] sm:h-[140px] sm:w-[140px] overflow-hidden rounded-full transition-transform duration-200 group-hover:scale-105"
        style={{ boxShadow: `0 10px 40px ${glowColor}44` }}
      >
        {children}
      </button>
      <div className="flex w-full min-w-0 flex-col items-center gap-2">
        <div className="max-w-full break-words text-center text-[15px] font-semibold text-[#C4C4C4] sm:text-[17px] transition-colors group-hover:text-white">
          {label}
        </div>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Editar ${label}`}
          title="Editar"
          className="grid size-11 place-items-center rounded-[4px] border border-gma-line-strong bg-gma-panel text-[#7C7C7C] opacity-100 transition-[opacity,border-color,color] md:[@media(hover:hover)]:opacity-0 duration-200 hover:border-[#22B16B]/40 hover:text-white group-hover:opacity-100 group-focus-within:opacity-100"
        >
          <PencilIcon size={16} />
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
