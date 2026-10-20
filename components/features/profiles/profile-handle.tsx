"use client";

import { useId } from "react";
import { useUsernameEditor } from "@/hooks/use-username-editor";
import { USERNAME_MAX, USERNAME_WINDOW_DAYS, formatHandle, usernameErrorMessage } from "@/lib/profiles/username";

const remainingText = (n: number, prefix = "te quedan") =>
  n <= 0 ? `no te quedarán más cambios en ${USERNAME_WINDOW_DAYS} días` : `${prefix} ${n} ${n === 1 ? "cambio" : "cambios"} en ${USERNAME_WINDOW_DAYS} días`;
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const formatDay = (date: Date) => date.toLocaleDateString("es-ES", { day: "numeric", month: "long" });

/**
 * El @ de la cuenta, bajo el nombre del perfil: un campo siempre visible. Al pulsarlo y empezar a escribir aparecen el
 * ✓ (guardar) y la ✗ (cancelar); mientras se escribe se comprueba el formato y si está libre. Con el cambio bloqueado
 * por el plazo de 30 días el campo se ve, pero no se puede editar.
 */
export function ProfileHandle() {
  const editor = useUsernameEditor();
  const { username, remaining, nextChange, isEditing, draft, candidate, availability, shownError, canSave, isSaving } = editor;
  const hintId = useId();
  if (!username) return null;

  const isLocked = Boolean(nextChange);
  const fieldTone = isEditing && shownError ? "border-[#ff7b7b]/70 shadow-[0_0_0_3px_rgba(255,123,123,0.14)]"
    : isEditing && availability === "free" ? "border-[#5FD39A] shadow-[0_0_0_3px_rgba(95,211,154,0.16)]"
      : isLocked ? "border-white/10"
        : "border-white/15 focus-within:border-[#5FD39A] focus-within:shadow-[0_0_0_3px_rgba(95,211,154,0.16)]";
  const shown = isEditing ? draft : username;
  const length = isEditing ? candidate.length : username.length;

  let hint: string;
  if (!isEditing) hint = isLocked ? `Podrás cambiar el @ el ${formatDay(nextChange!)}.` : `Tu @ es lo que ven los demás. Púlsalo para cambiarlo (${remainingText(remaining)}).`;
  else if (shownError) hint = usernameErrorMessage(shownError);
  else if (availability === "checking") hint = "Comprobando…";
  else if (availability === "free") hint = `${formatHandle(candidate)} está libre. ${capitalize(remainingText(remaining - 1, "después"))}.`;
  else hint = "Letras sin tilde, números y «_», de 3 a 20.";

  return (
    <form onSubmit={(e) => void editor.submit(e)} className="-mt-2 flex w-full max-w-[340px] flex-col items-center gap-2.5">
      <div className="flex w-full items-center gap-2">
        <label className={`flex min-w-0 flex-1 items-center gap-0.5 rounded-full border bg-white/[0.06] py-1 pl-4 pr-3 transition-[border-color,box-shadow] duration-200 ${fieldTone}`}>
          <span aria-hidden="true" className="select-none text-[18px] font-bold text-[#5FD39A]">@</span>
          <input value={shown} readOnly={isLocked} onChange={(e) => editor.setDraft(e.target.value)}
            onFocus={() => { if (!isEditing && !isLocked) editor.start(); }}
            onKeyDown={(e) => { if (e.key === "Escape" && isEditing) { e.stopPropagation(); editor.cancel(); } }}
            maxLength={USERNAME_MAX + 1} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" placeholder="tu_nombre"
            aria-label={isEditing ? "Nuevo nombre de usuario" : "Nombre de usuario"} aria-invalid={isEditing && shownError ? true : undefined} aria-describedby={hintId}
            className="min-w-0 flex-1 bg-transparent py-1.5 text-[18px] font-bold text-white placeholder-white/25 outline-none read-only:cursor-not-allowed read-only:text-white/70" />
          {isLocked ? (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-white/45"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5" /><path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7" /></svg>
          ) : (
            <span aria-hidden="true" className={`shrink-0 text-[12px] font-semibold tabular-nums ${length > USERNAME_MAX ? "text-[#ff7b7b]" : "text-white/45"}`}>{length}/{USERNAME_MAX}</span>
          )}
        </label>
        {isEditing && (
          <>
            <button type="submit" disabled={!canSave} aria-label="Guardar @"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-[#22B16B] text-[#031A0E] transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:scale-100 disabled:opacity-40 motion-reduce:transition-none">
              {isSaving
                ? <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-[#031A0E] border-t-transparent" />
                : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>}
            </button>
            <button type="button" onClick={editor.cancel} aria-label="Cancelar cambio de @"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </>
        )}
      </div>
      <p id={hintId} role="status" className={`text-center text-[12.5px] leading-snug ${isEditing && shownError ? "text-[#ff7b7b]" : isEditing && availability === "free" ? "text-[#5FD39A]" : "text-white/60"}`}>
        {hint}
      </p>
    </form>
  );
}
