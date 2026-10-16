import Link from "next/link";
import type { ReactNode } from "react";
import type { MovieMedia } from "@/types/catalog";

/**
 * Tarjetas de la pestaña «Detalles» (estilo Filmin): cada bloque en su tarjeta, con filas «Etiqueta: valor».
 * Solo se muestra lo que existe: sin dato no hay fila, y sin filas no hay tarjeta.
 */

const FORMAT_DESC: Record<string, string> = {
  UHD:   "4K Ultra HD",
  HDR:   "alto rango dinámico",
  Atmos: "audio Dolby Atmos",
};

export function DetailCard({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section data-detail-card className={`rounded-[12px] border border-white/10 bg-black/40 p-6 backdrop-blur-md sm:p-8 ${className}`}>
      <h2 className="mb-4 text-[20px] font-semibold text-[#949494]">{title}</h2>
      {children}
    </section>
  );
}

function InfoLine({ label, children, accent = false }: { label: string; children: ReactNode; accent?: boolean }) {
  return (
    <p className="text-[15px] leading-[1.8] text-white">
      <span className="text-[#949494]">{label}:</span>{" "}
      <span className={accent ? "font-semibold text-[#22B16B]" : undefined}>{children}</span>
    </p>
  );
}

// ─── Créditos ────────────────────────────────────────────────────────────────

interface Person {
  readonly name: string;
  readonly slug: string | null;
}

/** Interpreta el campo `author` cuando no hay créditos estructurados («Creado por: X; Ilustración por: Y»). */
function creditsFromAuthor(raw: string | null | undefined): { role: string; name: string }[] {
  if (!raw) return [];
  const creado = raw.match(/Creado por:\s*([^;]+)/i);
  const ilustr = raw.match(/Ilustraci[oó]n por:\s*([^;]+)/i);
  if (creado || ilustr) {
    return [
      ...(creado?.[1] ? [{ role: "Dirección", name: creado[1].trim() }] : []),
      ...(ilustr?.[1] ? [{ role: "Ilustración", name: ilustr[1].trim() }] : []),
    ];
  }
  return [{ role: "Dirección", name: raw.trim() }];
}

/** Agrupa a las personas por función conservando el orden de aparición. */
export function groupCredits(movie: Pick<MovieMedia, "artistas" | "author">): { role: string; people: Person[] }[] {
  const flat =
    movie.artistas && movie.artistas.length > 0
      ? movie.artistas.map((a) => ({ role: a.role.trim() || "Equipo", name: a.name, slug: a.slug ?? null }))
      : creditsFromAuthor(movie.author).map((c) => ({ ...c, slug: null }));

  const groups = new Map<string, Person[]>();
  for (const { role, name, slug } of flat) {
    const people = groups.get(role) ?? [];
    if (!people.some((p) => p.name === name)) groups.set(role, [...people, { name, slug }]);
  }
  const isLead = (role: string) => /direc|creador/i.test(role);
  return [...groups]
    .map(([role, people]) => ({ role, people }))
    .sort((a, b) => Number(isLead(b.role)) - Number(isLead(a.role))); // la dirección primero; el resto conserva su orden
}

export function CreditsCard({ movie }: { movie: MovieMedia }) {
  const groups = groupCredits(movie);
  if (groups.length === 0) return null;

  return (
    <DetailCard title="Dirección y reparto">
      {groups.map(({ role, people }) => (
        <InfoLine key={role} label={role}>
          {people.map((p, i) => (
            <span key={p.name}>
              {p.slug ? (
                <Link href={`/creadores/${encodeURIComponent(p.slug)}`} className="underline underline-offset-2 transition-colors hover:text-[#22B16B]">
                  {p.name}
                </Link>
              ) : (
                p.name
              )}
              {i < people.length - 1 ? ", " : ""}
            </span>
          ))}
        </InfoLine>
      ))}
    </DetailCard>
  );
}

// ─── Audio y subtítulos ──────────────────────────────────────────────────────

export function AudioCard({ movie }: { movie: MovieMedia }) {
  const hasSubtitles = Boolean(movie.subtitleUrl);
  if (!movie.language && !hasSubtitles) return null;

  return (
    <DetailCard title="Audio y subtítulos">
      {movie.language && <InfoLine label="Audio">{movie.language}</InfoLine>}
      {hasSubtitles && <InfoLine label="Subtítulos">Disponibles</InfoLine>}
    </DetailCard>
  );
}

// ─── Más información ─────────────────────────────────────────────────────────

export function InfoCard({ movie }: { movie: MovieMedia }) {
  const genres = movie.categories.filter((c) => c !== "Cortometraje");
  const quality = (movie.tags ?? []).map((t) => FORMAT_DESC[t] ?? t);

  return (
    <DetailCard title="Más información" className="lg:flex-1">
      {movie.year > 0 && <InfoLine label="Año">{movie.year}</InfoLine>}
      {movie.runtime && <InfoLine label="Duración">{movie.runtime}</InfoLine>}
      {genres.length > 0 && <InfoLine label="Géneros">{genres.join(", ")}</InfoLine>}
      {movie.tag && <InfoLine label="Producción" accent>{movie.tag}</InfoLine>}
      {quality.length > 0 && <InfoLine label="Calidad">{quality.join(", ")}</InfoLine>}
    </DetailCard>
  );
}
