"use client";

import { Dialog } from "radix-ui";
import { GmaIcon } from "@/components/ui/gma-icon";
import type { MovieExtra } from "@/types/catalog";

interface ExtrasPlayerDialogProps {
  readonly extra: MovieExtra | null;
  readonly onClose: () => void;
}

/** Reproductor sencillo de un extra (vídeo nativo). No toca el reproductor principal de la ficha. */
export function ExtrasPlayerDialog({ extra, onClose }: ExtrasPlayerDialogProps) {
  return (
    <Dialog.Root open={extra !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 w-[min(96vw,1040px)] -translate-x-1/2 -translate-y-1/2 outline-none"
        >
          <div className="mb-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#22B16B]">{extra?.kindLabel}</p>
              <Dialog.Title className="truncate text-[18px] font-semibold text-white">{extra?.title}</Dialog.Title>
            </div>
            <Dialog.Close
              aria-label="Cerrar extra"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-[#22B16B]"
            >
              <GmaIcon name="close" size={18} />
            </Dialog.Close>
          </div>
          {extra && (
            <video
              key={extra.id}
              src={extra.videoUrl}
              poster={extra.posterUrl ?? undefined}
              controls
              autoPlay
              playsInline
              preload="metadata"
              className="aspect-video w-full rounded-2xl bg-black shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
            />
          )}
          {extra?.description && (
            <p className="mt-4 max-w-[70ch] text-[14px] leading-relaxed text-white/75">{extra.description}</p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
