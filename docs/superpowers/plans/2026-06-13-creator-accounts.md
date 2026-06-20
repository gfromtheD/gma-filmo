# Creator Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir cuentas de creador: registro diferenciado desde la pantalla de login, tabla `creator_profiles` en Supabase, y una pestaña "Mi Estudio" solo visible para creadores con toggle espectador/creador.

**Architecture:** La diferenciación creador/espectador se implementa a nivel de aplicación: todos los usuarios comparten `auth.users`, pero los creadores tienen además una fila en `creator_profiles`. El entry point está en `landing-hero.tsx` (nuevo estado `creator-register`). El callback de auth detecta el intent creador (vía `user_metadata` para email, vía queryParam para Google) e inserta en `creator_profiles`. El hook `useIsCreator` consulta esta tabla client-side y el navbar lo usa para mostrar la tab "Mi Estudio".

**Tech Stack:** Next.js 14 (App Router), Supabase (SSR + browser client), TypeScript, Tailwind CSS, Zustand, motion/react

---

## Mapa de archivos

| Acción | Archivo |
|---|---|
| SQL manual | Ejecutar en Supabase Dashboard → SQL Editor |
| Modificar | `types/database.ts` |
| Crear | `hooks/use-is-creator.ts` |
| Crear | `components/ui/creator-register-card.tsx` |
| Modificar | `components/ui/landing-hero.tsx` |
| Modificar | `components/ui/login-card.tsx` |
| Modificar | `components/ui/register-card.tsx` |
| Modificar | `app/auth/callback/route.ts` |
| Crear | `app/configurar-perfil-creador/page.tsx` |
| Crear | `components/features/studio/studio-screen.tsx` |
| Crear | `app/(platform)/(protected)/mi-estudio/layout.tsx` |
| Crear | `app/(platform)/(protected)/mi-estudio/page.tsx` |
| Modificar | `components/layout/navbar.tsx` |

---

### Task 1: SQL — Crear tabla `creator_profiles` en Supabase

**Files:**
- SQL: ejecutar en Supabase Dashboard → SQL Editor

- [ ] **Step 1: Abrir Supabase Dashboard → SQL Editor y ejecutar**

```sql
create table if not exists public.creator_profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  creator_name text not null,
  bio          text,
  status       text not null default 'approved',
  created_at   timestamptz not null default now()
);

alter table public.creator_profiles enable row level security;

create policy "creator own select"
  on public.creator_profiles for select
  using (auth.uid() = user_id);

create policy "creator own insert"
  on public.creator_profiles for insert
  with check (auth.uid() = user_id);

create policy "creator own update"
  on public.creator_profiles for update
  using (auth.uid() = user_id);
```

- [ ] **Step 2: Verificar en Table Editor**

En Supabase Dashboard → Table Editor, la tabla `creator_profiles` debe aparecer con columnas: `user_id`, `creator_name`, `bio`, `status`, `created_at`.

---

### Task 2: Añadir tipo `creator_profiles` a `types/database.ts`

**Files:**
- Modify: `types/database.ts`

- [ ] **Step 1: Insertar la definición de `creator_profiles` en la sección `Tables` de `types/database.ts`**

Buscar la sección que empieza con `artistas:` (primera tabla) y añadir antes de ella:

```typescript
      creator_profiles: {
        Row: {
          user_id: string
          creator_name: string
          bio: string | null
          status: string
          created_at: string
        }
        Insert: {
          user_id: string
          creator_name: string
          bio?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          user_id?: string
          creator_name?: string
          bio?: string | null
          status?: string
          created_at?: string
        }
        Relationships: []
      }
```

- [ ] **Step 2: Verificar que el proyecto compila**

```bash
cd streaming-app && npx tsc --noEmit
```

Expected: sin errores relacionados con `creator_profiles`.

---

### Task 3: Crear hook `useIsCreator`

**Files:**
- Create: `hooks/use-is-creator.ts`

- [ ] **Step 1: Crear `hooks/use-is-creator.ts`**

```typescript
"use client";

import { useEffect, useState } from "react";
import { useSupabaseUserId } from "@/components/providers/supabase-auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function useIsCreator(): { isCreator: boolean; isLoading: boolean } {
  const userId = useSupabaseUserId();
  const [isCreator, setIsCreator] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setIsCreator(false);
      setIsLoading(false);
      return;
    }
    getSupabaseBrowserClient()
      .from("creator_profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        setIsCreator(data != null);
        setIsLoading(false);
      });
  }, [userId]);

  return { isCreator, isLoading };
}
```

