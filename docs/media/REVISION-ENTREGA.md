# Segunda revisión ejecutora de entrega local — 2026-10-11

Esta es una segunda pasada crítica del mismo ejecutor. No representa revisión independiente de otro agente/persona ni aprobación para producción. Base: rama `feature/upload-engine-v2`, HEAD `c5b3483b137624c96f389e487bb7c4d33897f41a`, esquema local con las 34 migraciones conservadas, incluida `202610080008_title_writes_server_only.sql`.

| Comprobación | Evidencia / conclusión |
|---|---|
| Identidad, roles y dominios de estado | `types/media-engine.ts`, `lib/media/**`, U/I acumuladas. UUID del principal, sesión y medio permanecen constantes en E02; retry cambia generación sin nueva reserva. Estado de transporte/asset/título/job no se sustituye por URL. |
| Recepción autoritativa y fencing | E02 confirma offset HTTP durable después de respuesta perdida y nuevo PID; verifica SHA, solo cola restante y ausencia de READY obsoleto. Suite PostgreSQL y muerte real de gateway pasan en DBs aisladas. |
| Cuotas e idempotencia | E01/E02 consultan SQL: reserve/confirm/release únicos por cuenta para READY; cancel antes de READY tiene confirm=0 y release único. Se corrigió la expectativa del test, no el ledger. |
| Provider y transporte | Registry lazy/contract tests acumulados pasan; Mock en local sin Cloudflare credentials. Bodies de vídeo al gateway, no API Vercel. PeerTube/Stream/P2P desactivados en env owned; rutas de negocio conservan frontera neutral. |
| Auth/RLS/secretos | Suite Auth/PostgREST real y ownership deniega acceso cruzado. DTO/resolvers/firmas cubiertos por tests. Real GoTrue reemplaza JWT sintético en fixtures visuales. Tests externos bloqueados; informes de herramientas no incluyen tokens/query/credenciales. |
| Publicación y lifecycle | E01 prueba main UUID, publicación, catálogo, HLS decodificado, retirada, republish, delete y cuota. Migración server-only conserva su hash. Se preserva el borrador preexistente de A usando B para los nuevos ensayos. |
| Player y UI | Chromium/WebKit/Firefox decodifican HLS/MP4; controles, pistas, seek, progreso y responsive pasan. No rediseño; este cierre corrige estabilidad de la lista de subtítulos mediante memoización. WebKit nativo no expone HTTP status: omisión explícita, denegación/renovación manual probadas. |
| Studio y responsive | 7 casos de navegador Studio, 26 generales y 16 secundarios pasan. Reanudación sin File local exige reselección. Perfiles usan Auth real y UUID real; filtro conserva la vista de fixture cuando cambia query, sin retirar aserciones. |
| Frontera legacy | Columnas/migraciones intactas, suites legacy 52 + navegador 4 + FFmpeg 2 + soporte 7. R2/Stream contratos offline preservados; MP4/HLS con bytes reales. YouTube remoto no contactado ni certificado. |
| Inventario y herramientas | READ ONLY PostgreSQL real deniega escritura; dry-run no aplica ni descarga. Carga 10/6s obtiene 50 respuestas, 0 errores; no benchmark de capacidad. Config PeerTube valida esquema oficial cacheado y mantiene placeholders/no P2P. |
| Rollback | `copy-ZmniPV` en cluster nuevo: source y Auth fingerprints intactos, snapshots y ACL/RLS restaurados, HLS firmado/read/cancel con admisión pausada. Sin reset de fixture ni restore sobre 54342. |
| Release / WIP | TS strict, lint, build local guardado y diff-check pasan. Sin rutas temporales de fixture. 34 migraciones iniciales idénticas, ningún archivo fuente inicial perdido y staging vacío. Snapshot privado de fuentes/patches separado del backup de runtime. |

La superficie modificada respecto a HEAD incluye trabajo anterior de Fases 1–7: 37 de 185 archivos TypeScript de producto ya rastreados (20%, 80% intactos), más 55 archivos de producto añadidos. No equivale al porcentaje de líneas reescritas ni a cambios exclusivos de esta continuación. El snapshot de Fase 1 registra como cambio rastreado previo `lib/uploads/repository.ts` y como WIP no rastreado el plan y `20261007_r2_capacity.sql`; no se puede atribuir todo el árbol a este cierre. `work/phase8-change-inventory.json` compara también el snapshot inicial de esta continuación.

No hay commit autocontenido de Fase 8: necesita base neutral previa no versionada y el WIP 20261007. Se entregan HEAD+manifiesto SHA+patch, sin `git add`. Primero atribuir y revisar la base; después versionar deltas por fase en una copia de integración, según runbook.

Aceptación funcional local: fases 1–8 cerradas con una omisión técnica explicada. Exposición externa bloqueada: audit actualizado y parches de dependencias pendientes, TLS/CORS/SSRF/IPv6 reales, PeerTube/FFmpeg/uploadx reales, backup remoto, dispositivos físicos y benchmarks. No avanzar a una afirmación de servicio VPS operativo desde estos tests locales.
