import { test, expect } from "@playwright/test";
import { mapEngineExtras } from "../../lib/media/engine-extras";
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