- [ ] **Step 2: Verificar compilación**

```bash
npx tsc --noEmit
```

Expected: sin errores.

---

### Task 4: Crear `CreatorRegisterCard`

**Files:**
- Create: `components/ui/creator-register-card.tsx`

Este componente replica el estilo visual de `register-card.tsx` pero con campos y lógica propios de creadores.

- [ ] **Step 1: Crear `components/ui/creator-register-card.tsx`**

```tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

interface CreatorRegisterCardProps {
  onBack?: () => void;
  onLogin?: () => void;
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 7L2 7" />
    </svg>
  );
}

const inputClass =
  "w-full rounded-[10px] border border-[#1E2D42] bg-white/[0.04] px-4 py-3 text-[14px] text-white placeholder-[#3A4A5E] outline-none transition-colors duration-150 focus:border-[#22B16B]";

const pillClass =
  "flex w-full items-center justify-center gap-3 rounded-full border border-[#22B16B]/40 bg-[#22B16B]/[0.06] py-3 text-[14px] font-semibold text-white transition-colors hover:bg-[#22B16B]/[0.12] active:scale-[0.98] disabled:opacity-50";

export function CreatorRegisterCard({ onBack, onLogin }: CreatorRegisterCardProps) {
  const [showEmail,     setShowEmail]     = useState(false);
  const [email,         setEmail]         = useState("");
  const [password,      setPassword]      = useState("");
  const [confirm,       setConfirm]       = useState("");
  const [creatorName,   setCreatorName]   = useState("");
  const [loading,       setLoading]       = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error,         setError]         = useState("");
  const [success,       setSuccess]       = useState("");

  async function handleGoogle() {
    setGoogleLoading(true);
    setError("");
    const { error: err } = await getSupabaseBrowserClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: "openid email profile",
        redirectTo: `${window.location.origin}/auth/callback?creator=1`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (err) { setError(err.message); setGoogleLoading(false); }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    if (password.length < 6)  { setError("La contraseña debe tener al menos 6 caracteres."); return; }
    if (!creatorName.trim())  { setError("Introduce tu nombre de creador."); return; }
    setLoading(true);

    const { error: err } = await getSupabaseBrowserClient().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { is_creator: true, creator_name: creatorName.trim() },
      },
    });

    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      setSuccess("Cuenta creada. Revisa tu correo para confirmar.");
      setTimeout(() => onLogin?.(), 3000);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <button type="button" onClick={onBack} className="mb-2 transition-opacity hover:opacity-75">
        <Image src="/images/logo-gma.png" alt="GMA Filmo" height={64} width={200} className="h-16 w-auto" />
      </button>

      <div className="text-center">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-[#22B16B]/30 bg-[#22B16B]/10 px-3 py-1">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#22B16B]">Perfil Creador</span>
        </div>
        <h1 className="text-2xl font-extrabold text-white md:text-3xl">Únete como creador</h1>
        <p className="mt-1.5 text-sm text-[#B8C5D4]">Comparte tu obra con la comunidad.</p>
      </div>

      {error && (
        <div className="w-full rounded-xl bg-[#ff5252]/10 px-4 py-2.5 text-center text-[13px] text-[#ff5252]">
          {error}
        </div>
      )}
      {success && (
        <div className="w-full rounded-xl bg-[#22B16B]/10 px-4 py-2.5 text-center text-[13px] text-[#22B16B]">
          {success}
        </div>
      )}

      <button type="button" onClick={() => void handleGoogle()} disabled={googleLoading} className={`${pillClass} mt-4`}>
        <GoogleIcon />
        {googleLoading ? "Conectando…" : "Continuar con Google"}
      </button>

      <button type="button" onClick={() => setShowEmail(v => !v)} className={pillClass}>
        <MailIcon />
        Registrarse con correo
      </button>

      <AnimatePresence>
        {showEmail && (
          <motion.div
            key="creator-email-form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="w-full overflow-hidden"
          >
            <form onSubmit={(e) => void handleRegister(e)} className="flex flex-col gap-3 pt-1">
              <input
                type="text"
                required
                value={creatorName}
                onChange={(e) => setCreatorName(e.target.value)}
                placeholder="Nombre artístico o del proyecto"
                maxLength={60}
                className={inputClass}
              />
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Correo electrónico"
                className={inputClass}
              />
              <input
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña (mínimo 6 caracteres)"
                className={inputClass}
              />
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirmar contraseña"
                className={inputClass}
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-[#22B16B] py-3 text-[14px] font-bold text-[#031A0E] transition-[transform,background] hover:bg-[#2AC57A] active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? "Creando cuenta…" : "Crear cuenta de creador"}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-center text-[13px] text-[#6D7D94]">
        ¿Ya tienes cuenta?{" "}
        <button type="button" onClick={onLogin} className="font-semibold text-white transition-colors hover:text-[#22B16B]">
          Inicia sesión →
        </button>
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verificar compilación**

```bash
npx tsc --noEmit
```

Expected: sin errores.

---

### Task 5: Actualizar `landing-hero.tsx` — añadir vista `creator-register`

**Files:**
- Modify: `components/ui/landing-hero.tsx`

- [ ] **Step 1: Añadir import de `CreatorRegisterCard`**

Al principio del archivo, junto a los otros imports de cards:

```tsx
import { CreatorRegisterCard } from "@/components/ui/creator-register-card";
```

- [ ] **Step 2: Ampliar el tipo del estado `view`**

Cambiar la línea:
```tsx
const [view, setView] = useState<"hero" | "login" | "register">("hero");
```
Por:
```tsx
const [view, setView] = useState<"hero" | "login" | "register" | "creator-register">("hero");
```

- [ ] **Step 3: Añadir el bloque `creator-register` dentro de `AnimatePresence`**

Después del bloque `{view === "register" && ( ... )}` existente, añadir:

```tsx
          {view === "creator-register" && (
            <motion.div
              key="creator-register-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="w-full"
            >
              <CreatorRegisterCard
                onBack={() => setView("hero")}
                onLogin={() => setView("login")}
              />
            </motion.div>
          )}
