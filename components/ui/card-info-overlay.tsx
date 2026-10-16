import { formatCommunityScore } from "@/lib/ratings/summary";
import type { MediaItem } from "@/types/catalog";

interface CardInfoOverlayProps {
  readonly item: MediaItem;
}

/**
 * Capa de información para listados grandes: al pasar el ratón (o enfocar) la
 * portada se oscurece con un fundido y muestra duración/año y la descripción.
 * Solo CSS (medido en Filmin: negro al 80 %, entrada 350 ms y salida 250 ms). El título que queda debajo se
 * desenfoca (ver `PosterArt`), así que la portada y el texto se funden en vez de cortarse.
 * Se renderiza dentro del enlace de la tarjeta, por eso no contiene controles.
 */
export function CardInfoOverlay({ item }: CardInfoOverlayProps) {
  const meta =
    item.kind === "movie"
      ? [item.runtime, String(item.year)]
      : [`${item.seasons} temp.`, String(item.year)];

  return (
    <div
      aria-hidden="true"
      data-card-overlay
      className="pointer-events-none absolute inset-0 z-[4] flex flex-col justify-between bg-black/80 p-4 opacity-0 transition-opacity duration-[250ms] ease-out group-has-[:focus-visible]/card:opacity-100 group-hover/card:opacity-100 group-hover/card:duration-[350ms] motion-reduce:transition-none"
    >
      <div className="flex flex-col gap-2">
        <p className="text-[12px] font-medium leading-[12px] text-[#969696]">{meta.join(" · ")}</p>
        {item.synopsis && (
          <p className="line-clamp-5 text-[12px] font-medium leading-[18px] text-white">{item.synopsis}</p>
        )}
      </div>
      {/* La clasificación por edad no se muestra hasta que exista el dato real (hoy es un valor fijo). */}
      {item.communityScore && (
        <p data-overlay-score className="text-[12px] font-semibold leading-4 text-white">
          <span className="text-[#22B16B]">★</span> {formatCommunityScore(item.communityScore.average)}
          <span className="font-medium text-[#969696]"> · {item.communityScore.votes} {item.communityScore.votes === 1 ? "valoración" : "valoraciones"}</span>
        </p>
      )}
    </div>
  );
}
