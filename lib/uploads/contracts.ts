import { z } from 'zod';
import { CREATOR_GENRES } from '@/lib/genres';
export const uuid=z.string().uuid();
export const metadataSchema=z.object({
 title:z.string().trim().max(160), synopsis:z.string().max(10000).nullable().optional(),
 year:z.string().regex(/^\d{4}$/).optional(),language:z.string().min(1).max(80).optional(),
 genre:z.string().refine(x=>CREATOR_GENRES.some(g=>g.label===x)).optional(),
}).strict();
export const reserveSchema=z.object({draft_id:uuid,revision:z.number().int().nonnegative(),
 role:z.enum(['main','trailer','extras','intro','poster','poster_h','poster_v','subtitles','avatar','banner']),
 bytes:z.number().int().positive(),sha256:z.string().regex(/^[a-f0-9]{64}$/),
 file_name:z.string().min(1).max(255),content_type:z.string().min(1).max(100),
 language:z.string().regex(/^[a-zA-Z0-9-]{2,35}$/).optional(),idempotency_key:uuid}).strict();
export const revisionSchema=z.number().int().nonnegative();
