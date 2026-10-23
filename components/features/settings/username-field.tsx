"use client";

import { AnimatePresence, motion } from "motion/react";
import { useUsernameEditor } from "@/hooks/use-username-editor";
import {
  USERNAME_CHANGE_LIMIT, USERNAME_MAX, USERNAME_MIN, USERNAME_WINDOW_DAYS, formatHandle, usernameErrorMessage,
} from "@/lib/profiles/username";

const BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-white/[0.07] px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-white/[0.13] focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40";

type RuleState = "idle" | "ok" | "bad";

function formatDay(date: Date): string {
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "long" });
}

/** Una regla del @ que se enciende en vivo: gris sin escribir, verde si se cumple, roja si no. */
function Rule({ state, children }: { readonly state: RuleState; readonly children: string }) {
  const tone = state === "ok" ? "border-[#22B16B]/50 bg-[#22B16B]/10 text-[#5FD39A]"
    : state === "bad" ? "border-[#ff7b7b]/50 bg-[#ff7b7b]/10 text-[#ff7b7b]"
      : "border-white/10 bg-white/[0.03] text-[#8A8A8A]";
  return (
    <li className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors duration-200 ${tone}`}>
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-3 shrink-0">
        {state === "ok" ? <path d="M2.5 6.5 5 9l4.5-5.5" /> : state === "bad" ? <path d="M3 3l6 6M9 3 3 9" /> : <circle cx="6" cy="6" r="1.6" fill="currentColor" stroke="none" />}
      </svg>
      {children}
      <span className="sr-only">{state === "ok" ? " (cumple)" : state === "bad" ? " (no cumple)" : ""}</span>
    </li>
  );
}

/** El @usuario: público y único. Se puede cambiar una vez cada 30 días (el primer cambio, desde el provisional, es libre). */
export function UsernameField() {
  const editor = useUsernameEditor();
  const { username, remaining, nextChange, isEditing, draft, candidate, availability, shownError, canSave, isSaving, saved } = editor;

  const hasText = candidate !== "";
  const lengthState: RuleState = !hasText ? "idle" : candidate.length >= USERNAME_MIN && candidate.length <= USERNAME_MAX ? "ok" : "bad";
  const charsState: RuleState = !hasText ? "idle" : /^[a-z0-9_]+$/.test(candidate) ? "ok" : "bad";
  const freeState: RuleState = candidate === username ? "idle"
    : availability === "free" ? "ok" : availability === "taken" || shownError === "reserved" ? "bad" : "idle";
  const isInvalid = Boolean(shownError);
  const fieldTone = isInvalid ? "border-[#ff7b7b]/70 shadow-[0_0_0_3px_rgba(255,123,123,0.12)]"
    : availability === "free" ? "border-[#22B16B] shadow-[0_0_0_3px_rgba(34,177,107,0.14)]"
      : "border-white/15 focus-within:border-[#22B16B] focus-within:shadow-[0_0_0_3px_rgba(34,177,107,0.14)]";
  const counterTone = candidate.length > USERNAME_MAX ? "text-[#ff7b7b]" : "text-[#8A8A8A]";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="block break-all text-[22px] font-extrabold leading-tight tracking-tight text-white">
            {username ? <><span className="text-[#2AC57A]">@</span>{username}</> : "—"}
          </span>
          <span className="mt-1 inline-flex items-center gap-1.5 text-[12.5px] text-[#8A8A8A]">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-3.5 shrink-0">
              {nextChange ? <><rect x="3.5" y="7" width="9" height="6.5" rx="1.5" /><path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7" /></> : <><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3.2l2 1.3" /></>}
            </svg>
            {nextChange ? `Podrás cambiarlo de nuevo el ${formatDay(nextChange)}.` : `Puedes cambiarlo ${USERNAME_CHANGE_LIMIT} veces cada ${USERNAME_WINDOW_DAYS} días (te quedan ${remaining}).`}
          </span>
        </div>
        <button type="button" disabled={!username || Boolean(nextChange)} onClick={() => (isEditing ? editor.cancel() : editor.start())} className={BUTTON}>
          {isEditing ? "Cancelar" : "Cambiar"}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {isEditing && (
          <motion.form onSubmit={(e) => void editor.submit(e)} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }} className="mt-4">
            <label className={`flex min-w-0 items-center gap-1 rounded-[14px] border bg-black/40 px-4 transition-[border-color,box-shadow] duration-200 ${fieldTone}`}>
              <span aria-hidden="true" className="select-none text-[26px] font-extrabold leading-none text-[#2AC57A]">@</span>
              <input autoFocus value={draft} onChange={(e) => editor.setDraft(e.target.value)}
                maxLength={USERNAME_MAX + 1} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username"
                placeholder="tu_nombre"
                aria-label="Nuevo nombre de usuario" aria-invalid={isInvalid ? true : undefined} aria-describedby="username-hint"
                className="min-w-0 flex-1 bg-transparent py-3.5 text-[22px] font-bold tracking-tight text-white placeholder-white/25 outline-none" />
              <span aria-hidden="true" className={`shrink-0 text-[12.5px] font-semibold tabular-nums transition-colors ${counterTone}`}>
                {candidate.length}/{USERNAME_MAX}
              </span>
            </label>

            <ul aria-label="Reglas del @" className="mt-3 flex flex-wrap gap-2">
              <Rule state={lengthState}>{`${USERNAME_MIN} a ${USERNAME_MAX} caracteres`}</Rule>
              <Rule state={charsState}>Letras sin tilde, números y «_»</Rule>
              <Rule state={freeState}>{availability === "checking" ? "Comprobando…" : "Libre"}</Rule>
            </ul>

            <p id="username-hint" role="status" className={`mt-3 min-h-5 text-[13px] ${isInvalid ? "text-[#ff7b7b]" : availability === "free" ? "text-[#5FD39A]" : "text-[#8A8A8A]"}`}>
              {isInvalid
                ? usernameErrorMessage(shownError!)
                : availability === "free"
                  ? `${formatHandle(candidate)} está libre. ${remaining > 1 ? `Después te quedarán ${remaining - 1}.` : `Será tu último cambio hasta dentro de ${USERNAME_WINDOW_DAYS} días.`}`
                  : "Es el nombre que verán los demás en tus comentarios y valoraciones."}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="submit" disabled={!canSave}
                className="min-h-11 rounded-full bg-[#22B16B] px-6 text-[13.5px] font-bold text-[#031A0E] transition-colors hover:bg-[#2AC57A] focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40">
                {isSaving ? "Guardando…" : "Guardar @"}
              </button>
              {canSave && (
                <span className="min-w-0 truncate text-[12.5px] text-[#8A8A8A]">
                  Así te verán: <strong className="font-semibold text-white">{formatHandle(candidate)}</strong>
                </span>
              )}
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {saved && !isEditing && <p role="status" className="mt-2 text-[12.5px] text-[#5FD39A]">Listo: ahora eres {formatHandle(username)}.</p>}
    </div>
  );
}
