import { expect, test } from "@playwright/test";
import {
  normalizeText,
  searchCreators,
  searchItems,
  suggestCorrection,
  tokenize,
  type SearchableItem,
} from "../../lib/search/search-engine";

function item(partial: Partial<SearchableItem> & Pick<SearchableItem, "id" | "title">): SearchableItem {
  return { categories: [], year: 2024, ...partial };
}

const CATALOG: SearchableItem[] = [
  item({ id: "camaron", title: "Camarón", categories: ["Stop Motion"], author: "Creado por: Lola Vidal", synopsis: "Un pescador sueña con el mar." }),
  item({ id: "cazando-perros", title: "Cazando Perros", categories: ["Mano Alzada"], artistas: [{ name: "Salvador Gálvez", role: "Director" }] }),
  item({ id: "control-mental", title: "Control Mental", categories: ["+18", "3D"], year: 2021 }),
  item({ id: "la-pelicula", title: "La Película", categories: ["La Película"], year: 2026, synopsis: "Una maratón por la obra completa." }),
  item({ id: "el-ser-mas-debil", title: "El Ser más Débil", categories: ["3D"], year: 2022 }),
  item({ id: "rata", title: "Ratametraje", categories: ["Stop Motion"], author: "Satan Orbis" }),
];

const ids = (query: string) => searchItems(CATALOG, query).map((r) => r.item.id);

test("normaliza mayúsculas, tildes y espacios", () => {
  expect(normalizeText("  CAMARÓN   Débil ")).toBe("camaron debil");
  expect(normalizeText("Ñandú")).toBe("nandu");
  expect(tokenize("el  ser, más-débil")).toEqual(["el", "ser", "mas", "debil"]);
});

test("encuentra sin tildes ni mayúsculas y con pocas letras", () => {
  expect(ids("camaron")).toEqual(["camaron"]);
  expect(ids("CAM")).toContain("camaron");
  expect(ids("debil")).toEqual(["el-ser-mas-debil"]);
});

test("varias palabras deben coincidir todas (en cualquier campo) y en cualquier orden", () => {
  expect(ids("control mental")).toEqual(["control-mental"]);
  expect(ids("mental control")).toEqual(["control-mental"]);
  expect(ids("control stop")).toEqual([]);
});

test("busca por colección, autor/dirección, año y sinopsis", () => {
  expect(ids("stop motion")).toEqual(expect.arrayContaining(["camaron", "rata"]));
  expect(ids("galvez")).toEqual(["cazando-perros"]);
  expect(ids("lola vidal")).toEqual(["camaron"]);
  expect(ids("2021")).toEqual(["control-mental"]);
  expect(ids("pescador")).toEqual(["camaron"]);
});

test("ordena: título exacto y por prefijo antes que coincidencias en otros campos", () => {
  const catalog = [
    item({ id: "otro", title: "Noche", categories: ["Control"] }),
    item({ id: "titulo", title: "Control Mental" }),
    item({ id: "prefijo", title: "Controlados" }),
  ];
  const result = searchItems(catalog, "control").map((r) => r.item.id);
  expect(result[0]).toBe("titulo");
  expect(result[1]).toBe("prefijo");
  expect(result[2]).toBe("otro");
});

test("tolera una errata en palabras largas y no inventa resultados en palabras cortas", () => {
  expect(ids("camaorn")).toEqual(["camaron"]);
  expect(ids("cazndo perros")).toEqual(["cazando-perros"]);
  expect(ids("xyz")).toEqual([]);
  expect(ids("zzzzqq")).toEqual([]);
});

test("consulta vacía o solo símbolos no devuelve nada", () => {
  expect(ids("")).toEqual([]);
  expect(ids("   ")).toEqual([]);
  expect(ids("¿?!")).toEqual([]);
});

test("indica qué campo coincidió para poder explicarlo en la interfaz", () => {
  const [title] = searchItems(CATALOG, "camaron");
  expect(title?.matchedIn).toBe("title");
  const [author] = searchItems(CATALOG, "galvez");
  expect(author?.matchedIn).toBe("credits");
  const [collection] = searchItems(CATALOG, "stop motion");
  expect(collection?.matchedIn).toBe("category");
});

test("sugiere una corrección cuando no hay resultados pero hay un título cercano", () => {
  expect(suggestCorrection(CATALOG, "contrl mntal")).toBe("Control Mental");
  expect(suggestCorrection(CATALOG, "zzzzqq")).toBeNull();
  expect(suggestCorrection(CATALOG, "")).toBeNull();
});

test("encuentra creadores por nombre (sin tildes) y no repite ni devuelve los que no tienen ficha", () => {
  const catalog = [
    item({ id: "a", title: "A", artistas: [{ name: "Salvador Gálvez", role: "Director", slug: "salvador-galvez" }] }),
    item({ id: "b", title: "B", artistas: [{ name: "Salvador Gálvez", role: "Director", slug: "salvador-galvez" }, { name: "Sin Ficha", role: "Música" }] }),
  ];
  expect(searchCreators(catalog, "galvez")).toEqual([{ name: "Salvador Gálvez", slug: "salvador-galvez" }]);
  expect(searchCreators(catalog, "sin ficha")).toEqual([]);
  expect(searchCreators(catalog, "")).toEqual([]);
});
