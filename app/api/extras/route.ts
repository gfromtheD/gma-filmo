import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { getUserId } from "@/lib/api/auth";
import { rateLimit } from "@/lib/api/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { EXTRA_COLUMNS, fetchPublishedExtras } from "@/lib/extras/queries";
import { ExtraInputSchema, rowToExtra, type ExtraRow } from "@/lib/extras/extras";

const PeliculaIdSchema = z.coerce.number().int().positive();
const CreateSchema = ExtraInputSchema.extend({ peliculaId: z.number().int().positive() });
const UpdateSchema = ExtraInputSchema.partial().extend({
  id: z.number().int().positive(),
  status: z.enum(["published", "draft", "hidden"]).optional(),
  sortOrder: z.number().int().min(0).optional(),
});
const DeleteSchema = z.object({ id: z.number().int().positive() });

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
}

/** Lectura pública: solo extras publicados (la RLS también lo impone). */
export async function GET(request: Request) {
  if (!rateLimit(`${clientIp(request)}/extras/read`, 120)) {
    return NextResponse.json({ extras: [], error: "Too many requests" }, { status: 429 });
  }
  const parsed = PeliculaIdSchema.safeParse(new URL(request.url).searchParams.get("peliculaId"));
  if (!parsed.success) return NextResponse.json({ extras: [], error: "Invalid input" }, { status: 400 });

  return NextResponse.json({ extras: await fetchPublishedExtras(parsed.data) });
}

/** ¿Es `userId` el creador del título? */
async function ownsPelicula(peliculaId: number, userId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (getSupabaseAdminClient() as any)
    .from("peliculas")
    .select("creator_user_id")
    .eq("id", peliculaId)
    .maybeSingle();
  return (data as { creator_user_id: string | null } | null)?.creator_user_id === userId;
}

async function extraPeliculaId(extraId: number): Promise<number | null> {
  const { data } = await getSupabaseAdminClient()
    .from("pelicula_extras")
    .select("pelicula_id")
    .eq("id", extraId)
    .maybeSingle();
  return data?.pelicula_id ?? null;
}

type Authorized = { readonly userId: string } | { readonly response: NextResponse };

async function authorize(request: Request): Promise<Authorized> {
  const userId = await getUserId(request);
  if (!userId) return { response: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  if (!rateLimit(`${userId}/extras/write`, 30)) {
    return { response: NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 }) };
  }
  return { userId };
}

/** Comprueba que el extra existe y es de un título del usuario. */
async function authorizeExtra(extraId: number, userId: string): Promise<NextResponse | null> {
  const peliculaId = await extraPeliculaId(extraId);
  if (peliculaId === null) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if (!(await ownsPelicula(peliculaId, userId))) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function POST(request: Request) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;

  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
  const input = parsed.data;

  if (!(await ownsPelicula(input.peliculaId, auth.userId))) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabaseAdminClient();
  const { data: last } = await supabase
    .from("pelicula_extras")
    .select("sort_order")
    .eq("pelicula_id", input.peliculaId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("pelicula_extras")
    .insert({
      pelicula_id: input.peliculaId,
      title: input.title,
      description: input.description || null,
      kind: input.kind,
      provider: input.provider,
      video_url: input.videoUrl,
      media_ref: input.mediaRef || null,
      poster_url: input.posterUrl || null,
      duration_seconds: input.durationSeconds ?? null,
      file_size_bytes: input.fileSizeBytes ?? null,
      sort_order: (last?.sort_order ?? -1) + 1,
      created_by: auth.userId,
    })
    .select(EXTRA_COLUMNS)
    .single();

  if (error || !data) {
    console.error("[api/extras POST]", error?.code, error?.message);
    return NextResponse.json({ ok: false, error: "Could not save" }, { status: 500 });
  }
  revalidateTag("extras");
  return NextResponse.json({ ok: true, extra: rowToExtra(data as ExtraRow) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;

  const parsed = UpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
  const { id, ...changes } = parsed.data;

  const denied = await authorizeExtra(id, auth.userId);
  if (denied) return denied;

  const patch = {
    ...(changes.title !== undefined && { title: changes.title }),
    ...(changes.description !== undefined && { description: changes.description || null }),
    ...(changes.kind !== undefined && { kind: changes.kind }),
    ...(changes.videoUrl !== undefined && { video_url: changes.videoUrl }),
    ...(changes.posterUrl !== undefined && { poster_url: changes.posterUrl || null }),
    ...(changes.durationSeconds !== undefined && { duration_seconds: changes.durationSeconds }),
    ...(changes.status !== undefined && { status: changes.status }),
    ...(changes.sortOrder !== undefined && { sort_order: changes.sortOrder }),
    updated_at: new Date().toISOString(),
  };

  const { error } = await getSupabaseAdminClient().from("pelicula_extras").update(patch).eq("id", id);
  if (error) {
    console.error("[api/extras PATCH]", error.code, error.message);
    return NextResponse.json({ ok: false, error: "Could not save" }, { status: 500 });
  }
  revalidateTag("extras");
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;

  const parsed = DeleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });

  const denied = await authorizeExtra(parsed.data.id, auth.userId);
  if (denied) return denied;

  const { error } = await getSupabaseAdminClient().from("pelicula_extras").delete().eq("id", parsed.data.id);
  if (error) {
    console.error("[api/extras DELETE]", error.code, error.message);
    return NextResponse.json({ ok: false, error: "Could not delete" }, { status: 500 });
  }
  revalidateTag("extras");
  return NextResponse.json({ ok: true });
}
