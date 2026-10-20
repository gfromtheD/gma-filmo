"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useVisibleViewport } from "@/hooks/use-visible-viewport";
import { useUserProfile } from "@/hooks/use-user-profile";
import { avatarContentFromId } from "@/lib/profiles/avatar";
import { ProfileHandle } from "@/components/features/profiles/profile-handle";
import { lockPageScroll } from "@/lib/scroll-lock";
import { isValidIconId, renderAvatar } from "@/lib/data/profile-avatars";
import { ColorSheet, PhotoSheet, SIDE_SHEET_GAP, SIDE_SHEET_WIDTH, type SheetPlacement } from "./profile-edit-sheets";

const NAME_MAX = 30;

// ─── Avatar ───────────────────────────────────────────────────────────────────

/** Rellena su contenedor: foto, icono o, si no hay ninguno, la inicial sobre el color de acento. */
function AvatarFill({ name, color, iconId, imageUrl }: { name: string; color: string; iconId: string; imageUrl: string }) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt="" className="size-full rounded-full object-cover" />;
  }
  if (iconId && isValidIconId(iconId)) return <div className="size-full overflow-hidden rounded-full">{renderAvatar(iconId, color)}</div>;
  return (
    <div className="flex size-full items-center justify-center rounded-full text-[44px] font-extrabold text-[#03200F]" style={{ background: color }}>
      {(name.trim()[0] ?? "?").toUpperCase()}
    </div>
  );
}

const PENCIL = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" />
  </svg>
);

// ─── Editor ───────────────────────────────────────────────────────────────────

export interface SubProfileValues {
  name:     string;
  color:    string;   // hex
  iconId:   string;
  imageUrl: string;
}

interface ProfileEditModalProps {
  onClose:        () => void;
  title?:         string;
  initialValues?: Partial<SubProfileValues>;
  onSave?:        (values: SubProfileValues) => void;
  onDelete?:      () => void;
}

type SheetId = "photo" | "color";

/**
 * Editor de perfil (nuevo perfil, editar el principal o un subperfil). En el centro, el perfil tal como se verá, y
 * sobre él tres controles pequeños. El color y la foto abren una hoja mínima con solo lo suyo; el nombre se edita
 * ahí mismo, sobre sí mismo. Los cambios se ven al momento en el avatar y «Guardar cambios» lo confirma todo.
 */