```

- [ ] **Step 4: Verificar en navegador**

Abrir `http://localhost:3000`. La vista hero debe mostrar los botones normales. Navegar a login/register — el nuevo estado `creator-register` no está enlazado todavía (se conecta en Task 6).

---

### Task 6: Añadir entry point creador en `login-card.tsx` y `register-card.tsx`

**Files:**
- Modify: `components/ui/login-card.tsx`
- Modify: `components/ui/register-card.tsx`

- [ ] **Step 1: Actualizar `LoginCardProps` en `login-card.tsx`**

```tsx
interface LoginCardProps {
  onBack?: () => void;
  onRegister?: () => void;
  onCreatorRegister?: () => void;
}
```

- [ ] **Step 2: Añadir el parámetro en `LoginCardInner` y el link**

En la firma de `LoginCardInner`:
```tsx
function LoginCardInner({ onBack, onRegister, onCreatorRegister }: LoginCardProps) {
```

Reemplazar el párrafo final del return (el que contiene "¿Aún no tienes cuenta?"):
```tsx
      <p className="text-center text-[13px] text-[#6D7D94]">
        ¿Aún no tienes cuenta?{" "}
        <button type="button" onClick={onRegister} className="font-semibold text-[#22B16B] transition-colors hover:underline">
          Regístrate
        </button>
      </p>

      <p className="text-center text-[12px] text-[#4A5A6E]">
        ¿Quieres aportar a la plataforma?{" "}
        <button type="button" onClick={onCreatorRegister} className="font-semibold text-[#22B16B] transition-colors hover:underline">
          Regístrate como creador →
        </button>
      </p>
```

- [ ] **Step 3: Propagar `onCreatorRegister` en el wrapper `LoginCard`**

```tsx
export function LoginCard({ onBack, onRegister, onCreatorRegister }: LoginCardProps) {
  return (
    <Suspense fallback={<div />}>
      <LoginCardInner onBack={onBack} onRegister={onRegister} onCreatorRegister={onCreatorRegister} />
    </Suspense>
  );
}
```

- [ ] **Step 4: Actualizar `RegisterCardProps` en `register-card.tsx`**

```tsx
interface RegisterCardProps {
  onBack?: () => void;
  onLogin?: () => void;
  onCreatorRegister?: () => void;
}
```

- [ ] **Step 5: Añadir el parámetro en `RegisterCard` y el link**

