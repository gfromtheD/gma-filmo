"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { Popover } from "radix-ui";
import { Check, NavArrowDown } from "@/components/ui/icons";

/** Bloques de formulario compartidos por todos los pasos de la subida. */

export const INPUT_CLASS =
  "w-full rounded-[8px] border border-white/15 bg-black/40 px-3.5 py-2.5 text-[15px] leading-6 text-white placeholder-[#7C7C7C] outline-none transition-colors focus:border-[#22B16B] disabled:opacity-50";

export const CARD_CLASS = "rounded-[12px] border border-white/10 bg-black/40 p-5 backdrop-blur-md sm:p-6";

export const BUTTON_PRIMARY =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[4px] bg-[#22B16B] px-5 text-[14px] font-extrabold uppercase text-[#031A0E] transition-colors hover:bg-[#2AC57A] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

export const BUTTON_SECONDARY =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[4px] border border-white/15 bg-white/5 px-5 text-[14px] font-bold text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

interface FieldShellProps {
  readonly id: string;
  readonly label: string;
  readonly required?: boolean;
  readonly hint?: string;
  readonly error?: string | null;
  readonly children: ReactNode;
}

/** Etiqueta, ayuda y error alrededor de un control. */
export function FieldShell({ id, label, required, hint, error, children }: FieldShellProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[14px] font-bold text-white">
        {label}
        {required ? <span className="ml-1 text-[#22B16B]" aria-hidden="true">*</span> : <span className="ml-2 text-[12px] font-medium text-[#7C7C7C]">Opcional</span>}
        {required && <span className="sr-only"> (obligatorio)</span>}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-[13px] leading-5 text-[#A8A8A8]">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="text-[13px] leading-5 text-[#ff7b7b]">{error}</p>}
    </div>
  );
}

interface TextFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly required?: boolean;
  readonly hint?: string;
  readonly error?: string | null;
  readonly type?: "text" | "url" | "email" | "tel" | "date" | "number";
  readonly placeholder?: string;
  readonly maxLength?: number;
  readonly min?: number;
  readonly autoComplete?: string;
}

export function TextField({ label, value, onChange, required, hint, error, type = "text", placeholder, maxLength, min, autoComplete }: TextFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error}>
      <input
        id={id} type={type} value={value} placeholder={placeholder} maxLength={maxLength} min={min} autoComplete={autoComplete}
        aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)} className={INPUT_CLASS}
      />
    </FieldShell>
  );
}

interface TextAreaFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly required?: boolean;
  readonly hint?: string;
  readonly error?: string | null;
  readonly maxLength?: number;
  readonly rows?: number;
}

/** Área de texto con contador de caracteres cuando tiene límite. */
export function TextAreaField({ label, value, onChange, required, hint, error, maxLength, rows = 5 }: TextAreaFieldProps) {
  const id = useId();
  const over = maxLength !== undefined && value.length > maxLength;
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error ?? (over ? `Te pasas ${value.length - maxLength!} caracteres.` : null)}>
      <textarea
        id={id} value={value} rows={rows}
        aria-invalid={error || over ? true : undefined}
        onChange={(e) => onChange(e.target.value)} className={`${INPUT_CLASS} resize-y`}
      />
      {maxLength !== undefined && (
        <p aria-live="polite" className={`text-right text-[12px] tabular-nums ${over ? "text-[#ff7b7b]" : "text-[#7C7C7C]"}`}>
          {value.length} / {maxLength}
        </p>
      )}
    </FieldShell>
  );
}

export interface Option {
  readonly value: string;
  readonly label: string;
}

interface SelectFieldProps {
  readonly label: string;
  readonly value: string;
  readonly options: readonly Option[];
  readonly onChange: (value: string) => void;
  readonly required?: boolean;
  readonly hint?: string;
  readonly error?: string | null;
  readonly placeholder?: string;
}

