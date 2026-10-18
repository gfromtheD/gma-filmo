-- ── Banner del perfil de creador ─────────────────────────────────────────────
-- Idempotente y aditiva. Imagen panorámica que encabeza la ficha pública del creador, junto a su foto/logo
-- (`avatar_url`). Se sube a R2 como el avatar y aquí solo se guarda su URL pública. Las políticas RLS que ya
-- dejan al creador actualizar su fila cubren esta columna.

ALTER TABLE creator_profiles
  ADD COLUMN IF NOT EXISTS banner_url text;
