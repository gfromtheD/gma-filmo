import type { ReactNode } from "react";

interface LandingMessageBandProps {
  readonly title: string;
  readonly description: string;
  readonly imageUrl?: string;
  readonly cta: ReactNode;
}

/**
 * Franja con una tarjeta de imagen real del catálogo (recuadrada, con margen alrededor que deja ver el fondo de la
 * página), titular y descripción cortos sobre ella y una llamada a la acción propia.
 */
export function LandingMessageBand({ title, description, imageUrl, cta }: LandingMessageBandProps) {
  return (
    <section className="px-6 py-10 sm:px-10 sm:py-14 lg:px-16">
      <div className="relative isolate mx-auto min-h-[420px] max-w-6xl overflow-hidden rounded-3xl sm:min-h-[460px]">
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" aria-hidden="true" loading="lazy" decoding="async"
            className="absolute inset-0 -z-20 h-full w-full object-cover" />
        )}
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(8,10,9,0.92)_0%,rgba(8,10,9,0.78)_35%,rgba(8,10,9,0.35)_75%,rgba(8,10,9,0.15)_100%)]" />
        <div className="relative px-6 py-10 sm:px-10 sm:py-14">
          <h2 className="max-w-xl text-[clamp(1.75rem,4vw,3rem)] font-extrabold leading-[1.08] tracking-[-.03em] text-white">
            {title}
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#DEE3E0] sm:text-base">{description}</p>
          <div className="mt-7">{cta}</div>
        </div>
      </div>
    </section>
  );
}
