import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function hasRealName(name: string | null | undefined): boolean {
  if (!name) return false;
  const t = name.trim();
  return t !== "" && t !== "Espectador";
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/perfiles";

  if (code) {
    const cookieStore = cookies();

    const pendingCookies: Array<{
      name: string;
      value: string;
      options: Parameters<(typeof cookieStore)["set"]>[2];
    }> = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
              pendingCookies.push({ name, value, options });
            });
          },
        },
      },
    );

    const isCreatorOAuth = cookieStore.getAll().some((c) => c.name === "gma_creator_pending");

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const googleName: string | undefined =
        data.user.user_metadata?.full_name ??
        data.user.user_metadata?.name;

      // ── Existing profile setup ────────────────────────────────────────────
      const { data: existing } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", data.user.id)
        .maybeSingle();

      const resolvedName = googleName?.trim() || null;

      if (!existing) {
        await supabase.from("profiles").insert({
          id: data.user.id,
          display_name: resolvedName ?? "",
        });
      } else if (resolvedName && !hasRealName(existing.display_name)) {
        await supabase.from("profiles").update({ display_name: resolvedName }).eq("id", data.user.id);
      }

      const finalName = existing
        ? (resolvedName && !hasRealName(existing.display_name) ? resolvedName : existing.display_name)
        : resolvedName;

      // ── Creator email path: insert creator_profiles from metadata ─────────
      const isCreatorEmail    = data.user.user_metadata?.is_creator === true;
      const creatorNameFromMeta = data.user.user_metadata?.creator_name as string | undefined;

      if (isCreatorEmail && creatorNameFromMeta) {
        const { data: existingCreator } = await supabase
          .from("creator_profiles")
          .select("user_id")
          .eq("user_id", data.user.id)
          .maybeSingle();

        if (!existingCreator) {
          await supabase.from("creator_profiles").insert({
            user_id: data.user.id,
            creator_name: creatorNameFromMeta,
          });
        }
      }

      // ── Creator OAuth path: redirect to creator setup ─────────────────────
      if (isCreatorOAuth) {
        const { data: existingCreator } = await supabase
          .from("creator_profiles")
          .select("user_id, studio_name")
          .eq("user_id", data.user.id)
          .maybeSingle();

        if (!existingCreator || !existingCreator.studio_name) {
          const response = NextResponse.redirect(`${origin}/configurar-perfil-creador`);
          pendingCookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          response.cookies.set("gma_guest", "", { path: "/", maxAge: 0, sameSite: "lax" });
          response.cookies.set("gma_creator_pending", "", { path: "/", maxAge: 0, sameSite: "lax" });
          return response;
        }
      }

      // ── Normal profile setup check ────────────────────────────────────────
      const needsSetup = !hasRealName(finalName);
      const destination = needsSetup ? "/configurar-perfil" : next;

      const response = NextResponse.redirect(`${origin}${destination}`);
      pendingCookies.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options),
      );
      response.cookies.set("gma_guest", "", { path: "/", maxAge: 0, sameSite: "lax" });
      response.cookies.set("gma_creator_pending", "", { path: "/", maxAge: 0, sameSite: "lax" });
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth`);
}
