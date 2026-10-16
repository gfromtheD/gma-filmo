import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MEDIA_ERROR_CODES, MediaError, mediaErrorResponse } from '../../lib/media/errors';

test('MediaError uses a stable code, safe message, status and retry policy', () => {
  const error = new MediaError(MEDIA_ERROR_CODES.providerUnavailable);
  assert.equal(error.code, 'MEDIA_PROVIDER_UNAVAILABLE');
  assert.equal(error.status, 503);
  assert.equal(error.retryable, true);
  assert.doesNotMatch(error.message, /token|secret|password/i);
});

test('normalized response includes stable retry fields and a request identifier', () => {
  const response = mediaErrorResponse(new MediaError(MEDIA_ERROR_CODES.sourceMismatch), 'request-123');
  assert.deepEqual(response, {
    error: {
      code: 'UPLOAD_SOURCE_MISMATCH',
      message: 'El archivo seleccionado no coincide con la subida iniciada.',
      retryable: false,
    },
    requestId: 'request-123',
  });
});

test('unexpected provider details are never used as a public error message', () => {
  const error = new MediaError(MEDIA_ERROR_CODES.providerUnavailable, { cause: new Error('secret=do-not-return') });
  const body = mediaErrorResponse(error);
  assert.equal(body.error.code, 'MEDIA_PROVIDER_UNAVAILABLE');
  assert.equal(body.error.message, 'El servicio de medios no está disponible temporalmente.');
  assert.doesNotMatch(JSON.stringify(body), /do-not-return/);
});