const MENU_CLASS =
  "z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-xl border border-white/10 bg-gma-surface shadow-[0_16px_48px_rgba(0,0,0,0.55)]";

const OPTION_CLASS =
  "flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] font-medium text-white/90 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:bg-white/10 focus-visible:outline-none";

const SEARCH_CLASS =
  "w-full rounded-[8px] border border-white/15 bg-black/40 px-3 py-2 text-[14px] text-white placeholder-[#7C7C7C] outline-none focus:border-[#22B16B]";

/** Elección única en desplegable (mismo estilo que los filtros del catálogo); con buscador si hay muchas opciones. */
export function SelectField({ label, value, options, onChange, required, hint, error, placeholder = "Elige una opción" }: SelectFieldProps) {
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.value === value);
  const searchable = options.length > 10;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);
  const pick = (next: string) => { onChange(next); setIsOpen(false); };

  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error}>
      <Popover.Root open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) setQuery(""); }}>
        <Popover.Trigger id={id} type="button" aria-invalid={error ? true : undefined} className={`${INPUT_CLASS} group flex items-center justify-between gap-3 text-left`}>
          <span className={selected ? "text-white" : "text-[#7C7C7C]"}>{selected ? selected.label : placeholder}</span>
          <NavArrowDown size={16} strokeWidth={2} aria-hidden="true" className="shrink-0 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="start" sideOffset={6} collisionPadding={12} className={MENU_CLASS}>
            {searchable && (
              <div className="border-b border-white/10 p-2">
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar…" aria-label={`Buscar en ${label}`} className={SEARCH_CLASS} />
              </div>
            )}
            <ul role="listbox" aria-label={`${label}: opciones`} className="max-h-[min(50vh,300px)] overflow-y-auto p-1.5">
              {!required && value !== "" && !query && (
                <li role="presentation">
                  <button type="button" role="option" aria-selected={false} onClick={() => pick("")} className={`${OPTION_CLASS} text-[#A8A8A8]`}>{placeholder}</button>
                </li>
              )}
              {visible.map((o) => {
                const checked = o.value === value;
                return (
                  <li key={o.value} role="presentation">
                    <button type="button" role="option" aria-selected={checked} onClick={() => pick(o.value)} className={OPTION_CLASS}>
                      <span aria-hidden="true" className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors ${checked ? "border-[#22B16B] bg-[#22B16B] text-[#031A0E]" : "border-white/25 bg-white/10"}`}>
                        {checked && <Check size={13} strokeWidth={3} />}
                      </span>
                      {o.label}
                    </button>
                  </li>
                );
              })}
              {visible.length === 0 && <li role="presentation" className="px-3 py-2 text-[13px] text-[#7C7C7C]">Nada coincide con tu búsqueda.</li>}
            </ul>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </FieldShell>
  );
}

interface CheckboxFieldProps {
  readonly label: ReactNode;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly hint?: string;
}

/** Marca circular: gris oscuro y, al elegirla, un círculo verde con su check. Solo pintura; el control real va encima. */
function CircleMark({ checked, className = "" }: { readonly checked: boolean; readonly className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-white ${
        checked ? "border-[#22B16B] bg-[#22B16B] text-[#031A0E]" : "border-white/25 bg-white/10"
      } ${className}`}
    >
      {checked && <Check size={13} strokeWidth={3} />}
    </span>
  );
}

export function CheckboxField({ label, checked, onChange, hint }: CheckboxFieldProps) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0" />
        <CircleMark checked={checked} />
      </span>
      <label htmlFor={id} className="cursor-pointer text-[15px] leading-6 text-white">
        {label}
        {hint && <span className="block text-[13px] leading-5 text-[#A8A8A8]">{hint}</span>}
      </label>
    </div>
  );
}

interface MultiSelectProps {
  readonly label: string;
  readonly options: readonly Option[];
  readonly value: readonly string[];
  readonly onChange: (value: string[]) => void;
  readonly required?: boolean;
  readonly hint?: string;
  readonly error?: string | null;
  readonly max?: number;
  /** Con muchas opciones se añade un buscador dentro del desplegable. */
  readonly searchable?: boolean;
}

