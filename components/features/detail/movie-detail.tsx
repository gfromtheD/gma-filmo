"use client";

import { useEffect, useRef, useState } from "react";
import { workPath } from "@/lib/catalog/work-path";
import { useRouter } from "next/navigation";
import { DetailsTab } from "@/components/features/detail/details-tab";
import { DETAIL_TERTIARY_ACTION, DetailHeader } from "@/components/features/detail/detail-header";
import { AddToListMenu } from "@/components/features/space/add-to-list-menu";
import { List } from "@/components/ui/icons";
import { AmbientBackdrop } from "@/components/features/home/ambient-backdrop";
import { DetailTabs, detailPanelId, type DetailTabItem } from "@/components/features/detail/detail-tabs";
import { PosterCard } from "@/components/ui/poster-card";
import { RatingsBlock } from "@/components/features/ratings/ratings-block";
import { CommentsBlock } from "@/components/features/comments/comments-block";
import { ExtrasPanel } from "@/components/features/detail/extras-panel";
import { useExtras } from "@/hooks/use-extras";
import { prefetchPlaybackFor } from "@/hooks/use-media-playback";
import { parseRuntimeSeconds, type WorkType } from "@/lib/comments/timestamp";
import { parseCommentHash } from "@/lib/comments/presentation";
import { useWatchlist, watchlistErrorMessage } from "@/hooks/use-watchlist";
import { useIsGuest } from "@/hooks/use-is-guest";
import { useNoticeToast } from "@/components/ui/notice-toast";
import { useCommunityRatings } from "@/hooks/use-community-ratings";
import type { MovieExtra, MovieMedia } from "@/types/catalog";
import { externalUrl } from "@/lib/social-links";
import { CATALOG_PAGE_PADDING_CLASS, RELATED_GRID_CLASS } from "@/lib/catalog/grid";
import type { CreatorProfile } from "@/types/creator";

interface MovieDetailProps {
  readonly movie: MovieMedia;
  readonly related: readonly MovieMedia[];
  readonly creator?: CreatorProfile | null;
  readonly extras?: readonly MovieExtra[];
  /** Sección de la ficha: «cortometraje» (por defecto) o «película». */
  readonly workType?: WorkType;
  readonly autoOpenRating?: boolean;
}

type DetailTabId = "detalles" | "similares" | "valoraciones" | "comentarios" | "extras";

const TAB_IDS: readonly DetailTabId[] = ["detalles", "similares", "valoraciones", "comentarios", "extras"];
const TAB_PREFIX = "movie";

function isDetailTabId(value: string): value is DetailTabId {
  return (TAB_IDS as readonly string[]).includes(value);
}

