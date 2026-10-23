"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from "./fields";
import { PublishingBucket } from "./processing-bucket";

/** Mientras se publica: la misma caja de «Sube tu obra», con las tareas de guardar y registrar la obra cayendo dentro. */
export function PublishingScreen({ title, publishes }: { readonly title: string; readonly publishes: boolean }) {
  return (
    <section aria-labelledby="publishing-title" aria-busy="true" className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-2 py-10 text-center">
      <h2 id="publishing-title" className="text-[26px] font-extrabold leading-tight text-white">
        {publishes ? "Publicando" : "Enviando"} {title ? `«${title}»` : "tu obra"}
      </h2>
      <p className="max-w-[46ch] text-[15px] leading-6 text-[#BBBBBB]">Estamos guardando tu obra con cuidado. Tarda unos segundos: no cierres esta página.</p>
      <PublishingBucket className="mt-20 mb-8" />
    </section>
  );
}

/** Al terminar: confirmación clara con un check y a dónde ir después (antes se volvía al formulario vacío con avisos). */
export function PublishedScreen({ title, slug, published, onGoToTitles, onNewUpload }: {
  readonly title: string;
  readonly slug: string | null;
  readonly published: boolean;
  readonly onGoToTitles?: () => void;
  readonly onNewUpload: () => void;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  return (
    <section aria-labelledby="published-title" className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-3 py-12 text-center">
      <motion.span
        aria-hidden="true"
        initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        className="grid size-20 place-items-center rounded-full bg-[#22B16B] text-[#031A0E] shadow-[0_10px_40px_rgba(34,177,107,0.45)]"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="size-10">
          <motion.path d="M5 12.5 10 17.5 19 7" initial={reduceMotion ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.25, duration: 0.45, ease: "easeOut" }} />
        </svg>
      </motion.span>
      <h2 id="published-title" role="status" className="mt-3 text-[28px] font-extrabold leading-tight text-white">
        {published ? "¡Publicada!" : "¡Enviada!"}
      </h2>
      <p className="max-w-[48ch] text-[15px] leading-6 text-[#BBBBBB]">
        {published
          ? <>{title ? <>«{title}» </> : "Tu obra "}ya está en el catálogo de GMA Filmo.</>
          : <>{title ? <>«{title}» </> : "Tu obra "}está en revisión: te avisaremos cuando se publique.</>}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        {onGoToTitles && <button type="button" onClick={onGoToTitles} className={BUTTON_PRIMARY}>Ver mis títulos</button>}
        {published && slug && <Link href={`/ver/${encodeURIComponent(slug)}`} className={BUTTON_SECONDARY}>Verla ahora</Link>}
        <button type="button" onClick={onNewUpload} className={BUTTON_SECONDARY}>Subir otra obra</button>
      </div>
    </section>
  );
}
