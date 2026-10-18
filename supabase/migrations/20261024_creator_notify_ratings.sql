-- ── Preferencia de avisos del creador ────────────────────────────────────────
-- Idempotente y aditiva. Configuración → Notificaciones: el creador decide si quiere que le avisemos cuando
-- valoran sus obras. Por defecto, sí. Las políticas RLS que dejan al creador actualizar su fila cubren la columna.

ALTER TABLE creator_profiles
  ADD COLUMN IF NOT EXISTS notify_ratings boolean NOT NULL DEFAULT true;
