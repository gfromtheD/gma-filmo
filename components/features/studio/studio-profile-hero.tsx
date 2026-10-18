"use client";

import { useRef, type ChangeEvent } from "react";
import { CheckCircle, EditPencil, MapPin, MediaImage, Xmark } from "@/components/ui/icons";
import { socialUrl } from "@/lib/social-links";
import { SocialPlatformIcon, getSocialPlatform, socialDisplayText } from "@/components/ui/social-links-panel";
import { StudioLogo } from "./studio-ui";

export type ImageKind = "avatar" | "banner";

interface Props {
  readonly studioName: string;
  readonly artistName: string;
  readonly role: string;
  readonly location: string;
  readonly bio: string;
  readonly socials: Record<string, string>;
  readonly verified: boolean;
  readonly logoColors: { from: string; to: string };
  readonly avatarUrl: string | null;
  readonly bannerUrl: string | null;
  readonly publishedCount: number;
  readonly avgRating: number | null;
  /** Qué imagen se está subiendo o quitando ahora mismo, para bloquear sus botones. */
  readonly busy: ImageKind | null;
  readonly onPickImage: (kind: ImageKind, file: File) => void;
  readonly onRemoveImage: (kind: ImageKind) => void;
}

const OVERLAY_BUTTON =
  "inline-flex min-h-9 items-center gap-2 rounded-full border border-white/15 bg-black/55 px-3.5 text-[12.5px] font-semibold text-white backdrop-blur-md transition-colors hover:bg-black/75 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-white";

/**
 * Cabecera de la ficha de creador: es a la vez la vista previa de la ficha pública y el sitio donde se cambian el banner y la foto
 * (pasando el ratón por encima o con sus botones). Sin seguidores: GMA no los usa por ahora.
 */
