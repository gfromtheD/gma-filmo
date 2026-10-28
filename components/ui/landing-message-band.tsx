import type { ReactNode } from "react";

interface LandingMessageBandProps {
  readonly title: string;
  readonly description: string;
  readonly imageUrl?: string;
  readonly cta: ReactNode;
}

/**
 * Franja a todo lo ancho con una imagen real del catálogo de fondo, titular y descripción cortos a la izquierda y
 * una llamada a la acción propia (el botón se le pasa hecho: cada franja lleva a un sitio distinto).
 */
export function LandingMessageBand({ title, description, imageUrl, cta }: LandingMessageBandProps) {
  return (
    <section className="relative isolate overflow-hidden py-20 sm:py-28">
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" aria-hidden="true" loading="lazy" decoding="async"
          className="absolute inset-0 -z-20 h-full w-full object-cover" />
      )}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(8,10,9,0.92)_0%,rgba(8,10,9,0.78)_35%,rgba(8,10,9,0.35)_75%,rgba(8,10,9,0.15)_100%)]" />
      <div className="relative px-6 sm:px-10 lg:px-16">
        <h2 className="max-w-xl text-[clamp(1.75rem,4vw,3rem)] font-extrabold leading-[1.08] tracking-[-.03em] text-white">
          {title}
        </h2>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#DEE3E0] sm:text-base">{description}</p>
        <div className="mt-7">{cta}</div>
      </div>
    </section>
  );
}
