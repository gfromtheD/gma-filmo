"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { HomeScreen } from "@/components/features/home/home-screen";
import { CatalogScreen } from "@/components/features/catalog/catalog-screen";
import { ComingSoonScreen } from "@/components/features/catalog/coming-soon-screen";
import { SearchScreen } from "@/components/features/search/search-screen";
import { SettingsScreen } from "@/components/features/settings/settings-screen";
import { MyListScreen } from "@/components/features/space/my-list-screen";
import { ProfileScreen } from "@/components/features/profile/profile-screen";
import { ProfileSelector } from "@/components/features/profiles/profile-selector";
import { ProfileEditModal } from "@/components/features/profiles/profile-edit-modal";
import { MovieDetail } from "@/components/features/detail/movie-detail";
import { SeriesDetail } from "@/components/features/detail/series-detail";
import { CreatorProfilePage } from "@/components/features/creator/creator-profile";
import { CreatorSupportPage } from "@/components/features/creator/creator-support-page";
import { PlayerScreen } from "@/components/features/player/player-screen";
import { DashboardView } from "@/components/features/studio/studio-dashboard-view";
import { TitlesView } from "@/components/features/studio/studio-titles-view";
import { ProfileView } from "@/components/features/studio/studio-profile-view";
import { StatsView } from "@/components/features/studio/studio-stats-view";
import { UploadWizard } from "@/components/features/studio/upload/upload-wizard";
import { EditModal } from "@/components/features/studio/studio-edit-modal";
import { STUDIO_DATA } from "@/components/features/studio/studio-data";
import type { StudioData, StudioTitle } from "@/components/features/studio/studio-types";
import ViewerSetup from "@/app/configurar-perfil/page";
import CreatorSetup from "@/app/configurar-perfil-creador/page";
import type { MovieMedia, SeriesMedia } from "@/types/catalog";
import type { CreatorProfile } from "@/types/creator";

const name = "María y el colectivo cinematográfico de larguísimos nombres";
const bio = "Una presentación extensa para comprobar la lectura, los campos y las ventanas en teléfonos y tablets. ".repeat(4);
const creator: CreatorProfile = { slug: "test-director", nombre: name, foto_perfil: null, imagen_portada: null, nacionalidad: "España", bio, redes_sociales: [{ platform: "instagram", url: "@cine.prueba" }], donacion_paypal: "https://paypal.me/testdirector", donacion_patreon: "https://patreon.com/testdirector", donacion_bitcoin: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", titulos: ["test-short"] };
const item: MovieMedia = { kind: "movie", genre: "Cortometraje", id: "test-short", numericId: 1, title: "Un cortometraje con un título largo para probar todos los tamaños", year: 2026, rating: "TP", categories: ["Drama", "Experimental"], synopsis: bio, runtime: "30 s", r2VideoUrl: "http://127.0.0.1:3219/__responsive-video.mp4", style: { tone: ["#11221a", "#111"], accent: "#22B16B", motif: "ring" }, artistas: [{ name, role: "Director", photoUrl: null, slug: creator.slug }] };
const items = Array.from({ length: 12 }, (_, i) => ({ ...item, id: i ? `short-${i}` : item.id, numericId: i + 1, year: 2026 - i }));
const series: SeriesMedia = { ...item, kind: "series", seasons: 6 };
const title: StudioTitle = { id: "test-title", title: item.title, type: "Cortometraje", genre: "Drama", year: 2026, duration: "10 min", status: "publicado", description: bio, language: "Español", subtitles: [], poster: { from: "#123", to: "#234", accent: "#22B16B" }, views: 0, publishDate: "4/10/2026" };
const data: StudioData = { ...STUDIO_DATA, creator: { ...STUDIO_DATA.creator, studioName: name, artistName: name, bio, location: "Una localización con varias palabras", socials: { instagram: "cine.prueba" }, stats: { ...STUDIO_DATA.creator.stats, titles: 4, published: 1 } }, titles: [title, { ...title, id: "draft", status: "borrador", completeness: 40 }, { ...title, id: "review", status: "revision" }, { ...title, id: "rejected", status: "rechazado", rejectReason: bio }] };
const noop = () => {};

export default function Fixture() {
  const view = useSearchParams().get("view") ?? "home";
  const [ready, setReady] = useState(false);
  const [openTitle, setOpenTitle] = useState<StudioTitle | null>(null);
  useEffect(() => {
    const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600, sub: "11111111-1111-4111-8111-111111111111", aud: "authenticated", role: "authenticated" })}.test`;
    void getSupabaseBrowserClient().auth.setSession({ access_token: token, refresh_token: "local-fake-token" }).then(() => setReady(true));
  }, []);
  if (!ready) return <p>Preparando prueba local…</p>;
  let content;
  switch (view) {
    case "catalog": content = <CatalogScreen items={items} heading="Catálogo de cortos" />; break;
    case "coming-soon": content = <ComingSoonScreen title="Nuevas colecciones de películas y cortometrajes" />; break;
    case "search": content = <SearchScreen items={items} />; break;
    case "settings": content = <SettingsScreen />; break;
    case "space": content = <MyListScreen items={items} />; break;
    case "profile": content = <ProfileScreen />; break;
    case "profiles": content = <ProfileSelector />; break;
    case "profile-edit": content = <ProfileEditModal onClose={noop} initialValues={{ name, color: "#22B16B", iconId: "", imageUrl: "" }} onSave={noop} />; break;
    case "movie": content = <MovieDetail movie={item} related={items} creator={creator} />; break;
    case "series": content = <SeriesDetail series={series} related={items.map(movie => ({ ...movie, kind: "series" as const, seasons: 6 }))} episodes={Array.from({ length: 4 }, (_, i) => ({ n: i + 1, title: item.title, synopsis: bio, runtime: "20 min" }))} />; break;
    case "creator": content = <CreatorProfilePage creator={creator} films={items} />; break;
    case "support": content = <CreatorSupportPage creator={creator} />; break;
    case "studio-home": content = <DashboardView data={data} onNav={noop} onOpenTitle={noop} />; break;
    case "studio-titles": content = <TitlesView data={data} onNav={noop} onEditTitle={noop} onToast={noop} onDelete={noop} openTitle={openTitle} setOpenTitle={setOpenTitle} />; break;
    case "studio-profile": content = <ProfileView data={data} onToast={noop} />; break;
    case "studio-stats": content = <StatsView data={data} onToast={noop} />; break;
    case "studio-upload": content = <UploadWizard />; break;
    case "studio-edit": content = <EditModal data={data} title={title} onClose={noop} onToast={noop} />; break;
    case "viewer-setup": content = <ViewerSetup />; break;
    case "creator-setup": content = <CreatorSetup />; break;
    case "player-hls": return <div data-ready="player-hls"><PlayerScreen item={{...item,playbackKind:"r2_hls"}} creator={creator} /></div>;
    case "player": return <div data-ready="player"><PlayerScreen item={item} creator={creator} nextItem={items[1]!} nextUrl="/creadores/responsive-fixture?view=movie" /></div>;
    default: content = <HomeScreen items={items} />;
  }
  return <div data-ready={view}><AppShell>{view.startsWith("studio-") ? <div style={{ padding: "24px 16px", minWidth: 0 }}>{content}</div> : content}</AppShell></div>;
}
