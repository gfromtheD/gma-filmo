-- ── Cómo ve cada perfil sus carpetas de Mi lista ─────────────────────────────
-- Idempotente y aditiva. Guarda, por perfil (`profile_id` '' = perfil principal), el orden manual de las carpetas, sus
-- colores, el tamaño, la vista y el criterio de orden, para que el usuario vea lo mismo en todos sus dispositivos.
-- Es un único JSON validado por la ruta /api/shelf-prefs (que usa la clave de servicio y comprueba siempre el
-- `user_id`); la RLS deja además a cada usuario ver y tocar solo lo suyo.

CREATE TABLE IF NOT EXISTS public.user_shelf_prefs (
  user_id     uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  profile_id  text        NOT NULL DEFAULT '',
  prefs       jsonb       NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(prefs) <= 16384),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, profile_id)
);

ALTER TABLE public.user_shelf_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_shelf_prefs_own" ON public.user_shelf_prefs;
CREATE POLICY "user_shelf_prefs_own" ON public.user_shelf_prefs
  FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
