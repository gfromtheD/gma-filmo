interface ComingSoonScreenProps {
  readonly title: string;
  readonly description?: string;
}

export function ComingSoonScreen({
  title,
  description = "Estamos preparando una selección de cortometrajes. Vuelve pronto.",
}: ComingSoonScreenProps) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 py-12 sm:gap-6 sm:px-8 sm:py-16 text-center">
      <span className="text-lg sm:text-[26px] font-semibold uppercase tracking-[0.12em] text-[#22B16B]">
        Próximamente
      </span>
      <h1 className="max-w-full break-words text-[clamp(2rem,7vw,4rem)] font-extrabold leading-tight text-white">{title}</h1>
      <p className="max-w-[640px] break-words text-lg sm:text-2xl lg:text-[30px] leading-relaxed text-[#6D7D94]">
        {description}
      </p>
    </div>
  );
}
