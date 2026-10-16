"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AudioCard, CreditsCard, InfoCard } from "@/components/features/detail/detail-cards";
import { SynopsisCard } from "@/components/features/detail/synopsis-card";
import type { MovieMedia } from "@/types/catalog";

const DESKTOP_QUERY = "(min-width: 1024px)";
const GRID_GAP = 24; // gap-6

/**
 * Pestaña «Detalles»: sinopsis a la izquierda y datos a la derecha.
 * Plegada, la sinopsis no pasa de la altura natural de la columna derecha: si el texto sobra, se corta
 * con «…» y un «Más». Desplegada, la tarjeta crece y la columna derecha se estira para acompañarla.
 */
export function DetailsTab({ movie, donation }: { movie: MovieMedia; donation: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const [targetHeight, setTargetHeight] = useState<number | null>(null);
  const asideRef = useRef<HTMLElement>(null);
  const donationRef = useRef<HTMLDivElement>(null);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;

  useLayoutEffect(() => {
    const aside = asideRef.current;
    if (!aside) return;

    function measure() {
      if (!aside) return;
      if (!window.matchMedia(DESKTOP_QUERY).matches) {
        setTargetHeight(null);
        return;
      }
      if (expandedRef.current) return; // desplegada, la columna derecha se estira: su alto ya no es el natural
      const donationHeight = donationRef.current?.offsetHeight ?? 0;
      const reserved = donationHeight > 0 ? donationHeight + GRID_GAP : 0;
      setTargetHeight(aside.offsetHeight - reserved);
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(aside);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [expanded]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_419px]">
      <div className="flex flex-col gap-6">
        <SynopsisCard
          movie={movie}
          expanded={expanded}
          onToggle={() => setExpanded((v) => !v)}
          targetHeight={targetHeight}
        />
        <div ref={donationRef} className="empty:hidden">{donation}</div>
      </div>
      <aside ref={asideRef} className={`flex flex-col gap-6 ${expanded ? "lg:self-stretch" : "lg:self-start"}`}>
        <CreditsCard movie={movie} />
        <AudioCard movie={movie} />
        <InfoCard movie={movie} />
      </aside>
    </div>
  );
}
