import { expect, test } from "@playwright/test";

/**
 * La ficha y el reproductor de un título leen la fila por su dirección (slug). Esa lectura tiene que llevar la etiqueta
 * `peliculas`, la que invalidan publicar, editar y borrar; si no la lleva, un título borrado se sigue viendo hasta una
 * hora después. Aquí se sustituyen `next/cache` y el cliente de Supabase para comprobarlo sin red.
 */

interface Recorded { keyParts: string[]; options: { tags?: string[]; revalidate?: number }; inner: (...args: unknown[]) => Promise<unknown> }
type QueryResult = { data: unknown; error: unknown };

const recorded: Partial<Recorded> = {};
const state: { result: QueryResult; calls: { or?: string; eq?: [string, string]; select?: string } } = { result: { data: null, error: null }, calls: {} };

const fakeClient = {
  from: () => ({
    select: (columns: string) => {
      state.calls.select = columns;
      const chain = {
        or: (filter: string) => { state.calls.or = filter; return chain; },
        eq: (column: string, value: string) => { state.calls.eq = [column, value]; return chain; },
        single: async () => state.result,
      };
      return chain;
    },
  }),
};

let cachedFilmRowBySlug: <T>(slug: string, select: string) => Promise<T | null>;
let FILMS_CACHE_TAG: string;

test.beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const Module = require("node:module") as any;
  const originalLoad = Module._load;
  Module._load = function (request: string, ...rest: unknown[]) {
    if (request === "next/cache") {
      return {
        unstable_cache: (inner: Recorded["inner"], keyParts: string[], options: Recorded["options"]) => {
          Object.assign(recorded, { inner, keyParts, options });
          return inner;
        },
      };
    }
    if (request.endsWith("lib/supabase/public")) return { getSupabasePublicClient: () => fakeClient };
    return originalLoad.call(this, request, ...rest);
  };
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ({ cachedFilmRowBySlug, FILMS_CACHE_TAG } = require("../../lib/supabase/film-by-slug"));
  } finally {
    Module._load = originalLoad;
  }
});

test.describe("lectura de un título por su dirección", () => {
  test("va etiquetada con «peliculas», la etiqueta que invalidan publicar, editar y borrar", () => {
    expect(FILMS_CACHE_TAG).toBe("peliculas");
    expect(recorded.options?.tags).toContain("peliculas");
    expect(recorded.options?.revalidate).toBeGreaterThan(0);
  });

  test("solo lee títulos publicados (o sin estado) y busca por la dirección pedida", async () => {
    state.result = { data: { slug: "mi-corto", title: "Mi corto" }, error: null };
    await cachedFilmRowBySlug("mi-corto", "*");
    expect(state.calls.or).toBe("status.eq.published,status.is.null");
    expect(state.calls.eq).toEqual(["slug", "mi-corto"]);
  });

  test("devuelve la fila cuando existe", async () => {
    state.result = { data: { slug: "mi-corto", title: "Mi corto" }, error: null };
    expect(await cachedFilmRowBySlug("mi-corto", "*")).toEqual({ slug: "mi-corto", title: "Mi corto" });
  });

  test("si no existe o falla devuelve null, y la lectura interna falla para que no se guarde en caché", async () => {
    state.result = { data: null, error: { code: "PGRST116", message: "no rows" } };
    expect(await cachedFilmRowBySlug("no-existe", "*")).toBeNull();
    await expect(recorded.inner!("no-existe", "*")).rejects.toThrow();
  });
});
