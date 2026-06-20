"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Hero } from "@/components/features/media/hero";
import { PosterCard } from "@/components/ui/poster-card";
import { RatingsBlock } from "@/components/features/ratings/ratings-block";
import { CommentsBlock } from "@/components/features/comments/comments-block";
import { useWatchlist } from "@/hooks/use-watchlist";
import type { MovieMedia } from "@/types/catalog";
import type { CreatorProfile } from "@/types/creator";

interface MovieDetailProps {
  readonly movie: MovieMedia;
  readonly related: readonly MovieMedia[];
  readonly creator?: CreatorProfile | null;
  readonly autoOpenRating?: boolean;
}

export function MovieDetail({ movie, related, creator, autoOpenRating }: MovieDetailProps) {
  const router = useRouter();
  const { addMedia, removeMedia, hasMedia } = useWatchlist();
  const inList = hasMedia(movie.numericId);
  const [activeTab, setActiveTab] = useState<"valoraciones" | "comentarios">("valoraciones");

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
            {/* ── Tabs: Valoraciones / Comentarios ──────────────────────── */}
            <div>
              <div className="mb-5 flex border-b border-[#262626]">
                {(["valoraciones", "comentarios"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className="px-5 py-2.5 text-[14px] font-bold capitalize transition-colors"
                    style={{
                      color:        activeTab === tab ? "#22B16B" : "#6D7D94",
                      borderBottom: activeTab === tab ? "2px solid #22B16B" : "2px solid transparent",
                      marginBottom: -1,
                      background:   "none",
                      border:       "none",
                      cursor:       "pointer",
                    }}
                  >
                    {tab === "valoraciones" ? "Valoraciones" : "Comentarios"}
                  </button>
                ))}
              </div>

              {activeTab === "valoraciones" ? (
                <RatingsBlock title={movie.title} numericId={movie.numericId} autoOpen={autoOpenRating} />
              ) : (
                <CommentsBlock peliculaId={movie.numericId} movieSlug={movie.id} />
              )}
            </div>
            <DonationRow creator={creator ?? null} />
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

// ─── Donation row ─────────────────────────────────────────────────────────────

const DONATION_PLATFORMS = [
  {
    key: "paypal"  as const,
    label: "PayPal",

    color: "#0070BA",
    hoverBg: "rgba(0,112,186,0.12)",
    hoverBorder: "rgba(0,112,186,0.45)",
    icon: (
      <svg width={36} height={36} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M15.607 4.653H8.941L6.645 19.251H1.82L4.862 0h7.995c3.754 0 6.375 2.294 6.473 5.513-.648-.478-2.105-.86-3.722-.86m6.57 5.546c0 3.41-3.01 6.853-6.958 6.853h-2.493L11.595 24H6.74l1.845-11.538h3.592c4.208 0 7.346-3.634 7.153-6.949a5.24 5.24 0 0 1 2.848 4.686M9.653 5.546h6.408c.907 0 1.942.222 2.363.541-.195 2.741-2.655 5.483-6.441 5.483H8.714Z" />
      </svg>
    ),
    getHref: (c: CreatorProfile | null) => c?.donacion_paypal ?? "https://www.paypal.com",
  },
  {
    key: "patreon" as const,
    label: "Patreon",

    color: "#FF424D",
    hoverBg: "rgba(255,66,77,0.10)",
    hoverBorder: "rgba(255,66,77,0.40)",
    icon: (
      <svg width={36} height={36} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M22.957 7.21c-.004-3.064-2.391-5.576-5.191-6.482-3.478-1.125-8.064-.962-11.384.604C2.357 3.231 1.093 7.391 1.046 11.54c-.039 3.411.302 12.396 5.369 12.46 3.765.047 4.326-4.804 6.068-7.141 1.24-1.662 2.836-2.132 4.801-2.618 3.376-.836 5.678-3.501 5.673-7.031Z" />
      </svg>
    ),
    getHref: (c: CreatorProfile | null) => c?.donacion_patreon ?? "https://www.patreon.com",
  },
  {
    key: "bitcoin" as const,
    label: "Bitcoin",

    color: "#F7931A",
    hoverBg: "rgba(247,147,26,0.10)",
    hoverBorder: "rgba(247,147,26,0.40)",
    icon: (
      <svg width={36} height={36} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.548v-.002zm-6.35-4.613c.24-1.59-.974-2.45-2.64-3.03l.54-2.153-1.315-.33-.525 2.107c-.345-.087-.705-.167-1.064-.25l.526-2.127-1.32-.33-.54 2.165c-.285-.067-.565-.132-.84-.2l-1.815-.45-.35 1.407s.975.225.955.236c.535.136.63.486.615.766l-1.477 5.92c-.075.166-.24.406-.614.314.015.02-.96-.24-.96-.24l-.66 1.51 1.71.426.93.242-.54 2.19 1.32.327.54-2.165c.36.1.705.19 1.05.273l-.51 2.154 1.32.33.545-2.19c2.24.427 3.93.257 4.64-1.774.57-1.637-.03-2.58-1.217-3.196.854-.193 1.5-.76 1.68-1.925l.007-.013zm-3.01 4.22c-.404 1.64-3.157.75-4.05.53l.72-2.9c.896.23 3.757.67 3.33 2.37zm.41-4.24c-.37 1.49-2.662.735-3.405.55l.654-2.64c.744.18 3.137.524 2.75 2.084v.006z" />
      </svg>
    ),
    getHref: (c: CreatorProfile | null) => {
      const addr = c?.donacion_bitcoin;
      return addr ? `bitcoin:${addr}` : "https://bitcoin.org";
    },
  },
] as const;

function DonationRow({ creator }: { creator: CreatorProfile | null }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-[13px] font-bold uppercase tracking-[0.1em] text-[#6D7D94]">
        Apoya al creador
      </h3>
      <div className="grid grid-cols-3 gap-3">
        {DONATION_PLATFORMS.map(({ key, label, color, hoverBg, hoverBorder, icon, getHref }) => (
          <a
            key={key}
            href={getHref(creator)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-3 rounded-[14px] border border-[#262626] bg-[#0D0D0D] px-3 py-6 text-center transition-all duration-200"
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              el.style.background  = hoverBg;
              el.style.borderColor = hoverBorder;
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              el.style.background  = "";
              el.style.borderColor = "";
            }}
          >
            <span style={{ color, filter: `drop-shadow(0 0 8px ${color}66)` }}>
              {icon}
            </span>
            <span className="text-[13px] font-bold text-white">{label}</span>
          </a>
        ))}
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
