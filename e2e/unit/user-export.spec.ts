import { expect, test } from "@playwright/test";
import { buildUserExport, renderExportHtml, type FilmRef, type RawExport } from "../../lib/export/user-data";

const films: FilmRef[] = [
  { id: 1, slug: "yasha-gozen", title: "Yasha Gozen", year: 2024 },
  { id: 2, slug: "llevame-al-rio", title: "Llévame al río", year: 2023 },
];

const raw: RawExport = {
  exportedAt: "2026-10-18T10:00:00.000Z",
  account: { id: "u1", email: "ana@example.test", createdAt: "2026-01-05T09:00:00Z" },
  profile: { display_name: "Ana" },
  creatorProfile: null,
  watchlist: [{ profile_id: "", pelicula_id: 1, added_at: "2026-10-01T10:00:00Z" }],
  ratings: [
    { profile_id: "", pelicula_id: 2, score: 4, comment: "Preciosa <b>y</b> triste", rated_at: "2026-10-02T10:00:00Z" },
    { profile_id: "", pelicula_id: 99, score: 2, comment: "", rated_at: "2026-10-03T10:00:00Z" },
  ],
  history: [{ profile_id: "", pelicula_id: 1, last_position: 125, completed: false, last_watched_at: "2026-10-04T10:00:00Z" }],
  comments: [
    { id: 7, pelicula_id: 1, parent_id: null, content: "Qué final", created_at: "2026-10-05T10:00:00Z", is_deleted: false },
    { id: 8, pelicula_id: 1, parent_id: null, content: "borrado", created_at: "2026-10-05T11:00:00Z", is_deleted: true },
  ],
  lists: [{ id: "l1", profile_id: "", name: "Para ver con amigos", created_at: "2026-10-06T10:00:00Z", user_list_items: [{ pelicula_id: 2, added_at: "2026-10-06T10:05:00Z" }] }],
  notifications: [],
};

test.describe("descarga de datos del usuario", () => {
  test("pone el título de cada obra, la nota sobre 10 y deja fuera los comentarios borrados", () => {
    const data = buildUserExport(raw, films);
    expect(data.saved[0]).toMatchObject({ title: "Yasha Gozen", year: 2024, slug: "yasha-gozen" });
    expect(data.ratings[0]).toMatchObject({ title: "Llévame al río", score: 8 });
    expect(data.comments.map((c) => c.content)).toEqual(["Qué final"]);
    expect(data.lists[0]!.items.map((i) => i.title)).toEqual(["Llévame al río"]);
  });

  test("una obra que ya no existe sale como «Obra retirada», no como un número", () => {
    const data = buildUserExport(raw, films);
    expect(data.ratings[1]!.title).toBe("Obra retirada");
  });

  test("el HTML trae el resumen arriba y las obras por su título", () => {
    const html = renderExportHtml(buildUserExport(raw, films));
    expect(html).toContain("<html lang=\"es\">");
    expect(html).toContain("<b>1</b> guardada");
    expect(html).toContain("<b>2</b> valoraciones");
    expect(html).toContain("Yasha Gozen");
    expect(html).toContain("2 min");
  });

  test("el HTML escapa lo que escribió el usuario (no se puede colar código)", () => {
    const html = renderExportHtml(buildUserExport(raw, films));
    expect(html).not.toContain("<b>y</b>");
    expect(html).toContain("&lt;b&gt;y&lt;/b&gt;");
  });

  test("los apartados vacíos no ocupan sitio en el HTML", () => {
    const html = renderExportHtml(buildUserExport({ ...raw, lists: [], notifications: [] }, films));
    expect(html).not.toContain("Tus listas");
    expect(html).not.toContain("Avisos");
  });
});
