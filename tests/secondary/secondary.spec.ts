import React from "react";
import { supportMethods } from "../../lib/creator-support";
import { catalogCredit, catalogCreditSlug, catalogProfile, catalogCreators, completeCatalogProfile, addCatalogCredits, keepCreatorLinks } from "../../lib/catalog-creators";
import { test, expect } from "@playwright/test";
import { renderToStaticMarkup } from "react-dom/server";
import { socialUrl, externalUrl } from "../../lib/social-links";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { loadReactModule } = require("./load-react.cjs");
const { STUDIO_DATA } = loadReactModule("components/features/studio/studio-data.ts");
const { DashboardView } = loadReactModule("components/features/studio/studio-dashboard-view.tsx");
const { StatsView } = loadReactModule("components/features/studio/studio-stats-view.tsx");
const { CreatorProfilePage } = loadReactModule("components/features/creator/creator-profile.tsx");
const { CreatorSupportPage } = loadReactModule("components/features/creator/creator-support-page.tsx");
const { DonationPanel } = loadReactModule("components/features/player/donation-panel.tsx");
const { Hero } = loadReactModule("components/features/media/hero.tsx");
import type { CreatorProfile } from "../../types/creator";
import type { MovieMedia } from "../../types/catalog";

const creator: CreatorProfile = {
  slug: "creadora-real", nombre: "Creadora real", foto_perfil: null, imagen_portada: null,
  nacionalidad: null, bio: null, redes_sociales: [{ platform: "instagram", url: "@cine.real" }],
  donacion_paypal: null, donacion_patreon: null, donacion_bitcoin: null, titulos: [],
};
const movie: MovieMedia = {
  kind: "movie", genre: "Cortometraje", id: "corto", numericId: 1, title: "Mi corto", year: 2026, rating: "TP",
  categories: [], synopsis: "", runtime: "10 min", style: { tone: ["#000", "#111"], accent: "#22B16B", motif: "ring" },
  artistas: [{ name: creator.nombre, role: "Director", photoUrl: null, slug: creator.slug }],
};

test("handles, URLs completas y canales conservan el destino correcto", () => {
  expect(socialUrl("instagram", " @cine.real ")).toBe("https://instagram.com/cine.real");
  expect(socialUrl("tiktok", "@cine")).toBe("https://tiktok.com/@cine");
  expect(socialUrl("youtube", "https://www.youtube.com/channel/UC123")).toBe("https://www.youtube.com/channel/UC123");
  expect(socialUrl("facebook", "facebook.com/mi.pagina")).toBe("https://facebook.com/mi.pagina");
  expect(socialUrl("website", "cine.example")).toBe("https://cine.example/");
});

test("enlaces inválidos o de otra plataforma no se convierten en perfiles", () => {
  expect(socialUrl("instagram", "https://evil.example/cine")).toBeNull();
  expect(socialUrl("instagram", "cine real")).toBeNull();
  expect(socialUrl("website", "javascript:alert(1)")).toBeNull();
  expect(socialUrl("website", "https://usuario:clave@cine.example")).toBeNull();
  expect(socialUrl("constructor", "javascript:alert(1)")).toBeNull();
  expect(externalUrl("")).toBeNull();
});

test("el estudio vacío no presenta actividad, almacenamiento o identidad ficticios", () => {
  const html = renderToStaticMarkup(React.createElement(DashboardView, { data: STUDIO_DATA, onNav: () => {}, onOpenTitle: () => {} }));
  expect(STUDIO_DATA.titles).toHaveLength(0);
  expect(STUDIO_DATA.creator.stats.totalViews).toBeNull();
  expect(html).toContain("Todavía no has subido ningún título");
  expect(html).toContain("El consumo de almacenamiento todavía no está disponible");
  // Se ignoran los SVG: las coordenadas de los iconos contienen números como "3.2" que no son datos.
  const visibleHtml = html.replace(/<svg[\s\S]*?<\/svg>/g, "");
  for (const text of ["Nora Vidal", "Marea baja", "131K", "18%", "3.2", "Completado"]) expect(visibleHtml).not.toContain(text);
});

