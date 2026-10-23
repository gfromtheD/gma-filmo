/**
 * Reparto de la calidad según el semáforo de la pasarela (`/carga`, ver lib/media/gateway/egress.ts). Reglas de G:
 *  - Siempre que se pueda, máxima calidad (1080p) para todos, y se empieza en ella.
 *  - Con la red apretada (media), los que entran nuevos van a 720p; nadie que ya ve en 1080p pierde calidad.
 *  - Con la red al límite (baja), los nuevos van a 360p y quien estaba en 1080p baja a 720p para hacer sitio.
 *  - Al liberarse, sube primero quien más tiempo lleva en baja calidad.
 *  - Si alguien elige una calidad a mano y no hay sitio, sigue viendo y sube solo en cuanto lo haya.
 */
export type Nivel = 'alta' | 'media' | 'baja';
export type Preferencia = 'auto' | number;

const SIN_TECHO = Number.POSITIVE_INFINITY;
/** Lo más que se espera para volver a subir de calidad (quien acaba de bajar); quien lleva mucho en baja, sube enseguida. */
const SUBIDA_MAX_MS = 30_000;

/** Techo de altura (píxeles) para este espectador según el nivel y lo que ya estaba viendo. */
export function techoPara(nivel: Nivel, ver: { readonly nuevo: boolean; readonly alturaActual: number | null }): number {
  if (nivel === 'alta') return SIN_TECHO;
  if (ver.nuevo || ver.alturaActual === null) return nivel === 'media' ? 720 : 360;
  if (nivel === 'media') return Math.max(ver.alturaActual, 720);
  return Math.min(Math.max(ver.alturaActual, 360), 720);
}

/** Lo que se aplica de verdad: el techo del semáforo, recortado por la elección manual si la hay. */
export function aplicarPreferencia(techo: number, preferencia: Preferencia): { readonly altura: number; readonly esperando: boolean } {
  if (preferencia === 'auto') return { altura: techo, esperando: false };
  return { altura: Math.min(preferencia, techo), esperando: preferencia > techo };
}

/** Espera antes de subir de calidad: cuanto más tiempo en baja, antes sube (con algo de azar para no subir todos a la vez). */
export function retrasoSubida(msEnBaja: number, azar = Math.random()): number {
  const base = Math.max(0, SUBIDA_MAX_MS - msEnBaja / 4);
  return Math.round(base * (0.7 + 0.6 * azar));
}

export function esNivel(valor: unknown): valor is Nivel {
  return valor === 'alta' || valor === 'media' || valor === 'baja';
}
