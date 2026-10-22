-- ── Limpieza automática de trabajos terminados del motor de subidas ──────────────────────────────────────────────────
-- Idempotente. `gma_upload_jobs` crece sin límite: cada subida o borrado pendiente se reencola (reconcile/poll) y deja una fila
-- `done` cada vez (17.000+ filas en 4 días con apenas unas subidas de prueba). Esto borra SOLO trabajos terminales antiguos:
--   · `done` con más de 3 días  · `dead` con más de 30 días (se conservan más para diagnosticar fallos)
-- Nunca toca trabajos pendientes o en curso, ni sesiones, archivos, borradores ni el libro de cuotas.
-- Se ejecuta solo: `gma_upload_schedule()` (la llama el ejecutor en cada ciclo) lo lanza con una probabilidad pequeña y en lotes,
-- así no hace falta pg_cron y nunca hay un borrado enorme de golpe.

CREATE OR REPLACE FUNCTION gma_upload_purge_jobs(p_done_after interval DEFAULT interval '3 days',
  p_dead_after interval DEFAULT interval '30 days', p_limit integer DEFAULT 2000)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE removed integer;
BEGIN
  WITH doomed AS (
    SELECT id FROM gma_upload_jobs
    WHERE (state = 'done' AND updated_at < now() - p_done_after) OR (state = 'dead' AND updated_at < now() - p_dead_after)
    ORDER BY id LIMIT GREATEST(1, LEAST(p_limit, 10000))
  ), attempts AS (
    DELETE FROM gma_processing_attempts WHERE job_id IN (SELECT id FROM doomed)
  ), gone AS (
    DELETE FROM gma_upload_jobs WHERE id IN (SELECT id FROM doomed) RETURNING 1
  )
  SELECT count(*) INTO removed FROM gone;
  RETURN removed;
END $$;

CREATE OR REPLACE FUNCTION public.gma_upload_schedule() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer;
BEGIN
 n=gma_upload_schedule_v2_compat();
 UPDATE peliculas p SET media_delete_state='done'
 WHERE p.media_delete_state='pending' AND NOT EXISTS(SELECT 1 FROM gma_upload_drafts d JOIN gma_upload_sessions s ON s.draft_id=d.id
   WHERE d.title_id=p.id AND NOT s.quota_released);
 -- Mantenimiento: en ~1 de cada 50 ciclos se purga un lote de trabajos terminales antiguos.
 IF random() < 0.02 THEN PERFORM gma_upload_purge_jobs(); END IF;
 RETURN n;
END $$;

REVOKE ALL ON FUNCTION gma_upload_purge_jobs(interval, interval, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION gma_upload_purge_jobs(interval, interval, integer) TO service_role;
REVOKE ALL ON FUNCTION gma_upload_schedule() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION gma_upload_schedule() TO service_role;
