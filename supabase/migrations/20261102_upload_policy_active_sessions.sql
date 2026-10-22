-- ── Subidas activas a la vez por usuario: de 3 a 6 ───────────────────────────────────────────────────────────────────
-- Idempotente. Con 3, un creador que suelta película, tráiler y un par de extras (o varias imágenes) a la vez topaba con
-- UPLOAD_CONCURRENCY_LIMIT. 6 cubre una ficha completa; los topes de bytes y de segundos de vídeo (usuario y global) siguen
-- siendo los que protegen el almacenamiento y el VPS, y el navegador espera turno si aun así se llena.
UPDATE gma_upload_policy SET user_active_sessions = 6 WHERE user_active_sessions < 6;
