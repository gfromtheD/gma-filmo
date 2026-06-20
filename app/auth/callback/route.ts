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

      // ── Ensure profiles row exists ──────────────────────────────────────────
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

      // ── Check creator status (single source of truth) ───────────────────────
      // A user IS a creator if they have a creator_profiles row with studio_name set.
      const { data: creatorRow } = await supabase
        .from("creator_profiles")
        .select("user_id, studio_name")
        .eq("user_id", data.user.id)
        .maybeSingle();

      const isConfirmedCreator = !!(creatorRow?.studio_name);

      // ── Routing decision ────────────────────────────────────────────────────
      //
      // Priority order:
      //   1. Already a confirmed creator → always land on perfiles → mi-estudio
      //   2. Creator OAuth + no studio yet → fill out creator form
      //   3. Normal viewer → perfiles (or configurar-perfil if no name yet)

      let destination: string;

      if (isConfirmedCreator) {
        // Returning creator: pick profile then go to Mi Estudio
        destination = "/perfiles?next=/mi-estudio";
      } else if (isCreatorOAuth) {
        // New creator OAuth: go set up creator profile
        destination = "/configurar-perfil-creador";
        // Mark that this session is mid-creator-onboarding so middleware can
        // block navigation away from the form until it's submitted or cancelled.
        pendingCookies.push({
          name: "gma_creator_setup",
          value: "1",
          options: { path: "/", maxAge: 600, sameSite: "lax" as const },
        });
      } else {
        // Normal viewer login
        const needsSetup = !hasRealName(finalName);
        destination = needsSetup ? "/configurar-perfil" : next;
      }

      const response = NextResponse.redirect(`${origin}${destination}`);
      pendingCookies.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options),
      );
      // Always clear these cookies on any successful auth
      response.cookies.set("gma_guest",           "", { path: "/", maxAge: 0, sameSite: "lax" });
      response.cookies.set("gma_creator_pending",  "", { path: "/", maxAge: 0, sameSite: "lax" });
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth`);
}
