import { readFile } from 'node:fs/promises';

/**
 * Semáforo de la red de salida del VPS para repartir la calidad de vídeo (pruebas de carga del 23-10-2026: el techo es la
 * tarjeta de 1 Gbit/s, no la CPU). El reproductor lo consulta y decide su techo de calidad:
 *  - alta:  hay sitio, todo el mundo en la máxima calidad.
 *  - media: los que entran nuevos, en 720p; quien ya ve en 1080p sigue igual.
 *  - baja:  los nuevos, en 360p; quien estaba en 1080p baja a 720p para hacer sitio.
 * Con margen al volver (histéresis) para que no oscile al borde de un umbral.
 */
export type Nivel = 'alta' | 'media' | 'baja';

const SUBE_A_MEDIA = 0.75, SUBE_A_BAJA = 0.9;
const VUELVE_A_MEDIA = 0.85, VUELVE_A_ALTA = 0.7;
/** Cada cuánto, como mucho, se vuelve a leer el contador de la tarjeta de red. */
const MUESTREO_MS = 2000;

export function nivelPara(ocupacion: number, anterior: Nivel): Nivel {
  if (ocupacion >= SUBE_A_BAJA) return 'baja';
  if (anterior === 'baja') return ocupacion < VUELVE_A_ALTA ? 'alta' : ocupacion < VUELVE_A_MEDIA ? 'media' : 'baja';
  if (ocupacion >= SUBE_A_MEDIA) return 'media';
  if (anterior === 'media') return ocupacion < VUELVE_A_ALTA ? 'alta' : 'media';
  return 'alta';
}

/** Bytes enviados por la interfaz con más tráfico de salida (sin contar `lo`), leídos de /proc/net/dev. */
export function bytesEnviados(procNetDev: string): number {
  let maximo = 0;
  for (const linea of procNetDev.split('\n').slice(2)) {
    const [nombre, datos] = linea.split(':');
    if (!datos || nombre!.trim() === 'lo') continue;
    const tx = Number(datos.trim().split(/\s+/)[8]);
    if (Number.isFinite(tx) && tx > maximo) maximo = tx;
  }
  return maximo;
}

export interface Carga { readonly nivel: Nivel; readonly ocupacion: number; readonly salidaMbps: number }

export function createEgressMeter(options: { capacidadMbps: number; leer?: () => Promise<string>; ahora?: () => number }) {
  const leer = options.leer ?? (() => readFile('/proc/net/dev', 'utf8'));
  const ahora = options.ahora ?? Date.now;
  let previo: { t: number; bytes: number } | null = null;
  let medido = false;
  let estado: Carga = { nivel: 'alta', ocupacion: 0, salidaMbps: 0 };
  let enCurso: Promise<Carga> | null = null;

  async function medir(): Promise<Carga> {
    const t = ahora();
    const bytes = bytesEnviados(await leer());
    if (previo && t > previo.t) {
      const mbps = ((bytes - previo.bytes) * 8) / ((t - previo.t) / 1000) / 1e6;
      // Media móvil: un pico de un segundo no cambia el semáforo; una subida sostenida, sí.
      const salidaMbps = medido ? estado.salidaMbps * 0.5 + Math.max(0, mbps) * 0.5 : Math.max(0, mbps);
      medido = true;
      const ocupacion = salidaMbps / options.capacidadMbps;
      estado = { nivel: nivelPara(ocupacion, estado.nivel), ocupacion, salidaMbps };
    }
    previo = { t, bytes };
    return estado;
  }

  return {
    /** Estado actual; vuelve a medir si la última lectura tiene más de MUESTREO_MS. */
    async carga(): Promise<Carga> {
      if (previo && ahora() - previo.t < MUESTREO_MS) return estado;
      enCurso ??= medir().finally(() => { enCurso = null; });
      return enCurso;
    },
  };
}
