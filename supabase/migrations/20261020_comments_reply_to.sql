-- ── Menciones por referencia ─────────────────────────────────────────────────
-- Idempotente y aditiva. `reply_to_id` es el comentario concreto del hilo al que se responde (el principal
-- o una respuesta). La mención se muestra con el nombre ACTUAL del autor de ese comentario, así que no se
-- rompe si esa persona cambia el nombre de su perfil. Si el comentario mencionado se elimina del todo,
-- la referencia queda a NULL y la mención deja de mostrarse como nombre.

ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS reply_to_id bigint REFERENCES comments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS comments_reply_to_id_idx ON comments (reply_to_id) WHERE reply_to_id IS NOT NULL;
