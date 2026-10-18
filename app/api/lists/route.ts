import { NextResponse } from "next/server";
import { z } from "zod";
import { LIST_NAME_MAX, MAX_LISTS_PER_PROFILE, listNameError, normalizeListName } from "@/lib/lists/rules";
import { authorize, jsonError, listsDb, userError } from "@/lib/lists/server";

const CreateSchema = z.object({
  name:      z.string().max(LIST_NAME_MAX * 2),
  profileId: z.string().max(64).default(""),
});

type ListRow = { id: string; name: string; created_at: string; user_list_items: { pelicula_id: number; added_at: string }[] };

/** Listas del perfil, cada una con sus obras (de la añadida más reciente a la más antigua). */
export async function GET(request: Request) {
  const auth = await authorize(request, "read");
  if ("response" in auth) return auth.response;
  const profileId = new URL(request.url).searchParams.get("profileId") ?? "";

  const { data, error } = await listsDb()
    .from("user_lists")
    .select("id, name, created_at, user_list_items(pelicula_id, added_at)")
    .eq("user_id", auth.userId)
    .eq("profile_id", profileId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[api/lists GET]", error.code, error.message);
    return NextResponse.json({ lists: [], error: error.message });
  }
  const lists = ((data ?? []) as ListRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    itemIds: [...row.user_list_items].sort((a, b) => b.added_at.localeCompare(a.added_at)).map((i) => i.pelicula_id),
  }));
  return NextResponse.json({ lists });
}

/** Crea una lista vacía. */
export async function POST(request: Request) {
  const auth = await authorize(request, "write");
  if ("response" in auth) return auth.response;
  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Invalid input");
  const { profileId } = parsed.data;
  const name = normalizeListName(parsed.data.name);

  const { data: existing } = await listsDb().from("user_lists").select("name").eq("user_id", auth.userId).eq("profile_id", profileId);
  const names = ((existing ?? []) as { name: string }[]).map((r) => r.name);
  if (names.length >= MAX_LISTS_PER_PROFILE) return userError(400, `Puedes tener como mucho ${MAX_LISTS_PER_PROFILE} listas.`);
  const invalid = listNameError(name, names);
  if (invalid) return userError(400, invalid);

  const { data, error } = await listsDb()
    .from("user_lists")
    .insert({ user_id: auth.userId, profile_id: profileId, name })
    .select("id, name, created_at")
    .single();
  if (error) {
    console.error("[api/lists POST]", error.code, error.message);
    return userError(500, "No se pudo crear la lista.");
  }
  return NextResponse.json({ ok: true, list: { id: data.id, name: data.name, createdAt: data.created_at, itemIds: [] } });
}
