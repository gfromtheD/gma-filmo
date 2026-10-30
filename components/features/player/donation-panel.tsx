"use client";
import { QRCodeSVG } from "qrcode.react";
import { Xmark as X } from "@/components/ui/icons";
import { useEffect, useRef, useState } from "react";
import type { CreatorProfile } from "@/types/creator";
import { externalUrl } from "@/lib/social-links";
import { supportMethods, supportPath } from "@/lib/creator-support";

interface DonationPanelProps {
  readonly creator: CreatorProfile | null;
  readonly appUrl: string;
  readonly onClose: () => void;
  readonly onContinue?: () => void;
}
export function DonationPanel({ creator, appUrl, onClose, onContinue }: DonationPanelProps) {
  const [origin, setOrigin] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setOrigin(window.location.origin); }, []);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLButtonElement>("button")?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button, a[href]'));
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [onClose]);
  const methods = supportMethods(creator);
  if (!creator || !methods.length) return null;
  const baseUrl = externalUrl(appUrl) ?? origin;
  const path = supportPath(creator.slug);
  const url = baseUrl ? new URL(path, baseUrl).toString() : null;
  return <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/85 p-4" onClick={event => event.stopPropagation()}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="support-title"
      className="relative max-h-[90svh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/15 bg-gma-surface-2 p-6 text-white">
      <button type="button" onClick={onClose} aria-label="Cerrar panel de apoyo" className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/15"><X size={20} /></button>
      <p className="pr-12 text-xs font-bold tracking-widest text-[#22B16B]">GMA FILMO</p>
      <h2 id="support-title" className="mt-3 pr-8 text-2xl font-bold">Apoya a {creator.nombre}</h2>
      <p className="mt-2 text-sm text-[#C4C4C4]">Escanea desde el móvil y elige cómo apoyar al creador. No necesitas iniciar sesión en GMA.</p>
      {url && <div className="mt-6 hidden justify-center sm:flex">
        <div className="rounded-xl bg-white p-4"><QRCodeSVG value={url} size={192} bgColor="#ffffff" fgColor="#000000" level="M" marginSize={4} title={`Apoyar a ${creator.nombre}`} /></div>
      </div>}
      <a href={url ?? path} target="_blank" rel="noopener noreferrer" className="mt-6 flex min-h-12 items-center justify-center rounded-[4px] bg-[#22B16B] p-3 font-semibold text-[#031A0E]">Abrir página de apoyo</a>
      <p className="mt-3 text-center text-xs text-[#7C7C7C]">{methods.map(method => method.key === "bitcoin" ? "Bitcoin" : method.key === "paypal" ? "PayPal" : "Patreon").join(" · ")}</p>
      {onContinue && <button type="button" onClick={onContinue} className="mt-4 min-h-11 w-full text-sm text-[#C4C4C4] underline">Siguiente corto</button>}
    </div>
  </div>;
}
