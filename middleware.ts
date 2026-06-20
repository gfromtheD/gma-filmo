import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/", "/auth/callback", "/terminos", "/privacidad"];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip static assets
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase env vars — denying all requests");
    return NextResponse.redirect(new URL("/", request.url));
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() validates the JWT with Supabase and refreshes session if needed
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isGuest = request.cookies.get("gma_guest")?.value === "1";

  if (!user && !isPublic && !isGuest) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Guests cannot access profile management — redirect to register
  const GUEST_BLOCKED = ["/perfiles", "/configurar-perfil"];
  if (isGuest && GUEST_BLOCKED.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/?register=1", request.url));
  }

  if (user && pathname === "/") {
    return NextResponse.redirect(new URL("/inicio", request.url));
  }

  // Creator onboarding gate: if the user is mid-creator-setup they must
  // finish (or cancel) the form before accessing any other part of the app.
  const creatorSetupVal = request.cookies.get("gma_creator_setup")?.value;
  const isCreatorSetup = creatorSetupVal === "1" || creatorSetupVal === "confirmed";
  const CREATOR_SETUP_ALLOWED = [
    "/configurar-perfil-creador",
    "/terminos",
    "/privacidad",
    "/auth/callback",
  ];
  if (
    isCreatorSetup &&
    user &&
    !CREATOR_SETUP_ALLOWED.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.redirect(new URL("/configurar-perfil-creador", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
