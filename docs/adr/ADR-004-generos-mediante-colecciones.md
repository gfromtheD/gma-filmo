# ADR-004: Géneros narrativos mediante el modelo de colecciones existente

## Estado
Aceptado — táctico, reversible.

## Contexto
El selector "Género" del formulario de subida de creadores nunca persistía:
`app/api/titles/route.ts` no extraía `genre` del body, y el valor se perdía
sin error visible. El único canal real de categorización del catálogo es
`colecciones` / `peliculas_colecciones`, pensado originalmente para
colecciones editoriales curadas (TOP, Stop Motion, Mano Alzada, +18...),
no para género narrativo (Drama, Comedia, Terror...).

Auditoría previa a implementar (2026-07-12): 0 slugs duplicados en
`colecciones` (8 filas existentes). `peliculas_colecciones` tiene PK
compuesta real `(pelicula_id, coleccion_id)`. Ninguna de las dos tablas
tenía política RLS de INSERT — solo el service role puede escribir.
`/api/titles` es exclusivamente de creación (no existe `PATCH`/`PUT`;
el modal de edición de metadatos en el estudio no persiste nada, es un
mock de UI).

## Decisión
Reutilizar `colecciones` / `peliculas_colecciones` para género narrativo,
en vez de crear una taxonomía y tabla nuevas.

- Único índice `colecciones_slug_unique_idx` añadido (aditivo).
- 9 géneros sembrados vía `INSERT ... ON CONFLICT (slug) DO UPDATE`
  (idempotente incluso bajo concurrencia).
- Género validado server-side contra una allowlist explícita
  (`lib/genres.ts`) — el cliente nunca envía un `collection_id`, solo
  la etiqueta, resuelta a id en el servidor.
- Creación de película + relación de género hecha atómica vía la función
  `publish_creator_pelicula` (`SECURITY DEFINER`, solo ejecutable por
  `service_role`), porque Supabase JS/PostgREST no soporta transacciones
  multi-tabla desde una Route Handler.
- Selector single-select en UI, API y base de datos (una sola relación de
  género por título) — coherente con `FormState.genre: string`.

## Por qué
- Cero DDL destructivo: reutiliza infraestructura ya probada y con RLS
  ya configurado correctamente.
- `peliculas_colecciones` ya tenía PK compuesta real → inserción idempotente
  sin necesidad de lógica de deduplicación adicional.
- La alternativa (tabla y taxonomía nuevas, `peliculas_generos` separado)
  es especulativa hoy: no hay evidencia de que el producto necesite un
  filtro de género visualmente distinto del de colecciones editoriales.

## Limitación conocida
El caso "cambiar género en edición → eliminar solo la relación cuyo
`coleccion_id` pertenezca a la allowlist de géneros, conservar cualquier
colección editorial" **no está implementado** porque no existe edición
real de títulos todavía. Cuando se construya `PATCH /api/titles/[slug]`,
debe aplicarse exactamente esa regla al tocar género.

## Criterio de migración a taxonomía separada
Migrar a una tabla y relación dedicadas (`generos` / `peliculas_generos`)
cuando género narrativo y colección editorial necesiten filtros, orden o
permisos distintos en el catálogo — por ejemplo, si se quiere una sección
de filtro "Género" visualmente separada de "Colección" en la UI, o si una
colección editorial necesita reglas de visibilidad que un género no debe
heredar.

## Reversión
```sql
DROP FUNCTION IF EXISTS publish_creator_pelicula;
DELETE FROM colecciones WHERE slug IN (
  'drama','thriller','documental','experimental','comedia',
  'terror','ciencia-ficcion','romance','animacion'
);
DROP INDEX IF EXISTS colecciones_slug_unique_idx;
```
El `DELETE` limpia en cascada cualquier fila asociada en
`peliculas_colecciones` vía FK. Revertir además `app/api/titles/route.ts`,
`lib/supabase/queries.ts:169` y `components/features/studio/studio-data.ts`,
y eliminar `lib/genres.ts`.
