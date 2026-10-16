import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { UploadError, translateDatabaseError } from '@/lib/uploads/repository';
import type { MediaRepositoryClient } from './repository';
import { saveFichaSchema } from './ficha';

const savedSchema = z.object({ draft_id: z.string().uuid(), revision: z.number().int().positive(), schema_version: z.number().int(), updated_at: z.string() }).strict();
const copiedSchema = z.object({ pelicula_id: z.number().int().positive(), copied: z.boolean() }).strict();

/** Ficha completa del borrador y del título (migración 20261021000100). Solo service_role; el propietario lo fija la ruta. */
export class FichaRepository {
  constructor(private readonly db: Pick<MediaRepositoryClient, 'rpc'> = getSupabaseAdminClient() as unknown as MediaRepositoryClient) {}

  private async call(name: string, args: Record<string, unknown>): Promise<unknown> {
    const { data, error } = await this.db.rpc(name, args);
    if (error) translateDatabaseError(error);
    if (data === null || data === undefined) throw new UploadError('UPLOAD_DATABASE_UNAVAILABLE', 503);
    return data;
  }

  async save(owner: string, draftId: string, body: unknown) {
    const input = saveFichaSchema.parse(body);
    const raw = await this.call('gma_draft_ficha_save', {
      p_owner: owner, p_draft_id: draftId, p_expected_revision: input.revision, p_schema_version: input.schemaVersion, p_ficha: input.ficha,
    });
    const saved = savedSchema.parse(raw);
    return { ficha: { draftId: saved.draft_id, revision: saved.revision, schemaVersion: saved.schema_version, updatedAt: saved.updated_at } };
  }

  /** Copia la ficha al título publicado. No hay ficha → `copied:false` (borradores creados fuera de la pasarela nueva). */
  async publish(owner: string, draftId: string) {
    return copiedSchema.parse(await this.call('gma_draft_ficha_publish', { p_owner: owner, p_draft_id: draftId }));
  }
}
