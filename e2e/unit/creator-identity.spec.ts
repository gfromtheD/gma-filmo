import { test, expect } from "@playwright/test";
import { accountOverlay, accountProfile, linkAccountCredits, mergeCreatorWorks, type AccountCreatorRow } from "../../lib/creator-identity";
import { keepCreatorLinks } from "../../lib/catalog-creators";
import type { MovieMedia } from "../../types/catalog";

const film = (id: string, genre: "Cortometraje" | "Película" = "Cortometraje", slugs: (string | null)[] = []) =>
  ({ id, genre, artistas: slugs.map((slug) => ({ name: `n-${slug}`, role: "", slug, photoUrl: null })) }) as unknown as MovieMedia;

const row = (extra: Partial<AccountCreatorRow> = {}): AccountCreatorRow => ({
  user_id: "u1", slug: "ana-lopez", creator_name: "Ana López", studio_name: null, banner_url: null, avatar_url: "https://x/a.jpg", bio: "Hola", ...extra,
});

test.describe("identidad del creador", () => {
  test("el crédito con el nombre de la cuenta enlaza con el slug de la cuenta, sin importar mayúsculas ni espacios", () => {
    const credits = [{ name: " ana  LÓPEZ ", role: "Director", slug: "catalogo-xyz", photoUrl: null }, { name: "Otra", role: "", slug: null, photoUrl: null }];
    const linked = linkAccountCredits(credits, { slug: "ana-lopez", name: "Ana López" });
    expect(linked.map((c) => c.slug)).toEqual(["ana-lopez", null]);
    expect(credits[0]!.slug).toBe("catalogo-xyz");
  });

  test("sin cuenta los créditos quedan como estaban", () => {
    const credits = [{ name: "Ana", role: "", slug: "a", photoUrl: null }];
    expect(linkAccountCredits(credits, undefined)).toEqual(credits);
  });

  test("las obras de la página suman las acreditadas y las de la cuenta, sin repetir y en orden de catálogo", () => {
    const films = [film("a"), film("b"), film("c"), film("d")];
    const merged = mergeCreatorWorks(films, [films[2]!, films[0]!], new Set(["b", "c"]));
    expect(merged.map((f) => f.id)).toEqual(["a", "b", "c"]);
  });

  test("una obra nueva de la cuenta aparece sin tocar ninguna lista manual", () => {
    expect(mergeCreatorWorks([film("nueva")], [], new Set(["nueva"])).map((f) => f.id)).toEqual(["nueva"]);
  });

  test("una cuenta sin obras tiene perfil con su nombre, foto y bio", () => {
    const profile = accountProfile(row(), "ana-lopez", []);
    expect(profile).toMatchObject({ slug: "ana-lopez", nombre: "Ana López", foto_perfil: "https://x/a.jpg", bio: "Hola", titulos: [] });
  });

  test("la ficha de Mi Estudio se superpone por cuenta, aunque el nombre del catálogo sea otro", () => {
    expect(accountOverlay(row({ gestionado: true, location: "Madrid" }))).toMatchObject({ gestionado: true, location: "Madrid" });
  });

  test("los enlaces a creadores de largometrajes sobreviven si son slugs de cuenta", () => {
    const peli = film("peli", "Película", ["ana-lopez", "catalogo-x"]);
    const kept = keepCreatorLinks([peli], [peli], new Set(["ana-lopez"]));
    expect(kept[0]!.artistas!.map((c) => c.slug)).toEqual(["ana-lopez", null]);
  });
});

test.describe("slugs históricos con caracteres especiales", () => {
  test("la misma ficha se encuentra con la URL codificada una o dos veces, o ya decodificada", async () => {
    const { storedCreatorSlug } = await import("../../lib/catalog-creators");
    const stored = "mar_oblivion%e2%99%a1";
    for (const received of [stored, "mar_oblivion%E2%99%A1", "mar_oblivion♡", "mar_oblivion%25e2%2599%25a1"]) {
      expect(storedCreatorSlug(received)).toBe(stored);
    }
    expect(storedCreatorSlug("pablo-pares")).toBe("pablo-pares");
    expect(storedCreatorSlug("%E0%A4%A")).toBe("%E0%A4%A");
  });
});
