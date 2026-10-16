# Backup y recuperación futuros
Antes de habilitar ingestión, crear snapshot coherente con admisión pausada, executor drenado y uploads pausados. Guardar dump PostgreSQL GMA y PeerTube por separado, storage original/HLS/aux, spool y SHA, manifest de release/migraciones, configuración y claves en destino cifrado restringido. Redis no es fuente de verdad; documentar las colas y su reconstrucción. No restaurar una DB anterior sobre archivos posteriores: fencing y generaciones deben coincidir.

Ensayar restauración en instancia aislada; validar ownership/RLS, conteo y ledger, indexed outputs, SHA, playback privado y cancelación. Retener fuente R2 y snapshots al menos 30 días tras aceptación. No borrar originales como parte del rollback. El ensayo local se implementa con `scripts/media/rollback-local.ts`; no autoriza restauración de producción.


## Decisión D-VPS-TEST-01 — 2026-10-11

Backups externos definitivos aplazados, **NO IMPLEMENTADOS**: Restic cifrado/incremental hacia Linuxcasero/HDD400GB/SSH y B2 paraconfig/DB/datoscríticos con límites actuales por verificar al alta. Diseño/fuentes en `docs/media/BACKUPS-FUTUROS.md`. El requisito inicial antesdeingestión se mantiene para datos únicos/reales; su excepción parafixtures recuperables requiere EX-VPS-PRIVATE-01 aprobada, aislamiento y fuentes conservadas. No source R2real, datos productivos ni garantías de recuperación externa.

Ensayo local anterior COMPLETADO, 69tablas/3Auth/41activos/17títulos/HLS privado; no repetir. Snapshot544fuentes no es backupDB. V.13 requiere backup del original real+DB/metadata/objetos y rollback probado, fuenteR2retenida. No confundir B2 deconfig/DB con copia de películas.
