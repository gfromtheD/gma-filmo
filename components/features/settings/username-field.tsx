"use client";

import { AnimatePresence, motion } from "motion/react";
import { useUsernameEditor } from "@/hooks/use-username-editor";
import { USERNAME_COOLDOWN_DAYS, USERNAME_MAX, formatHandle, usernameErrorMessage } from "@/lib/profiles/username";

const BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-white/[0.07] px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-white/[0.13] focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40";

function formatDay(date: Date): string {
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "long" });
}

/** El @usuario: público y único. Se puede cambiar una vez cada 30 días (el primer cambio, desde el provisional, es libre). */
export function UsernameField() {
  const editor = useUsernameEditor();
  const { username, nextChange, isEditing, draft, candidate, availability, shownError, canSave, isSaving, saved } = editor;

  const status = nextChange
    ? `Podrás cambiarlo de nuevo el ${formatDay(nextChange)}.`
    : `Puedes cambiarlo una vez cada ${USERNAME_COOLDOWN_DAYS} días.`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="block break-all text-[15px] font-semibold text-white">{username ? formatHandle(username) : "—"}</span>
          <span className="mt-0.5 block text-[12.5px] text-[#8A8A8A]">{status}</span>
        </div>
        <button type="button" disabled={!username || Boolean(nextChange)} onClick={() => (isEditing ? editor.cancel() : editor.start())} className={BUTTON}>
          {isEditing ? "Cancelar" : "Cambiar"}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {isEditing && (
          <motion.form onSubmit={(e) => void editor.submit(e)} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }} className="mt-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="flex min-w-0 flex-1 items-center rounded-[10px] border border-white/15 bg-black/40 px-3.5 focus-within:border-[#22B16B]">
                <span aria-hidden="true" className="text-base text-[#7C7C7C] sm:text-[14px]">@</span>
                <input autoFocus value={draft} onChange={(e) => editor.setDraft(e.target.value)}
                  maxLength={USERNAME_MAX + 1} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username"
                  aria-label="Nuevo nombre de usuario" aria-invalid={shownError ? true : undefined} aria-describedby="username-hint"
                  className="min-w-0 flex-1 bg-transparent py-2.5 pl-0.5 text-base text-white placeholder-[#7C7C7C] outline-none sm:text-[14px]" />
              </label>
              <button type="submit" disabled={!canSave}
                className="min-h-11 rounded-full bg-[#22B16B] px-5 text-[13.5px] font-bold text-[#031A0E] transition-colors hover:bg-[#2AC57A] disabled:opacity-40">
                {isSaving ? "Guardando…" : "Guardar"}
              </button>
            </div>
            <p id="username-hint" role="status" className={`mt-2 text-[12.5px] ${shownError ? "text-[#ff7b7b]" : availability === "free" ? "text-[#5FD39A]" : "text-[#8A8A8A]"}`}>
              {shownError
                ? usernameErrorMessage(shownError)
                : availability === "checking"
                  ? "Comprobando…"
                  : availability === "free"
                    ? `${formatHandle(candidate)} está libre. Después no podrás cambiarlo en ${USERNAME_COOLDOWN_DAYS} días.`
                    : "Letras sin tilde, números y «_», de 3 a 20."}
            </p>
          </motion.form>
        )}
      </AnimatePresence>

      {saved && !isEditing && <p role="status" className="mt-2 text-[12.5px] text-[#5FD39A]">Listo: ahora eres {formatHandle(username)}.</p>}
    </div>
  );
}
