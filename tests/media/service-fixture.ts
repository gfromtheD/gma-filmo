import { MediaRepository, type MediaRepositoryClient } from '../../lib/media/repository';

/** Local tests only: PGlite and disposable native PostgreSQL use the same SQL seam. */
export interface MediaTestSqlDriver {
  query<Row extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: Row[] }>;
}

export function serviceRepository(db: MediaTestSqlDriver): MediaRepository {
  return new MediaRepository({
    async rpc(name: string, args: Record<string, unknown>) {
      if (!/^gma_[a-z_]+$/.test(name)) throw new Error('UNSAFE_TEST_RPC');
      const entries = Object.entries(args);
      const sql = `SELECT to_jsonb(${name}(${entries.map(([key], i) => `${key}=>$${i+1}`).join(',')})) result`;
      try {
        const result = await db.query<{result:unknown}>(sql, entries.map(([,value]) => value && typeof value === 'object' ? JSON.stringify(value) : value));
        return { data: result.rows[0]?.result ?? null, error: null };
      } catch (error) { return { data: null, error: { message: error instanceof Error ? error.message : 'DB_ERROR' } }; }
    },
    from(table: string) {
      if (!/^[a-z_]+$/.test(table)) throw new Error('UNSAFE_TEST_TABLE');
      const filters: Array<[string, string | number, '=' | '<>']> = []; let order = ''; let limit = '';
      const run = async () => {
        const sql = `SELECT * FROM ${table}${filters.length ? ' WHERE '+filters.map(([key,,operator],i)=>`${key}${operator}$${i+1}`).join(' AND ') : ''}${order}${limit}`;
        return { data: JSON.parse(JSON.stringify((await db.query(sql, filters.map(([,value])=>value))).rows)) as Array<Record<string,unknown>>, error: null };
      };
      const query = {
        select(_columns: string) { return query; },
        eq(key: string, value: string | number) { if (!/^[a-z_]+$/.test(key)) throw new Error('UNSAFE_TEST_COLUMN'); filters.push([key,value,'=']); return query; },
        neq(key: string, value: string | number) { if (!/^[a-z_]+$/.test(key)) throw new Error('UNSAFE_TEST_COLUMN'); filters.push([key,value,'<>']); return query; },
        order(key: string) { if (!/^[a-z_]+$/.test(key)) throw new Error('UNSAFE_TEST_COLUMN'); order=` ORDER BY ${key}`; return query; },
        limit(value: number) { if (!Number.isSafeInteger(value)) throw new Error('INVALID_LIMIT'); limit=` LIMIT ${value}`; return query; },
        async maybeSingle() { const result=await run(); return { data:result.data[0]??null,error:null }; },
        then<T = unknown>(resolve: (value: {data:unknown;error:null}) => T) { return run().then(resolve); },
      };
      return query;
    },
  } as unknown as MediaRepositoryClient);
}
