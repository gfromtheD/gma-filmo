-- Directores gestionados (docs/DIRECTORES-GESTIONADOS.md): cuentas que el equipo de GMA crea y lleva en nombre de un autor.
-- La página pública muestra «Perfil gestionado por el equipo de GMA Filmo · Reclamar mi perfil».

ALTER TABLE public.creator_profiles ADD COLUMN IF NOT EXISTS gestionado boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.creator_profiles.gestionado IS
  'Cuenta llevada por el equipo de GMA en nombre del autor. No se puede cambiar desde la web (roles authenticated/anon).';

-- Un usuario puede editar su propia ficha, pero no hacerse pasar por perfil oficial de GMA: desde la web (roles authenticated
-- y anon) el valor no cambia (al crear la fila, siempre false). El servidor y el editor SQL del equipo sí pueden.
CREATE OR REPLACE FUNCTION public.gma_creator_gestionado_solo_servidor() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    NEW.gestionado := CASE WHEN TG_OP = 'INSERT' THEN false ELSE OLD.gestionado END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS gma_creator_gestionado_solo_servidor ON public.creator_profiles;
CREATE TRIGGER gma_creator_gestionado_solo_servidor BEFORE INSERT OR UPDATE OF gestionado ON public.creator_profiles
  FOR EACH ROW EXECUTE FUNCTION public.gma_creator_gestionado_solo_servidor();

-- Primer director gestionado: sus créditos («Pablo Parés») enlazan con /creadores/pablo-pares.
-- Bio a partir de su propio dosier (ficha técnica de Filmatron); la ficha de Mi Estudio de su cuenta manda sobre ella.
INSERT INTO public.artistas (slug, name, bio) VALUES ('pablo-pares', 'Pablo Parés',
  'Director argentino de cine, videoclips y publicidad, especializado en géneros fantásticos: aventura, ciencia ficción y terror. '
  || 'Empezó a filmar a los 12 años y no ha parado desde entonces. Entre sus largometrajes independientes están Plaga Zombie, '
  || 'Filmatron, Daemonium y Grasa, y entre los industriales Chronicle of the Raven y 100% Lucha: El amo de los clones. Ha dirigido '
  || 'más de 50 videoclips (Miranda!, Kapanga, Pimpinela) y más de 50 publicidades.')
ON CONFLICT (slug) DO NOTHING;
