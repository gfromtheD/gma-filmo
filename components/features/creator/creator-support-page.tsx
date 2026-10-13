"use client";
import Link from "next/link";
import { useState } from "react";
import type { CreatorProfile } from "@/types/creator";
import { supportMethods } from "@/lib/creator-support";

export function CreatorSupportPage({ creator }: { creator: CreatorProfile }) {
  const methods = supportMethods(creator);
  const [copyStatus, setCopyStatus] = useState("");
  async function copyAddress(address: string) {
    try { await navigator.clipboard.writeText(address); setCopyStatus("Dirección copiada"); }
    catch { setCopyStatus("No se pudo copiar. Puedes seleccionar la dirección y copiarla manualmente."); }
  }
  return <main className="min-h-screen min-h-[100dvh] bg-[#0A0F17] pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pt-[calc(2rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))] text-white sm:pt-[calc(3.5rem+env(safe-area-inset-top))] sm:pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
    <div className="mx-auto max-w-md">
      <Link href={`/creadores/${encodeURIComponent(creator.slug)}`} className="text-sm font-bold tracking-widest text-[#22B16B]">GMA FILMO</Link>
      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
        {creator.foto_perfil ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={creator.foto_perfil} alt={creator.nombre} width={80} height={80} className="h-20 w-20 rounded-full object-cover" />
        ) : <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#22B16B] text-3xl font-bold text-black">{creator.nombre[0]}</div>}
        <p className="mt-5 text-sm text-[#22B16B]">Apoya al creador</p>
        <h1 className="mt-1 break-words text-2xl font-bold sm:text-3xl">{creator.nombre}</h1>
        {creator.bio && <p className="mt-4 line-clamp-4 whitespace-pre-line break-words text-sm leading-6 text-[#B8C5D4]">{creator.bio}</p>}
        <div className="mt-6 space-y-3">
          {methods.map(method => <div key={method.key}>
            <a href={method.href} target={method.key === "bitcoin" ? undefined : "_blank"} rel="noopener noreferrer"
              className="flex min-h-12 items-center justify-center rounded-xl bg-[#22B16B] px-4 py-3 text-center font-semibold text-[#031A0E]">{method.label} ↗</a>
            {method.address && <div className="mt-3 rounded-xl border border-white/10 p-3">
              <p className="text-xs text-[#B8C5D4]">Dirección Bitcoin</p>
              <code className="mt-2 block select-all break-all text-xs">{method.address}</code>
              <button type="button" onClick={() => copyAddress(method.address!)} className="mt-3 min-h-11 text-sm text-[#22B16B] underline">Copiar dirección</button>
            </div>}
          </div>)}
          {!methods.length && <p className="text-sm leading-6 text-[#B8C5D4]">Este creador todavía no tiene métodos de apoyo disponibles.</p>}
        </div>
        <p aria-live="polite" className="mt-3 text-xs text-[#B8C5D4]">{copyStatus}</p>
        {!!methods.length && <p className="mt-4 text-xs leading-5 text-[#6D7D94]">El apoyo se realiza en la plataforma elegida o en tu cartera. GMA Filmo no procesa el pago.</p>}
      </section>
      <Link href={`/creadores/${encodeURIComponent(creator.slug)}`} className="mt-6 block min-h-11 py-3 text-center text-sm text-[#B8C5D4] underline">Ver perfil y sus obras</Link>
    </div>
  </main>;
}
