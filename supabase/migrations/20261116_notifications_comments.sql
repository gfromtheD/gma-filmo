-- ── Notificaciones de comentarios: respuestas a tu comentario y actividad en tu hilo ─────────────────────────────
-- Idempotente y aditiva sobre `notifications` (migración 20261023). Nuevos tipos:
--   reply  → alguien ha respondido a TU comentario.
--   thread → alguien ha respondido a otro comentario dentro de un hilo que abriste tú (tu comentario es el principal).
-- Cambios: se admiten los tipos nuevos; `comment_id` (el comentario nuevo; 0 en las valoraciones) y `actor_name` (el @ público de
-- quien responde; vacío en las valoraciones, que no muestran quién valoró). La unicidad pasa a incluir `comment_id`, así
-- varias respuestas de la misma persona en la misma obra son avisos distintos, y las valoraciones siguen siendo uno por persona.

DO $$
DECLARE c text;
BEGIN
  -- Tipo permitido: se sustituye el CHECK de `kind` por uno que admita los tipos nuevos.
  FOR c IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'public.notifications'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%kind%'
  LOOP
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', c);
  END LOOP;
  ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN ('rating', 'reply', 'thread'));

  -- Unicidad antigua (sin `comment_id`) fuera.
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.notifications'::regclass AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS comment_id bigint NOT NULL DEFAULT 0;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS actor_name text NOT NULL DEFAULT '';

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_event_unique UNIQUE (user_id, kind, pelicula_id, actor_user_id, actor_profile_id, comment_id);

NOTIFY pgrst, 'reload schema';
