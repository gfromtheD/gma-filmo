/**
 * Lista «Mi Lista» compartida por TODA la interfaz.
 *
 * - Se carga una sola vez por usuario y perfil (antes cada tarjeta flotante volvía a pedirla y agotaba el límite).
 * - Guardar y quitar se ven al instante; si el servidor falla, vuelve a lo último confirmado.
 * - Los cambios de un mismo título se envían en orden (guardar y quitar deprisa nunca se pisan).
 * - Distingue «vas demasiado rápido» (límite de peticiones) de un fallo cualquiera.
 *
 * Sin dependencias de React ni de red: el transporte se inyecta, así se prueba sin navegador.
 */

export type WriteResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "rate_limited" | "failed"; readonly retryAfterSeconds?: number };

export interface WatchlistTransport {
  /** Ids guardados del perfil, o `null` si no se pudo cargar. */
  load(profileId: string): Promise<number[] | null>;
  write(kind: "add" | "remove", id: number, profileId: string): Promise<WriteResult>;
}

type Listener = () => void;

/** Una carga fallida no se reintenta antes de este tiempo (evita bucles de peticiones). */
const LOAD_RETRY_MS = 5_000;
const FAILED: WriteResult = { ok: false, reason: "failed" };

export class WatchlistStore {
  private contextKey: string | null = null;
  private profileId = "";
  /** Último estado confirmado por el servidor. */
  private confirmed = new Set<number>();
  /** Lo que el usuario pidió en el último cambio de cada título que aún no está confirmado. */
  private readonly desired = new Map<number, boolean>();
  private readonly latestSeq = new Map<number, number>();
  private readonly chains = new Map<number, Promise<unknown>>();
  private readonly listeners = new Set<Listener>();
  private loading: Promise<void> | null = null;
  private loadedOk = false;
  private lastAttempt = 0;
  private snapshot: readonly number[] = [];
  private snapshotSet: ReadonlySet<number> = new Set();
  private loadedSnapshot: readonly number[] = [];

  /** Último fallo al guardar o quitar (`null` si el último cambio salió bien). */
  lastFailure: WriteResult | null = null;

  constructor(
    private readonly transport: WatchlistTransport,
    private readonly now: () => number = Date.now,
  ) {}

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  /** Ids guardados tal como se ven (confirmados más los cambios pendientes). Estable entre cambios. */
  getSnapshot = (): readonly number[] => this.snapshot;

  /**
   * La lista tal como llegó del servidor al cargar (o vacía tras cerrar sesión o cambiar de perfil). Guardar o
   * quitar no la modifica: sirve para calcular recomendaciones sin que la portada se reordene mientras se usa.
   */
  getLoadedSnapshot = (): readonly number[] => this.loadedSnapshot;

  has(id: number): boolean {
    return this.snapshotSet.has(id);
  }

  /** Cierre de sesión: se olvida todo. */
  reset(): void {
    this.contextKey = null;
    this.profileId = "";
    this.confirmed = new Set();
    this.desired.clear();
    this.latestSeq.clear();
    this.loading = null;
    this.loadedOk = false;
    this.lastFailure = null;
    this.setLoadedSnapshot([]);
    this.emit();
  }

  /** Carga la lista del usuario y perfil dados; las llamadas repetidas comparten la misma carga. */
  ensureLoaded(key: string, profileId: string): Promise<void> {
    if (this.contextKey === key) {
      if (this.loading) return this.loading;
      if (this.loadedOk || this.now() - this.lastAttempt < LOAD_RETRY_MS) return Promise.resolve();
    } else {
      this.contextKey = key;
      this.profileId = profileId;
      this.confirmed = new Set();
      this.desired.clear();
      this.latestSeq.clear();
      this.loadedOk = false;
      this.lastFailure = null;
      this.setLoadedSnapshot([]);
      this.emit();
    }

    this.lastAttempt = this.now();
    const loading = (async () => {
      let ids: number[] | null = null;
      try {
        ids = await this.transport.load(profileId);
      } catch {
        ids = null;
      }
      if (this.contextKey !== key) return; // mientras tanto cambió el usuario o el perfil
      if (ids) {
        this.confirmed = new Set(ids);
        this.loadedOk = true;
        this.setLoadedSnapshot(ids);
      }
      this.loading = null;
      this.emit();
    })();
    this.loading = loading;
    return loading;
  }

  /** Guarda o quita un título. Devuelve el resultado del servidor; lo mostrado ya cambió al instante. */
  mutate(kind: "add" | "remove", id: number): Promise<WriteResult> {
    const key = this.contextKey;
    if (key === null) return Promise.resolve(FAILED);
    const profileId = this.profileId;
    const want = kind === "add";

    const seq = (this.latestSeq.get(id) ?? 0) + 1;
    this.latestSeq.set(id, seq);
    this.desired.set(id, want);
    this.emit();

    const run = async (): Promise<WriteResult> => {
      let result: WriteResult;
      try {
        result = await this.transport.write(kind, id, profileId);
      } catch {
        result = FAILED;
      }
      if (this.contextKey !== key) return result; // otro usuario o perfil: no se toca su lista

      if (result.ok) {
        if (want) this.confirmed.add(id);
        else this.confirmed.delete(id);
        this.lastFailure = null;
      } else {
        this.lastFailure = result;
      }
      // Solo el último cambio de este título cierra el deseo; si hay uno más reciente, sigue vigente.
      if (this.latestSeq.get(id) === seq) {
        this.desired.delete(id);
        this.latestSeq.delete(id);
      }
      this.emit();
      return result;
    };

    // Si no hay nada pendiente de este título se envía ya; si lo hay, espera a que termine (siempre en orden).
    const previous = this.chains.get(id);
    const next = previous ? previous.then(run, run) : run();
    this.chains.set(id, next);
    void next.finally(() => {
      if (this.chains.get(id) === next) this.chains.delete(id);
    });
    return next;
  }

  /** Solo cambia la referencia si el contenido es distinto (estable para `useSyncExternalStore`). */
  private setLoadedSnapshot(ids: readonly number[]): void {
    const unchanged = ids.length === this.loadedSnapshot.length && ids.every((id, i) => id === this.loadedSnapshot[i]);
    if (!unchanged) this.loadedSnapshot = [...ids];
  }

  private emit(): void {
    const ids = [...this.confirmed].filter((id) => this.desired.get(id) !== false);
    for (const [id, want] of this.desired) {
      if (want && !this.confirmed.has(id)) ids.push(id);
    }
    const unchanged = ids.length === this.snapshot.length && ids.every((id, i) => id === this.snapshot[i]);
    if (!unchanged) {
      this.snapshot = ids;
      this.snapshotSet = new Set(ids);
    }
    for (const listener of this.listeners) listener();
  }
}