En la firma del componente:
```tsx
export function RegisterCard({ onBack, onLogin, onCreatorRegister }: RegisterCardProps) {
```

Reemplazar el párrafo final del return (el que contiene "¿Ya tienes cuenta?"):
```tsx
      <p className="text-center text-[13px] text-[#6D7D94]">
        ¿Ya tienes cuenta?{" "}
        <button type="button" onClick={onLogin} className="font-semibold text-white transition-colors hover:text-[#22B16B]">
          Inicia sesión →
        </button>
      </p>

      <p className="text-center text-[12px] text-[#4A5A6E]">
        ¿Quieres aportar a la plataforma?{" "}
        <button type="button" onClick={onCreatorRegister} className="font-semibold text-[#22B16B] transition-colors hover:underline">
          Regístrate como creador →
        </button>
      </p>
```

- [ ] **Step 6: Conectar `onCreatorRegister` en `landing-hero.tsx`**

En `landing-hero.tsx`, en el bloque `{view === "login" && ...}`, actualizar el `LoginCard`:
```tsx
              <LoginCard
                onBack={() => setView("hero")}
                onRegister={() => setView("register")}
                onCreatorRegister={() => setView("creator-register")}
              />
```

En el bloque `{view === "register" && ...}`, actualizar el `RegisterCard`:
```tsx
              <RegisterCard
                onBack={() => setView("hero")}
                onLogin={() => setView("login")}
                onCreatorRegister={() => setView("creator-register")}
              />
```

- [ ] **Step 7: Verificar en navegador**

Abrir `http://localhost:3000` → Iniciar sesión. Debe aparecer el link "Regístrate como creador →" al fondo del card. Al pulsar, el card debe cambiar al formulario de creador con título "Únete como creador".

---

### Task 7: Actualizar `auth/callback/route.ts` — detectar intent creador

**Files:**
- Modify: `app/auth/callback/route.ts`

El callback necesita manejar dos casos:
- **Email creator**: `user.user_metadata.is_creator === true` → insertar en `creator_profiles` automáticamente
- **Google creator**: `searchParams.get("creator") === "1"` → redirigir a `/configurar-perfil-creador`

- [ ] **Step 1: Reemplazar el bloque completo de `app/auth/callback/route.ts`**

