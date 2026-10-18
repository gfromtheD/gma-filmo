import { randomUUID } from 'node:crypto';

export const MEDIA_ERROR_CODES = {
  invalidInput: 'UPLOAD_INVALID_INPUT',
  sourceMismatch: 'UPLOAD_SOURCE_MISMATCH',
  cancelled: 'UPLOAD_CANCELLED',
  unauthorized: 'UPLOAD_UNAUTHORIZED',
  notFound: 'UPLOAD_NOT_FOUND',
  mediaNotFound: 'MEDIA_NOT_FOUND',
  revisionConflict: 'UPLOAD_REVISION_CONFLICT',
  idempotencyConflict: 'IDEMPOTENCY_CONFLICT',
  quotaExceeded: 'UPLOAD_QUOTA_EXCEEDED',
  notComplete: 'UPLOAD_NOT_COMPLETE',
  processingPending: 'UPLOAD_PROCESSING_PENDING',
  providerUnavailable: 'MEDIA_PROVIDER_UNAVAILABLE',
  recoveryRequired: 'UPLOAD_PROVISION_RECOVERY_REQUIRED',
  processingFailed: 'MEDIA_PROCESSING_FAILED',
  cleanupUnconfirmed: 'UPLOAD_CLEANUP_UNCONFIRMED',
  playbackUnsupported: 'MEDIA_PLAYBACK_UNSUPPORTED',
  protocolUnsupported: 'UPLOAD_PROTOCOL_UNSUPPORTED',
} as const;

export type MediaErrorCode = (typeof MEDIA_ERROR_CODES)[keyof typeof MEDIA_ERROR_CODES];

interface ErrorPolicy {
  status: number;
  retryable: boolean;
  message: string;
}

const errorPolicies: Record<MediaErrorCode, ErrorPolicy> = {
  UPLOAD_INVALID_INPUT: { status: 400, retryable: false, message: 'Los datos de la subida no son válidos.' },
  UPLOAD_SOURCE_MISMATCH: { status: 400, retryable: false, message: 'El archivo seleccionado no coincide con la subida iniciada.' },
  UPLOAD_CANCELLED: { status: 409, retryable: false, message: 'La subida ha sido cancelada.' },
  UPLOAD_UNAUTHORIZED: { status: 401, retryable: false, message: 'La sesión ha caducado o no está autorizada.' },
  UPLOAD_NOT_FOUND: { status: 404, retryable: false, message: 'No se encontró el recurso solicitado.' },
  MEDIA_NOT_FOUND: { status: 404, retryable: false, message: 'No se encontró el medio solicitado.' },
  UPLOAD_REVISION_CONFLICT: { status: 409, retryable: false, message: 'El recurso cambió. Actualiza su estado antes de continuar.' },
  IDEMPOTENCY_CONFLICT: { status: 409, retryable: false, message: 'La clave de reintento ya se usó con otros datos.' },
  UPLOAD_QUOTA_EXCEEDED: { status: 413, retryable: false, message: 'La subida supera la cuota disponible.' },
  UPLOAD_NOT_COMPLETE: { status: 409, retryable: true, message: 'La transferencia aún no ha confirmado todos los bytes.' },
  UPLOAD_PROCESSING_PENDING: { status: 202, retryable: true, message: 'El medio sigue procesándose.' },
  MEDIA_PROVIDER_UNAVAILABLE: { status: 503, retryable: true, message: 'El servicio de medios no está disponible temporalmente.' },
  UPLOAD_PROVISION_RECOVERY_REQUIRED: { status: 503, retryable: true, message: 'La creación de la subida requiere reconciliación.' },
  MEDIA_PROCESSING_FAILED: { status: 409, retryable: false, message: 'No se pudo procesar el medio.' },
  UPLOAD_CLEANUP_UNCONFIRMED: { status: 202, retryable: true, message: 'La retirada está pendiente de confirmación.' },
  MEDIA_PLAYBACK_UNSUPPORTED: { status: 422, retryable: false, message: 'El formato de reproducción no está disponible.' },
  UPLOAD_PROTOCOL_UNSUPPORTED: { status: 409, retryable: false, message: 'El proveedor no admite este transporte.' },
};

export class MediaError extends Error {
  readonly code: MediaErrorCode;
  readonly status: number;
  readonly retryable: boolean;

  constructor(
    code: MediaErrorCode,
    options: { status?: number; retryable?: boolean; cause?: unknown } = {},
  ) {
    const policy = errorPolicies[code];
    super(policy.message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'MediaError';
    this.code = code;
    this.status = options.status ?? policy.status;
    this.retryable = options.retryable ?? policy.retryable;
  }
}

export interface MediaErrorResponse {
  error: { code: MediaErrorCode; message: string; retryable: boolean };
  requestId: string;
}

export function mediaErrorResponse(error: MediaError, requestId: string = randomUUID()): MediaErrorResponse {
  return {
    error: { code: error.code, message: error.message, retryable: error.retryable },
    requestId,
  };
}
