"use client";

import { useState } from "react";
import { DropdownMenu } from "radix-ui";
import { MoreHoriz } from "@/components/ui/icons";
import { moderateComment, reportComment } from "@/lib/comments/client";

type Status = "idle" | "busy" | "reported" | "failed";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded-sm";

/**
 * «⋯» de un comentario ajeno: cualquier persona con sesión puede denunciarlo; el creador de la obra puede además ocultarlo.
 * No sale en comentarios propios ni para invitados.
 */
export function CommentModerationMenu({ commentId, canReport, canHide, onHidden }: {
  readonly commentId: number;
  readonly canReport: boolean;
  readonly canHide: boolean;
  /** El comentario se ha ocultado: la lista lo quita. */
  readonly onHidden: () => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [isConfirmingHide, setIsConfirmingHide] = useState(false);

  if (!canReport && !canHide) return null;

  async function handleReport() {
    setStatus("busy");
    setStatus((await reportComment(commentId)) ? "reported" : "failed");
  }

  async function handleHide() {
    setStatus("busy");
    if (await moderateComment({ commentId, action: "hide" })) {
      onHidden();
      return;
    }
    setStatus("failed");
    setIsConfirmingHide(false);
  }

  if (isConfirmingHide) {
    return (
      <span className="flex items-center gap-3 text-[13px] font-bold">
        <span className="text-white">¿Ocultar este comentario?</span>
        <button type="button" onClick={() => void handleHide()} disabled={status === "busy"} className={`text-red-300 hover:underline disabled:opacity-50 ${FOCUS}`}>
          {status === "busy" ? "Ocultando…" : "Sí, ocultar"}
        </button>
        <button type="button" onClick={() => setIsConfirmingHide(false)} className={`text-[#BBBBBB] hover:text-white ${FOCUS}`}>Cancelar</button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button type="button" aria-label="Más acciones del comentario" className={`grid size-8 place-items-center text-[#BBBBBB] transition-colors hover:text-white ${FOCUS}`}>
            <MoreHoriz width={18} height={18} aria-hidden="true" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="start" sideOffset={4} className="z-[210] min-w-[200px] rounded-[8px] bg-gma-border p-1.5 shadow-[0_18px_48px_rgba(0,0,0,0.7)] outline-none ring-1 ring-white/10">
            {canReport && (
              <DropdownMenu.Item onSelect={() => void handleReport()} className="flex min-h-10 cursor-pointer items-center rounded-[6px] px-3 text-[14px] font-medium text-white outline-none data-[highlighted]:bg-white/10">
                Denunciar
              </DropdownMenu.Item>
            )}
            {canHide && (
              <DropdownMenu.Item onSelect={() => setIsConfirmingHide(true)} className="flex min-h-10 cursor-pointer items-center rounded-[6px] px-3 text-[14px] font-medium text-red-300 outline-none data-[highlighted]:bg-white/10">
                Ocultar comentario
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <span role="status" aria-live="polite" className="text-[12.5px] text-[#9A9A9A]">
        {status === "reported" ? "Denuncia enviada" : status === "failed" ? "No se pudo completar. Inténtalo de nuevo." : ""}
      </span>
    </span>
  );
}
