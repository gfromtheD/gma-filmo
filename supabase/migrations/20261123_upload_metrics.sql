-- Métricas agregadas de subida: cuántas sesiones hay por día, tipo de archivo, estado y código de error, con su tamaño.
-- Sin ids, nombres de archivo ni dueños. Cerrada a la web: se consulta desde el editor SQL o con la clave de servicio.
CREATE OR REPLACE VIEW public.gma_upload_phase_metrics WITH (security_invoker = true) AS
SELECT date_trunc('day', created_at)::date AS dia, role, state, last_error_code,
       count(*) AS sesiones, sum(retry_count) AS reintentos, sum(expected_input_bytes) AS bytes_esperados
FROM public.gma_upload_sessions
GROUP BY 1, 2, 3, 4;
REVOKE ALL ON public.gma_upload_phase_metrics FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.gma_upload_phase_metrics TO service_role;
