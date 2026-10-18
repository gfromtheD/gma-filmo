import { NextResponse } from "next/server";
import { z } from "zod";
import { LIST_NAME_MAX, listNameError, normalizeListName } from "@/lib/lists/rules";
import { authorize, jsonError, listsDb, ownsList, userError } from "@/lib/lists/server";

const RenameSchema = z.object({ name: z.string().max(LIST_NAME_MAX * 2) });
const IdSchema = z.string().uuid();

/** Renombra la lista. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorize(request, "write");
  if ("response" in auth) return auth.response;
  if (!IdSchema.safeParse(params.id).success) return jsonError(400, "Invalid list");
  const parsed = RenameSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Invalid input");

  const { data: list } = await listsDb().from("user_lists").select("profile_id").eq("id", params.id).eq("user_id", auth.userId).maybeSingle();
  if (!list) return jsonError(404, "Not found");
  const { data: siblings } = await listsDb()
    .from("user_lists").select("name").eq("user_id", auth.userId).eq("profile_id", list.profile_id).neq("id", params.id);
  const name = normalizeListName(parsed.data.name);
  const invalid = listNameError(name, ((siblings ?? []) as { name: string }[]).map((r) => r.name));
  if (invalid) return userError(400, invalid);

  const { error } = await listsDb()
    .from("user_lists").update({ name, updated_at: new Date().toISOString() }).eq("id", params.id).eq("user_id", auth.userId);
  if (error) {
    console.error("[api/lists PATCH]", error.code, error.message);
    return userError(500, "No se pudo renombrar la lista.");
  }
  return NextResponse.json({ ok: true, name });
}

/** Borra la lista y su contenido (las obras siguen en el catálogo y en Guardados). */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorize(request, "write");
  if ("response" in auth) return auth.response;
  if (!IdSchema.safeParse(params.id).success) return jsonError(400, "Invalid list");
  if (!(await ownsList(auth.userId, params.id))) return jsonError(404, "Not found");

  const { error } = await listsDb().from("user_lists").delete().eq("id", params.id).eq("user_id", auth.userId);
  if (error) {
    console.error("[api/lists DELETE]", error.code, error.message);
    return userError(500, "No se pudo borrar la lista.");
  }
  return NextResponse.json({ ok: true });
}
