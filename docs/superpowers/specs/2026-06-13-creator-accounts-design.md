# Design: Cuentas de Creador

**Fecha:** 2026-06-13  
**Estado:** Aprobado

## Resumen

Añadir un segundo tipo de usuario: el **creador**. Los creadores se registran desde un entry point en la pantalla de login/registro, se auto-aprueban al instante, y obtienen acceso a una 5ª pestaña en el navbar ("Mi Estudio") con una vista dual espectador/creador. El uploader de contenido queda fuera del scope de este spec.

---

## Scope

**Incluido:**
- Tabla `creator_profiles` en Supabase
- Entry point en login/register para creadores
- Formulario de registro creador (nombre artístico + auth)
- Paso post-OAuth para capturar nombre de creador (Google)
- Hook `useIsCreator` para detectar estado de creador
- Pestaña "Mi Estudio" en navbar (solo visible a creadores)
- Página `/mi-estudio` con toggle Espectador | Creador
- Vista Espectador: reutiliza el contenido de Mi Espacio
- Vista Creador: perfil editable (nombre, bio) + placeholder uploader

**Excluido:**
- Uploader de contenido
- Panel de administración / aprobación manual
- Moderación de contenido subido

---

## Base de datos

### Tabla `creator_profiles`

```sql
create table creator_profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  creator_name text not null,
  bio         text,
  status      text not null default 'approved',
  created_at  timestamptz not null default now()
);

-- Solo el propio usuario puede leer/escribir su fila
alter table creator_profiles enable row level security;

create policy "creator own read"
  on creator_profiles for select
  using (auth.uid() = user_id);

create policy "creator own insert"
  on creator_profiles for insert
  with check (auth.uid() = user_id);

create policy "creator own update"
  on creator_profiles for update
  using (auth.uid() = user_id);
```

**Detección de creador:** existencia de fila en `creator_profiles` para el `user_id` actual. No hay campo de rol en `auth.users`.

---

## Flujo de registro

### Path email

1. Usuario ve la pantalla de login/registro normal
2. Debajo de los botones existe el texto: *"¿Quieres aportar a la plataforma? Regístrate como creador →"*
3. Al pulsar: el card cambia visualmente — título "Únete como creador", subtítulo diferente
4. El formulario de email incluye un campo extra: **Nombre de creador** (texto libre, requerido)
5. On submit: `supabase.auth.signUp(email, password)` + insert en `creator_profiles(user_id, creator_name)`
6. Resultado: cuenta creada + estado creador = `approved`

### Path Google OAuth

1. Usuario activa el modo creador (paso 2 arriba) y pulsa "Continuar con Google"
2. OAuth completa → redirect a `/auth/callback`
3. El callback detecta el param `?creator=1` en el `state` de OAuth y redirige a `/configurar-perfil-creador`
4. Página `/configurar-perfil-creador`: pide solo el **nombre de creador**
5. On submit: insert en `creator_profiles` → redirige a `/perfiles` (flujo normal)

---

## Detección de creador

### Hook `useIsCreator`

```
hooks/use-is-creator.ts
```

- Consulta `creator_profiles` para el `user_id` del usuario autenticado
- Devuelve `{ isCreator: boolean, isLoading: boolean }`
- Cachea el resultado en estado local (no polling)
- Retorna `false` para usuarios no autenticados o invitados

---

## Navbar

### Lógica de tabs

`NAV_ITEMS` se calcula dinámicamente: si `isCreator === true`, se inserta la tab "Mi Estudio" entre "Mi Espacio" y el final.

Orden para creadores:
1. Home → `/inicio`
2. Películas → `/peliculas`
3. Cortos → `/cortos`
4. Mi Estudio → `/mi-estudio`
5. Mi Espacio → `/mi-espacio`

Orden para usuarios normales: igual sin la tab 4.

---

## Página `/mi-estudio`

**Ruta:** `app/(platform)/(protected)/mi-estudio/page.tsx`

**Protección:** requiere auth + `isCreator`. Si el usuario no es creador, redirige a `/mi-espacio`.

**Layout:**

```
┌─────────────────────────────────────┐
│  Mi Estudio                         │
│  [Espectador]  [Creador]  ← toggle  │
├─────────────────────────────────────┤
│                                     │
│  Vista Espectador:                  │
│    → Renderiza <MySpaceScreen />    │
│                                     │
│  Vista Creador:                     │
│    → Nombre artístico (editable)    │
│    → Bio (editable, textarea)       │
│    → Guardar                        │
│    → Card "Subir contenido —        │
│        próximamente"                │
└─────────────────────────────────────┘
```

**Estado del toggle:** persiste en `sessionStorage` para mantener la tab activa entre navegaciones.

---

## Componentes nuevos

| Componente | Ruta | Responsabilidad |
|---|---|---|
| `CreatorRegisterCard` | `components/ui/creator-register-card.tsx` | Formulario de registro creador (email path) |
| `CreatorSetupPage` | `app/configurar-perfil-creador/page.tsx` | Paso post-OAuth: capturar nombre de creador |
| `StudioScreen` | `components/features/studio/studio-screen.tsx` | Página Mi Estudio con toggle dual |
| `useIsCreator` | `hooks/use-is-creator.ts` | Hook de detección de estado creador |

---

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `components/ui/login-card.tsx` | Añadir link "Regístrate como creador" → muestra `CreatorRegisterCard` |
| `components/ui/register-card.tsx` | Añadir link "Regístrate como creador" → muestra `CreatorRegisterCard` |
| `components/layout/navbar.tsx` | `NAV_ITEMS` condicionado por `useIsCreator` |
| `app/auth/callback/route.ts` | Detectar `?creator=1` en state → redirect a `/configurar-perfil-creador` |
| `types/database.ts` | Añadir tipo `creator_profiles` |

---

## Decisiones clave

- **Auto-aprobación:** `status = 'approved'` siempre. Sin workflow de revisión por ahora.
- **RLS en Supabase:** cada creador solo puede leer/escribir su propia fila.
- **Sin rol en auth.users:** la detección es puramente por existencia de fila en `creator_profiles`. Flexible para el futuro.
- **Mi Espacio se mantiene:** los creadores tienen acceso a ambas tabs. No se fusionan.
