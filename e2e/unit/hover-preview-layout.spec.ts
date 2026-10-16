import { expect, test } from "@playwright/test";
import { computePreviewLayout, previewWidth } from "../../lib/hover-preview-layout";

const VIEWPORT = { width: 1440, height: 900 };
const HEADER = 64;

test.describe("previewWidth", () => {
  test("algo mayor que la portada, entre 344 y 440 px", () => {
    expect(previewWidth(200)).toBe(344);
    expect(previewWidth(300)).toBe(360);
    expect(previewWidth(422)).toBe(440);
  });
});

test.describe("computePreviewLayout: la tarjeta nace sobre la portada", () => {
  const anchor = { left: 502, top: 400, width: 422, height: 237 };
  const panelHeight = 520;

  test("la parte de arriba de la tarjeta, escalada, coincide con la parte de arriba de la portada", () => {
    const layout = computePreviewLayout(anchor, panelHeight, VIEWPORT, HEADER);
    // Con `transform-origin` arriba al centro, la tarjeta escalada deja su borde superior en top + dy.
    expect(layout.top + layout.from.dy).toBeCloseTo(anchor.top, 5);
  });

  test("el centro horizontal de la tarjeta coincide con el de la portada", () => {
    const layout = computePreviewLayout(anchor, panelHeight, VIEWPORT, HEADER);
    expect(layout.left + layout.width / 2 + layout.from.dx).toBeCloseTo(anchor.left + anchor.width / 2, 5);
  });

  test("la escala de partida hace que el ancho de la tarjeta sea el de la portada", () => {
    const layout = computePreviewLayout(anchor, panelHeight, VIEWPORT, HEADER);
    expect(layout.width * layout.from.scale).toBeCloseTo(anchor.width, 5);
  });

  test("la imagen de la tarjeta (16:9) escalada cubre exactamente la portada (16:9)", () => {
    const layout = computePreviewLayout(anchor, panelHeight, VIEWPORT, HEADER);
    const scaledImageHeight = ((layout.width * 9) / 16) * layout.from.scale;
    expect(scaledImageHeight).toBeCloseTo((anchor.width * 9) / 16, 5);
  });

  test("sigue colocándose dentro del viewport y bajo la cabecera", () => {
    const tall = computePreviewLayout({ left: 20, top: 90, width: 300, height: 170 }, 700, VIEWPORT, HEADER);
    expect(tall.left).toBeGreaterThanOrEqual(16);
    expect(tall.top).toBeGreaterThanOrEqual(HEADER + 8);
    expect(tall.top + 700).toBeLessThanOrEqual(VIEWPORT.height - 16);
  });

  test("en el borde derecho no se sale: el desplazamiento horizontal de partida lo compensa", () => {
    const edge = { left: 1100, top: 300, width: 330, height: 186 };
    const layout = computePreviewLayout(edge, 500, VIEWPORT, HEADER);
    expect(layout.left + layout.width).toBeLessThanOrEqual(VIEWPORT.width - 16);
    expect(layout.left + layout.width / 2 + layout.from.dx).toBeCloseTo(edge.left + edge.width / 2, 5);
  });
});
