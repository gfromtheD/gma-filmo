import type { ReactNode } from "react";

interface SectionHeaderProps {
  readonly title: string;
  /** Línea secundaria bajo el título (qué contiene la fila). */
  readonly subtitle?: string;
  /** Elemento a la derecha (enlace "Ver todas", etc.). */
  readonly action?: ReactNode;
}

/**
 * Cabecera de sección de la portada: barra de acento, título y subtítulo.
 * Medidas de la referencia: título 24/600 (18 en móvil), subtítulo 14, 20 px hasta la fila.
 */
export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="mb-6 flex items-end justify-between gap-3 px-4 lg:mb-5 lg:px-16">
      <div className="min-w-0 border-l-[3px] border-[#22B16B] pl-2.5">
        <h2 className="text-[18px] font-semibold leading-7 text-[#EEF1F6] lg:text-[24px] lg:leading-8">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] leading-5 text-[#8A94A6] lg:text-[14px]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