export function ProfileHero(props: Props) {
  const { studioName, artistName, role, location, bio, socials, verified, logoColors, avatarUrl, bannerUrl, busy } = props;
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  const pick = (kind: ImageKind) => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // permite volver a elegir el mismo archivo
    if (file) props.onPickImage(kind, file);
  };

  const links = Object.entries(socials)
    .map(([key, value]) => ({ key, value: value.trim(), platform: getSocialPlatform(key), href: socialUrl(key, value.trim()) }))
    .filter((l) => l.value && l.platform && l.href);
  const subtitle = [artistName.trim(), role.trim()].filter(Boolean).join(", ");

  return (
    <section aria-label="Vista previa de tu ficha pública"
      className="relative overflow-clip rounded-[22px] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_24px_60px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
      <input ref={bannerInput} type="file" accept="image/*" hidden onChange={pick("banner")} />
      <input ref={avatarInput} type="file" accept="image/*" hidden onChange={pick("avatar")} />

      {/* Banner */}
      <div className="group/banner relative aspect-[4/1] min-h-[150px] w-full overflow-hidden">
        {bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bannerUrl} alt="" className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover/banner:scale-[1.02] motion-reduce:transition-none" />
        ) : (
          <div aria-hidden="true" className="absolute inset-0" style={{ background: `linear-gradient(120deg, ${logoColors.from}, ${logoColors.to})` }}>
            <div className="absolute inset-0 bg-[radial-gradient(70%_120%_at_85%_0%,rgba(255,255,255,0.18),transparent_60%)]" />
          </div>
        )}
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(0,0,0,0.65)_100%)]" />
        <div className="absolute right-3 top-3 flex gap-2 sm:right-4 sm:top-4">
          <button type="button" disabled={busy === "banner"} onClick={() => bannerInput.current?.click()} className={OVERLAY_BUTTON}>
            <MediaImage aria-hidden="true" className="size-4" />
            {busy === "banner" ? "Subiendo…" : bannerUrl ? "Cambiar banner" : "Añadir banner"}
          </button>
          {bannerUrl && (
            <button type="button" disabled={busy === "banner"} onClick={() => props.onRemoveImage("banner")} aria-label="Quitar banner" className={`${OVERLAY_BUTTON} px-2.5`}>
              <Xmark aria-hidden="true" className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Identidad */}
      <div className="relative flex flex-wrap items-end gap-x-6 gap-y-4 px-5 pb-6 sm:px-7">
        <div className="group/avatar relative -mt-14 shrink-0 rounded-full ring-4 ring-black/80">
          <StudioLogo colors={logoColors} size={112} name={studioName || "Estudio"} rounded={56} imageUrl={avatarUrl ?? undefined} />
          <button type="button" disabled={busy === "avatar"} onClick={() => avatarInput.current?.click()}
            aria-label={avatarUrl ? "Cambiar foto o logo" : "Añadir foto o logo"}
            className="absolute inset-0 grid place-items-center rounded-full bg-black/55 text-[12.5px] font-semibold text-white opacity-0 transition-opacity group-hover/avatar:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-100">
            {busy === "avatar" ? "Subiendo…" : <EditPencil aria-hidden="true" className="size-6" />}
          </button>
          {avatarUrl && busy !== "avatar" && (
            <button type="button" onClick={() => props.onRemoveImage("avatar")} aria-label="Quitar foto o logo"
              className="absolute right-0.5 top-0.5 grid size-7 place-items-center rounded-full border border-white/15 bg-[#0C1611] text-[#C4C4C4] opacity-0 transition-opacity hover:text-[#ff7b7b] group-hover/avatar:opacity-100 focus-visible:opacity-100">
              <Xmark aria-hidden="true" className="size-3.5" />
            </button>
          )}
        </div>

        <div className="min-w-0 flex-1 pt-3">
          <h2 className="flex items-center gap-2 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-white">
            <span className="truncate">{studioName.trim() || "Nombre de tu estudio"}</span>
            {verified && <CheckCircle aria-label="Verificado" className="size-5 shrink-0 text-[#2AC57A]" />}
          </h2>
          {subtitle && <p className="mt-1 text-[14.5px] text-[#C4C4C4]">{subtitle}</p>}
          {location.trim() && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-[#8A8A8A]"><MapPin aria-hidden="true" className="size-3.5" />{location.trim()}</p>
          )}
        </div>

        <dl className="flex gap-8 pb-1">
          <div>
            <dd className="text-[24px] font-semibold tabular-nums text-white">{props.publishedCount}</dd>
            <dt className="text-[12.5px] text-[#8A8A8A]">{props.publishedCount === 1 ? "Obra publicada" : "Obras publicadas"}</dt>
          </div>
          <div>
            <dd className="text-[24px] font-semibold tabular-nums text-white">{props.avgRating ? props.avgRating.toLocaleString("es-ES", { maximumFractionDigits: 1 }) : "—"}</dd>
            <dt className="text-[12.5px] text-[#8A8A8A]">Valoración</dt>
          </div>
        </dl>
      </div>

      {(bio.trim() || links.length > 0) && (
        <div className="border-t border-white/[0.06] px-5 py-5 sm:px-7">
          {bio.trim() && <p className="max-w-[70ch] text-[14.5px] leading-6 text-[#C4C4C4]">{bio.trim()}</p>}
          {links.length > 0 && (
            <ul className={`flex flex-wrap gap-2 ${bio.trim() ? "mt-4" : ""}`}>
              {links.map((l) => (
                <li key={l.key}>
                  <a href={l.href!} target="_blank" rel="noopener noreferrer"
                    aria-label={`${l.platform!.label}: ${socialDisplayText(l.key, l.value)}`} title={socialDisplayText(l.key, l.value)}
                    className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-[#C4C4C4] transition-[color,background-color,transform] hover:-translate-y-0.5 hover:bg-white/[0.12] hover:text-white focus-visible:outline-2 focus-visible:outline-white motion-reduce:transition-none">
                    <SocialPlatformIcon platform={l.platform!} size={17} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
