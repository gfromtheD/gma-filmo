-- ── Mi Estudio: métodos de apoyo del creador y consumo real de almacenamiento ───────────────────────────────────
-- Idempotente y aditiva.
--  1) `creator_profiles.donacion_*`: lo que el creador escribe en Mi Estudio para que el QR y el botón «Apoyar» de sus obras
--     lleven a su PayPal, su Patreon o su dirección de Bitcoin. La web vuelve a validar el formato al mostrarlo.
--  2) `gma_my_storage_used()`: bytes que el motor tiene confirmados para la cuenta de quien llama (`gma_upload_quota`,
--     clave `owner:<id>`). La tarjeta de almacenamiento de Mi Estudio sumaba el tamaño de los títulos publicados y no contaba
--     tráilers, extras, imágenes ni obras sin publicar.

ALTER TABLE public.creator_profiles ADD COLUMN IF NOT EXISTS donacion_paypal  text CHECK (donacion_paypal  IS NULL OR char_length(donacion_paypal)  <= 300);
ALTER TABLE public.creator_profiles ADD COLUMN IF NOT EXISTS donacion_patreon text CHECK (donacion_patreon IS NULL OR char_length(donacion_patreon) <= 300);
ALTER TABLE public.creator_profiles ADD COLUMN IF NOT EXISTS donacion_bitcoin text CHECK (donacion_bitcoin IS NULL OR char_length(donacion_bitcoin) <= 120);

CREATE OR REPLACE FUNCTION public.gma_my_storage_used() RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT used_bytes FROM gma_upload_quota WHERE account_key = 'owner:' || auth.uid()::text), 0);
$$;

REVOKE ALL ON FUNCTION public.gma_my_storage_used() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gma_my_storage_used() TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
