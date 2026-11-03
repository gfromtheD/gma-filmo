"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { commentAnchorId, splitLeadingMention, splitTimestamps } from "@/lib/comments/presentation";
import { formatTimestamp } from "@/lib/comments/timestamp";

/** Un comentario más largo que esto (en caracteres o en líneas) se pliega con «Leer más». */
const LONG_TEXT_CHARS = 420;
const LONG_TEXT_LINES = 7;

function isLongText(text: string): boolean {
  return text.length > LONG_TEXT_CHARS || text.split("\n").length > LONG_TEXT_LINES;
}

interface CommentTextProps {
  readonly text: string;
  readonly movieSlug: string;
  /** Duración de la obra; si se conoce, solo se enlazan momentos que caben en ella. */
  readonly durationSeconds: number | null;
  readonly className?: string;
  /** Nombres de quienes participan en el hilo: la mención del principio («@Nombre») se resalta. */
  readonly mentionNames?: readonly string[];
  /**
   * Mención por referencia: lleva al comentario mencionado y muestra el nombre actual de su autor.
   * `name: null` = ese comentario ya no existe.
   */
  readonly mention?: { readonly id: number; readonly name: string | null };
}

/**
 * Texto de un comentario con los momentos escritos («10:32») convertidos en enlaces que abren la obra en
 * ese minuto. Se construye con elementos de React (nunca HTML), así que el texto del usuario no puede
 * inyectar nada.
 */
export function CommentText({ text, movieSlug, durationSeconds, className = "", mentionNames = [], mention }: CommentTextProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const isLong = isLongText(text);
  // Los comentarios antiguos llevan «@Nombre» escrito en el texto; los nuevos usan la referencia.
  const leading = mention ? null : splitLeadingMention(text, mentionNames);
  const body = leading ? leading.rest : text;
  return (
    <div>
    <p className={`whitespace-pre-line break-words ${isLong && !expanded ? "line-clamp-6" : ""} ${className}`}>
      {mention && (
        <>
          {mention.name !== null ? (
            <a
              href={`#${commentAnchorId(mention.id)}`}
              title="Ir al comentario mencionado"
              className="rounded-sm font-semibold text-[#22B16B] hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
            >
              @{mention.name}
            </a>
          ) : (
            <span className="italic text-[#909090]">@comentario eliminado</span>
          )}{" "}
        </>
      )}
      {leading && <span className="font-semibold text-[#22B16B]">{leading.mention}</span>}
      {splitTimestamps(body, durationSeconds).map((segment, index) =>
        segment.type === "text" ? (
          <span key={index}>{segment.value}</span>
        ) : (
          <button
            key={index}
            type="button"
            onClick={() => router.push(`/ver/${movieSlug}?t=${segment.seconds}`)}
            title={`Ir al minuto ${formatTimestamp(segment.seconds)}`}
            className="rounded px-0.5 font-semibold text-[#22B16B] transition-colors hover:bg-[#22B16B]/15 hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
          >
            {segment.value}
          </button>
        ),
      )}
    </p>
    {isLong && (
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className="mt-1 rounded-sm text-[13px] font-semibold text-[#C4C4C4] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
      >
        {expanded ? "Mostrar menos" : "Leer más"}
      </button>
    )}
    </div>
  );
}
