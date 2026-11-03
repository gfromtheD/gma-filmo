"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

/** Cabeceras con la sesión actual para llamar a `/api/comments`. */
export async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
  return { Authorization: `Bearer ${session?.access_token ?? ""}`, "Content-Type": "application/json" };
}

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

/** `POST /api/comments/report`: denunciar un comentario ajeno. Denunciar dos veces el mismo cuenta como hecho. */
export async function reportComment(commentId: number): Promise<boolean> {
  try {
    const res = await fetch("/api/comments/report", { method: "POST", headers: await authHeaders(), body: JSON.stringify({ commentId }) });
    return res.ok;
  } catch {
    return false;
  }
}

/** `POST /api/creator/moderation`: el creador descarta las denuncias de un comentario suyo o lo oculta. */
export async function moderateComment(body: { commentId: number; action: "dismiss" | "hide" }): Promise<boolean> {
  try {
    const res = await fetch("/api/creator/moderation", { method: "POST", headers: await authHeaders(), body: JSON.stringify(body) });
    return res.ok;
  } catch {
    return false;
  }
}

export interface ModerationQueueItem {
  readonly commentId: number;
  readonly content: string;
  readonly authorName: string;
  readonly reportCount: number;
  readonly lastReportAt: string;
  readonly film: { readonly slug: string; readonly title: string };
}

/** `GET /api/creator/moderation`: comentarios con denuncias pendientes en las obras del creador; `null` si falla. */
export async function fetchModerationQueue(): Promise<ModerationQueueItem[] | null> {
  try {
    const res = await fetch("/api/creator/moderation", { headers: await authHeaders() });
    if (!res.ok) return null;
    const body = (await res.json()) as { items?: ModerationQueueItem[] };
    return body.items ?? [];
  } catch {
    return null;
  }
}