export function ProfileEditModal({ onClose, title, initialValues, onSave, onDelete }: ProfileEditModalProps) {
  const reduceMotion = useReducedMotion();
  const viewportBounds = useVisibleViewport();
  // En escritorio la hoja sale hacia la derecha; en pantallas estrechas (móvil, vertical) sube desde abajo.
  const placement: SheetPlacement = useMediaQuery("(min-width: 900px)") ? "side" : "bottom";
  const titleId = useId();
  const { displayName, username, avatarColor, chosenAvatarId, updateDisplayName, updateAvatarColor, updateSettings } = useUserProfile();

  // Local state — seeded from initialValues (sub-profile) or context (Supabase profile)
  const [name,     setName]     = useState(initialValues?.name     ?? displayName);
  const [color,    setColor]    = useState(initialValues?.color    ?? avatarColor);
  // En el perfil principal se parte del avatar ELEGIDO (no de la foto de creador ni de la de Google, que son de respaldo).
  const chosen = avatarContentFromId(chosenAvatarId);
  const [iconId,   setIconId]   = useState(initialValues?.iconId   ?? (chosen?.kind === "icon" ? chosen.iconId : ""));
  const [imageUrl, setImageUrl] = useState(initialValues?.imageUrl ?? (chosen?.kind === "image" ? chosen.src : ""));
  const [sheet, setSheet] = useState<SheetId | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const isNameCancelled = useRef(false);
  const nameButtonRef = useRef<HTMLButtonElement>(null);
  const wasEditingName = useRef(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const handleRefs = useRef<Record<SheetId, HTMLButtonElement | null>>({ photo: null, color: null });
  const lastSheet = useRef<SheetId | null>(null);

  // Bloquea el scroll de la página, lleva el foco al cuadro y lo devuelve al cerrar.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const unlockScroll = lockPageScroll();
    dialogRef.current?.focus();
    return () => { unlockScroll(); previous?.focus(); };
  }, []);

  // Escape cierra primero la hoja abierta y, si no hay ninguna, el editor.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (isEditingName) cancelNameEdit();
      else if (sheet) setSheet(null);
      else onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, sheet, isEditingName]);

  // Al terminar de editar el nombre, el foco vuelve a su botón.
  useEffect(() => {
    if (wasEditingName.current && !isEditingName) nameButtonRef.current?.focus();
    wasEditingName.current = isEditingName;
  }, [isEditingName]);

  // Al cerrar una hoja, el foco vuelve al control que la abrió.
  useEffect(() => {
    if (sheet) { lastSheet.current = sheet; return; }
    if (lastSheet.current) handleRefs.current[lastSheet.current]?.focus();
  }, [sheet]);

  function startNameEdit() {
    isNameCancelled.current = false;
    setNameDraft(name);
    setIsEditingName(true);
  }
  function commitNameEdit() {
    if (isNameCancelled.current) return;
    const trimmed = nameDraft.trim();
    if (trimmed) setName(trimmed); // un nombre vacío no se guarda: se queda el anterior
    setIsEditingName(false);
  }
  function cancelNameEdit() {
    isNameCancelled.current = true;
    setIsEditingName(false);
  }

  function pickImage(url: string) { setImageUrl(url); setIconId(""); }
  function pickIcon(id: string) { setIconId(id); setImageUrl(""); }

  async function handleSave() {
    setSaving(true);
    const trimmed = name.trim();

    if (onSave) {
      // Sub-profile mode: hand data back to caller, no Supabase/localStorage writes
      onSave({ name: trimmed || displayName, color, iconId, imageUrl });
      setSaving(false);
      onClose();
      return;
    }

    // Supabase profile mode
    if (trimmed && trimmed !== displayName) await updateDisplayName(trimmed);
    if (color !== avatarColor) await updateAvatarColor(color);
    updateSettings({ avatarIconId: iconId, avatarImageUrl: imageUrl });
    setSaving(false);
    onClose();
  }

  const isSheetOpen = sheet !== null;
  const isSide = placement === "side";
  const tab = isSheetOpen ? -1 : 0; // con una hoja abierta, lo de debajo no entra en el tabulador
  const sheetProps = { placement, onDone: () => setSheet(null) };
  const fade = reduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const };
  const shownName = name.trim() || displayName;

  return (
    <motion.div
      className="fixed inset-0 z-[600] flex items-center justify-center overflow-y-auto pl-[max(.75rem,env(safe-area-inset-left))] pr-[max(.75rem,env(safe-area-inset-right))] pt-[max(.75rem,env(safe-area-inset-top))] pb-[max(.75rem,env(safe-area-inset-bottom))] sm:pl-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))] sm:pt-[max(1.25rem,env(safe-area-inset-top))] sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      style={{ ...viewportBounds, background: "color-mix(in srgb, var(--gma-bg) 82%, transparent)" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fade}
      onClick={onClose}
    >
      <motion.div
        className="relative w-full max-w-[420px]"
        style={{ height: "min(580px, calc(var(--visible-viewport-height, 100dvh) - max(24px, env(safe-area-inset-top)) - max(24px, env(safe-area-inset-bottom))))" }}
        initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.97 }}
        // En escritorio, al salir la hoja el editor se desplaza a la izquierda para que el conjunto siga centrado.
        animate={{ opacity: 1, y: 0, scale: 1, x: isSide && isSheetOpen ? -(SIDE_SHEET_WIDTH + SIDE_SHEET_GAP) / 2 : 0 }}
        transition={reduceMotion ? { duration: 0 } : { default: { duration: 0.32, ease: [0.16, 1, 0.3, 1] }, x: { type: "spring", stiffness: 380, damping: 38 } }}
        onClick={(e) => e.stopPropagation()}
      >
      <div
        ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="relative z-10 flex h-full flex-col overflow-hidden rounded-[28px] bg-[#0A0E0C] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] outline-none"
      >
        {/* El color de acento tiñe todo el fondo desde arriba */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-55 transition-colors duration-500"
          style={{ background: color, maskImage: "radial-gradient(120% 70% at 50% 0%, #000 0%, transparent 72%)", WebkitMaskImage: "radial-gradient(120% 70% at 50% 0%, #000 0%, transparent 72%)" }} />

        <div className="relative flex shrink-0 items-center justify-between px-5 pt-4">
          <h2 id={titleId} className="text-[13px] font-semibold text-white/70">{title ?? "Editar perfil"}</h2>
          <button type="button" onClick={onClose} tabIndex={tab} aria-label="Cerrar edición de perfil"
            className="-mr-2 flex size-11 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* El perfil, tal como se verá */}
        <motion.div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-6" aria-hidden={isSheetOpen || undefined}
          animate={{ y: !isSide && isSheetOpen ? "-15dvh" : 0, scale: !isSide && isSheetOpen ? 0.88 : 1 }} transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 36 }}>
          <div className="relative aspect-square w-[clamp(96px,24dvh,148px)]">
            <button type="button" ref={(el) => { handleRefs.current.photo = el; }} tabIndex={tab} onClick={() => setSheet("photo")} aria-label="Cambiar foto o icono"
              className="block size-full rounded-full transition-[box-shadow,transform] duration-300 hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white motion-reduce:transition-none"
              style={{ boxShadow: `0 18px 50px -8px ${color}99, 0 0 0 3px ${color}` }}>
              <AvatarFill name={shownName} color={color} iconId={iconId} imageUrl={imageUrl} />
            </button>
            <button type="button" ref={(el) => { handleRefs.current.color = el; }} tabIndex={tab} onClick={() => setSheet("color")} aria-label="Cambiar color de acento"
              className="absolute -bottom-1 -left-1 size-10 rounded-full ring-[3px] ring-[#0A0E0C] transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none"
              style={{ background: color, boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.35)" }} />
            <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => setSheet("photo")}
              className="absolute -bottom-1 -right-1 grid size-10 place-items-center rounded-full bg-white text-[#0A0E0C] ring-[3px] ring-[#0A0E0C] transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none">
              {PENCIL}
            </button>
          </div>

          {isEditingName ? (
            <div className="flex w-full max-w-[320px] items-center gap-2.5">
              <input autoFocus value={nameDraft} maxLength={NAME_MAX} aria-label="Nombre del perfil" placeholder="¿Cómo te llamamos?"
                onChange={(e) => setNameDraft(e.target.value)} onFocus={(e) => e.currentTarget.select()} onBlur={commitNameEdit}
                // preventDefault: al terminar, el foco vuelve al botón del nombre y este mismo Intro lo volvería a pulsar.
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitNameEdit(); } }}
                className="min-w-0 flex-1 border-0 border-b-2 border-white/40 bg-transparent px-1 pb-1 text-center text-[clamp(1.6rem,6dvh,2.1rem)] leading-tight text-white placeholder-white/30 outline-none transition-colors focus:border-white"
                style={{ fontFamily: "var(--font-sans)", fontWeight: 500, fontStyle: "italic" }} />
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={commitNameEdit} aria-label="Guardar nombre"
                className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-[#0A0E0C] transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
              </button>
            </div>
          ) : (
            <button type="button" ref={nameButtonRef} tabIndex={tab} onClick={startNameEdit} aria-label={`Cambiar nombre: ${shownName}`}
              className="group flex max-w-full items-center gap-2.5 rounded-full px-3 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              <span className="min-w-0 break-words text-center text-[clamp(1.6rem,6dvh,2.1rem)] leading-tight text-white" style={{ fontFamily: "var(--font-sans)", fontWeight: 500, fontStyle: "italic" }}>
                {shownName}
              </span>
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-white/80 transition-colors group-hover:bg-white/20 group-hover:text-white">{PENCIL}</span>
            </button>
          )}
          {/* Perfil principal: el @ de la cuenta, debajo del nombre y como parte de él; se cambia aquí mismo. */}
          {!onSave && username && <ProfileHandle />}
        </motion.div>

        {/* Acciones */}
        <div className="relative flex shrink-0 flex-wrap items-center gap-2 px-5 pb-5 pt-2" aria-hidden={isSheetOpen || undefined}>
          {onDelete && (isConfirmingDelete ? (
            <div role="alert" className="flex flex-wrap items-center gap-1 text-[13px] text-[#ffb3b3]">
              ¿Eliminar este perfil?
              <button type="button" tabIndex={tab} onClick={() => setIsConfirmingDelete(false)} className="min-h-10 rounded-full px-3 font-semibold text-white/80 hover:text-white">No</button>
              <button type="button" tabIndex={tab} onClick={onDelete} className="min-h-10 rounded-full bg-[#ff5252] px-4 font-bold text-white hover:bg-[#ff6b6b]">Eliminar</button>
            </div>
          ) : (
            <button type="button" tabIndex={tab} onClick={() => setIsConfirmingDelete(true)} className="min-h-11 rounded-full px-3 text-[13px] font-semibold text-[#ff8a8a] transition-colors hover:bg-[#ff5252]/10">
              Eliminar perfil
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <button type="button" tabIndex={tab} onClick={onClose}
              className="min-h-11 rounded-full px-4 text-[13.5px] font-semibold text-white/80 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-white">
              Cancelar
            </button>
            <button type="button" tabIndex={tab} onClick={() => void handleSave()} disabled={saving}
              className="min-h-11 rounded-full bg-white px-6 text-[13.5px] font-bold text-[#0A0E0C] transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </div>

        {/* Hoja inferior (móvil): dentro de la tarjeta */}
        <AnimatePresence>
          {!isSide && sheet === "photo" && <PhotoSheet key="photo" {...sheetProps} color={color} iconId={iconId} imageUrl={imageUrl} onPickImage={pickImage} onPickIcon={pickIcon} />}
          {!isSide && sheet === "color" && <ColorSheet key="color" {...sheetProps} color={color} onPick={setColor} />}
        </AnimatePresence>
      </div>

      {/* Hoja lateral (escritorio): sale hacia la derecha desde detrás de la tarjeta */}
      <AnimatePresence>
        {isSide && sheet === "photo" && <PhotoSheet key="photo" {...sheetProps} color={color} iconId={iconId} imageUrl={imageUrl} onPickImage={pickImage} onPickIcon={pickIcon} />}
        {isSide && sheet === "color" && <ColorSheet key="color" {...sheetProps} color={color} onPick={setColor} />}
      </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
