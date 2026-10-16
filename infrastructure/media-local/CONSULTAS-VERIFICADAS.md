# Preparación auditada de pasos 5.4–5.5

Fecha de la misión: 2026-10-07. Son drafts para integrar cuando se alcance
su orden de dependencia. Ningún archivo final del repositorio se modificó
en esta subtarea.

| Consulta real | Fuente | Elementos incluidos en baseline |
| --- | --- | --- |
| Carga de perfil | `components/providers/user-profile-provider.tsx:97` | profiles UUID/display_name/avatar_color, creator_profiles user_id/avatar_url |
| Restaurar subperfiles | `store/use-profile-store.ts:116` | sub_profiles ID text, owner, campos de selección y created_at |
| Perfil activo | `hooks/use-active-profile-id.ts:12` | perfil principal `''`, subperfil `p_<uuid>`; seed manifiesto conserva ambos |
| Progreso | `hooks/use-progress.ts:23` y `:47` | view_history PK numérica, unique user_id/profile_id/pelicula_id y columnas reales |
| Studio | `components/features/studio/studio-screen.tsx:56` | todas las columnas de profile/titles y FK de colecciones |
| Catálogo | `lib/supabase/queries.ts:244` | SELECT completo + FK artistas/colecciones + orden created_at |
| Scores | `lib/supabase/queries.ts:225` | film_scores security_invoker, rating_count/approval_score/view_count |
| Creador público | `lib/supabase/queries.ts:453` y mapper `:202` | creator_public_profiles y campos españoles del mapper |

El baseline aplica la lista explícita de migraciones 05/06/07/001/002/003/
0031/004/005/006/007 durante el test; no usa glob de históricos ni migrations
de restauración. El fichero final local-stack debe copiar esos fuentes a
timestamps ordenados de 14 dígitos sin renombrar las migraciones originales.

Pruebas verificadas en el draft:

- `local-baseline.test.ts.txt`: 4/4 aprobadas, 0 fallidas, 0 omitidas.
  Auth mínimo solo dentro del test PGlite; verifica todas las migraciones,
  consultas, relaciones numéricas, RLS y contabilidad idempotente local.
- `local-seed.test.ts.txt`: 4/4 aprobadas, 0 fallidas, 0 omitidas.
  Valida guards y contrato doble Auth/PostgREST, no prueba Auth real.
- TypeScript strict: correcto con ambos drafts temporalmente como `.ts`;
  las copias ejecutables se eliminaron después para no interferir con otros
  trabajos. Ningún `any` nuevo.

El test de inventario también rechaza URLs legacy remotas; repetición
posterior a esa ampliación: 4/4 aprobadas, 0 fallidas, 0 omitidas.
Rerun combinado tras añadir migration007 y renombrar el RPC a
`gma_media_local_inventory`: 8/8 aprobadas, 0 fallidas, 0 omitidas.
Log: `work/media-phase5/preparation/baseline/baseline-tests.log`.

Bloqueos conocidos: CLI/Docker/imágenes no disponibles según auditoría del
coordinador. No se descargó nada ni se contactó un servicio remoto. No se
certifican health, bindings Docker loopback, signIn real, PostgREST real ni
E2E. La CLI exacta y lockfile se añaden únicamente cuando haya paquete local
verificable; no inventar una versión ni resolución del lockfile.
