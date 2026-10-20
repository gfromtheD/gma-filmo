-- ── Nombre personal y @usuario ───────────────────────────────────────────────
-- Idempotente. Separa los dos nombres de una cuenta:
--   display_name → nombre personal. Privado: solo lo ve su dueño (la RLS de `profiles` ya es solo-propietario).
--   username     → @usuario. Único y público: es el que se ve al comentar y al valorar.
-- Formato del @: de 3 a 20 caracteres, solo minúsculas a-z, cifras y «_». Se guarda sin la arroba y en minúsculas.
-- Las cuentas que ya existen reciben un @ provisional («usuario_123456», sin pistas del nombre personal) con
-- `username_changed_at` NULL: el primer cambio es libre. Después, un cambio cada 30 días como mucho. La base de
-- datos lo hace cumplir con un trigger, así que no depende de la web.
-- Además, la copia del nombre que guardan los comentarios (`comments.display_name`, de lectura pública) deja de
-- ser el nombre personal y pasa a ser el @.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username_changed_at timestamptz;

-- ── Formato ──────────────────────────────────────────────────────────────────
-- Misma regla que lib/profiles/username.ts (USERNAME_PATTERN y RESERVED_USERNAMES).
CREATE OR REPLACE FUNCTION public.username_is_valid(candidate text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT candidate ~ '^[a-z0-9_]{3,20}$'
     AND candidate NOT IN ('admin', 'administrador', 'gma', 'gmafilmo', 'filmo', 'soporte', 'support',
                           'moderador', 'moderacion', 'root', 'sistema', 'system', 'oficial', 'staff');
$$;

-- ── @ provisional ────────────────────────────────────────────────────────────
-- Aleatorio y libre. Solo la llama el trigger (SECURITY DEFINER) y esta migración: no se expone a la API.
CREATE OR REPLACE FUNCTION public.username_provisional()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  candidate text;
BEGIN
  LOOP
    candidate := 'usuario_' || lpad(floor(random() * 1000000)::int::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate);
  END LOOP;
  RETURN candidate;
END
$$;

REVOKE ALL ON FUNCTION public.username_provisional() FROM PUBLIC, anon, authenticated;

-- ── Cuentas existentes ───────────────────────────────────────────────────────
-- Fila a fila, para que cada @ nuevo ya cuente al comprobar que el siguiente está libre.
DO $$
DECLARE
  profile_id uuid;
BEGIN
  FOR profile_id IN SELECT id FROM public.profiles WHERE username IS NULL LOOP
    UPDATE public.profiles SET username = public.username_provisional(), username_changed_at = NULL WHERE id = profile_id;
  END LOOP;
END
$$;

ALTER TABLE public.profiles ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON public.profiles (username);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_format' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_format CHECK (public.username_is_valid(username));
  END IF;
END
$$;

-- ── Reglas al crear y al cambiar el @ ────────────────────────────────────────
--  · Alta sin @ → provisional (sin fecha: el primer cambio es libre). Alta con @ → cuenta como elegido.
--  · Se normaliza: sin espacios, sin «@» delante y en minúsculas.
--  · Un cambio cada 30 días; si no, error «username_cooldown» (P0001).
--  · Nadie puede tocar `username_changed_at` a mano: siempre lo pone el trigger.
-- SECURITY DEFINER: así puede llamar a username_provisional() y ver todos los @ ocupados (la RLS de `profiles` solo
-- deja ver la fila propia).
CREATE OR REPLACE FUNCTION public.profiles_username_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.username IS NULL OR btrim(NEW.username) = '' THEN
      NEW.username := public.username_provisional();
      NEW.username_changed_at := NULL;
    ELSE
      NEW.username := lower(ltrim(btrim(NEW.username), '@'));
      NEW.username_changed_at := now();
    END IF;
    RETURN NEW;
  END IF;

  NEW.username := lower(ltrim(btrim(coalesce(NEW.username, OLD.username)), '@'));
  IF NEW.username = OLD.username THEN
    NEW.username_changed_at := OLD.username_changed_at;
    RETURN NEW;
  END IF;

  IF OLD.username_changed_at IS NOT NULL AND OLD.username_changed_at > now() - interval '30 days' THEN
    RAISE EXCEPTION 'username_cooldown' USING ERRCODE = 'P0001',
      HINT = 'El @ solo puede cambiarse una vez cada 30 días.';
  END IF;

  NEW.username_changed_at := now();
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.profiles_username_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_username_guard ON public.profiles;
CREATE TRIGGER profiles_username_guard
  BEFORE INSERT OR UPDATE OF username, username_changed_at ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_username_guard();

-- ── ¿Está libre este @? ──────────────────────────────────────────────────────
-- Para comprobarlo mientras se escribe. El @ propio cuenta como libre. SECURITY DEFINER porque la RLS no deja ver
-- las filas de los demás; solo devuelve sí/no (los @ son públicos de todas formas).
CREATE OR REPLACE FUNCTION public.username_available(candidate text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH normalized AS (SELECT lower(ltrim(btrim(coalesce(candidate, '')), '@')) AS value)
  SELECT public.username_is_valid(value)
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.username = value AND p.id IS DISTINCT FROM auth.uid()
     )
  FROM normalized;
$$;

REVOKE ALL ON FUNCTION public.username_available(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.username_available(text) TO authenticated;

-- ── Comentarios ya publicados ────────────────────────────────────────────────
-- Su copia del nombre (pública) pasa del nombre personal al @. La web ya muestra el @ actual del autor; esta copia
-- solo se usa si no se encuentra su perfil.
UPDATE public.comments c
SET display_name = '@' || p.username
FROM public.profiles p
WHERE p.id = c.user_id
  AND c.display_name IS DISTINCT FROM '@' || p.username;
