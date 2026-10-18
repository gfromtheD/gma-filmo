-- ── Retirada de los mensajes directos ────────────────────────────────────────
-- ¡DESTRUCTIVA! Borra las tablas de mensajes directos y todo lo que contengan. La función de mensajería se ha
-- quitado de la aplicación y nada las usa ya. Aplícala solo cuando estés seguro: no se puede deshacer.
-- Idempotente (IF EXISTS). Al borrar las tablas se borran también sus políticas RLS.

DROP TABLE IF EXISTS public.dm_messages CASCADE;
DROP TABLE IF EXISTS public.dm_conversations CASCADE;
