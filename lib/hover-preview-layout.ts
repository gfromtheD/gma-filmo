/** Medidas de la vista previa flotante respecto a la portada que la origina. */

const MIN_WIDTH = 344;
const MAX_WIDTH = 440;
const WIDTH_FACTOR = 1.2;
const VIEWPORT_MARGIN = 16;
const HEADER_GAP = 8;

export interface PreviewLayout {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  /** Desplazamiento y escala de partida para que el panel "salga" de la portada. */
  readonly from: { readonly dx: number; readonly dy: number; readonly scale: number };
}

export interface AnchorBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/** Ancho del panel: algo mayor que la portada, entre 344 y 440 px. */
export function previewWidth(anchorWidth: number): number {
  return clamp(Math.round(anchorWidth * WIDTH_FACTOR), MIN_WIDTH, MAX_WIDTH);
}

/**
 * Centra el panel sobre la portada y lo mantiene dentro del viewport
 * (16 px de margen) y por debajo de la cabecera fija.
 */
export function computePreviewLayout(
  anchor: AnchorBox,
  panelHeight: number,
  viewport: { readonly width: number; readonly height: number },
  headerBottom: number,
): PreviewLayout {
  const width = previewWidth(anchor.width);
  const anchorCx = anchor.left + anchor.width / 2;
  const anchorCy = anchor.top + anchor.height / 2;

  const left = clamp(anchorCx - width / 2, VIEWPORT_MARGIN, viewport.width - VIEWPORT_MARGIN - width);
  const minTop = headerBottom + HEADER_GAP;
  const top = clamp(anchorCy - panelHeight / 2, minTop, viewport.height - VIEWPORT_MARGIN - panelHeight);

  return {
    left,
    top,
    width,
    from: {
      dx: anchorCx - (left + width / 2),
      dy: anchorCy - (top + panelHeight / 2),
      scale: anchor.width / width,
    },
  };
}
