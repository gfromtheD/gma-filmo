"use client";

import { useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Dialog } from "radix-ui";
import { GmaIcon } from "@/components/ui/gma-icon";

interface LoginRequiredDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** Lleva a iniciar sesión (cada sitio decide cómo: cambiar de vista o navegar). */
  readonly onLogin: () => void;
  readonly title: string;
  readonly description: string;
  readonly perks: readonly string[];
  /** Imagen o cabecera visual de arriba (la portada de la obra, p. ej.). Sin ella, el diálogo empieza por el icono. */
  readonly media?: ReactNode;
  /** Icono redondo verde que da el motivo (marcador, candado…). */
  readonly badge: ReactNode;
}

/**
 * «Para esto necesitas una cuenta»: propuesta a pantalla completa con fondo oscurecido y desenfocado, tarjeta grande
 * y un único camino destacado (iniciar sesión). Bloquea la página hasta decidir: no se cierra al pulsar fuera (para
 * que se sienta como una invitación y no como un aviso al pasar), solo con «Ahora no», la × o Escape. El foco queda
 * atrapado dentro y el scroll de la página, bloqueado (Radix).
 */
export function LoginRequiredDialog({ open, onClose, onLogin, title, description, perks, media, badge }: LoginRequiredDialogProps) {
  const loginRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[500] bg-black/75 backdrop-blur-md"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
              />
            </Dialog.Overlay>
            <Dialog.Content
              asChild
              forceMount
              onInteractOutside={(event) => event.preventDefault()}
              onOpenAutoFocus={(event) => { event.preventDefault(); loginRef.current?.focus(); }}
            >
              <motion.div
                className="fixed left-1/2 top-1/2 z-[501] max-h-[92svh] w-[min(92vw,34rem)] overflow-y-auto rounded-[28px] text-white shadow-[0_40px_120px_rgba(0,0,0,0.85)] ring-1 ring-white/15 outline-none"
                style={{
                  x: "-50%",
                  y: "-50%",
                  background:
                    "radial-gradient(120% 60% at 50% 100%, rgba(91,63,209,0.4) 0%, rgba(91,63,209,0) 70%), linear-gradient(180deg, var(--gma-preview) 0%, var(--gma-preview-end) 100%)",
                }}
                initial={{ opacity: 0, scale: 0.92, y: "-46%" }}
                animate={{ opacity: 1, scale: 1, y: "-50%" }}
                exit={{ opacity: 0, scale: 0.96, y: "-48%" }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              >
                {media && (
                  <div className="relative aspect-video w-full overflow-hidden">
                    {media}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0"
                      style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0) 40%, var(--gma-preview) 100%)" }}
                    />
                  </div>
                )}
                <Dialog.Close
                  aria-label="Cerrar"
                  className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <GmaIcon name="close" size={18} />
                </Dialog.Close>

                <div className={`px-6 pb-7 text-center sm:px-9 sm:pb-9 ${media ? "-mt-10" : "pt-12"}`}>
                  <span className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#22B16B] text-[#031A0E] shadow-[0_0_0_6px_var(--gma-preview)]">
                    {badge}
                  </span>

                  <Dialog.Title className="mt-5 text-[clamp(1.6rem,4.6vw,2.15rem)] font-extrabold leading-[1.1] tracking-[-.02em]">
                    {title}
                  </Dialog.Title>
                  <Dialog.Description className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-[#C9CFCB] sm:text-base">
                    {description}
                  </Dialog.Description>

                  <ul className="mx-auto mt-6 flex max-w-sm flex-col gap-3 text-left">
                    {perks.map((perk) => (
                      <li key={perk} className="flex items-start gap-3 text-[15px] leading-snug text-white">
                        <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#22B16B]/20 text-[#58D99B]">
                          <GmaIcon name="check" size={13} strokeWidth={3} />
                        </span>
                        {perk}
                      </li>
                    ))}
                  </ul>

                  <button
                    ref={loginRef}
                    type="button"
                    onClick={onLogin}
                    className="mt-8 inline-flex h-14 w-full items-center justify-center rounded-[4px] bg-[#22B16B] px-8 text-[17px] font-bold leading-none text-[#021208] transition-colors hover:bg-[#2AC57A] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                  >
                    Iniciar sesión
                  </button>
                  <Dialog.Close className="mt-3 inline-flex h-11 items-center justify-center rounded-[4px] px-5 text-[14px] font-semibold text-[#B9C0BC] transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                    Ahora no
                  </Dialog.Close>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
