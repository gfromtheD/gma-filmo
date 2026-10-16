import { expect, test } from "@playwright/test";
import { WatchlistStore, type WatchlistTransport, type WriteResult } from "../../lib/watchlist/store";

/** Transporte falso: cada llamada queda pendiente hasta que el test la resuelva, para controlar el orden. */
function fakeTransport(initial: number[] | null = []) {
  const writes: { kind: "add" | "remove"; id: number; resolve: (r: WriteResult) => void }[] = [];
  const log: string[] = [];
  let loadCalls = 0;
  let loadResult: number[] | null = initial;
  const transport: WatchlistTransport = {
    async load() {
      loadCalls++;
      return loadResult;
    },
    write(kind, id) {
      log.push(`${kind}:${id}`);
      return new Promise<WriteResult>((resolve) => writes.push({ kind, id, resolve }));
    },
  };
  return { transport, writes, log, loads: () => loadCalls, setLoadResult: (v: number[] | null) => { loadResult = v; } };
}

const OK: WriteResult = { ok: true };
const FAILED: WriteResult = { ok: false, reason: "failed" };
const LIMITED: WriteResult = { ok: false, reason: "rate_limited", retryAfterSeconds: 30 };
const flush = () => new Promise((r) => setTimeout(r, 0));

async function ready(initial: number[] = []) {
  const fake = fakeTransport(initial);
  const store = new WatchlistStore(fake.transport);
  await store.ensureLoaded("u1|", "");
  return { ...fake, store };
}

test.describe("carga", () => {
  test("carga la lista una sola vez aunque la pidan varios componentes a la vez", async () => {
    const fake = fakeTransport([1, 2]);
    const store = new WatchlistStore(fake.transport);
    await Promise.all([store.ensureLoaded("u1|", ""), store.ensureLoaded("u1|", ""), store.ensureLoaded("u1|", "")]);
    expect(fake.loads()).toBe(1);
    expect(store.getSnapshot()).toEqual([1, 2]);
  });

  test("no vuelve a pedirla en cada montaje mientras siga siendo el mismo usuario y perfil", async () => {
    const { store, loads } = await ready([5]);
    await store.ensureLoaded("u1|", "");
    await store.ensureLoaded("u1|", "");
    expect(loads()).toBe(1);
  });

  test("al cambiar de perfil o de usuario se vacía y se vuelve a cargar", async () => {
    const fake = fakeTransport([1]);
    const store = new WatchlistStore(fake.transport);
    await store.ensureLoaded("u1|", "");
    fake.setLoadResult([9]);
    await store.ensureLoaded("u1|p_a", "p_a");
    expect(fake.loads()).toBe(2);
    expect(store.getSnapshot()).toEqual([9]);
  });

  test("si la carga falla, otro componente puede reintentarla pasado un momento", async () => {
    const fake = fakeTransport(null);
    let now = 1_000;
    const store = new WatchlistStore(fake.transport, () => now);
    await store.ensureLoaded("u1|", "");
    await store.ensureLoaded("u1|", ""); // demasiado pronto: no reintenta
    expect(fake.loads()).toBe(1);
    now += 6_000;
    fake.setLoadResult([3]);
    await store.ensureLoaded("u1|", "");
    expect(fake.loads()).toBe(2);
    expect(store.getSnapshot()).toEqual([3]);
  });

  test("reset() deja la lista vacía (cierre de sesión)", async () => {
    const { store } = await ready([1, 2]);
    store.reset();
    expect(store.getSnapshot()).toEqual([]);
  });
});

