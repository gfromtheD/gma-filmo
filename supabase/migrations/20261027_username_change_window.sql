-- ── @usuario: 3 cambios cada 7 días ──────────────────────────────────────────
-- Sustituye el plazo de «un cambio cada 30 días» (20261025_profiles_username.sql) por una ventana móvil:
-- como mucho 3 cambios del @ dentro de los últimos 7 días. El primero (desde el @ provisional) sigue siendo libre.
-- Idempotente. `username_change_log` guarda las fechas de los últimos cambios; solo lo escribe el trigger.
-- El código web lo lee con tolerancia: si esta migración no está aplicada, la web sigue funcionando con la regla vieja.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username_change_log timestamptz[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.profiles_username_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent timestamptz[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.username IS NULL OR btrim(NEW.username) = '' THEN
      NEW.username := public.username_provisional();
      NEW.username_changed_at := NULL;
      NEW.username_change_log := '{}';
    ELSE
      NEW.username := lower(ltrim(btrim(NEW.username), '@'));
      NEW.username_changed_at := now();
      NEW.username_change_log := ARRAY[now()];
    END IF;
    RETURN NEW;
  END IF;

  NEW.username := lower(ltrim(btrim(coalesce(NEW.username, OLD.username)), '@'));
  IF NEW.username = OLD.username THEN
    NEW.username_changed_at := OLD.username_changed_at;
    NEW.username_change_log := OLD.username_change_log;
    RETURN NEW;
  END IF;

  -- Cambios de los últimos 7 días. Las cuentas que cambiaron antes de esta migración no tienen registro: cuenta su
  -- último cambio.
  recent := ARRAY(
    SELECT t FROM unnest(OLD.username_change_log) AS t WHERE t > now() - interval '7 days' ORDER BY t
  );
  IF cardinality(recent) = 0 AND OLD.username_changed_at IS NOT NULL AND OLD.username_changed_at > now() - interval '7 days' THEN
    recent := ARRAY[OLD.username_changed_at];
  END IF;

  IF cardinality(recent) >= 3 THEN
    RAISE EXCEPTION 'username_cooldown' USING ERRCODE = 'P0001',
      HINT = 'El @ solo puede cambiarse 3 veces cada 7 días.';
  END IF;

  NEW.username_changed_at := now();
  NEW.username_change_log := recent || now();
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.profiles_username_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_username_guard ON public.profiles;
CREATE TRIGGER profiles_username_guard
  BEFORE INSERT OR UPDATE OF username, username_changed_at, username_change_log ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_username_guard();
