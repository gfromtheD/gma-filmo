interface ComingSoonScreenProps {
  readonly title: string;
  readonly description?: string;
}

export function ComingSoonScreen({
  title,
  description = "Estamos preparando una selección de cortometrajes. Vuelve pronto.",
}: ComingSoonScreenProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-8 text-center">
      <span className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#22B16B]">
        Próximamente
      </span>
      <h1 className="text-[32px] font-extrabold text-white">{title}</h1>
      <p className="max-w-[400px] text-[15px] leading-relaxed text-[#6D7D94]">
        {description}
      </p>
    </div>
  );
}