test("estadísticas vacías distinguen métricas pendientes y no inventan gráficos", () => {
  const html = renderToStaticMarkup(React.createElement(StatsView, { data: STUDIO_DATA, onToast: () => {} }));
  expect(html).toContain("Todavía no hay títulos que mostrar");
  expect(html).toContain("todavía no están disponibles");
  expect(html).not.toContain("9.420");
  expect(html).not.toContain("NaN");
});

test("el perfil público muestra el enlace social correcto y omite donaciones ausentes", () => {
  const html = renderToStaticMarkup(React.createElement(CreatorProfilePage, { creator, films: [] }));
  expect(html).toContain('href="https://instagram.com/cine.real"');
  expect(html).not.toContain("patreon.com");
  expect(html).not.toContain("paypal.com");
});

test("los créditos del hero enlazan por slug y no fabrican perfiles del autor textual", () => {
  expect(renderToStaticMarkup(React.createElement(Hero, { item: movie }))).toContain('href="/creadores/creadora-real"');
  const html = renderToStaticMarkup(React.createElement(Hero, { item: { ...movie, artistas: [], author: "Autor histórico" } }));
  expect(html).toContain("Autor histórico");
  expect(html).not.toContain('href="/creadores/');
});

test("el QR solo aparece con métodos reales y un creador", () => {
  const donor = { ...creator, donacion_paypal: "https://paypal.me/cine" };
  const html = renderToStaticMarkup(React.createElement(DonationPanel, { creator: donor, appUrl: "https://gma.example", onClose: () => {} }));
  expect(html).toContain("<svg");
  expect(html).toContain('href="https://gma.example/creadores/creadora-real/apoyar"');
  expect(html).toContain("Abrir página de apoyo");
  expect(renderToStaticMarkup(React.createElement(DonationPanel, { creator, appUrl: "https://gma.example", onClose: () => {} }))).toBe("");
  expect(renderToStaticMarkup(React.createElement(DonationPanel, { creator: null, appUrl: "https://gma.example", onClose: () => {} }))).toBe("");
});

test("la página de apoyo muestra identidad, destinos válidos y Bitcoin sin exigir login", () => {
  const donor = { ...creator, donacion_paypal: "https://paypal.me/cine", donacion_patreon: "https://patreon.com/cine", donacion_bitcoin: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa" };
  expect(supportMethods(donor)).toHaveLength(3);
  const html = renderToStaticMarkup(React.createElement(CreatorSupportPage, { creator: donor }));
  expect(html).toContain("Creadora real");
  expect(html).toContain('href="https://paypal.me/cine"');
  expect(html).toContain('href="https://patreon.com/cine"');
  expect(html).toContain('href="bitcoin:1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"');
  expect(html).toContain("Copiar dirección");
  expect(html).not.toContain("Iniciar sesión");
  expect(supportMethods({ ...creator, donacion_paypal: "https://paypal.me.evil.com/cine", donacion_patreon: "javascript:alert(1)", donacion_bitcoin: "invalid?amount=100" })).toEqual([]);
});

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`bienvenida entra directo como invitado sin datos (${viewport.width}px)`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    await page.route("**/*", route => {
      const url = new URL(route.request().url());
      return ["data:", "blob:", "about:"].includes(url.protocol) || url.origin === "http://127.0.0.1:4318"
        ? route.continue() : route.abort();
    });
    await page.route("**/inicio", route => route.fulfill({ contentType: "text/html", body: "<h1>Destino invitado de prueba</h1>" }));
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "El lugar para descubrir, compartir, sentir y disfrutar cine." })).toBeVisible();
    // LandingHero is server-rendered. Wait for its client hydration before the first interaction.
    await page.waitForTimeout(800);
    await expect(page.getByPlaceholder("Tu email")).toHaveCount(0);
    await page.getByRole("button", { name: "Entrar a GMA Filmo" }).click();
    await expect(page).toHaveURL(/\/inicio$/);
    const cookies = await context.cookies();
    expect(cookies.some(cookie => cookie.name === "gma_guest" && cookie.value === "1")).toBeTruthy();
  });
}


