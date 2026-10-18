import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Destino del enlace «restablecer contraseña» del correo. Canjea el código por una sesión y lleva a la página donde se
 * elige la nueva contraseña. Va bajo /auth/callback para que el middleware la deje pasar sin sesión.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}/?error=recuperar`);

  const cookieStore = cookies();
  const pending: Array<{ name: string; value: string; options: Parameters<(typeof cookieStore)["set"]>[2] }> = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
            pending.push({ name, value, options });
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  // Sin sesión el middleware mandaría la página al inicio, así que el aviso de enlace caducado va al login.
  const response = NextResponse.redirect(error ? `${origin}/?error=recuperar` : `${origin}/restablecer-contrasena`);
  pending.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  response.cookies.set("gma_guest", "", { path: "/", maxAge: 0, sameSite: "lax" });
  return response;
}