test.describe("guardar y quitar", () => {
  test("al guardar, el cambio se ve al instante y se confirma al responder el servidor", async () => {
    const { store, writes } = await ready();
    const promise = store.mutate("add", 7);
    expect(store.has(7)).toBe(true); // optimista
    expect(writes).toHaveLength(1);
    writes[0]!.resolve(OK);
    expect(await promise).toEqual(OK);
    expect(store.has(7)).toBe(true);
  });

  test("si el servidor falla, se deshace", async () => {
    const { store, writes } = await ready();
    const promise = store.mutate("add", 7);
    writes[0]!.resolve(FAILED);
    expect((await promise).ok).toBe(false);
    expect(store.has(7)).toBe(false);
  });

  test("si falla al quitar, vuelve a aparecer como guardado", async () => {
    const { store, writes } = await ready([7]);
    const promise = store.mutate("remove", 7);
    expect(store.has(7)).toBe(false);
    writes[0]!.resolve(FAILED);
    await promise;
    expect(store.has(7)).toBe(true);
  });

  test("distingue el límite de peticiones de un fallo cualquiera", async () => {
    const { store, writes } = await ready();
    const promise = store.mutate("add", 7);
    writes[0]!.resolve(LIMITED);
    const result = await promise;
    expect(result).toEqual(LIMITED);
    expect(store.lastFailure).toEqual(LIMITED);
    expect(store.has(7)).toBe(false);
    const second = store.mutate("add", 8);
    writes[1]!.resolve(OK);
    await second;
    expect(store.lastFailure).toBeNull(); // un éxito limpia el último fallo
  });

  test("guardar y quitar el mismo título deprisa se envía EN ORDEN, nunca a la vez", async () => {
    const { store, writes, log } = await ready();
    const first = store.mutate("add", 7);
    const second = store.mutate("remove", 7);
    await flush();
    expect(log).toEqual(["add:7"]); // la segunda espera a que termine la primera
    expect(store.has(7)).toBe(false); // lo que se ve es lo último que pidió el usuario
    writes[0]!.resolve(OK);
    await flush();
    expect(log).toEqual(["add:7", "remove:7"]);
    writes[1]!.resolve(OK);
    await Promise.all([first, second]);
    expect(store.has(7)).toBe(false);
  });

  test("si falla la primera pero ya había una orden posterior, manda lo último que pidió el usuario", async () => {
    const { store, writes } = await ready();
    const first = store.mutate("add", 7);
    const second = store.mutate("add", 7); // el usuario pulsó otra vez antes de que respondiera
    writes[0]!.resolve(FAILED);
    await flush();
    expect(store.has(7)).toBe(true); // el deseo vigente sigue siendo «guardado»
    writes[1]!.resolve(OK);
    await Promise.all([first, second]);
    expect(store.has(7)).toBe(true);
  });

  test("títulos distintos no se esperan entre sí", async () => {
    const { store, log } = await ready();
    void store.mutate("add", 1);
    void store.mutate("add", 2);
    void store.mutate("add", 3);
    await flush();
    expect(log).toEqual(["add:1", "add:2", "add:3"]);
  });

  test("una carga que termina después de guardar no borra lo que el usuario acaba de guardar", async () => {
    const fake = fakeTransport([]);
    let release: (ids: number[]) => void = () => undefined;
    fake.transport.load = () => new Promise<number[]>((resolve) => { release = resolve; });
    const store = new WatchlistStore(fake.transport);
    const loading = store.ensureLoaded("u1|", "");
    void store.mutate("add", 4);
    expect(store.has(4)).toBe(true);
    release([1, 2]);
    await loading;
    expect([...store.getSnapshot()].sort()).toEqual([1, 2, 4]);
  });

  test("un fallo de una sesión anterior no toca la lista del nuevo perfil", async () => {
    const { store, writes } = await ready();
    const promise = store.mutate("add", 7);
    await store.ensureLoaded("u1|p_a", "p_a"); // cambio de perfil con la petición aún en vuelo
    writes[0]!.resolve(FAILED);
    await promise;
    expect(store.getSnapshot()).toEqual([]);
  });

  test("avisa a los suscriptores en cada cambio, y deja de avisar al darse de baja", async () => {
    const { store, writes } = await ready();
    let calls = 0;
    const unsubscribe = store.subscribe(() => { calls++; });
    void store.mutate("add", 1);
    expect(calls).toBeGreaterThan(0);
    const before = calls;
    unsubscribe();
    writes[0]!.resolve(OK);
    await flush();
    void store.mutate("add", 2);
    expect(calls).toBe(before);
  });

  test("getSnapshot es estable entre cambios (requisito de useSyncExternalStore)", async () => {
    const { store } = await ready([1]);
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });
});

test.describe("getLoadedSnapshot: la lista tal como llegó del servidor", () => {
  test("guardar o quitar no la cambia (las recomendaciones no se reordenan en pleno uso)", async () => {
    const { store, writes } = await ready([1, 2]);
    const loaded = store.getLoadedSnapshot();
    expect(loaded).toEqual([1, 2]);

    void store.mutate("add", 3);
    expect(store.getSnapshot()).toContain(3);
    expect(store.getLoadedSnapshot()).toBe(loaded);

    writes[0]!.resolve(OK);
    await flush();
    void store.mutate("remove", 1);
    expect(store.getLoadedSnapshot()).toBe(loaded);
  });

  test("cambia al cargar la lista de otro perfil y al cerrar sesión", async () => {
    const fake = fakeTransport([5]);
    const store = new WatchlistStore(fake.transport);
    await store.ensureLoaded("u1|a", "a");
    expect(store.getLoadedSnapshot()).toEqual([5]);

    fake.setLoadResult([7, 8]);
    await store.ensureLoaded("u1|b", "b");
    expect(store.getLoadedSnapshot()).toEqual([7, 8]);

    store.reset();
    expect(store.getLoadedSnapshot()).toEqual([]);
  });

  test("es estable entre lecturas (requisito de useSyncExternalStore)", async () => {
    const { store } = await ready([1]);
    expect(store.getLoadedSnapshot()).toBe(store.getLoadedSnapshot());
  });
});
