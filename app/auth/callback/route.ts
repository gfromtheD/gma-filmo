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

    // Collect cookies that Supabase wants to set so we can copy them
    // explicitly onto the redirect response. Without this, the browser
    // never receives the session cookies because NextResponse.redirect()
    // is a separate object from the internal cookieStore response.
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
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
              pendingCookies.push({ name, value, options });
            });
          },
        },
      },
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const googleName: string | undefined =
        data.user.user_metadata?.full_name ??
        data.user.user_metadata?.name;

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

      const needsSetup = !hasRealName(finalName);
      const destination = needsSetup ? "/configurar-perfil" : next;

      const response = NextResponse.redirect(`${origin}${destination}`);

      // Copy session cookies onto the redirect so the browser receives them
      pendingCookies.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options),
      );
      response.cookies.set("gma_guest", "", { path: "/", maxAge: 0, sameSite: "lax" });
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth`);
}
