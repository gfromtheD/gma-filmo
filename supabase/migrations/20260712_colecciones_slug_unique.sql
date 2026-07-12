-- Auditoría previa (ejecutada manualmente antes de esta migración): 0 duplicados
-- de slug en colecciones (8 filas: top, evolucion, cortos-cortos, mano-alzada,
-- stop-motion, 3d, adultos, la-pelicula). Aditivo: no toca filas existentes.
CREATE UNIQUE INDEX IF NOT EXISTS colecciones_slug_unique_idx
  ON public.colecciones (slug);
