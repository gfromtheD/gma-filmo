"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { PosterCard } from "@/components/ui/poster-card";
import type { CreatorProfile } from "@/types/creator";
import type { MovieMedia } from "@/types/catalog";

function slugToHue(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = ((h * 31) + slug.charCodeAt(i)) >>> 0;
  return h % 360;
}

function InitialAvatar({ nombre, size = 72 }: { nombre: string; size?: number }) {
  const COLORS = ["#22B16B", "#3a8fb7", "#f0c14b", "#e63946", "#9B6FD4", "#3BAED4"];
  let h = 0;
  for (let i = 0; i < nombre.length; i++) h = ((h * 31) + nombre.charCodeAt(i)) >>> 0;
  const bg = COLORS[h % COLORS.length]!;
  return (
    <div
      style={{ width: size, height: size, background: bg, fontSize: size * 0.42 }}
      className="flex shrink-0 items-center justify-center rounded-full font-extrabold text-[#031A0E]"
    >
      {(nombre[0] ?? "?").toUpperCase()}
    </div>
  );
}

const DONATION_BUTTONS = [
  {
    key: "paypal" as const,
    label: "Donar por PayPal",
    icon: (
      <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 2.72A.641.641 0 0 1 5.577 2h7.022c2.33 0 3.984.65 4.96 1.948.93 1.234 1.096 2.795.501 4.715-.847 2.766-2.951 4.213-6.254 4.29l-1.286.02-.613 3.875a.641.641 0 0 1-.633.54H7.076zm4.99-13.073c1.93 0 3.145.677 3.641 2.016.366.993.257 2.207-.322 3.61-.793 1.942-2.213 2.913-4.219 2.913h-.37l.494-3.116a.641.641 0 0 0-.633-.74H9.4l.948-5.988c.527.194 1.067.305 1.718.305z" />
      </svg>
    ),
  },
  {
    key: "patreon" as const,
    label: "Apoyar en Patreon",
    icon: (
      <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M14.82 2.41c3.96 0 7.18 3.24 7.18 7.21 0 3.96-3.22 7.18-7.18 7.18-3.97 0-7.21-3.22-7.18-7.18 0-3.97 3.24-7.21 7.21-7.21M2 21.6h3.5V2.41H2V21.6z" />
      </svg>
    ),
  },
  {
    key: "bitcoin" as const,
    label: "Dirección Bitcoin",
    icon: (
      <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.548v-.002zm-6.35-4.613c.24-1.59-.974-2.45-2.64-3.03l.54-2.153-1.315-.33-.525 2.107c-.345-.087-.705-.167-1.064-.25l.526-2.127-1.32-.33-.54 2.165c-.285-.067-.565-.132-.84-.2l-1.815-.45-.35 1.407s.975.225.955.236c.535.136.63.486.615.766l-1.477 5.92c-.075.166-.24.406-.614.314.015.02-.96-.24-.96-.24l-.66 1.51 1.71.426.93.242-.54 2.19 1.32.327.54-2.165c.36.1.705.19 1.05.273l-.51 2.154 1.32.33.545-2.19c2.24.427 3.93.257 4.64-1.774.57-1.637-.03-2.58-1.217-3.196.854-.193 1.5-.76 1.68-1.925l.007-.013zm-3.01 4.22c-.404 1.64-3.157.75-4.05.53l.72-2.9c.896.23 3.757.67 3.33 2.37zm.41-4.24c-.37 1.49-2.662.735-3.405.55l.654-2.64c.744.18 3.137.524 2.75 2.084v.006z" />
      </svg>
    ),
  },
] as const;

interface CreatorProfileProps {
  readonly creator: CreatorProfile;
  readonly films: readonly MovieMedia[];
}

export function CreatorProfilePage({ creator, films }: CreatorProfileProps) {
  const hue = slugToHue(creator.slug);
  const hasCover = Boolean(creator.imagen_portada);

  return (
    <div className="min-h-screen" style={{ background: "#0A0F17" }}>
      {/* ── Banner header ──────────────────────────────────────────── */}
      <div className="relative h-56 overflow-hidden">
        {hasCover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={creator.imagen_portada!}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: `linear-gradient(135deg, hsl(${hue},40%,8%) 0%, hsl(${(hue + 40) % 360},35%,16%) 100%)`,
            }}
          />
        )}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, transparent 20%, rgba(10,15,23,0.7) 60%, #0A0F17 100%)",
          }}
        />
      </div>

      {/* ── Identity row (overlaps banner) ────────────────────────── */}
      <div className="relative z-10 mx-auto max-w-[1100px] px-6">
        <div className="-mt-10 flex flex-wrap items-end gap-5">
          {/* Avatar */}
          <div className="shrink-0 rounded-full ring-2 ring-[#22B16B] ring-offset-2 ring-offset-[#0A0F17]">
            {creator.foto_perfil ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={creator.foto_perfil}
                alt={creator.nombre}
                width={72}
                height={72}
                className="h-[72px] w-[72px] rounded-full object-cover"
              />
            ) : (
              <InitialAvatar nombre={creator.nombre} size={72} />
            )}
          </div>

          {/* Name + nationality */}
          <div className="flex flex-1 flex-col gap-0.5 pb-1">
            <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-white">
              {creator.nombre}
            </h1>
            {creator.nacionalidad && (
              <p className="text-[13px] text-[#6D7D94]">{creator.nacionalidad}</p>
            )}
          </div>

          {/* Donation buttons */}
          <div className="flex shrink-0 flex-wrap gap-2 pb-1">
            {DONATION_BUTTONS.map(({ key, label, icon }) => {
              const url = creator[`donacion_${key}`];
              if (!url) return null;
              const href = key === "bitcoin" ? `bitcoin:${url}` : url;
              return (
                <motion.a
                  key={key}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 rounded-full border border-[#1E2D42] px-4 py-2 text-[13px] font-semibold text-[#B8C5D4] transition-colors duration-150 hover:border-[#22B16B]/40 hover:bg-[#22B16B]/10 hover:text-[#22B16B]"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  {icon}
                  {label}
                </motion.a>
              );
            })}
          </div>
        </div>

        {/* ── Bio ────────────────────────────────────────────────────── */}
        {creator.bio && (
          <p className="mt-6 max-w-[680px] text-[15px] leading-[1.7] text-[#B8C5D4]">
            {creator.bio}
          </p>
        )}

        {/* ── Filmography ────────────────────────────────────────────── */}
        <section className="mt-10 pb-20">
          <h2 className="mb-6 text-[18px] font-extrabold tracking-[-0.01em] text-white">
            Filmografía en GMA Filmo
          </h2>
          {films.length === 0 ? (
            <p className="text-[14px] text-[#6D7D94]">
              Próximamente más contenido de este creador.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {films.map((film) => (
                <Link key={film.id} href={`/cortos/${film.id}`} className="block">
                  <PosterCard item={film} ratio="portrait" fluid />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
