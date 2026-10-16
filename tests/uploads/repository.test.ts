import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import type { PGlite } from '@electric-sql/pglite';
import { database, command, OWNER, OTHER } from './database';
import { UploadError, UploadRepository } from '../../lib/uploads/repository';
import type { UploadDraft, UploadSession } from '../../lib/uploads/types';

type Filter = { column: string; value: unknown };

class SelectQuery implements PromiseLike<{ data: unknown; error: { message: string } | null }> {
  private readonly filters: Filter[] = [];
  private orderBy: string | null = null;
  private limitValue: number | null = null;

  constructor(
    private readonly db: PGlite,
    private readonly table: string,
    private readonly columns: string,
  ) {}

  eq(column: string, value: unknown): this {
    this.filters.push({ column, value });
    return this;
  }

  order(column: string): this {
    this.orderBy = column;
    return this;
  }

  limit(value: number): this {
    this.limitValue = value;
    return this;
  }

  async maybeSingle(): Promise<{ data: unknown; error: { message: string } | null }> {
    const result = await this.execute();
    if (result.error || !Array.isArray(result.data)) return result;
    if (result.data.length > 1) return { data: null, error: { message: 'multiple rows returned' } };
    return { data: result.data[0] ?? null, error: null };
  }

  then<TResult1 = { data: unknown; error: { message: string } | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<{ data: unknown; error: { message: string } | null }> {
    const identifiers = [this.table, this.columns, ...this.filters.map((item) => item.column), this.orderBy]
      .filter((value): value is string => value !== null);
    if (identifiers.some((value) => value !== '*' && !/^[a-z_][a-z0-9_]*$/.test(value))) {
      return { data: null, error: { message: 'invalid test SQL identifier' } };
    }

    const values: unknown[] = [];
    const where = this.filters.map(({ column, value }) => {
      values.push(value);
      return `${column} = $${values.length}`;
    });
    const order = this.orderBy ? ` ORDER BY ${this.orderBy}` : '';
    const limit = this.limitValue === null ? '' : ` LIMIT ${Math.max(0, Math.floor(this.limitValue))}`;
    const sql = `SELECT ${this.columns} FROM ${this.table}${where.length ? ` WHERE ${where.join(' AND ')}` : ''}${order}${limit}`;

    try {
      const result = await this.db.query(sql, values);
      return { data: result.rows, error: null };
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : 'query failed' } };
    }
  }
}

function repositoryClient(db: PGlite) {
  return {
    from(table: string) {
      return {
        select(columns: string) {
          return new SelectQuery(db, table, columns);
        },
      };
    },
    async rpc(name: string, params: Record<string, unknown>) {
      const calls: Record<string, (values: Record<string, unknown>) => Promise<{ data: unknown; error: null }>> = {
        gma_media_claim_job: async (values) => {
          const result = await db.query<{ result: unknown }>(
            'SELECT to_jsonb(job) AS result FROM gma_media_claim_job($1::text, $2::boolean, $3::boolean) job',
            [values.p_worker, values.p_allow_mock_process, values.p_r2_process_only],
          );
          return { data: result.rows[0]?.result ?? null, error: null };
        },
        gma_video_asset_summaries: async (values) => {
          const result = await db.query<{ result: unknown }>(
            'SELECT gma_video_asset_summaries($1::uuid, $2::uuid[]) AS result',
            [values.p_owner, values.p_asset_ids],
          );
          return { data: result.rows[0]?.result ?? null, error: null };
        },
        gma_video_output_authorized: async (values) => {
          const result = await db.query<{ result: unknown }>(
            'SELECT gma_video_output_authorized($1::uuid, $2::text, $3::uuid) AS result',
            [values.p_asset_id, values.p_relative, values.p_owner],
          );
          return { data: result.rows[0]?.result ?? null, error: null };
        },
      };
      const call = calls[name];
      if (!call) return { data: null, error: { message: `unknown RPC ${name}` } };
      try {
        return await call(params);
      } catch (error) {
        return { data: null, error: { message: error instanceof Error ? error.message : 'RPC failed' } };
      }
    },
  };
}

