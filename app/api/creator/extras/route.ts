import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { getUserId } from "@/lib/api/auth";
import { rateLimit } from "@/lib/api/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { manageableExtras, readTitleExtras } from "@/lib/media/engine-extras";
import { EXTRA_DESCRIPTION_MAX, EXTRA_TITLE_MAX } from "@/lib/extras/extras";

const LIMIT_PER_MINUTE = 30;
const TitleIdSchema = z.coerce.number().int().positive();
const SaveSchema = z.object({
  titleId: z.number().int().positive(),
  items: z.array(z.object({
    assetId: z.string().uuid(),
    label: z.string().trim().max(EXTRA_TITLE_MAX),
    description: z.string().trim().max(EXTRA_DESCRIPTION_MAX),
    hidden: z.boolean(),
  })).max(60),
});

type Gate = { readonly userId: string } | { readonly response: NextResponse };

/** Sesión, límite de peticiones y autoría: solo el creador de la obra toca sus extras. */
async function gate(request: Request, titleId: number): Promise<Gate> {
  const userId = await getUserId(request);
  if (!userId) return { response: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  if (!rateLimit(`${userId}/creator-extras`, LIMIT_PER_MINUTE)) {
    return { response: NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 }) };
  }
  const { data } = await getSupabaseAdminClient().from("peliculas").select("creator_user_id").eq("id", titleId).maybeSingle();
  if ((data as { creator_user_id: string | null } | null)?.creator_user_id !== userId) {
    return { response: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
  }
  return { userId };
}

export async function GET(request: Request) {
  const parsed = TitleIdSchema.safeParse(new URL(request.url).searchParams.get("titleId"));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
  const denied = await gate(request, parsed.data);
  if ("response" in denied) return denied.response;
  try {
    const { rows, metas } = await readTitleExtras(parsed.data);
    return NextResponse.json({ ok: true, extras: manageableExtras(rows, metas) });
  } catch (error) {
    console.error("[creator extras GET]", error);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

/** Guarda nombre, descripción, orden (el de la lista) y visibilidad de los extras de una obra. */
export async function PUT(request: Request) {
  const parsed = SaveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
  const { titleId, items } = parsed.data;
  const denied = await gate(request, titleId);
  if ("response" in denied) return denied.response;

  try {
    const { rows, metas } = await readTitleExtras(titleId);
    const owned = new Set(manageableExtras(rows, metas).map((e) => e.assetId));
    if (items.some((item) => !owned.has(item.assetId)) || new Set(items.map((i) => i.assetId)).size !== items.length) {
      return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
    }
    const now = new Date().toISOString();
    const { error } = await (getSupabaseAdminClient() as unknown as {
      from: (t: string) => { upsert: (v: unknown, o: { onConflict: string }) => PromiseLike<{ error: { message?: string } | null }> };
    }).from("gma_extra_meta").upsert(
      items.map((item, index) => ({
        title_id: titleId, asset_id: item.assetId, label: item.label || null, description: item.description || null,
        hidden: item.hidden, sort_order: index, updated_at: now,
      })),
      { onConflict: "title_id,asset_id" },
    );
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error("[creator extras PUT]", error);
    return NextResponse.json({ ok: false, error: "Could not save" }, { status: 500 });
  }
  revalidateTag("extras");
  return NextResponse.json({ ok: true });
}
