import { LandingHero } from "@/components/ui/landing-hero";
import { getPeliculas } from "@/lib/supabase/queries";
import { FEATURE_GENRE } from "@/lib/catalog/work-path";

/** Cuántos títulos como mucho en cada fila de avance de la bienvenida. */
const PREVIEW_ROW_SIZE = 12;

export default async function RootPage() {
  const all = await getPeliculas();
  const peliculas = all.filter((m) => m.genre === FEATURE_GENRE).slice(0, PREVIEW_ROW_SIZE);
  const cortos = all.filter((m) => m.genre !== FEATURE_GENRE).slice(0, PREVIEW_ROW_SIZE);
  return <LandingHero peliculas={peliculas} cortos={cortos} />;
}
