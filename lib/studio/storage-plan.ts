/**
 * Almacenamiento de los creadores: lo que incluye GMA gratis y cuánto costaría ampliarlo, calculado a partir de lo que
 * nos cuesta a nosotros alojar ese espacio (sin margen). Módulo puro: lo usan el Panel de Mi Estudio y sus pruebas.
 *
 * De dónde salen los números (revisar si cambia el proveedor o sus precios):
 *  - Cloudflare R2, almacenamiento estándar: 0,015 USD por GB al mes; la salida de datos (ver los vídeos) no se cobra.
 *  - Cada GB que sube un creador ocupa más en nuestro almacenamiento: se guarda el original y las versiones HLS en varias
 *    calidades para reproducirlo en cualquier conexión. Se estima ×2.
 *  - Margen del 20 % para operaciones de lectura/escritura y el procesado (conversión) de los vídeos.
 *  - Cambio aproximado: 1 USD = 0,92 EUR (redondeado al alza para no quedarnos cortos).
 *  - Cobro con tarjeta (Stripe, tarjetas europeas): en torno a 1,5 % + 0,25 € por cobro mensual.
 */

export const GIB = 1024 ** 3;

/** Espacio gratis por creador. */
export const FREE_STORAGE_GB = 5;
export const FREE_STORAGE_BYTES = FREE_STORAGE_GB * GIB;

/** Rango de la calculadora de ampliación. */
export const PLAN_MIN_GB = FREE_STORAGE_GB;
export const PLAN_MAX_GB = 500;
export const PLAN_STEP_GB = 5;

const R2_USD_PER_GB_MONTH = 0.015;
const STORED_PER_UPLOADED_GB = 2;
const OPERATIONS_OVERHEAD = 1.2;
const EUR_PER_USD = 0.92;
const CARD_FEE_RATE = 0.015;
const CARD_FEE_FIXED_EUR = 0.25;

/** Coste real para GMA de cada GB extra al mes, en euros (≈ 0,033 €). */
export const COST_PER_EXTRA_GB_EUR = R2_USD_PER_GB_MONTH * STORED_PER_UPLOADED_GB * OPERATIONS_OVERHEAD * EUR_PER_USD;

export interface PlanEstimate {
  /** Espacio total elegido, en GB. */
  readonly totalGB: number;
  /** GB por encima de lo gratuito. */
  readonly extraGB: number;
  /** Coste de alojar esos GB extra durante un mes. */
  readonly storageEur: number;
  /** Comisión del cobro con tarjeta (0 si no hay nada que cobrar). */
  readonly feeEur: number;
  /** Total al mes, redondeado a céntimos. */
  readonly totalEur: number;
}

const cents = (value: number) => Math.round(value * 100) / 100;

/** Estimación mensual para un espacio total en GB. Con el espacio gratuito o menos, no se cobra nada. */
export function estimatePlan(totalGB: number): PlanEstimate {
  const total = Math.min(PLAN_MAX_GB, Math.max(PLAN_MIN_GB, Math.round(totalGB)));
  const extraGB = total - FREE_STORAGE_GB;
  if (extraGB <= 0) return { totalGB: total, extraGB: 0, storageEur: 0, feeEur: 0, totalEur: 0 };
  const storage = extraGB * COST_PER_EXTRA_GB_EUR;
  const fee = storage * CARD_FEE_RATE + CARD_FEE_FIXED_EUR;
  return { totalGB: total, extraGB, storageEur: cents(storage), feeEur: cents(fee), totalEur: cents(storage + fee) };
}

/** GB necesarios (redondeados al siguiente paso de la calculadora) para que quepa lo que ya ocupa el creador. */
export function suggestedPlanGB(usedBytes: number): number {
  const neededGB = Math.ceil(usedBytes / GIB);
  if (neededGB <= FREE_STORAGE_GB) return FREE_STORAGE_GB;
  return Math.min(PLAN_MAX_GB, Math.ceil(neededGB / PLAN_STEP_GB) * PLAN_STEP_GB);
}

/** Estado del espacio usado frente al límite, para colorear la barra y elegir el aviso. */
export type StorageLevel = "ok" | "warning" | "critical" | "over";

export function storageLevel(usedBytes: number, limitBytes = FREE_STORAGE_BYTES): StorageLevel {
  const ratio = usedBytes / limitBytes;
  if (ratio > 1) return "over";
  if (ratio >= 0.9) return "critical";
  if (ratio >= 0.75) return "warning";
  return "ok";
}

/** Bytes en texto corto: «1,2 GB», «340 MB». */
export function formatBytes(bytes: number): string {
  if (bytes >= GIB) return `${(bytes / GIB).toLocaleString("es-ES", { maximumFractionDigits: 1 })} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2).toLocaleString("es-ES")} MB`;
  return `${Math.round(bytes / 1024).toLocaleString("es-ES")} KB`;
}
