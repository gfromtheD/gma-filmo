import { test, expect } from "@playwright/test";
import { manageableExtras, mapEngineExtras } from "../../lib/media/engine-extras";
import { moveItem } from "../../lib/studio/extras-order";
import { swipeDirection } from "../../lib/extras/extras";
import { refreshExtras } from "../../hooks/use-extras";

const row = (role: string, position: number, state = "ready", duration: number | null = null) => ({
  asset_id: `${role}-${position}`, role, position, gma_media_assets: { state, duration_seconds: duration },
});

test.describe("mapEngineExtras", () => {
  test("el tráiler va primero, luego los vídeos y por último las imágenes", () => {
    const extras = mapEngineExtras("mi-obra", [row("extra_image", 1), row("extras", 2), row("trailer", 3)]);
    expect(extras.map((e) => e.kindLabel)).toEqual(["Tráiler", "Extra", "Galería"]);
  });

  test("las imágenes salen de /api/media y los vídeos se piden bajo demanda por su endpoint", () => {
    const [trailer, image] = mapEngineExtras("mi-obra", [row("trailer", 1, "ready", 125), row("extra_image", 2)]);
    expect(trailer!.managedEndpoint).toBe("/api/titles/mi-obra/media/trailer-1/playback");
    expect(trailer!.durationLabel).toBe("2:05");
    expect(image!.mediaType).toBe("image");
    expect(image!.videoUrl).toBe("/api/media/extra_image-2");
    expect(image!.managedEndpoint).toBeUndefined();
  });

  test("solo se enseña lo que ya está listo y nunca el vídeo principal ni los subtítulos", () => {
    const extras = mapEngineExtras("x", [row("trailer", 1, "processing"), row("main", 2), row("subtitles", 3), row("extras", 4)]);
    expect(extras).toHaveLength(1);
    expect(extras[0]!.kindLabel).toBe("Extra");
  });

  test("los ids son únicos y negativos para no chocar con los de pelicula_extras", () => {
    const extras = mapEngineExtras("x", [row("trailer", 1), row("extras", 2), row("extra_image", 3)]);
    expect(new Set(extras.map((e) => e.id)).size).toBe(3);
    expect(extras.every((e) => e.id < 0)).toBe(true);
  });

  test("sin filas no hay extras", () => {
    expect(mapEngineExtras("x", [])).toEqual([]);
  });
});

test.describe("refreshExtras", () => {
  test("al refrescar los extras históricos se conservan los del motor (tráiler incluido)", () => {
    const engine = mapEngineExtras("mi-obra", [row("trailer", 3)]);
    expect(refreshExtras(engine, []).map((e) => e.kindLabel)).toEqual(["Tráiler"]);
  });
  test("los históricos recién leídos sustituyen a los anteriores y van detrás de los del motor", () => {
    const engine = mapEngineExtras("mi-obra", [row("trailer", 3)]);
    const legacy = { ...engine[0]!, id: 7, title: "Making of", kindLabel: "Making of" };
    const stale = { ...legacy, id: 5, title: "Viejo" };
    expect(refreshExtras([...engine, stale], [legacy]).map((e) => e.title)).toEqual(["Tráiler", "Making of"]);
  });
});

test.describe("metadatos de extras", () => {
  const meta = (assetId: string, sortOrder: number, extra: Partial<{ label: string; description: string; hidden: boolean }> = {}) =>
    ({ assetId, label: extra.label ?? null, description: extra.description ?? null, hidden: extra.hidden ?? false, sortOrder });

  test("el nombre y la descripción del creador sustituyen a los de siempre", () => {
    const [extra] = mapEngineExtras("x", [row("extras", 1)], [meta("extras-1", 0, { label: "Making of", description: "Cómo se rodó" })]);
    expect(extra!.title).toBe("Making of");
    expect(extra!.description).toBe("Cómo se rodó");
  });

  test("un extra oculto no sale en la ficha", () => {
    const extras = mapEngineExtras("x", [row("extras", 1), row("extras", 2)], [meta("extras-1", 0, { hidden: true })]);
    expect(extras.map((e) => e.managedEndpoint)).toEqual(["/api/titles/x/media/extras-2/playback"]);
  });

  test("el orden elegido manda sobre el de subida, pero el tráiler sigue primero", () => {
    const extras = mapEngineExtras("x", [row("extras", 1), row("trailer", 2), row("extras", 3)],
      [meta("extras-1", 1), meta("trailer-2", 5), meta("extras-3", 0)]);
    expect(extras.map((e) => e.managedEndpoint?.split("/")[5])).toEqual(["trailer-2", "extras-3", "extras-1"]);
  });

  test("manageableExtras lista también los ocultos con su nombre por defecto", () => {
    const list = manageableExtras([row("trailer", 1), row("extras", 2), row("extra_image", 3), row("extras", 4, "processing")],
      [meta("extras-2", 0, { hidden: true })]);
    expect(list.map((e) => [e.label, e.hidden])).toEqual([["Tráiler", false], ["Extra 1", true], ["Imagen 1", false]]);
  });
});

test.describe("orden con extras nuevos", () => {
  test("lo subido después de ordenar va detrás de lo ya ordenado, sea cual sea su tipo", () => {
    const metas = [{ assetId: "extra_image-1", label: null, description: null, hidden: false, sortOrder: 0 }, { assetId: "extras-2", label: null, description: null, hidden: false, sortOrder: 1 }];
    const rows = [row("extras", 3), row("extras", 2), row("extra_image", 1)];
    const ids = () => manageableExtras(rows, metas).map((e) => e.assetId);
    expect(ids()).toEqual(["extra_image-1", "extras-2", "extras-3"]);
    rows.reverse();
    expect(ids()).toEqual(["extra_image-1", "extras-2", "extras-3"]);
  });
});

test("deslizar cambia de extra solo si el gesto es horizontal y largo", () => {
  expect(swipeDirection(-80, 10)).toBe("next");
  expect(swipeDirection(80, 10)).toBe("prev");
  expect(swipeDirection(-20, 0)).toBeNull();
  expect(swipeDirection(-60, 90)).toBeNull();
});

test.describe("moveItem", () => {
  test("intercambia vecinos sin mutar la lista y respeta el tráiler", () => {
    const list = [{ role: "trailer", n: 1 }, { role: "extras", n: 2 }, { role: "extras", n: 3 }];
    expect(moveItem(list, 2, -1).map((i) => i.n)).toEqual([1, 3, 2]);
    expect(moveItem(list, 1, -1).map((i) => i.n)).toEqual([1, 2, 3]);
    expect(moveItem(list, 2, 1).map((i) => i.n)).toEqual([1, 2, 3]);
    expect(list.map((i) => i.n)).toEqual([1, 2, 3]);
  });
});
