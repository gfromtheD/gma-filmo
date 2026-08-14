interface ComingSoonScreenProps {
  readonly title: string;
  readonly description?: string;
}

export function ComingSoonScreen({
  title,
  description = "Estamos preparando una selección de cortometrajes. Vuelve pronto.",
}: ComingSoonScreenProps) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-6 px-8 py-16 text-center">
      <span className="text-[26px] font-semibold uppercase tracking-[0.12em] text-[#22B16B]">
        Próximamente
      </span>
      <h1 className="text-[64px] font-extrabold leading-tight text-white">{title}</h1>
      <p className="max-w-[640px] text-[30px] leading-relaxed text-[#6D7D94]">
        {description}
      </p>
    </div>
  );
}
