export const AUTH_ROUTES = {
  signIn: "/login",
  afterSignOut: "/login",
} as const;

export const PUBLIC_ROUTES = ["/login", "/auth/callback"] as const;

export const SUPABASE_CONFIG_ERRORS = {
  missingPublicEnv:
    "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  missingServerEnv:
    "Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para operaciones server-side.",
} as const;
