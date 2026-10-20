"use client";

import { useId } from "react";
import { useUsernameEditor } from "@/hooks/use-username-editor";
import { USERNAME_COOLDOWN_DAYS, USERNAME_MAX, formatHandle, usernameErrorMessage } from "@/lib/profiles/username";

const ICON_BUTTON =
  "grid size-8 shrink-0 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40";

const formatDay = (date: Date) => date.toLocaleDateString("es-ES", { day: "numeric", month: "long" });

/**
 * El @ de la cuenta, justo debajo del nombre del perfil: en verde, con un lápiz para cambiarlo y una «i» que explica
 * (al pasar el cursor o enfocarla) qué ve cada quien. Al editar se escribe ahí mismo y se comprueba si está libre.
 */
export function ProfileHandle() {
  const editor = useUsernameEditor();
  const { username, nextChange, isEditing, draft, candidate, availability, shownError, canSave, isSaving } = editor;
  const tipId = useId();
  const hintId = useId();
  if (!username) return null;

  const info = [
    "Tu nombre solo lo ves tú; los demás ven tu @.",
    nextChange ? `Podrás cambiar el @ el ${formatDay(nextChange)}.` : `Puedes cambiar el @ una vez cada ${USERNAME_COOLDOWN_DAYS} días.`,
  ].join(" ");

  return (
    <div className="-mt-2 flex w-full max-w-[320px] flex-col items-center gap-2">
      {isEditing ? (
        <form onSubmit={(e) => void editor.submit(e)} className="flex w-full flex-col items-center gap-2">
          <div className="flex w-full items-center gap-2">
            <label className="flex min-w-0 flex-1 items-center border-b-2 border-[#5FD39A]/60 px-1 focus-within:border-[#5FD39A]">
              <span aria-hidden="true" className="text-[15px] text-[#5FD39A]/70">@</span>
              <input autoFocus value={draft} onChange={(e) => editor.setDraft(e.target.value)} maxLength={USERNAME_MAX + 1}
                autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username"
                aria-label="Nuevo nombre de usuario" aria-invalid={shownError ? true : undefined} aria-describedby={hintId}
                className="min-w-0 flex-1 bg-transparent py-1 pl-0.5 text-[16px] font-semibold text-[#5FD39A] outline-none" />
            </label>
            <button type="submit" disabled={!canSave} aria-label="Guardar @" className="min-h-9 rounded-full bg-[#22B16B] px-4 text-[13px] font-bold text-[#031A0E] transition-colors hover:bg-[#2AC57A] disabled:opacity-40">
              {isSaving ? "…" : "Guardar"}
            </button>
            <button type="button" onClick={editor.cancel} className="min-h-9 rounded-full px-2 text-[13px] font-semibold text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-white">
              Cancelar
            </button>
          </div>
          <p id={hintId} role="status" className={`text-center text-[12.5px] ${shownError ? "text-[#ff7b7b]" : availability === "free" ? "text-[#5FD39A]" : "text-white/60"}`}>
            {shownError
              ? usernameErrorMessage(shownError)
              : availability === "checking"
                ? "Comprobando…"
                : availability === "free"
                  ? `${formatHandle(candidate)} está libre.`
                  : "Letras sin tilde, números y «_», de 3 a 20."}
          </p>
        </form>
      ) : (
        <div className="relative flex items-center justify-center gap-1">
          <span className="min-w-0 break-all text-[16px] font-semibold text-[#5FD39A]">{formatHandle(username)}</span>
          <button type="button" onClick={editor.start} disabled={Boolean(nextChange)} aria-label="Cambiar @" className={ICON_BUTTON}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
          </button>
          <span className="group relative inline-flex">
            <button type="button" aria-label="Más información sobre el @" aria-describedby={tipId} className={ICON_BUTTON}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.01" /></svg>
            </button>
            <span id={tipId} role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-[240px] -translate-x-1/2 rounded-[10px] bg-[#1b221e] px-3 py-2 text-center text-[12.5px] leading-[1.4] text-white/85 opacity-0 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.8)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              {info}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
