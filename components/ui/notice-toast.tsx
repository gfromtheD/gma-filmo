"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Tiempo que permanece el aviso antes de ocultarse solo. */
const AUTO_HIDE_MS = 6000;

interface Notice {
  readonly message: string;
  readonly showLogin: boolean;
}

interface NoticeToast {
  /** Debe renderizarse una vez en el componente que usa el hook. */
  readonly toast: ReactNode;
  /** Aviso para invitados: pide iniciar sesión (con enlace). */
  readonly showLoginRequired: () => void;
  /** Aviso de error genérico (p. ej. "no se pudo guardar"). */
  readonly showError: (message: string) => void;
}

const LOGIN_MESSAGE = "Inicia sesión para guardar títulos en tu lista.";

/**
 * Aviso flotante ligero, abajo y centrado, accesible (`role="status"`).
 * Vive en un portal, así sobrevive a paneles que se cierran (p. ej. la vista previa).
 */
export function useNoticeToast(): NoticeToast {
  const [notice, setNotice] = useState<Notice | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setNotice(null);
  }, []);

  const show = useCallback((next: Notice) => {
    if (timer.current) clearTimeout(timer.current);
    setNotice(next);
    timer.current = setTimeout(() => setNotice(null), AUTO_HIDE_MS);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const showLoginRequired = useCallback(() => show({ message: LOGIN_MESSAGE, showLogin: true }), [show]);
  const showError = useCallback((message: string) => show({ message, showLogin: false }), [show]);

  const toast =
    notice !== null
      ? createPortal(
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-[calc(86px+env(safe-area-inset-bottom))] left-1/2 lg:bottom-6 z-[400] flex w-[min(92vw,460px)] -translate-x-1/2 items-center gap-4 rounded-[8px] bg-[#242432] px-5 py-4 text-[14px] font-medium text-white shadow-[0_18px_48px_rgba(0,0,0,0.7)] ring-1 ring-white/10"
          >
            <p className="flex-1 leading-snug">{notice.message}</p>
            {notice.showLogin && (
              <Link
                href="/?login=1"
                onClick={dismiss}
                className="shrink-0 rounded-[4px] bg-[#22B16B] px-3 py-1.5 text-[13px] font-extrabold uppercase text-[#031A0E] transition-colors hover:bg-[#2AC57A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Iniciar sesión
              </Link>
            )}
            <button
              type="button"
              onClick={dismiss}
              aria-label="Cerrar aviso"
              className="shrink-0 text-[18px] leading-none text-[#B8B8CC] transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              ×
            </button>
          </div>,
          document.body,
        )
      : null;

  return { toast, showLoginRequired, showError };
}
