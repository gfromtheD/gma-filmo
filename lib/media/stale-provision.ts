/**
 * Una subida cancelada cuyo «provisioning» nunca llegó a atarse a un archivo del proveedor no tiene nada que borrar en él: sin
 * `uploadId` el cliente jamás recibió un descriptor de transferencia (no pudo subir ni un byte) y PeerTube no crea el vídeo hasta
 * que termina la subida. Mientras el provisioning pueda seguir en curso se espera; pasado este plazo se da por limpia, en lugar de
 * quedarse «cancelando» para siempre (le ocurrió a una subida de pruebas durante 4 días).
 */
export const PROVISION_GIVE_UP_MS = 2 * 60 * 60 * 1000;

export function provisioningNeverBound(input: {
  readonly privateState: Readonly<Record<string, unknown>>;
  readonly providerData: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  readonly now: number;
}): boolean {
  if (typeof input.privateState.uploadId === 'string') return false;
  if (input.providerData.provision_started !== true && input.privateState.creation_pending !== true) return false;
  const created = Date.parse(input.createdAt);
  return Number.isFinite(created) && input.now - created > PROVISION_GIVE_UP_MS;
}
