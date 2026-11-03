"use client";

import { authHeaders } from "@/lib/api/auth-headers";

export { authHeaders };

export interface PatchResult {
  readonly ok: boolean;
  readonly status: number;
  /** Código de error de la API (`feature_unavailable`, `Forbidden`…) o `null`. */
  readonly error: string | null;
  readonly data: Record<string, unknown>;
}

/** `PATCH /api/comments`: editar el propio comentario o una acción del creador. Nunca lanza. */
export async function patchComment(body: Record<string, unknown>): Promise<PatchResult> {
  try {
    const res = await fetch("/api/comments", { method: "PATCH", headers: await authHeaders(), body: JSON.stringify(body) });
    const data = ((await res.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    return { ok: res.ok && data.ok === true, status: res.status, error: typeof data.error === "string" ? data.error : null, data };
  } catch {
    return { ok: false, status: 0, error: "network", data: {} };
  }
}
