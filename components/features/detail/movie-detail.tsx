"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Hero } from "@/components/features/media/hero";
import { PosterCard } from "@/components/ui/poster-card";
import { RatingsBlock } from "@/components/features/ratings/ratings-block";
import { useWatchlist } from "@/hooks/use-watchlist";
import type { MovieMedia } from "@/types/catalog";

interface MovieDetailProps {
  readonly movie: MovieMedia;
  readonly related: readonly MovieMedia[];
  readonly autoOpenRating?: boolean;
}

export function MovieDetail({ movie, related, autoOpenRating }: MovieDetailProps) {
  const router = useRouter();
  const { addMedia, removeMedia, hasMedia } = useWatchlist();
  const inList = hasMedia(movie.numericId);

  function toggleList() {
    if (inList) removeMedia(movie.numericId);
    else addMedia(movie.numericId);
  }

  return (
    <div>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <Hero item={movie} onPlay={() => router.push(`/ver/${movie.id}`)} onAddList={toggleList} inList={inList} backHref="/cortos" />

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-[1440px] px-6 pb-20 pt-10">
        <div className="grid gap-10" style={{ gridTemplateColumns: "1fr 304px" }}>

          {/* Left: synopsis + stats */}
          <div className="flex flex-col gap-8">
            <SynopsisSection movie={movie} />
            <RatingsBlock title={movie.title} numericId={movie.numericId} autoOpen={autoOpenRating} />
            <StatsRow movie={movie} />
            {(movie.tags ?? []).length > 0 && <FormatSection tags={movie.tags!} />}
          </div>

          {/* Right: meta + related */}
          <aside className="flex flex-col gap-8">
            <MetaCard movie={movie} />
            {related.length > 0 && (
              <RelatedPanel
                related={related}
                onNavigate={(id) => router.push(`/cortos/${id}`)}
              />
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

// ─── Synopsis ─────────────────────────────────────────────────────────────────

function SynopsisSection({ movie }: { movie: MovieMedia }) {
  const [open,    setOpen]    = useState(false);
  const [text,    setText]    = useState("");
  const [sent,    setSent]    = useState(false);
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState("");

  async function submit() {
    if (!text.trim()) return;
    setSending(true);
    setError("");
    try {
      const { data: { session } } = await (await import("@/lib/supabase/browser")).getSupabaseBrowserClient().auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

      const res = await fetch("/api/synopsis-proposals", {
        method: "POST",
        headers,
        body: JSON.stringify({ peliculaId: movie.numericId, proposedText: text.trim() }),
      });
      if (!res.ok) { setError("No se pudo enviar. Inicia sesión e inténtalo de nuevo."); return; }
      setSent(true);
      setOpen(false);
      setText("");
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section>
      <h2 className="mb-4 text-[20px] font-extrabold tracking-[-0.02em] text-white">
        Sinopsis
      </h2>
      <p className="text-[15px] leading-[1.7] text-[#D9E2EC]">{movie.synopsis}</p>

      {/* AI disclosure + propose CTA */}
      <div className="mt-5 rounded-[10px] border border-[#1E1E1E] bg-[#0A0A0A] px-4 py-3">
        {sent ? (
          <p className="text-[12px] font-semibold text-[#22B16B]">
            Gracias por tu aportación — la revisaremos pronto.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-[#5A6A7E]">
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M6 5.5v3M6 3.5h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                Descripción generada con IA
              </span>
              <span className="text-[#262626]">·</span>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="text-[11px] font-semibold text-[#5A6A7E] transition-colors hover:text-white"
              >
                {open ? "Cancelar" : <>¿No es acorde al contenido? <span className="underline underline-offset-2">Propón una mejor</span></>}
              </button>
            </div>

            {open && (
              <div className="mt-3 flex flex-col gap-2">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Escribe aquí la sinopsis correcta para este corto…"
                  rows={4}
                  className="w-full resize-none rounded-[8px] border border-[#262626] bg-[#111] px-3 py-2.5 text-[13px] leading-[1.6] text-[#D9E2EC] placeholder-[#3A4A5A] outline-none transition-colors focus:border-[#22B16B]/50"
                />
                {error && <p className="text-[11px] text-[#ff5252]">{error}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void submit()}
                    disabled={!text.trim() || sending}
                    className="rounded-full bg-[#22B16B] px-4 py-1.5 text-[12px] font-bold text-[#03200F] transition-colors hover:bg-[#2AC57A] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {sending ? "Enviando…" : "Enviar propuesta"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-full px-4 py-1.5 text-[12px] font-semibold text-[#5A6A7E] transition-colors hover:text-white"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

// ─── Credits parser ───────────────────────────────────────────────────────────

function parseAuthorField(
  raw: string | null | undefined,
  artistas?: MovieMedia["artistas"],
): { director: string | null; illustrator: string | null; directorSlug: string | null; illustratorSlug: string | null } {
  if (artistas && artistas.length > 0) {
    const directorArtist    = artistas.find((a) => /creador|director/i.test(a.role)) ?? artistas[0];
    const illustratorArtist = artistas.find((a) => /ilustrador|illustrator/i.test(a.role));
    return {
      director:        directorArtist?.name    ?? null,
      illustrator:     illustratorArtist?.name ?? null,
      directorSlug:    directorArtist?.slug    ?? null,
      illustratorSlug: illustratorArtist?.slug ?? null,
    };
  }
  if (!raw) return { director: null, illustrator: null, directorSlug: null, illustratorSlug: null };
  const creado = raw.match(/Creado por:\s*([^;]+)/i);
  const ilustr  = raw.match(/Ilustraci[oó]n por:\s*([^;]+)/i);
  if (creado || ilustr) {
    return {
      director:        creado?.[1]?.trim() ?? null,
      illustrator:     ilustr?.[1]?.trim()  ?? null,
      directorSlug:    null,
      illustratorSlug: null,
    };
  }
  return { director: raw.trim(), illustrator: null, directorSlug: null, illustratorSlug: null };
}

// ─── Stats row ────────────────────────────────────────────────────────────────

function StatsRow({ movie }: { movie: MovieMedia }) {
  const { director, directorSlug } = parseAuthorField(movie.author, movie.artistas);

  return (
    <div className="grid grid-cols-3 gap-4">
      {[
        { label: "Estreno",  value: String(movie.year) },
        { label: "Duración", value: movie.runtime },
      ].map(({ label, value }) => (
        <div
          key={label}
          className="flex flex-col items-center justify-center rounded-[12px] border border-[#262626] bg-[#0D0D0D] py-5 text-center"
        >
          <span className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6D7D94]">
            {label}
          </span>
          <span className="text-[22px] font-extrabold tracking-[-0.02em] text-white">
            {value}
          </span>
        </div>
      ))}
      <div className="flex flex-col items-center justify-center rounded-[12px] border border-[#262626] bg-[#0D0D0D] py-5 text-center">
        <span className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6D7D94]">
          Director
        </span>
        {director && directorSlug ? (
          <Link
            href={`/creadores/${directorSlug}`}
            className="text-[22px] font-extrabold tracking-[-0.02em] text-white transition-colors hover:text-[#22B16B] hover:underline"
          >
            {director}
          </Link>
        ) : (
          <span className="text-[22px] font-extrabold tracking-[-0.02em] text-white">
            {director ?? "—"}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Format section ───────────────────────────────────────────────────────────

const FORMAT_DESC: Record<string, string> = {
  UHD:   "Resolución 4K Ultra HD",
  HDR:   "Alto rango dinámico",
  Atmos: "Audio Dolby Atmos",
};

function FormatSection({ tags }: { tags: readonly string[] }) {
  return (
    <section>
      <h3 className="mb-4 text-[16px] font-extrabold tracking-[-0.01em] text-white">
        Calidad disponible
      </h3>
      <div className="flex flex-col divide-y divide-[#262626] rounded-[12px] border border-[#262626] bg-[#0D0D0D] overflow-hidden">
        {tags.map((t) => (
          <div key={t} className="flex items-center gap-4 px-5 py-3.5">
            <span className="w-[52px] shrink-0 rounded border border-[#22B16B]/50 py-0.5 text-center text-[11px] font-extrabold text-[#22B16B]">
              {t}
            </span>
            <span className="text-[13px] text-[#B8C5D4]">
              {FORMAT_DESC[t] ?? t}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Meta card ────────────────────────────────────────────────────────────────

function MetaCard({ movie }: { movie: MovieMedia }) {
  return (
    <div className="rounded-[12px] border border-[#262626] bg-[#0D0D0D] p-5">
      <h3 className="mb-4 text-[13px] font-bold uppercase tracking-[0.1em] text-[#6D7D94]">
        Información
      </h3>

      <dl className="flex flex-col gap-3">
        {(() => {
          const { director, illustrator, directorSlug, illustratorSlug } = parseAuthorField(movie.author, movie.artistas);
          return (
            <>
              <MetaRow label="Año"      value={String(movie.year)} />
              <MetaRow label="Duración" value={movie.runtime} />
              {director    && <MetaRow label="Director"   value={director}   linkHref={directorSlug    ? `/creadores/${directorSlug}`    : undefined} />}
              {illustrator && <MetaRow label="Ilustrador" value={illustrator} linkHref={illustratorSlug ? `/creadores/${illustratorSlug}` : undefined} />}
              {movie.tag   && <MetaRow label="Producción" value={movie.tag} accent />}
            </>
          );
        })()}

        {/* Colección */}
        {movie.categories.filter((c) => c !== "Cortometraje").length > 0 && (
          <MetaRow label="Género" value={movie.categories.filter((c) => c !== "Cortometraje").join(", ")} />
        )}

        {/* Format tags */}
        {(movie.tags ?? []).length > 0 && (
          <div className="flex flex-col gap-1.5">
            <dt className="text-[12px] text-[#6D7D94]">Formato</dt>
            <dd className="flex flex-wrap gap-1.5">
              {movie.tags!.map((t) => (
                <span
                  key={t}
                  className="rounded border border-[#22B16B]/40 px-2 py-0.5 text-[11px] font-bold text-[#22B16B]"
                >
                  {t}
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function MetaRow({ label, value, accent, linkHref }: {
  label: string;
  value: string;
  accent?: boolean;
  linkHref?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="shrink-0 text-[12px] text-[#6D7D94]">{label}</dt>
      <dd className={`text-right text-[13px] font-semibold ${accent ? "text-[#22B16B]" : "text-white"}`}>
        {linkHref ? (
          <Link href={linkHref} className="transition-colors hover:text-[#22B16B] hover:underline">
            {value}
          </Link>
        ) : value}
      </dd>
    </div>
  );
}

// ─── Related panel ────────────────────────────────────────────────────────────

function RelatedPanel({
  related,
  onNavigate,
}: {
  related: readonly MovieMedia[];
  onNavigate: (id: string) => void;
}) {
  return (
    <section>
      <h3 className="mb-4 text-[16px] font-extrabold tracking-[-0.01em] text-white">
        También te puede gustar
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {related.map((m) => (
          <PosterCard
            key={m.id}
            item={m}
            ratio="portrait"
            fluid
            onClick={() => onNavigate(m.id)}
          />
        ))}
      </div>
    </section>
  );
}
