"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchModerationQueue, moderateComment, type ModerationQueueItem } from "@/lib/comments/client";

type Load = "loading" | "ready" | "error";

/**
 * Pestaña «Comentarios» de Mi Estudio: los comentarios de tus obras que alguien ha denunciado. Puedes descartar la denuncia
 * (el comentario se queda) u ocultar el comentario. Sin retención previa: los comentarios se publican al momento.
 */
export function ModerationView({ onToast }: { readonly onToast: (msg: string, opts?: { error?: boolean }) => void }) {
  const [load, setLoad] = useState<Load>("loading");
  const [items, setItems] = useState<readonly ModerationQueueItem[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoad("loading");
    const queue = await fetchModerationQueue();
    if (queue === null) { setLoad("error"); return; }
    setItems(queue);
    setLoad("ready");
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function decide(item: ModerationQueueItem, action: "dismiss" | "hide") {
    setBusyId(item.commentId);
    const ok = await moderateComment({ commentId: item.commentId, action });
    setBusyId(null);
    if (!ok) { onToast("No se pudo completar la acción. Inténtalo de nuevo.", { error: true }); return; }
    setItems((current) => current.filter((i) => i.commentId !== item.commentId));
    onToast(action === "hide" ? "Comentario oculto" : "Denuncia descartada");
  }

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-5 pb-28">
      <header>
        <h1 className="text-[28px] font-semibold leading-tight text-white sm:text-[32px]">Comentarios denunciados</h1>
        <p className="mt-1.5 text-[15px] text-[#A8A8A8]">
          Aquí aparecen los comentarios de tus obras que alguien ha denunciado. Descarta la denuncia si el comentario está bien u ocúltalo si no.
          También puedes ocultar cualquier comentario desde la ficha de tu obra, con el menú «⋯».
        </p>
      </header>

      {load === "loading" && <p role="status" className="text-[14px] text-[#A8A8A8]">Cargando…</p>}

      {load === "error" && (
        <div role="alert" className="text-[14px] text-[#C4C4C4]">
          <p>No se pudieron cargar las denuncias.</p>
          <button type="button" onClick={() => void refresh()} className="mt-2 min-h-10 rounded-[4px] border border-white/20 px-4 font-semibold text-white hover:bg-white/10">Reintentar</button>
        </div>
      )}

      {load === "ready" && items.length === 0 && (
        <p className="rounded-[12px] border border-white/10 bg-white/[0.03] p-6 text-[14.5px] text-[#C4C4C4]">
          No hay denuncias pendientes en tus obras.
        </p>
      )}

      {load === "ready" && items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.commentId} className="rounded-[12px] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[13px] text-[#9A9A9A]">
                <span className="font-semibold text-white">{item.authorName}</span> en{" "}
                <Link href={`/cortos/${encodeURIComponent(item.film.slug)}#${`comentario-${item.commentId}`}`} className="underline underline-offset-2 hover:text-white">{item.film.title}</Link>
                {" · "}{item.reportCount} {item.reportCount === 1 ? "denuncia" : "denuncias"}
              </p>
              <p className="mt-2 whitespace-pre-line break-words text-[15px] leading-[1.5] text-white">{item.content}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" disabled={busyId === item.commentId} onClick={() => void decide(item, "dismiss")}
                  className="min-h-10 rounded-[4px] border border-white/20 px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-50">
                  Descartar denuncia
                </button>
                <button type="button" disabled={busyId === item.commentId} onClick={() => void decide(item, "hide")}
                  className="min-h-10 rounded-[4px] bg-red-500/15 px-4 text-[13.5px] font-bold text-red-300 transition-colors hover:bg-red-500/25 disabled:opacity-50">
                  Ocultar comentario
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
