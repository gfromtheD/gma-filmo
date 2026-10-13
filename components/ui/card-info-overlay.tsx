import type { MediaItem } from "@/types/catalog";

interface CardInfoOverlayProps {
  readonly item: MediaItem;
}

/**
 * Capa de información para listados grandes: al pasar el ratón (o enfocar) la
 * portada se oscurece con un fundido y muestra duración/año y la descripción.
 * Solo CSS (Filmin: negro al 80 %; aquí 90 % para que no se transparente el título; entrada 350 ms, salida 250 ms).
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
      className="pointer-events-none absolute inset-0 z-[4] flex flex-col justify-between bg-black/90 p-4 opacity-0 transition-opacity duration-[250ms] ease-out group-focus-within/card:opacity-100 group-hover/card:opacity-100 group-hover/card:duration-[350ms] motion-reduce:transition-none"
    >
      <div className="flex flex-col gap-2">
        <p className="text-[12px] font-medium leading-[12px] text-[#93959C]">{meta.join(" · ")}</p>
        {item.synopsis && (
          <p className="line-clamp-5 text-[12px] font-medium leading-[18px] text-white">{item.synopsis}</p>
        )}
      </div>
      {item.rating && (
        <span className="self-start text-[14px] font-extrabold leading-none text-white">{item.rating}</span>
      )}
    </div>
  );
}
