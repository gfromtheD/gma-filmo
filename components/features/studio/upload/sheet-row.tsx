"use client";

import type { ReactNode } from "react";

interface SheetRowProps {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}

/**
 * Una fila de la ficha técnica: a la izquierda qué se pide (fija mientras se rellena la derecha en escritorio);
 * a la derecha, los campos. Las filas se apilan en un único pliego, separadas por una línea fina.
 */
export function SheetRow({ id, title, description, children }: SheetRowProps) {
  return (
    <section aria-labelledby={id} className="grid gap-5 px-5 py-7 sm:px-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
      <header className="flex flex-col gap-2 lg:sticky lg:top-24 lg:self-start">
        <h3 id={id} className="text-[17px] font-extrabold leading-tight text-white">{title}</h3>
        <p className="max-w-[40ch] text-[13.5px] leading-5 text-[#A8A8A8]">{description}</p>
      </header>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** Cabeceras de columna sobre una lista de filas (créditos, subtítulos, premios). Solo visibles en pantallas anchas. */
export function ColumnHeads({ columns, template }: { readonly columns: readonly string[]; readonly template: string }) {
  return (
    <div aria-hidden="true" className={`hidden gap-4 px-1 pb-2 text-[12.5px] font-semibold text-[#7C7C7C] sm:grid ${template}`}>
      {columns.map((c) => <span key={c}>{c}</span>)}
    </div>
  );
}

/** Botón «quitar» de una fila: una cruz discreta que se vuelve roja al pasar por encima. */
export function RemoveRowButton({ label, onClick }: { readonly label: string; readonly onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick} aria-label={label}
      className="grid size-11 shrink-0 place-items-center rounded-[8px] text-[#8A8A8A] transition-colors hover:bg-[#ff5252]/10 hover:text-[#ff7b7b] focus-visible:outline-2 focus-visible:outline-white"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" className="size-4"><path d="M6 6l12 12M18 6 6 18" /></svg>
    </button>
  );
}

/** Acción «añadir» al pie de una lista: texto con un + delante, sin caja, para no competir con los campos. */
export function AddRowButton({ children, onClick, disabled }: { readonly children: ReactNode; readonly onClick: () => void; readonly disabled?: boolean }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      className="mt-2 inline-flex min-h-11 items-center gap-2 self-start rounded-[8px] px-2 text-[14px] font-bold text-[#5FD39A] transition-colors hover:bg-[#22B16B]/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-white"
    >
      <span aria-hidden="true" className="text-[18px] leading-none">+</span>{children}
    </button>
  );
}
