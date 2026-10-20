-- ── Listas personalizadas de Mi lista ────────────────────────────────────────
-- Idempotente y aditiva. Además de «Guardados» (tabla `watchlist`), cada perfil puede crear sus propias listas
-- («Para ver con amigos», «Animación»…) y añadirles obras. Igual que `watchlist`, se separan por perfil con
-- `profile_id` ('' = perfil principal de la cuenta). Las rutas /api/lists usan la clave de servicio y comprueban
-- siempre el `user_id`; la RLS deja además a cada usuario ver y tocar solo lo suyo.

CREATE TABLE IF NOT EXISTS public.user_lists (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  profile_id  text        NOT NULL DEFAULT '',
  name        text        NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_lists_owner_idx ON public.user_lists (user_id, profile_id, created_at);

CREATE TABLE IF NOT EXISTS public.user_list_items (
  list_id     uuid        NOT NULL REFERENCES public.user_lists (id) ON DELETE CASCADE,
  pelicula_id int         NOT NULL,
  added_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, pelicula_id)
);

ALTER TABLE public.user_lists      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_lists_own" ON public.user_lists;
CREATE POLICY "user_lists_own" ON public.user_lists
  FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_list_items_own" ON public.user_list_items;
CREATE POLICY "user_list_items_own" ON public.user_list_items
  FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.user_lists l WHERE l.id = list_id AND l.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_lists l WHERE l.id = list_id AND l.user_id = auth.uid()));