test("cada artista histórico tiene una página pública sin cuenta y una fuente verificable", () => {
  expect(catalogCreators.length).toBe(120);
  for (const artist of catalogCreators) {
    expect(catalogProfile(artist.slug, [])).toBeNull();
    const profile = catalogProfile(artist.slug, [{ ...movie, artistas: [{ name: artist.name, slug: artist.slug, role: "Director", photoUrl: null }] }]);
    expect(profile?.nombre).toBe(artist.name);
    expect(profile?.editorial).toBe(true);
    expect(profile?.donacion_paypal).toBeNull();
  }
  const alberto = catalogProfile("alberto-valdez", [{ ...movie, artistas: [catalogCredit("Alberto Valdez", "Director")] }]);
  expect(alberto?.source_url).toBe("https://generacionmaldita.com/artista/alberto-valdez/");
  expect(alberto?.redes_sociales).toContainEqual({ platform: "instagram", url: "https://www.instagram.com/strangerealities/" });
});

test("un crédito textual desconocido tiene ficha y obras, sin inventar biografía o identidad", () => {
  const credit = catalogCredit("Autor sin cuenta", "Director");
  const profile = catalogProfile(credit.slug!, [{ ...movie, artistas: [credit] }]);
  expect(profile?.nombre).toBe("Autor sin cuenta");
  expect(profile?.titulos).toEqual([movie.id]);
  expect(profile?.bio).toBeNull();
  expect(profile?.redes_sociales).toEqual([]);
  expect(catalogProfile("catalogo-persona-inexistente", [movie])).toBeNull();
  expect(catalogCreditSlug("  Autor sin cuenta ")).toBe(catalogCreditSlug("Autor sin cuenta"));
  expect(catalogCreditSlug("José Pérez")).not.toBe(catalogCreditSlug("Jose Perez"));
});


test("las fichas antiguas vacías se completan sin sustituir información existente", () => {
  const catalog = catalogProfile("alberto-valdez", [{ ...movie, artistas: [catalogCredit("Alberto Valdez", "Director")] }]);
  const completed = completeCatalogProfile({ ...creator, slug: "alberto-valdez", redes_sociales: [] }, catalog);
  expect(completed.bio).toBeTruthy();
  expect(completed.foto_perfil).toBeTruthy();
  expect(completed.redes_sociales).toEqual(catalog?.redes_sociales);
  const existing = { ...creator, bio: "Biografía existente", foto_perfil: "https://example.com/avatar.jpg" };
  const preserved = completeCatalogProfile(existing, catalog);
  expect(preserved.bio).toBe(existing.bio);
  expect(preserved.foto_perfil).toBe(existing.foto_perfil);
  expect(preserved.redes_sociales).toEqual(existing.redes_sociales);
});


test("no se publican fichas por existir en la web original, ni por tener solo una película", () => {
  expect(catalogCreators.some(artist => artist.slug === "nam")).toBe(false);
  expect(catalogProfile("nam", [movie])).toBeNull();
  const credit = catalogCredit("Alberto Valdez", "Director");
  expect(catalogProfile(credit.slug!, [{ ...movie, genre: "Película", artistas: [credit] }])).toBeNull();
  const stale = { ...creator, titulos: ["obra-ausente", "otra-persona"] };
  const actual = catalogProfile(credit.slug!, [{ ...movie, artistas: [credit] }]);
  expect(completeCatalogProfile(stale, actual).titulos).toEqual([movie.id]);
});


test("las asociaciones originales completan directores solo en sus obras confirmadas", () => {
  expect(addCatalogCredits("guerra-en-sarilla", []).some(credit => credit.slug === "alberto-valdez")).toBe(true);
  expect(addCatalogCredits("obra-inexistente", [])).toEqual([]);
  const credit = catalogCredit("Solo una película", "Director");
  const film = { ...movie, genre: "Película", artistas: [credit] };
  expect(keepCreatorLinks([film], [film])[0]?.artistas?.[0]?.slug).toBeNull();
});


test("sin métodos configurados no hay destinos de demostración", () => {
  expect(supportMethods(creator)).toEqual([]);
  const html = renderToStaticMarkup(React.createElement(CreatorSupportPage, { creator }));
  expect(html).toContain("todavía no tiene métodos de apoyo disponibles");
  expect(html).not.toContain("paypal.com/signin");
  expect(html).not.toContain("patreon.com/login");
});
