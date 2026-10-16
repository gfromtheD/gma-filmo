-- ── Comentarios: perfil con el que se escribió ───────────────────────────────
-- Idempotente y aditiva. Misma convención que `ratings` y `watchlist` (20260525_profile_isolation):
--   profile_id = ''       → perfil principal de la cuenta
--   profile_id = 'p_…'    → id de un perfil secundario (`sub_profiles`)
-- Permite mostrar en cada comentario la foto/icono y el nombre del perfil elegido en el selector de perfiles.

ALTER TABLE comments ADD COLUMN IF NOT EXISTS profile_id text NOT NULL DEFAULT '';