/**
 * Selección múltiple en desplegable (mismo estilo que los filtros del catálogo): un botón abre la lista, con buscador
 * si hay muchas opciones, y las elegidas quedan debajo como etiquetas que se pueden quitar.
 */
export function MultiSelect({ label, options, value, onChange, required, hint, error, max, searchable = false }: MultiSelectProps) {
  const id = useId();
  const [query, setQuery] = useState("");
  const labelOf = useMemo(() => new Map(options.map((o) => [o.value, o.label])), [options]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);
  const atLimit = max !== undefined && value.length >= max;
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <FieldShell id={id} label={label} required={required} hint={hint ?? (max ? `Hasta ${max}.` : undefined)} error={error}>
      <Popover.Root onOpenChange={(open) => { if (!open) setQuery(""); }}>
        <Popover.Trigger
          id={id} type="button" aria-invalid={error ? true : undefined}
          className={`${INPUT_CLASS} group flex items-center justify-between gap-3 text-left`}
        >
          <span className={value.length ? "text-white" : "text-[#7C7C7C]"}>
            {value.length === 0 ? "Elegir…" : value.length === 1 ? labelOf.get(value[0]!) ?? value[0] : `${value.length} elegidas`}
          </span>
          <NavArrowDown size={16} strokeWidth={2} aria-hidden="true" className="shrink-0 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="start" sideOffset={6} collisionPadding={12} className={MENU_CLASS}>
            {searchable && (
              <div className="border-b border-white/10 p-2">
                <input
                  type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar…" aria-label={`Buscar en ${label}`}
                  className={SEARCH_CLASS}
                />
              </div>
            )}
            <ul role="listbox" aria-multiselectable="true" aria-label={`${label}: opciones`} className="max-h-[min(50vh,300px)] overflow-y-auto p-1.5">
              {visible.map((o) => {
                const checked = value.includes(o.value);
                const blocked = atLimit && !checked;
                return (
                  <li key={o.value} role="presentation">
                    <button
                      type="button" role="option" aria-selected={checked} disabled={blocked} onClick={() => toggle(o.value)}
                      className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] font-medium text-white/90 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:bg-white/10 focus-visible:outline-none"
                    >
                      <span aria-hidden="true" className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors ${checked ? "border-[#22B16B] bg-[#22B16B] text-[#031A0E]" : "border-white/25 bg-white/10"}`}>
                        {checked && <Check size={13} strokeWidth={3} />}
                      </span>
                      {o.label}
                    </button>
                  </li>
                );
              })}
              {visible.length === 0 && <li role="presentation" className="px-3 py-2 text-[13px] text-[#7C7C7C]">Nada coincide con tu búsqueda.</li>}
            </ul>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {value.length > 0 && (
        <ul aria-label={`${label}: elegidas`} className="flex flex-wrap gap-2">
          {value.map((v) => (
            <li key={v}>
              <button
                type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`Quitar ${labelOf.get(v) ?? v}`}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[#22B16B]/50 bg-[#22B16B]/15 px-3 text-[13px] font-semibold text-white hover:bg-[#22B16B]/25 focus-visible:outline-2 focus-visible:outline-white"
              >
                {labelOf.get(v) ?? v}<span aria-hidden="true" className="text-[#A8A8A8]">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </FieldShell>
  );
}

/** Título de un paso: qué se pide y por qué. */
export function StepHeading({ title, intro }: { readonly title: string; readonly intro: string }) {
  return (
    <header className="mb-6">
      <h2 className="text-[26px] font-extrabold leading-tight text-white">{title}</h2>
      <p className="mt-2 max-w-[62ch] text-[15px] leading-6 text-[#BBBBBB]">{intro}</p>
    </header>
  );
}
