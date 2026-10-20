-- ── Notificaciones para creadores ────────────────────────────────────────────
-- Idempotente y aditiva. Por ahora un solo tipo: alguien ha valorado una obra que subió el creador. Una fila por
-- obra y por quien valora: si esa persona cambia su nota, la misma notificación se actualiza y vuelve a «no leída»
-- en lugar de acumular avisos repetidos. No guarda quién valoró de forma visible: solo la nota.
-- Las rutas /api/notifications usan la clave de servicio y filtran siempre por el destinatario; la RLS deja
-- además a cada usuario leer y marcar como leídas solo las suyas.

CREATE TABLE IF NOT EXISTS public.notifications (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,  -- destinatario (el creador)
  kind             text        NOT NULL CHECK (kind IN ('rating')),
  pelicula_id      int         NOT NULL,
  actor_user_id    uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,  -- quien valoró (no se muestra)
  actor_profile_id text        NOT NULL DEFAULT '',
  score            smallint    CHECK (score BETWEEN 1 AND 10),
  created_at       timestamptz NOT NULL DEFAULT now(),
  read_at          timestamptz,
  UNIQUE (user_id, kind, pelicula_id, actor_user_id, actor_profile_id)
);

CREATE INDEX IF NOT EXISTS notifications_inbox_idx ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_read_own" ON public.notifications;
CREATE POLICY "notifications_read_own" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_mark_own" ON public.notifications;
CREATE POLICY "notifications_mark_own" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
