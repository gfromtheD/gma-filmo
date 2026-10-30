import { LandingHero } from "@/components/ui/landing-hero";
import { getPeliculas } from "@/lib/supabase/queries";
import { FEATURE_GENRE } from "@/lib/catalog/work-path";

/** Cuántos títulos como mucho en cada fila de avance de la bienvenida. */
const PREVIEW_ROW_SIZE = 12;

/**
 * Cortos del carrete de la bienvenida, elegidos a mano por lo trabajadas que están sus portadas y en este orden
 * (alternando color y tono para que la fila tenga ritmo). Si alguno deja de estar publicado se salta, y la fila se
 * completa con el resto del catálogo.
 */
const LANDING_CORTOS = [
  "e-toro",
  "quizas-la-flor-quizas-la-muerte-quizas",
  "solio",
  "opium",
  "la-nieve-que-mata",
  "higiene-de-sueno",
  "la-fabrica-de-desahuciados",
  "pequenos-problemas",
  "yasha-gozen",
  "ojos",
  "puerta",
  "siul-a-fun-fan-animation",
] as const;

/** Fuera del carrete de la bienvenida (siguen en el catálogo): portadas menos elaboradas para una primera impresión. */
const LANDING_CORTOS_EXCLUIDOS: ReadonlySet<string> = new Set([
  "no-voy-a-decir-que-no-merezco-esto",
  "simon",
  "sangre-de-hermanos",
  "ratametraje",
  "rojo-y-negro-sobre-blanco",
]);

export default async function RootPage() {
  const all = await getPeliculas();
  const peliculas = all.filter((m) => m.genre === FEATURE_GENRE).slice(0, PREVIEW_ROW_SIZE);

  const shorts = all.filter((m) => m.genre !== FEATURE_GENRE);
  const bySlug = new Map(shorts.map((m) => [m.id, m]));
  const chosen = LANDING_CORTOS.map((slug) => bySlug.get(slug)).filter((m) => m !== undefined);
  const chosenIds = new Set(chosen.map((m) => m.id));
  const filler = shorts.filter((m) => !chosenIds.has(m.id) && !LANDING_CORTOS_EXCLUIDOS.has(m.id));
  const cortos = [...chosen, ...filler].slice(0, PREVIEW_ROW_SIZE);

  return <LandingHero peliculas={peliculas} cortos={cortos} />;
}
