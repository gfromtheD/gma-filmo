import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_ITEMS_PER_LIST } from "@/lib/lists/rules";
import { authorize, jsonError, listsDb, ownsList, userError } from "@/lib/lists/server";

const ItemSchema = z.object({ peliculaId: z.number().int().positive() });
const IdSchema = z.string().uuid();

/** Comprueba sesión, datos y que la lista sea del usuario. */
async function prepare(request: Request, listId: string): Promise<{ peliculaId: number } | { response: NextResponse }> {
  const auth = await authorize(request, "write");
  if ("response" in auth) return auth;
  if (!IdSchema.safeParse(listId).success) return { response: jsonError(400, "Invalid list") };
  const parsed = ItemSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return { response: jsonError(400, "Invalid input") };
  if (!(await ownsList(auth.userId, listId))) return { response: jsonError(404, "Not found") };
  return { peliculaId: parsed.data.peliculaId };
}

/** Añade una obra a la lista. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const ready = await prepare(request, params.id);
  if ("response" in ready) return ready.response;
  const { count } = await listsDb().from("user_list_items").select("pelicula_id", { count: "exact", head: true }).eq("list_id", params.id);
  if ((count ?? 0) >= MAX_ITEMS_PER_LIST) return userError(400, `Una lista puede tener como mucho ${MAX_ITEMS_PER_LIST} obras.`);

  const { error } = await listsDb()
    .from("user_list_items").upsert({ list_id: params.id, pelicula_id: ready.peliculaId }, { onConflict: "list_id,pelicula_id" });
  if (error) {
    console.error("[api/lists items POST]", error.code, error.message);
    return userError(500, "No se pudo añadir a la lista.");
  }
  return NextResponse.json({ ok: true });
}

/** Quita una obra de la lista. */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const ready = await prepare(request, params.id);
  if ("response" in ready) return ready.response;
  const { error } = await listsDb().from("user_list_items").delete().eq("list_id", params.id).eq("pelicula_id", ready.peliculaId);
  if (error) {
    console.error("[api/lists items DELETE]", error.code, error.message);
    return userError(500, "No se pudo quitar de la lista.");
  }
  return NextResponse.json({ ok: true });
}
