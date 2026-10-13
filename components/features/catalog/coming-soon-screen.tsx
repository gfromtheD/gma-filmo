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
    <section className="relative flex min-h-[calc(100svh-var(--gma-header-h))] w-full items-center justify-center overflow-hidden bg-[#0A0F17]">
      {/* Fondo: carrusel de portadas bajando (como en la pantalla de login) */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <ThreeDMarquee className="h-full w-full" columns={5} />
      </div>

      {/* Gradiente oscuro: resta protagonismo al fondo y deja leer el texto */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 50% 50%, rgba(5,10,16,0.45) 0%, rgba(5,10,16,0.75) 55%, rgba(5,10,16,0.96) 100%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-6 px-8 py-16 text-center">
        <span className="text-[26px] font-semibold uppercase tracking-[0.12em] text-[#22B16B]">
          Próximamente
        </span>
        <h1 className="text-[64px] font-extrabold leading-tight text-white">{title}</h1>
        <p className="max-w-[640px] text-[30px] leading-relaxed text-[#B8C5D4]">
          {description}
        </p>
      </div>
    </section>
  );
}
