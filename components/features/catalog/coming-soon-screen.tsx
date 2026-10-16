import { ThreeDMarquee } from "@/components/ui/three-d-marquee";

interface ComingSoonScreenProps {
  readonly title: string;
  readonly description?: string;
}

export function ComingSoonScreen({
  title,
  description = "Estamos preparando una selección de cortometrajes. Vuelve pronto.",
}: ComingSoonScreenProps) {
  return (
    <section className="relative flex min-h-[calc(100svh-var(--gma-header-h))] w-full items-center justify-center overflow-hidden bg-gma-surface-2">
      {/* Fondo: carrusel de portadas bajando (como en la pantalla de login) */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <ThreeDMarquee className="h-full w-full" columns={5} />
      </div>

      {/* Gradiente oscuro: resta protagonismo al fondo y deja leer el texto */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 50% 50%, color-mix(in srgb, var(--gma-bg) 45%, transparent) 0%, color-mix(in srgb, var(--gma-bg) 75%, transparent) 55%, color-mix(in srgb, var(--gma-bg) 96%, transparent) 100%)",
        }}
      />

      <div className="relative z-10 flex min-w-0 flex-col items-center gap-4 px-4 py-12 text-center sm:gap-6 sm:px-8 sm:py-16">
        <span className="text-lg font-semibold uppercase tracking-[0.12em] text-[#22B16B] sm:text-[26px]">
          Próximamente
        </span>
        <h1 className="max-w-full break-words text-[clamp(2rem,7vw,4rem)] font-extrabold leading-tight text-white">{title}</h1>
        <p className="max-w-[640px] break-words text-lg leading-relaxed text-[#C4C4C4] sm:text-2xl lg:text-[30px]">
          {description}
        </p>
      </div>
    </section>
  );
}
