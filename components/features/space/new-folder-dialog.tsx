"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Dialog } from "radix-ui";
import { useEffect, useState, type FormEvent } from "react";
import GlassFolder from "@/components/ui/glass-folder-cards";
import { Check, Xmark } from "@/components/ui/icons";
import { LoadingLabel } from "@/components/ui/loading-label";
import { FOLDER_COLORS, FOLDER_TEMPLATES } from "@/lib/lists/folder-colors";
import { LIST_NAME_MAX, listNameError } from "@/lib/lists/rules";

interface Props {
  readonly open: boolean;
  readonly onClose: () => void;
  /** Nombres de las listas que ya existen (para no repetir). */
  readonly existingNames: readonly string[];
  /** Crea la carpeta; devuelve el mensaje de error si algo falla. */
  readonly onCreate: (name: string, color: string) => Promise<string | null>;
}

const FIELD = "h-12 w-full rounded-[4px] border border-white/20 bg-black/50 px-3.5 text-[15px] text-white placeholder-white/40 outline-none transition-colors focus:border-[#22B16B]";

/**
 * Crear una carpeta nueva: eliges un tipo de partida (nombre y color sugeridos), lo cambias a tu gusto y ves la carpeta
 * de verdad mientras la preparas.
 */
export function NewFolderDialog({ open, onClose, existingNames, onCreate }: Props) {
  const reduceMotion = useReducedMotion();
  const [templateId, setTemplateId] = useState<string>(FOLDER_TEMPLATES[0]!.id);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(FOLDER_TEMPLATES[0]!.color);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) { setTemplateId(FOLDER_TEMPLATES[0]!.id); setName(""); setColor(FOLDER_TEMPLATES[0]!.color); setError(null); }
  }, [open]);

  function pickTemplate(id: string) {
    const template = FOLDER_TEMPLATES.find((t) => t.id === id);
    if (!template) return;
    setTemplateId(id);
    setName(template.name);
    setColor(template.color);
    setError(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const invalid = listNameError(name, existingNames);
    if (invalid) { setError(invalid); return; }
    setIsSaving(true);
    const failure = await onCreate(name, color);
    setIsSaving(false);
    if (failure) setError(failure);
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-[500] bg-black/70 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className="fixed left-1/2 top-1/2 z-[501] max-h-[94svh] w-[min(94vw,40rem)] overflow-y-auto rounded-[8px] border border-white/15 bg-[var(--gma-surface-2)] p-5 text-white shadow-[0_40px_120px_rgba(0,0,0,0.85)] outline-none sm:p-7"
                style={{ x: "-50%", y: "-50%" }}
                initial={reduceMotion ? false : { opacity: 0, scale: 0.94, y: "-46%" }} animate={{ opacity: 1, scale: 1, y: "-50%" }}
                exit={{ opacity: 0, scale: 0.97, y: "-48%" }} transition={{ type: "spring", stiffness: 380, damping: 32 }}>
                <div className="flex items-start justify-between gap-4">
                  <Dialog.Title className="text-[24px] font-semibold tracking-[-0.01em]">Nueva carpeta</Dialog.Title>
                  <Dialog.Close aria-label="Cerrar" className="grid size-10 shrink-0 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white">
                    <Xmark className="size-5" />
                  </Dialog.Close>
                </div>

                <div className="mt-2 grid items-center gap-6 sm:grid-cols-[auto_1fr]">
                  <div className="mx-auto pt-4">
                    <GlassFolder label={name.trim() || "Sin nombre"} meta="0 obras" color={color} width={190} appear={false} files={[]} />
                  </div>

                  <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
                    <div>
                      <p className="mb-2 text-[13px] font-semibold text-[#A8A8A8]">Tipo</p>
                      <div className="flex flex-wrap gap-1.5">
                        {FOLDER_TEMPLATES.map((t) => (
                          <button key={t.id} type="button" aria-pressed={templateId === t.id} onClick={() => pickTemplate(t.id)}
                            className={`min-h-9 rounded-[4px] border px-3 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-white ${
                              templateId === t.id ? "border-white/60 bg-white/15 text-white" : "border-white/10 bg-white/[0.04] text-[#C4C4C4] hover:bg-white/10 hover:text-white"
                            }`}>
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="nueva-carpeta-nombre" className="mb-2 block text-[13px] font-semibold text-[#A8A8A8]">Nombre</label>
                      <input id="nueva-carpeta-nombre" autoFocus value={name} maxLength={LIST_NAME_MAX + 10} placeholder="Para ver con amigos"
                        onChange={(e) => { setName(e.target.value); setError(null); }} className={FIELD} />
                    </div>

                    <div>
                      <p className="mb-2 text-[13px] font-semibold text-[#A8A8A8]">Color</p>
                      <div role="radiogroup" aria-label="Color de la carpeta" className="flex flex-wrap gap-2">
                        {FOLDER_COLORS.map((c) => (
                          <button key={c.id} type="button" role="radio" aria-checked={c.hex === color} aria-label={c.label} title={c.label} onClick={() => setColor(c.hex)}
                            className="grid size-9 place-items-center rounded-full ring-offset-2 ring-offset-[var(--gma-surface-2)] transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-white aria-checked:ring-2 aria-checked:ring-white"
                            style={{ background: c.hex }}>
                            {c.hex === color && <Check className="size-4 text-white" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    {error && <p role="alert" className="text-[13px] text-[#ff7b7b]">{error}</p>}

                    <div className="mt-1 flex gap-2">
                      <Dialog.Close className="min-h-12 flex-1 rounded-[4px] border border-white/20 text-[14px] font-semibold text-[#C4C4C4] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white">Cancelar</Dialog.Close>
                      <button type="submit" disabled={isSaving || !name.trim()}
                        className="min-h-12 flex-[1.4] rounded-[4px] bg-[#22B16B] text-[15px] font-bold text-[#031A0E] transition-colors hover:bg-[#2AC57A] focus-visible:outline-2 focus-visible:outline-white disabled:opacity-50">
                        {isSaving ? <LoadingLabel>Creando</LoadingLabel> : "Crear carpeta"}
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