test('R2 process claim treats the empty PostgREST composite as no available job', async () => {
  const db = await database();
  try {
    const result = await db.query<{ result: Record<string, unknown> }>(
      "SELECT to_jsonb(job) AS result FROM gma_media_claim_job('empty-worker',false,true) job",
    );
    assert.equal(result.rows[0]?.result.id, null);
    assert.ok(Object.values(result.rows[0]!.result).every(value => value === null));
    assert.equal(await new UploadRepository(repositoryClient(db) as never).claimR2Process('empty-worker'), null);
  } finally { await db.close(); }
});

async function readyAsset(db: PGlite) {
  const draft = await command<UploadDraft>(db, 'create_draft', { purpose: 'title' });
  await db.exec('UPDATE gma_upload_policy SET legacy_inventory_verified = true');
  const session = await command<UploadSession>(db, 'reserve', {
    draft_id: draft.id,
    revision: draft.revision,
    role: 'main',
    bytes: 1024,
    sha256: 'a'.repeat(64),
    file_name: 'film.mp4',
    content_type: 'video/mp4',
    idempotency_key: 'test-repository-asset',
    request_hash: 'b'.repeat(64),
  });
  const relative = '0/segment-000000.ts';
  const prefix = `media/${session.asset_id}/hls/`;
  await db.query(
    `UPDATE gma_media_assets
     SET state = 'ready', metadata = $2::jsonb, received_bytes = expected_input_bytes
     WHERE id = $1`,
    [session.asset_id, JSON.stringify({ hls_prefix: prefix, outputs: [{ relative, bytes: 512, mime: 'video/mp2t' }] })],
  );
  return { draft, session, relative, objectKey: `${prefix}${relative}` };
}

test('draftDetail batch tolerates migration 07 replay and omits the private output inventory', async () => {
  const db = await database();
  try {
    const fixture = await readyAsset(db);
    await db.exec(await readFile('supabase/migrations/20261007_r2_capacity.sql', 'utf8'));
    const repository = new UploadRepository(repositoryClient(db) as never);
    const result = await repository.draftDetail(OWNER, fixture.draft.id);

    assert.equal(result.sessions.length, 1);
    assert.equal(result.sessions[0]?.id, fixture.session.id);
    assert.equal(result.assets.length, 1);
    assert.equal(result.assets[0]?.id, fixture.session.asset_id);
    assert.equal(result.assets[0]?.metadata.outputs, undefined);
    assert.equal(result.assets[0]?.metadata.hls_prefix, `media/${fixture.session.asset_id}/hls/`);
    const outputCount = await db.query<{ count: number }>(
      'SELECT count(*) AS count FROM gma_media_outputs WHERE asset_id = $1',
      [fixture.session.asset_id],
    );
    assert.equal(Number(outputCount.rows[0]?.count), 1);
  } finally {
    await db.close();
  }
});

test('migration 07 output lookup is indexed and denies another owner', async () => {
  const db = await database();
  try {
    const fixture = await readyAsset(db);
    const repository = new UploadRepository(repositoryClient(db) as never);
    const resolved = await repository.videoOutputAuthorized(fixture.session.asset_id, fixture.relative, OWNER);

    assert.equal(resolved.asset.id, fixture.session.asset_id);
    assert.equal(resolved.key, fixture.objectKey);
    await assert.rejects(
      repository.videoOutputAuthorized(fixture.session.asset_id, fixture.relative, OTHER),
      (error: unknown) => error instanceof UploadError && error.code === 'UPLOAD_NOT_FOUND',
    );
    await assert.rejects(
      repository.videoOutputAuthorized(fixture.session.asset_id, '../private', OWNER),
      (error: unknown) => error instanceof UploadError && error.code === 'UPLOAD_NOT_FOUND',
    );
  } finally {
    await db.close();
  }
});
