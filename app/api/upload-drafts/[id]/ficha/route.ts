import { owner, engineGate, respond } from '@/lib/uploads/http';
import { uuid } from '@/lib/uploads/contracts';
import { UploadError } from '@/lib/uploads/repository';
import { FichaRepository } from '@/lib/media/ficha-repository';
export const dynamic = 'force-dynamic';
type Context = { params: { id: string } };
/** Límite propio: la ficha (sinopsis larga, equipo, premios…) puede superar los 24 KB del resto de rutas del motor. */
const FICHA_BODY_BYTES = 64 * 1024;
async function fichaBody(request: Request): Promise<unknown> {
  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > FICHA_BODY_BYTES) throw new UploadError('UPLOAD_INVALID_INPUT', 400);
  try { return JSON.parse(raw) as unknown; } catch { throw new UploadError('UPLOAD_INVALID_INPUT', 400); }
}
/** Guarda la ficha completa del borrador (campos de Mi Estudio que el borrador del motor no admite). Motor v2 solamente. */
export async function PUT(req: Request, { params }: Context) {
  return respond(async () => { engineGate(); return new FichaRepository().save(await owner(req), uuid.parse(params.id), await fichaBody(req)); });
}
/** Ficha guardada (o `null`): la pasarela la usa para saber la revisión antes del primer guardado y para restaurar. */
export async function GET(req: Request, { params }: Context) {
  return respond(async () => { engineGate(); return new FichaRepository().get(await owner(req), uuid.parse(params.id)); });
}
