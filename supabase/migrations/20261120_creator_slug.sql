-- Identidad estable del creador: cada ficha de creador (creator_profiles, 1:1 con la cuenta) tiene su propio slug único,
-- que es la URL de su página pública. Las obras se asocian por creator_user_id, no por coincidencia de nombre.
ALTER TABLE public.creator_profiles ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS creator_profiles_slug_key ON public.creator_profiles (slug) WHERE slug IS NOT NULL;

CREATE OR REPLACE FUNCTION public.creator_slug_base(name text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(NULLIF(trim(both '-' from left(regexp_replace(lower(translate(COALESCE(name, ''),
    'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')), '[^a-z0-9]+', '-', 'g'), 50)), ''), 'creador')
$$;

-- Asigna el slug al crear la ficha y lo mantiene fijo: quien llama desde la web (anon/authenticated) no puede ni elegirlo ni
-- cambiarlo. Nunca reutiliza el de otra persona (ni de otro creador ni de un artista histórico de `artistas`).
CREATE OR REPLACE FUNCTION public.creator_slug_assign() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  from_web boolean := COALESCE(auth.role(), '') IN ('anon', 'authenticated');
  base text;
  candidate text;
  n integer := 1;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.slug IS NOT NULL THEN
    IF from_web THEN NEW.slug := OLD.slug; END IF;
    RETURN NEW;
  END IF;
  IF from_web OR NEW.slug IS NULL THEN
    IF from_web THEN NEW.slug := NULL; END IF;
    IF NEW.slug IS NULL THEN
      base := creator_slug_base(NEW.creator_name);
      candidate := base;
      WHILE EXISTS (SELECT 1 FROM creator_profiles WHERE slug = candidate AND user_id <> NEW.user_id)
         OR EXISTS (SELECT 1 FROM artistas WHERE slug = candidate) LOOP
        n := n + 1;
        candidate := base || '-' || n;
      END LOOP;
      NEW.slug := candidate;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS creator_slug_assign ON public.creator_profiles;
CREATE TRIGGER creator_slug_assign BEFORE INSERT OR UPDATE ON public.creator_profiles
  FOR EACH ROW EXECUTE FUNCTION public.creator_slug_assign();

-- Cuentas existentes: las gestionadas conservan la URL que ya tenían en `artistas` (mismo nombre); el resto recibe la suya.
UPDATE public.creator_profiles cp SET slug = a.slug
FROM public.artistas a
WHERE cp.slug IS NULL AND cp.gestionado = true AND public.creator_slug_base(a.name) = public.creator_slug_base(cp.creator_name)
  AND NOT EXISTS (SELECT 1 FROM public.creator_profiles o WHERE o.slug = a.slug);
UPDATE public.creator_profiles SET creator_name = creator_name WHERE slug IS NULL;
