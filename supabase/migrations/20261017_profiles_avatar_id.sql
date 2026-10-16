-- ── Avatar del perfil principal en la base de datos ──────────────────────────
-- Idempotente y aditiva. Hasta ahora el avatar elegido para el perfil principal (icono o foto propia)
-- vivía solo en el navegador (localStorage), así que nadie más lo veía. Se guarda en `profiles` con la
-- misma convención que `sub_profiles.avatar_id`: icono del catálogo, ruta propia («/profiles/…»),
-- URL https o imagen incrustada («data:image/…», ya reducida por el cliente). NULL = sin avatar elegido.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_id text;