export function MovieDetail({ movie, related, creator, extras: initialExtras = [], workType = "cortometraje", autoOpenRating }: MovieDetailProps) {
  const router = useRouter();
  const isGuest = useIsGuest();
  const { addMedia, removeMedia, hasMedia, canSave } = useWatchlist();
  const notice = useNoticeToast();
  const inList = hasMedia(movie.numericId);
  const [scoreRefresh, setScoreRefresh] = useState(0);
  const { avgScore, voteCount } = useCommunityRatings(movie.numericId, scoreRefresh);
  const [activeTab, setActiveTab] = useState<DetailTabId>(autoOpenRating ? "valoraciones" : "detalles");
  const [rateIntent, setRateIntent] = useState(Boolean(autoOpenRating));
  const tabsRef = useRef<HTMLDivElement>(null);
  const extras = useExtras(movie.numericId, initialExtras);

  const tabs: DetailTabItem<DetailTabId>[] = [
    { id: "detalles", label: "Detalles" },
    ...(related.length > 0 ? [{ id: "similares" as const, label: "Similares" }] : []),
    { id: "valoraciones", label: "Valoraciones" },
    { id: "comentarios", label: "Comentarios" },
    ...(extras.length > 0 ? [{ id: "extras" as const, label: "Extras" }] : []),
  ];

  // Estado de pestañas enlazable: /cortos/slug#valoraciones
  useEffect(() => {
    const fromHash = window.location.hash.replace("#", "");
    const available = (fromHash !== "similares" || related.length > 0) && (fromHash !== "extras" || extras.length > 0);
    if (parseCommentHash(fromHash) !== null) setActiveTab("comentarios"); // enlace permanente a un comentario
    else if (isDetailTabId(fromHash) && available) setActiveTab(fromHash);
  }, [related.length, extras.length]);

  function selectTab(id: DetailTabId) {
    setActiveTab(id);
    window.history.replaceState(null, "", `#${id}`);
  }

  async function toggleList() {
    if (!canSave) {
      notice.showLoginRequired();
      return;
    }
    const saved = inList ? await removeMedia(movie.numericId) : await addMedia(movie.numericId);
    if (!saved) notice.showError(watchlistErrorMessage());
  }

  function handleRate() {
    if (!isGuest) setRateIntent(true);
    selectTab("valoraciones");
    requestAnimationFrame(() => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      tabsRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
  }

  async function handleShare() {
    const url = window.location.href.split("#")[0] ?? window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: movie.title, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      // El usuario canceló el diálogo de compartir o el portapapeles no está disponible.
    }
  }

  // Las pestañas de cuadrícula ocupan todo el ancho con los márgenes del catálogo; las de texto conservan su ancho de lectura.
  const isGridTab = activeTab === "similares" || activeTab === "extras";

  return (
    <div>
      {/* Cada título tiene su fondo: el brillo de color de su portada, como en Inicio con el hero. */}
      <AmbientBackdrop imageUrl={movie.imageUrl} style={movie.style} />
      {notice.toast}
      {/* El contenido va por encima del brillo (que es fijo y de pantalla completa). */}
      <div className="relative z-[2]">
      <DetailHeader
        movie={movie}
        avgScore={avgScore}
        voteCount={voteCount}
        inList={inList}
        onPlay={() => { prefetchPlaybackFor(movie); router.push(`/ver/${movie.id}`); }}
        onToggleList={() => void toggleList()}
        onRate={handleRate}
        onShare={() => void handleShare()}
        listAction={
          <AddToListMenu numericId={movie.numericId} title={movie.title} onError={notice.showError} onLoginRequired={notice.showLoginRequired} align="center">
            <button type="button" className={DETAIL_TERTIARY_ACTION}>
              <List size={22} />
              A una lista
            </button>
          </AddToListMenu>
        }
      />

      <div ref={tabsRef} className="scroll-mt-[var(--gma-header-h)]">
        <DetailTabs tabs={tabs} activeId={activeTab} onChange={selectTab} idPrefix={TAB_PREFIX} />
      </div>

      <div
        role="tabpanel"
        id={detailPanelId(TAB_PREFIX, activeTab)}
        aria-labelledby={`${TAB_PREFIX}-tab-${activeTab}`}
        className={`pb-20 pt-10 lg:pt-12 ${isGridTab ? CATALOG_PAGE_PADDING_CLASS : "mx-auto max-w-[1240px] px-4 lg:px-6"}`}
      >
        {activeTab === "detalles" && <DetailsTab movie={movie} donation={<DonationRow creator={creator ?? null} />} />}

        {activeTab === "extras" && extras.length > 0 && <ExtrasPanel extras={extras} />}

        {activeTab === "similares" && (
          <RelatedGrid related={related} onNavigate={(id) => router.push(workPath(related.find((r) => r.id === id) ?? { id }))} />
        )}

        {activeTab === "valoraciones" && (
          <RatingsBlock
            key={rateIntent ? "rate" : "view"}
            title={movie.title}
            numericId={movie.numericId}
            autoOpen={rateIntent}
            onChange={() => setScoreRefresh((k) => k + 1)}
          />
        )}

        {activeTab === "comentarios" && <CommentsBlock peliculaId={movie.numericId} movieSlug={movie.id} workType={workType} durationSeconds={parseRuntimeSeconds(movie.runtime)} />}
      </div>
      </div>
    </div>
  );
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
    getHref: (c: CreatorProfile | null) => externalUrl(c?.donacion_paypal),
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
    getHref: (c: CreatorProfile | null) => externalUrl(c?.donacion_patreon),
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
      return addr ? `bitcoin:${addr}` : null;
    },
  },
] as const;

function DonationRow({ creator }: { creator: CreatorProfile | null }) {
  const platforms = DONATION_PLATFORMS.filter(platform => platform.getHref(creator));
  if (platforms.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-[22px] font-bold text-white">Apoya al creador</h2>
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-3">
        {platforms.map(({ key, label, color, hoverBg, hoverBorder, icon, getHref }) => (
          <a
            key={key}
            href={getHref(creator)!}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-3 rounded-[14px] border border-gma-border bg-gma-surface-2 px-3 py-6 text-center transition-all duration-200"
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

// ─── Related panel ────────────────────────────────────────────────────────────

function RelatedGrid({
  related,
  onNavigate,
}: {
  related: readonly MovieMedia[];
  onNavigate: (id: string) => void;
}) {
  return (
    <section>
      <h2 className="mb-4 text-[22px] font-bold text-white">También te puede gustar</h2>
      <div data-related-grid className={RELATED_GRID_CLASS}>
        {related.map((m) => (
          <PosterCard key={m.id} item={m} ratio="landscape" fluid hoverOverlay onClick={() => onNavigate(m.id)} />
        ))}
      </div>
    </section>
  );
}
