-- Requiere colecciones_slug_unique_idx (migración anterior).
-- Idempotente vía ON CONFLICT real sobre restricción única — seguro bajo concurrencia.
-- No borra ni reasigna ninguna colección existente.
INSERT INTO colecciones (slug, name)
VALUES
  ('drama','Drama'), ('thriller','Thriller'), ('documental','Documental'),
  ('experimental','Experimental'), ('comedia','Comedia'), ('terror','Terror'),
  ('ciencia-ficcion','Ciencia ficción'), ('romance','Romance'), ('animacion','Animación')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;