```typescript
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
  const code        = searchParams.get("code");
  const next        = searchParams.get("next") ?? "/perfiles";
  const isCreatorOAuth = searchParams.get("creator") === "1";

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

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const googleName: string | undefined =
        data.user.user_metadata?.full_name ?? data.user.user_metadata?.name;

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
      const isCreatorEmail = data.user.user_metadata?.is_creator === true;
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
          .select("user_id")
          .eq("user_id", data.user.id)
          .maybeSingle();

        if (!existingCreator) {
          const response = NextResponse.redirect(`${origin}/configurar-perfil-creador`);
          pendingCookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          response.cookies.set("gma_guest", "", { path: "/", maxAge: 0, sameSite: "lax" });
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
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth`);
}
```

- [ ] **Step 2: Verificar compilación**

```bash
npx tsc --noEmit
```

Expected: sin errores.

---

### Task 8: Crear página `/configurar-perfil-creador`

**Files:**
- Create: `app/configurar-perfil-creador/page.tsx`

Esta página se muestra tras el OAuth de Google en el path de creador. Pide el nombre de creador, inserta en `creator_profiles`, y redirige a `/perfiles`.

- [ ] **Step 1: Crear `app/configurar-perfil-creador/page.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function ConfigurarPerfilCreadorPage() {
  const router = useRouter();
  const [creatorName, setCreatorName] = useState("");
  const [loading,     setLoading]     = useState(false);
  const [init,        setInit]        = useState(true);
  const [error,       setError]       = useState("");

  useEffect(() => {
    async function check() {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }

      // If already a creator, skip setup
      const { data } = await supabase
        .from("creator_profiles")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) { router.replace("/perfiles"); return; }

      // Pre-fill with Google display name if available
      const metaName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? "";
      setCreatorName(metaName);
      setInit(false);
    }
    void check();
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = creatorName.trim();
    if (!trimmed) return;
    setLoading(true);
    setError("");

    const supabase = getSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/"); return; }

    const { error: err } = await supabase
      .from("creator_profiles")
      .insert({ user_id: user.id, creator_name: trimmed });

    if (err) {
      setError("Error al guardar. Inténtalo de nuevo.");
      setLoading(false);
    } else {
      router.push("/perfiles");
      router.refresh();
    }
  }

  if (init) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#0A0F17" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#22B16B] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12" style={{ background: "#0A0F17" }}>
      <div
        className="w-full"
        style={{
          maxWidth: 420,
          background: "#111827",
          border: "1px solid #1E2D42",
          borderRadius: 16,
          padding: "40px 36px",
        }}
      >
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-[#22B16B]/30 bg-[#22B16B]/10 px-3 py-1">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#22B16B]">Perfil Creador</span>
        </div>

        <h1 className="mb-1 mt-4 text-[24px] font-extrabold tracking-[-0.02em] text-white">
          Un último paso
        </h1>
        <p className="mb-8 text-[13px] text-[#5A6A7E]">
          ¿Cómo quieres que te conozca la comunidad?
        </p>

        {error && (
          <div className="mb-4 rounded-xl bg-[#ff5252]/10 px-4 py-2.5 text-center text-[13px] text-[#ff5252]">
            {error}
          </div>
        )}

        <form onSubmit={(e) => void handleSave(e)} className="flex flex-col gap-5">
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-widest text-[#4A5A6E]">
              Nombre artístico o del proyecto
            </label>
            <input
              type="text"
              autoFocus
              value={creatorName}
              onChange={(e) => setCreatorName(e.target.value)}
              placeholder="Tu nombre de creador"
              maxLength={60}
              required
              className="w-full rounded-md border border-[#1E2D42] bg-[#0D1520] px-4 py-3 text-[14px] text-white placeholder-[#4A5A6E] outline-none transition-colors focus:border-[#22B16B]/60"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !creatorName.trim()}
            className="mt-2 w-full rounded-full bg-[#22B16B] py-3 text-[14px] font-bold text-[#031A0E] transition-colors hover:bg-[#2AC57A] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Guardando…" : "Empezar a crear →"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar en navegador**

Navegar directamente a `http://localhost:3000/configurar-perfil-creador` sin sesión → debe redirigir a `/`. Con sesión de usuario normal (sin creator_profiles) → debe mostrar el formulario.

---

### Task 9: Crear `StudioScreen`

**Files:**
- Create: `components/features/studio/studio-screen.tsx`

- [ ] **Step 1: Crear `components/features/studio/studio-screen.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MySpaceScreen } from "@/components/features/space/my-space-screen";
import { GmaIcon } from "@/components/ui/gma-icon";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useSupabaseUserId } from "@/components/providers/supabase-auth-provider";
import type { MovieMedia } from "@/types/catalog";

interface StudioScreenProps {
  readonly items: readonly MovieMedia[];
}

type StudioTab = "spectator" | "creator";

function getInitialTab(): StudioTab {
  if (typeof window === "undefined") return "creator";
  return (sessionStorage.getItem("studio-tab") as StudioTab) ?? "creator";
}

export function StudioScreen({ items }: StudioScreenProps) {
  const [tab, setTab] = useState<StudioTab>(getInitialTab);
  const [creatorName, setCreatorName] = useState("");
  const [bio,         setBio]         = useState("");
  const [saving,      setSaving]      = useState(false);
  const [saveMsg,     setSaveMsg]     = useState("");
  const userId = useSupabaseUserId();
  const router = useRouter();

  useEffect(() => {
    sessionStorage.setItem("studio-tab", tab);
  }, [tab]);

  useEffect(() => {
    if (!userId) return;
    getSupabaseBrowserClient()
      .from("creator_profiles")
      .select("creator_name, bio")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setCreatorName(data.creator_name);
          setBio(data.bio ?? "");
        }
      });
  }, [userId]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    setSaveMsg("");
    const { error } = await getSupabaseBrowserClient()
      .from("creator_profiles")
      .update({ creator_name: creatorName.trim(), bio: bio.trim() || null })
      .eq("user_id", userId);
    setSaving(false);
    setSaveMsg(error ? "Error al guardar." : "Guardado.");
    setTimeout(() => setSaveMsg(""), 2500);
  }

  return (
    <div className="mx-auto max-w-[1440px] px-6 pb-20 pt-10">
      {/* Header + Toggle */}
      <div className="mb-10 flex items-center justify-between gap-4">
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-white">Mi Estudio</h1>
        <div className="flex items-center rounded-full border border-[#262626] bg-[#0D0D0D] p-1">
          <button
            type="button"
            onClick={() => setTab("spectator")}
            className="rounded-full px-4 py-2 text-[13px] font-semibold transition-colors"
            style={{
              background: tab === "spectator" ? "#22B16B" : "transparent",
              color: tab === "spectator" ? "#031A0E" : "#B8C5D4",
            }}
          >
            Espectador
          </button>
          <button
            type="button"
            onClick={() => setTab("creator")}
            className="rounded-full px-4 py-2 text-[13px] font-semibold transition-colors"
            style={{
              background: tab === "creator" ? "#22B16B" : "transparent",
              color: tab === "creator" ? "#031A0E" : "#B8C5D4",
            }}
          >
            Creador
          </button>
        </div>
      </div>

      {/* Spectator view */}
      {tab === "spectator" && <MySpaceScreen items={items} />}

      {/* Creator view */}
      {tab === "creator" && (
        <div className="flex flex-col gap-8">
          {/* Profile editor */}
          <section className="rounded-[14px] border border-[#1E1E1E] bg-[#0D0D0D] p-6">
            <h2 className="mb-5 text-[16px] font-bold text-white">Perfil de creador</h2>
            <form onSubmit={(e) => void handleSaveProfile(e)} className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-widest text-[#4A5A6E]">
                  Nombre artístico
                </label>
                <input
                  type="text"
                  value={creatorName}
                  onChange={(e) => setCreatorName(e.target.value)}
                  placeholder="Tu nombre de creador"
                  maxLength={60}
                  required
                  className="w-full rounded-[10px] border border-[#1E2D42] bg-white/[0.04] px-4 py-3 text-[14px] text-white placeholder-[#3A4A5E] outline-none transition-colors focus:border-[#22B16B]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-widest text-[#4A5A6E]">
                  Bio <span className="normal-case text-[#3A4A5E]">(opcional)</span>
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Cuéntanos sobre tu proyecto..."
                  maxLength={300}
                  rows={3}
                  className="w-full resize-none rounded-[10px] border border-[#1E2D42] bg-white/[0.04] px-4 py-3 text-[14px] text-white placeholder-[#3A4A5E] outline-none transition-colors focus:border-[#22B16B]"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={saving || !creatorName.trim()}
                  className="rounded-full bg-[#22B16B] px-6 py-2.5 text-[13px] font-bold text-[#031A0E] transition-colors hover:bg-[#2AC57A] disabled:opacity-50"
                >
                  {saving ? "Guardando…" : "Guardar"}
                </button>
                {saveMsg && (
                  <span className="text-[13px] text-[#22B16B]">{saveMsg}</span>
                )}
              </div>
            </form>
          </section>

          {/* Upload placeholder */}
          <section className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-[#262626] py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#1A1A1A] text-[#3A3A3A]">
              <GmaIcon name="film" size={24} />
            </div>
            <p className="mb-1 text-[15px] font-bold text-white">Subir contenido</p>
            <p className="text-[13px] text-[#5A6A7E]">Próximamente podrás subir tus cortos y largometrajes.</p>
          </section>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar compilación**

```bash
npx tsc --noEmit
```

Expected: sin errores.

---

### Task 10: Crear ruta `/mi-estudio` — layout + page

**Files:**
- Create: `app/(platform)/(protected)/mi-estudio/layout.tsx`
- Create: `app/(platform)/(protected)/mi-estudio/page.tsx`

- [ ] **Step 1: Crear el layout con protección de creador**

`app/(platform)/(protected)/mi-estudio/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function MiEstudioLayout({ children }: { children: React.ReactNode }) {
  const supabase = getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: creatorProfile } = await supabase
    .from("creator_profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!creatorProfile) {
    redirect("/mi-espacio");
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Crear la page**

`app/(platform)/(protected)/mi-estudio/page.tsx`:

```tsx
import type { Metadata } from "next";
import { getPeliculas } from "@/lib/supabase/queries";
import { StudioScreen } from "@/components/features/studio/studio-screen";

export const metadata: Metadata = { title: "Mi Estudio" };

export default async function MiEstudioPage() {
  const items = await getPeliculas();
  return <StudioScreen items={items} />;
}
```

- [ ] **Step 3: Verificar en navegador**

- `http://localhost:3000/mi-estudio` sin sesión → debe redirigir a `/`
- Con sesión de usuario normal (sin creator_profiles) → debe redirigir a `/mi-espacio`
- Con sesión de creador → debe mostrar la página con el toggle Espectador / Creador

---

### Task 11: Actualizar navbar — tab condicional "Mi Estudio"

**Files:**
- Modify: `components/layout/navbar.tsx`

- [ ] **Step 1: Añadir import de `useIsCreator`**

```tsx
import { useIsCreator } from "@/hooks/use-is-creator";
```

- [ ] **Step 2: Cambiar `NAV_ITEMS` de constante estática a definición base + item creador**

Reemplazar el bloque `NAV_ITEMS` existente:

```tsx
const BASE_NAV_ITEMS: readonly NavItem[] = [
  { id: "home",    label: "Home",       href: "/inicio",     match: "/inicio" },
  { id: "movies",  label: "Películas",  href: "/peliculas",  match: "/peliculas" },
  { id: "cortos",  label: "Cortos",     href: "/cortos",     match: "/cortos" },
  { id: "space",   label: "Mi Espacio", href: "/mi-espacio", match: "/mi-espacio" },
];

const STUDIO_NAV_ITEM: NavItem = {
  id: "studio", label: "Mi Estudio", href: "/mi-estudio", match: "/mi-estudio",
};
```

- [ ] **Step 3: Añadir `useIsCreator` dentro del componente `Navbar` y computar `navItems`**

Dentro del cuerpo del componente `Navbar`, después de las líneas `const isGuest = ...`:

```tsx
  const { isCreator } = useIsCreator();
  const navItems: readonly NavItem[] = isCreator
    ? [...BASE_NAV_ITEMS.slice(0, 3), STUDIO_NAV_ITEM, ...BASE_NAV_ITEMS.slice(3)]
    : BASE_NAV_ITEMS;
```

- [ ] **Step 4: Reemplazar todas las referencias a `NAV_ITEMS` por `navItems` en el render**

Hay dos usos de `NAV_ITEMS`:
1. En el `useEffect` que mide la posición del pill: `NAV_ITEMS.findIndex(...)` → `navItems.findIndex(...)`
2. En el `.map(...)` del render: `NAV_ITEMS.map(...)` → `navItems.map(...)`

- [ ] **Step 5: Verificar en navegador**

- Usuario normal: navbar muestra 4 tabs (Home, Películas, Cortos, Mi Espacio)
- Usuario creador: navbar muestra 5 tabs (Home, Películas, Cortos, Mi Estudio, Mi Espacio)
- La píldora verde debe deslizarse correctamente entre las 5 tabs

---

### Task 12: Verificación final end-to-end

- [ ] **Step 1: Flujo email creador**

1. Ir a `http://localhost:3000` → Registrarse → "Regístrate como creador →"
2. Rellenar nombre de creador + email + contraseña → "Crear cuenta de creador"
3. Confirmar email → volver a la app
4. Navbar debe mostrar 5 tabs incluyendo "Mi Estudio"
5. `/mi-estudio` carga con toggle Espectador / Creador

- [ ] **Step 2: Flujo Google creador**

1. Ir a `http://localhost:3000` → Iniciar sesión → "Regístrate como creador →"
2. "Continuar con Google" → OAuth completa
3. Debe redirigir a `/configurar-perfil-creador`
4. Introducir nombre de creador → "Empezar a crear →"
5. Redirige a `/perfiles` → Navbar con 5 tabs

- [ ] **Step 3: Verificar que usuarios normales NO ven Mi Estudio**

Con una cuenta que NO tiene fila en `creator_profiles`: el navbar debe mostrar solo 4 tabs. Navegar manualmente a `/mi-estudio` → debe redirigir a `/mi-espacio`.

- [ ] **Step 4: Verificar toggle en Mi Estudio**

En Mi Estudio, cambiar a "Espectador" → debe mostrar el contenido de Mi Espacio (watchlist, historial). Cambiar a "Creador" → debe mostrar el editor de perfil y el placeholder de upload. Recargar la página → debe mantener el tab activo (sessionStorage).

- [ ] **Step 5: Verificar edición de perfil creador**

En la vista Creador, cambiar el nombre artístico y la bio → Guardar. Recargar → los cambios deben persistir.
