"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { isTransferring, type UploadedAsset } from "@/lib/studio/upload-draft";
import { useUploadDraftStore } from "@/store/use-upload-draft-store";

/** El vídeo principal manda; si no se está subiendo, el tráiler. */
function activeVideo(video: UploadedAsset | null, trailer: UploadedAsset | null): UploadedAsset | null {
  const busy = (asset: UploadedAsset | null) => asset?.status === "uploading" || asset?.status === "processing";
  return busy(video) ? video : busy(trailer) ? trailer : null;
}

/**
 * Las subidas siguen aunque se salga de Mi Estudio (ver store/use-upload-draft-store.ts). Esto, montado en toda la web:
 * - pide confirmación al cerrar o recargar mientras un archivo sale del navegador (eso sí lo cortaría);
 * - fuera de Mi Estudio, enseña cómo va la subida y lleva de vuelta a ella.
 */
export function UploadGuard() {
  const pathname = usePathname();
  const draft = useUploadDraftStore((state) => state.draft);
  const transferring = isTransferring(draft);

  useEffect(() => {
    if (!transferring) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [transferring]);

  const asset = activeVideo(draft.video.file, draft.trailer.file);
  if (!asset || pathname?.startsWith("/mi-estudio")) return null;
  const processing = asset.status === "processing" || asset.phase === "processing";
  const label = processing ? "Procesando tu vídeo" : `Subiendo tu vídeo · ${Math.round(asset.progress ?? 0)} %`;

  return (
    <Link
      href="/mi-estudio?tab=subir"
      role="status"
      aria-label={`${label}. Ir a la subida`}
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+20px)] left-4 z-[41] flex items-center gap-2.5 rounded-full border border-white/10 bg-[#0C1611]/95 py-2 pl-3 pr-4 text-[13px] font-semibold text-white shadow-[0_18px_44px_-14px_rgba(0,0,0,0.85)] backdrop-blur-xl transition-colors hover:bg-[#12201A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:bottom-6 lg:left-6"
    >
      <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-[#22B16B] motion-reduce:animate-none" />
      {label}
    </Link>
  );
}
