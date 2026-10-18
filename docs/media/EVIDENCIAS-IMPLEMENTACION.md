# Evidencias de implementación del motor multimedia

## Punto de partida

- Plan de referencia: `docs/PLAN-MAESTRO-MOTOR-MEDIA-GMA-FILMO.md` (copia de entrega en el directorio `outputs` del chat).
- Rama inicial: `feature/upload-engine-v2`.
- HEAD inicial: `c5b3483b137624c96f389e487bb7c4d33897f41a`.
- Cambios preexistentes preservados: `lib/uploads/repository.ts` modificado y `supabase/migrations/20261007_r2_capacity.sql` sin seguimiento.
- Evidencia inicial (status, diff no secreto, lista de archivos sin seguimiento, HEAD/rama y remoto) guardada en `work/media-audit/`.
- `npm run test:uploads`: 26/26 pasan.
- `npm run test:uploads:r2`: 23/23 pasan.
- No se ejecutó el proyecto ni se contactó con servicios remotos de producto.

## Seguimiento por fase

| Fase | Estado | Commits/evidencia |
|---|---|---|
| 1. Base, contratos y tests de referencia | Completada | Contratos neutrales, fixture del repositorio WIP, PeerTube v8.3.1 shape tests y suite provider 17/17. |
| 2. Schema, invariantes y repositorio | Completada (2.1–2.8) | Migraciones aditivas 080001–080004 y 0800031; 120 pruebas acumuladas + PostgreSQL nativo; TypeScript strict y diff check correctos. |

Las suites de referencia verifican el código preexistente. Los resultados de cada nueva suite se añadirán cuando exista la implementación correspondiente; no se cuentan resultados simulados o omitidos como pruebas aprobadas.

## Fase 1 — resultado

- `types/media-engine.ts`, `types/playback.ts`: provider keys, filas neutrales, DTO, recibos, transfer descriptors y PlaybackSource versionado.
- `lib/media/contracts.ts`, `errors.ts`, `idempotency.ts`, `provider.ts`: schemas whitelist, errores estables, hash JSON canónico e interfaz común.
- `tests/media/fixtures/peertube/`: respuestas sintéticas sanitizadas de contrato PeerTube v8.3.1. Los SHA256 son de los ficheros locales, no de los fuentes upstream; se declara en README.
- `tests/uploads/repository.test.ts`: verifica batch de assets WIP y lookup output indexado con owner correcto/ajeno.
- `tests/uploads/database.ts` aplica las migraciones 05/06/07 y 080001 en orden. No se modificó la migración preexistente 20261007.
- `tsc --noEmit --incremental false`: correcto tras 1.8.
- `tests/media/*.test.ts`: 17/17 correctas tras corregir los recibos R2 y Stream según sus pruebas autoritativas.
- Baselines de upload: `tests/uploads/engine.test.ts`, `providers.test.ts`, `repository.test.ts` 28/28; `tests/uploads/r2-first.test.ts` 23/23.
- Prueba de contrato PeerTube usa solo HTTP local; no conectó a ninguna instancia remota.

## Fase 2 — resultado

- Paso 2.1: migración nueva aditiva permite provider `mock`/`peertube`, estado de activo `failed`, revisiones/generaciones/errores/verificación, writer lease/fence, estado de borrado y los índices descritos en el plan. Revoca lectura directa autenticada de filas de activos/sesiones que contienen referencias y datos privados.
- `tests/media/states.test.ts`: verifica replay de la migración, campos iniciales de R2, sesión Stream, y que el título legacy mantiene sus valores/URL.
- La migración es una extensión del schema; no se aplicó a Supabase remoto. Falta terminar y validar DB neutralizada con tests completos antes de continuar a 2.2.
- Las APIs superiores siguen fuera de esta fase y deberán consumir el repositorio/facade en las fases posteriores; no se aplicó schema a Supabase remoto.

## Continuación secuencial de Fase 2

Snapshot de continuación: HEAD `c5b3483b137624c96f389e487bb7c4d33897f41a`, rama `feature/upload-engine-v2`. Hashes de los dos WIP previos guardados en `work/media-phase2/preexisting.sha256`; ambos coinciden tras implementar 2.2. No se ejecutan APIs superiores, Studio/Player ni servicios remotos.

### 2.2 — Estado privado, command results y writer receipts

Implementados en 080002: tablas privadas con RLS/grants, trigger session/asset/provider/owner, command_results con recurso único y SHA canónico, chunks inmutables por rango/SHA. RPC claim/renew/release/commit con lease 30 s, fence creciente, tamaño máximo 16 MiB, ruta derivada exclusivamente de sesión/generación/rango/hash y offsets local/upstream contiguos. No toman lock global por chunk.

Validación final: `tests/media/ownership.test.ts` 6/6 y `tests/media/database-concurrency.test.ts` PostgreSQL real 1/1 pasan, sin skips. 20 PIDs/conexiones independientes, un writer, 20 replays producen un chunk, 20 fences antiguos rechazados; el lock global de cuota no bloquea otro transporte. Runner loopback apaga/limpia exclusivamente su instancia. Primer intento detectó `createdb` ausente y formato de timeout inválido; corregidos usando SQL por conexión local y `2s`. **Paso 2.2 cerrado.**

Desviación heredada detectada: 080001 había revocado owner SELECT de activos/sesiones, contrario a §7.2 del plan. Se restaurará la política literal en 080004; los datos sensibles nuevos se guardan exclusivamente en `gma_media_provider_private`, nunca en columnas owner-readable. APIs superiores quedan fuera de esta misión.

### 2.3 — Recibo autoritativo y estados

`gma_media_command` implementa binding durable, queue_verification, receipt, processing/ready/failed, authorize_transfer y delete_confirmed. Primera mutación exige verify/process job, worker, lease, generations y asset CAS; el recibo se valida por proveedor y se guarda privado. El replay idéntico devuelve el estado actual incluso tras finalizar el job y retirar la lease; no degrada processing/ready ni duplica process. Mock/R2 separan verify/process; managed y auxiliares conservan verify. READY exige snapshot, bytes, duración, HLS o normalización verificados y confirma ledger una vez.

Wrappers aditivos protegen observe histórico y `gma_video_command_locked` sin editar 05/06/07. El motor legacy no puede emitir observe/receipt/bind para Mock/PeerTube. Compatibilidad R2/Stream permanece activa.

Validación: lifecycle 13/13, regresión uploads+R2 51/51, TypeScript strict correcto; sin skips. Corregidos binding replay que incrementaba revision y fixture Stream que no reservaba minutos. Pruebas incluyen lost response tras finish_job, callbacks tardíos, generation/lease/worker/revision obsoletos, terminal states y READY duplicado. **Paso 2.3 cerrado.**

### 2.4 — Reserva neutral y retry con contabilidad única

`gma_media_reserve` valida la selección de provider en el servidor, identidad de source, caps por rol, gate de inventario, cuotas draft/owner/global y sesiones activas. Idempotencia se resuelve antes de CAS y conserva provider/respuesta original incluso si cambió el default. Solo Stream reserva segundos comerciales; Mock/PeerTube/R2 mantienen bytes y límite de duración. Retry requiere recibo durable, owner y draft editables, error recuperable y CAS de ambas revisiones; máximo 3, invalida jobs previos, aumenta processing_generation, conserva receipt/transfer_generation y no agrega reserve/confirm. Scheduler deja visible el fallo tras 12 leases agotadas y permite reconciliación pese a jobs dead antiguos.

Validación antes de 2.5: `quota.test.ts` 8/8; `retry.test.ts` 7/7; `lifecycle.test.ts` 13/13; `r2-first.test.ts` 51/51. En PostgreSQL nativo loopback, `database-concurrency.test.ts` 1/1 con 20 conexiones: límite 5/20 reservas, retry concurrente único, misma respuesta tras READY y un job reclamado. `tsc --noEmit --incremental false`, `git diff --check` y hashes de `lib/uploads/repository.ts` y `supabase/migrations/20261007_r2_capacity.sql` correctos. Primer run reveló un parser `CASE` en SQL y tres regresiones; corregidos y suite final sin fallos ni skips. **Paso 2.4 cerrado.**

### 2.5 — Publicación por UUID y snapshots

080003 exige `main_media_id` como identidad de la publicación y lo compara con el slot main del draft; solo publica activos READY del mismo owner y exige que todos los assets adjuntos estén READY. Mock/PeerTube se publican con `playback_kind='media'`, sin colocar IDs/HLS en `r2_video_url`; R2/Stream conservan su mapping histórico. Al reemplazar un título existente se guarda una versión con junctions, playback kind, metadatos y URLs estables por siete días. La cancelación legacy ve esa retención y deja el activo anterior y su cuota intactos durante la ventana. Se añadió la columna aditiva `gma_upload_publications.main_media_id` para que un replay siga comparándose con el UUID original aunque un reemplazo posterior cambie el main actual.

La frontera de compatibilidad de tests modela el enriquecimiento de la futura fachada legacy: cuando un comando histórico R2/Stream no trae main_media_id, el helper deriva el UUID de su junction; la RPC SQL cruda sí rechaza el campo ausente. La fachada productiva que enviará este campo se completa en 2.8, sin editar APIs superiores durante esta fase.

Validación de cierre: `publication.test.ts` 4/4; `lifecycle.test.ts` 13/13; `engine.test.ts` 17/17; `r2-first.test.ts` 23/23 (57/57 total); TypeScript strict pasa; sin skips. Incluye R2→Mock, PeerTube detrás de GMA, Stream histórico, UUID ajeno/ausente/no-ready, replay y retención de siete días. **Paso 2.5 cerrado.**

### 2.6 — Retirada reversible, republish y delete durable

La migración aditiva `2026100800031_media_title_lifecycle.sql` implementa comandos idempotentes de título para editar, retirar, republicar, borrar y restaurar una versión. La retirada mantiene junctions y cuota; el borrado quita primero las referencias visibles y solo avanza a `done` después de confirmar limpieza; restaurar exige mismo propietario, versión retenida, activos READY y CAS monotónico. El purge de cuenta elimina snapshots/resultados privados antes de sus filas padre. Los títulos históricos MP4 y la ruta de limpieza de cuenta preexistente siguen cubiertos.

Validación: `title-lifecycle.test.ts` 4/4, `publication.test.ts` 4/4 y `lifecycle.test.ts` 13/13, sin skips. La regresión Fase 1+2 acumulada también verifica cancelación concurrente, republish, snapshot MP4 y purge con replacement. **Paso 2.6 cerrado.**

### 2.7 — Autorización y outputs indexados

`202610080004_media_delivery_security.sql` limita lectura autenticada de las cinco relaciones del plan al propietario, conserva escritura solo en servidor y niega acceso a provider-private, command results, chunks, outputs y jobs. `gma_media_authorize` verifica draft propio o título permitido y `gma_media_output_authorized` autoriza por ruta exacta indexada. La sincronización de outputs R2/Mock conserva inventario válido en refresh; MIME/tamaño nullable mantienen outputs R2 históricos; Stream/PeerTube no requieren enumeración. El test histórico se actualizó para comprobar SELECT permitido al dueño con RLS, aislamiento del usuario ajeno y denegación de tablas privadas/escrituras.

Validación: `delivery-security.test.ts` 5/5 y regresión R2 de lookup/owner/path; suite acumulada anterior a la última prueba unitaria 119/119, sin skips. **Paso 2.7 cerrado.**

### 2.8 — Repositorio tipado y mappers seguros

Se añadió `lib/media/repository.ts` con los siete accesos neutrales del plan: comandos, lease/chunk, lectura privada server-only, autorización, ciclo de título y restauración. La lease, private state y resumen de autorización validan el shape SQL real; arrays batch se conservan y los composites no se desenvuelven en la fachada. `lib/media/dto.ts` valida filas antes de mapear whitelist: no incluye owner, provider/ref, private state, outputs, delivery path ni URL externa. El progreso usa bytes confirmados y queda limitado al tamaño reservado. `types/database.ts` describe las relaciones multimedia y RPC principales. `UploadRepository` conserva los bloques WIP de batch/lookup indexado, elimina su constructor `any`, valida resultados consultados en los métodos modificados y traduce output inexistente a 404.

Validación: `mapping.test.ts` 3/3, `repository.test.ts` 3/3, `tests/uploads/repository.test.ts` 2/2 y `providers.test.ts` 9/9. La batería completa pasa 120/120 sin skips; PostgreSQL nativo 1/1 con 20 conexiones independientes; `tsc --noEmit --incremental false` y `git diff --check` correctos. La invocación inicial del test nativo dentro de la batería carecía de conexión aislada y falló por configuración; se ejecutó mediante `scripts/media/test-postgres.ts`, que crea y elimina una instancia loopback descartable, y pasó.

#### Cierre de Fase 2

Pasos 2.2–2.8 completados en orden. Se separó el ciclo de título en la migración aditiva `2026100800031_media_title_lifecycle.sql`, entre 0003 y 0004, para mantener commits de schema por etapas; el orden lexicográfico es intencional. No se modificó `20261007_r2_capacity.sql`; su SHA256 sigue igual. `lib/uploads/repository.ts` sí recibió los cambios solicitados por 2.8 y conserva los bloques WIP originales de batch y output registrados en `work/media-phase2/preexisting-repository.diff`; su hash completo cambia por el tipado y la validación añadidos. No se creó commit porque el árbol contiene trabajo preexistente y una migración WIP no rastreada. No hubo push, deploy ni acceso a servicios remotos.

## Fase 3 — adaptadores y procesamiento simulado

La implementación se hizo después de cerrar la Fase 2, en el orden 3.1–3.8. Los cambios son locales. No se llamó a PeerTube, Cloudflare, Supabase remoto ni producción. El WIP anterior y la migración no rastreada `20261007_r2_capacity.sql` se conservaron; no se creó commit.

### 3.1 — Registry perezoso y configuración independiente

`lib/media/config.ts` valida únicamente las variables requeridas por la configuración seleccionada: Mock local funciona sin credenciales R2/Stream/PeerTube, Mock falla fuera de local o con Supabase no loopback, y gates Stream/PeerTube permanecen explícitos. `lib/media/registry.ts` construye adaptadores de forma perezosa y resuelve por provider persistido; cambiar el default solo cambia reservas nuevas. Se agregaron ejemplos sin secretos en `.env.media.example` y `.env.uploads.example`.

Pruebas: `registry.test.ts`, `provider-contract.test.ts` y suites de proveedores/uploads heredadas; 27/27 en el primer bloque focalizado. **Paso 3.1 cerrado.**

### 3.2 — Envolver R2 sin reescribirlo

`R2MediaProvider` delega en `R2VideoProvider`/`AuxiliaryProvider`, conserva multipart, rutas y limpieza histórica, y diferencia ETag de SHA. Las pruebas de adaptador validan ETag, playback por ruta GMA y el margen de borrado existente; `r2-first.test.ts` conserva sus 23 casos.

Pruebas: adapter R2 y regresión de providers/uploads; bloque conjunto 40/40. **Paso 3.2 cerrado.**

### 3.3 — Encapsular Stream como compatibilidad

`StreamMediaProvider` delega tus, recovery, inspección, JWT HLS y borrado sin hacer que otros proveedores requieran credenciales Stream. Auxiliares PeerTube quedan explícitamente no soportados por ese motor. Las firmas/webhooks legacy no se alteraron.

Pruebas: adapter Stream, `providers.test.ts`, suite histórica y cobertura R2; incluidas en los bloques focalizados 40/40 y acumulado de cierre. **Paso 3.3 cerrado.**

### 3.4 — Compartir validación de auxiliares

`lib/media/auxiliary-validation.ts` concentra normalización SRT/VTT y decode, orientación, límite de píxeles, WebP y hash de imagen. `lib/uploads/auxiliary.ts` conserva su API/errores previos y reutiliza esos helpers.

Pruebas: `auxiliary-validation.test.ts` cubre SRT→VTT, UTF-8 inválido, scripts/cues malformados, decode/hash/resizing y límites; incluida en el bloque focalizado 40/40. **Paso 3.4 cerrado.**

### 3.5 — Mock ingest durable y ficheros inmutables

`MockMediaStorage` usa directorios por UUID y generación, chunk files inmutables promovidos con link exclusivo, hash/rango/offset contiguo, reconstrucción del SHA completo, `original.bin`, tombstone de cancelación y claim persistente de escenario one-shot. `MockMediaProvider` separa disco durable de recibos SQL inyectados; el replay idéntico reemite el recibo y no vuelve a escribir el chunk. No se usa `Map` como almacén durable.

Pruebas: reinicio de provider recupera offset exacto; replay de mismo chunk, chunk conflictivo, SHA fuente incorrecto y escritura tardía después de cancelación. Focalizadas `mock-provider`, `registry`, `legacy-adapters`, auxiliares, errores y contrato: 13/13 al cierre focalizado. **Paso 3.5 cerrado.**

### 3.6 — Fixture HLS y simulación de processing

`tests/media/fixtures/hls/` contiene MP4 H.264/AAC de 12 s, master HLS fMP4 con rendiciones 480p/720p e init/segmentos, dos VTT y WebP. `SHA256SUMS` se genera por `scripts/media/generate-fixtures.ts`; `verifyMockFixture` comprueba inventario/hash/referencias y tamaño ≤10 MiB antes de instalar outputs inmutables por generación. `MockMediaProcessing` produce metadatos sintéticos con fixture real, fallo transitorio en generación 1, rechazo y cancelación; no ejecuta FFmpeg sobre un `File` arbitrario.

Ejecución de generación/verificación: FFmpeg y ffprobe locales bajo `Documents/Codex/Temporal/gma-filmo/ffmpeg`; MP4 y ambos playlists/rendiciones decodificados correctamente; tamaño total 3,170,793 bytes en la última generación determinista. Dos ejecuciones consecutivas produjeron el mismo SHA256SUMS y los mismos bytes. Focalizada `mock-processing` + `mock-provider`: 4/4. **Paso 3.6 cerrado.**

### 3.7 — Cliente REST PeerTube server-only

`lib/media/providers/peertube-client.ts` implementa timeout 10 s, OAuth password/refresh con singleflight, validación `/config` + `/users/me` + canal/HLS/tracker, init privado `privacy=3`, uploadx `Content-Range`, query de offset por PUT vacío, cancel, detalle, token privado y delete. La respuesta 308 se maneja como offset, sin seguir redirects. `Location` se limita al origen y endpoint reanudable configurado. Un fallo/timeout incierto en POST de init genera recovery-required y no reintenta la creación. PeerTube queda apagado por gate.

Pruebas locales (fetch doble y servidor loopback): wire `201/308/200`, 404/429/503, token concurrente y renovación singleflight, rechazo de `Location` ajena, y POST con respuesta perdida sin duplicación; `peertube-client` + fixtures `peertube-contract`: 7/7 en el último bloque. **Paso 3.7 cerrado.**

### 3.8 — PeerTube adapter, estados y playback references

`PeerTubeMediaProvider` crea binding sin UUID inicial, guarda `upload_id`/Location/correlación solo en estado privado, recupera offset upstream, exige recibo durable validado por esquema estricto (incluye UUID, tamaño, SHA GMA, generación/correlación) y solo declara READY con estado 1, duración válida y HLS del mismo origen validado. El mapping cubre estados 1–12 y unknown sin convertir desconocidos en READY; retry es observe-only. Playback emite ruta GMA con capability inyectado; nunca OAuth/file token/upstream URL. Auxiliares PeerTube se rechazan. `infrastructure/peertube/README.md` delimita el contrato y el trabajo bloqueado hasta VPS.

Pruebas: todos los estados y unknown, recibo ausente, HLS externo malformado, READY validado y URL privada GMA/P2P none; bloque adapter + cliente + fixtures: 7/7. **Paso 3.8 cerrado.**

### Revisión crítica y alcance pendiente

La salida `getPlayback` presupone que el gateway de la Fase 5 consumirá el namespace/capability y resolverá el HLS privado, y el verificador de recibo es una dependencia inyectada que solo se conectará al spool de la pasarela en 5.2. Esto es una frontera deliberada del Plan Maestro, no integración operativa PeerTube. El endpoint local Mock aún requiere la API/ejecutor y gateway de fases posteriores; no se declara completa la prueba E2E de producto. Las rutas R2/Stream/MP4 históricas permanecen conservadas; la compatibilidad local se verifica en la regresión final más abajo.


#### Cierre de Fase 3

Se completaron 3.1–3.8 en orden y no se inició Fase 4. La ejecución acumulada final de todas las suites `tests/media/*.test.ts` excepto `database-concurrency.test.ts`, más `tests/uploads/engine.test.ts`, `providers.test.ts`, `repository.test.ts` y `r2-first.test.ts`, terminó con **137/137 aprobadas, 0 fallidas, 0 omitidas**. La suite de concurrencia PostgreSQL nativa aislada terminó **1/1 aprobada** con 20 conexiones independientes. `tsc --noEmit --incremental false` y `git diff --check` pasaron en la misma secuencia de cierre.

Regresión dirigida legacy (`legacy-adapters`, `provider-contract`, `playback`, `publication` y las cuatro suites upload anteriores): **59/59 aprobadas**. Comprueba multipart/ETag y gracia R2, Stream/tus/JWT/webhook/status/recovery, reproducción MP4/YouTube, snapshots MP4, publicación y los flujos históricos. Los archivos y endpoints legacy no se retiraron. El fixture HLS se regeneró y decodificó con FFmpeg/ffprobe local; dos regeneraciones consecutivas fueron byte-a-byte reproducibles.

No hubo desviaciones de contrato. Las fronteras pendientes son las previstas: el PeerTube real, el spool/forwarder de pasarela que entrega el recibo PeerTube, API/ejecutor/gateway local completo, Studio y Player se implementan en fases posteriores; no se declara E2E de producto. PeerTube está apagado y no se conectó una instancia. No se creó commit para mantener separado el WIP previo; tampoco se hizo push ni deploy. **Fase 3 queda cerrada; es seguro iniciar la Fase 4**, manteniendo las dependencias de pasarela/capability en sus pasos planificados.

## Fase 4 — coordinación neutral

Snapshot: rama `feature/upload-engine-v2`, HEAD `c5b3483b137624c96f389e487bb7c4d33897f41a`. Estado/diff previos y SHA de migration 20261007 en `work/media-phase4/`. No servicios remotos. El directorio de documentación Next indicado por AGENTS.md no existe en la distribución instalada; se conservan firmas App Router de Next 14 presentes en el código y sus tipos locales.

### 4.1 — Reserva y provisionado

MediaService valida dominio/creator, consulta primero idempotencia y resuelve el proveedor persistido. Registry construye SDKs solo al usar ese proveedor; reserve guarda una intención durable antes de crear y recover no repite POST incierto. Nueva migración aditiva 080005 contiene únicamente coordinación server-only, sin modificar 20261007 ni las anteriores. La API devuelve envelope neutral y distingue creación/replay 201/200. UploadService pasa a fachada neutral; las fixtures de regresión importan explícitamente el coordinador histórico preservado en legacy-service, no la fachada de producto.

Pruebas focalizadas de reserva, hash e invariantes de cuotas: 14/14; primer intento detectó serialización Date del doble PGlite y se corrigió el doble para imitar JSON PostgREST. Lost response conserva un solo create, provider persistido y ledger. Paso 4.1 cerrado.

### 4.2 — Complete autoritativo

Complete valida generación/estado, obtiene el recibo provisional solo del adaptador y lo persiste privado; encola verify una vez, sin llamar receipt ni declarar READY en la route. Los replays no vuelven a finalizar transporte. Pruebas complete + lifecycle: 15/15, incluyendo offset incompleto, SHA incorrecto, staging privado y una sola verificación. Paso 4.2 cerrado.

### 4.3 — Executor y reconciler

MediaService ejecuta jobs durables con leases de 120 s, heartbeat, CAS de generación y polling sin consumir intentos. La route no procesa vídeos; scripts/media/executor procesa solo la fixture Mock y el worker FFmpeg histórico reclama exclusivamente process R2. Receipt se revalida en verify y auxiliares se normalizan dentro del job. La migración 080005 añade coordinación y admite MIME fMP4 video/iso.segment; corrige el object_key auxiliar de forma aditiva.

Pruebas jobs + lifecycle + retry: 22/22; TypeScript strict correcto. Se comprobó fixture HLS real, cuota única, procesamiento excluido en request y lease atrasado rechazado. Paso 4.3 cerrado.

### 4.4 — Lifecycle de sesión

Pausa/resume/cancel usan RPC CAS aditiva bajo lock global; resume exige identidad SHA+tamaño. Retry devuelve snapshot command_results estable incluso después de READY. Cleanup comprueba referencias/writer/provision antes de borrar; binding incierto se recupera y late UUID permanece en estado privado para cleanup. Finalización de cuentas purga SQL solo después de liberar todas las sesiones y llama Auth posteriormente desde executor. Pruebas actions+lifecycle+retry: 23/23. Se corrigió el tipo boolean del singleton SQL durante verificación. Paso 4.4 cerrado.

### 4.5 — DTO de lectura

Draft/session GET son consultas puras owner-only y usan whitelist (metadata de negocio, progreso confirmado, revisiones). No se envían outputs, OAuth, Locations ni estado privado. Errores HTTP v1 incluyen code/message/retryable/requestId; uploadApi tolera temporalmente string legacy y objeto v1. Pruebas service-read+errors: 4/4. Paso 4.5 cerrado.

### 4.6 — Acciones neutrales

Routes transport solo validan/auth y delegan a MediaService. Transfer/retry tienen schemas estrictos; partes están protegidas por protocolo/capacidad, resume renueva descriptor. Envelopes incorporan las revisiones correspondientes. Pruebas transport + actions: 4/4, con 400/401/409 y protocol guard. Se conserva multipart histórico en el adaptador. Paso 4.6 cerrado.

### 4.7 — Publicación y título

POST estricto draft_id/revision/main_media_id delega publicación UUID+snapshot en SQL. Unpublish/republish/delete usan media_revision e idempotencia durable; delete responde pending202 y scheduler confirma done. Detail es whitelist. Cache peliculas se invalida tras publicación/edición/cambio de visibilidad. Gate legacy independiente conserva default histórico según §14, fixture/release neutral lo fija false; no depende del rollback del motor. Pruebas title-service+publication+title-lifecycle: 10/10, y gate false repetido en bloque 5.1. Paso 4.7 cerrado.

### 5.1 — Prerequisito firmado

Signer Ed25519 real por node:crypto y verificador estricto header/claims, máximo4KiB, kid configurado, firma previa a autorización DB obligatoria, TTL900/300s y skew30s. Scope/method/namespace/bytes/generación/resource path se comprueban; GET admite HEAD. Script local genera claves exclusivas con privada0600 en directorio ignorado; no imprime secretos ni modifica entorno. Pruebas capability + title-service: 5/5. Paso 5.1 cerrado como contrato de seguridad; integración gateway HTTP y verificación DB por request pertenecen a 5.2/5.3 y no se implementan aquí.

### 4.8 — Resolución neutral

PlaybackService obtiene main por junction, autoriza antes de emitir fuente, resuelve auxiliares por registry y reserva preview a owner con draft vigente. Las routes title/media/hls no importan SDKs ni hacen branches de proveedor. HLS R2 conserva el helper histórico: manifests≤1MiB y segmentos redirect firmado, lookup indexed y lectura de cabecera sin inventario para segmentos. Auxiliares R2 limitados≤4MiB/MIME verificado; Mock usa URLs capability reales en runtime, transporte Bearer y playback query para Safari. HTTP de fixture legacy solo host/puerto/path exactos bajo modo local Mock+Supabase loopback. Legacy MP4 tiene precedencia, YouTube se parsea con host/ID exactos, sin fuente422.

Pruebas resolver + delivery-security + playback + legacy-adapters: 12/12; incluye preview título null, ajeno404, retiro público404 y capability revocada por SQL tras retirada. Ajustes de verificación: el MIME fMP4 se admite de forma aditiva; outputs R2 históricos permiten mime/bytes nullable; tipos auxiliares y partSize se estrechan explícitamente para strict. Cierre pendiente de batería acumulada.

#### Revisión final y correcciones verificadas

- Reserva concurrente elige created en la misma transacción SQL (un 201 y un replay200); conserva idempotency_key histórico text, sin alterar columna.
- Progreso de lectura usa chunks confirmados persistidos; nunca progreso optimista del navegador.
- Cleanup espera writer y process/verify leases vivos; polling de ausencia pendiente no consume intentos. UUID PeerTube observado después de cancelación se elimina; finalización incierta no libera cuota.
- Stream READY usa el tamaño del recibo durable cuando upstream no informa bytes; offset PeerTube200 acepta el recibo final. Pruebas de integración con adaptador concreto Stream y worker R2 histórico pasan 2/2.
- Prueba API real con auth/registry dobles locales verifica 400/401/409/202/200 y esquemas; recovery de worker y respuesta READY perdida conserva confirmación única.
- El doble VM legacy incorpora la compuerta real nueva; se mantienen todas sus aserciones históricas. No se cambia el comportamiento para ocultar un fallo.
- JSON limitado por bytes UTF-8; valores Unicode no eluden 24KB.

Extensiones aditivas necesarias: migration `202610080005_media_coordination.sql` para intención, leases/poll/claims, CAS, chequeo cleanup y created atómico; operaciones opcionales de adaptador getParts/validateAsset/maintainAsset/readAuxiliary/deliverHls conservan helpers históricos bajo la frontera neutral. Son detalles de coordinación/compatibilidad previstos por Fase4, sin cambios de identidad, roles, cuota, state machine o contratos públicos cerrados. No se modificó migration20261007 ni migraciones Fases1–3.

Alcance: no se implementa 5.2/5.3 ni se afirma gateway HTTP, E2E de navegador o PeerTube operativo. El verificador 5.1 exige callback de autorización DB; el gateway futuro debe aplicarlo a cada recurso y diferenciar la ACL de preview de la de título publicado, con pruebas de retirada. Native HLS consume query capability; no OAuth upstream. Studio/Player esperan sus fases y no deben habilitarse con DTO nuevo hasta su adaptación.

#### Cierre de Fase 4 + prerequisito 5.1

**Cerrados:** 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1 y 4.8. Se ejecutó 5.1 antes de integrar 4.8. No se inició 5.2 ni ninguna fase de Studio/Player.

| Verificación final | Aprobadas | Fallidas | Omitidas |
|---|---:|---:|---:|
| Acumulada Fases1–4 + 5.1, incluye FFmpeg real | 165 | 0 | 0 |
| Concurrencia PostgreSQL nativa, 20 conexiones | 1 | 0 | 0 |
| Regresión dirigida R2/Stream/MP4/YouTube + integración neutral | 63 | 0 | 0 |
| Publicación, snapshots, title lifecycle y playback | 15 | 0 | 0 |

Las dos últimas filas son reejecuciones de subconjuntos, no se suman al total. Total único acumulado+nativa: **166 aprobadas, 0 fallidas, 0 omitidas**. TypeScript `--noEmit --incremental false` y `git diff --check` correctos. FFmpeg real (incluido en165) genera HLS720p/480p, AAC, decodifica segmentos y comprueba corrupción/límites/sandbox. El doble de repositorio del worker ahora reclama process R2 con la misma RPC que producción; no cambia aserciones.

Último caso crítico añadido y comprobado: una excepción del processor en intento12 pasa el job a dead y el activo a failed recuperable con recibo durable; conserva cuota y permite retry generación2. `gma_media_finish_job` hace visible el error atómicamente sin degradar READY ni resucitar generaciones/cancelaciones. Recibo de UUID tardío PeerTube debe coincidir con uploadId/correlación/SHA/tamaño antes de eliminarlo.

Evidencia ejecutable bajo `work/media-phase4/`: `accumulated-tests.log`, `postgres-tests.log`, `legacy-regression-tests.log`, `publication-playback-tests.log`, `typescript-final.log`, `ffmpeg-tests.log` y bloques focalizados por paso. `suites.txt` enumera los ficheros existentes de media, sin nombres de suites supuestos. Comandos usados (Node/tsx y dependencias ya instalados, sin descargas):

```sh
# Con FFMPEG_PATH, FFPROBE_PATH, VIDEO_TEST_TEMP y MEDIA_PYTHON_PATH locales
node --import tsx --test --test-concurrency=1 $(cat work/media-phase4/suites.txt) tests/uploads/engine.test.ts tests/uploads/providers.test.ts tests/uploads/repository.test.ts tests/uploads/r2-first.test.ts tests/uploads/ffmpeg.test.ts
# Con PG_BIN_DIR apuntando a PostgreSQL local; bootstrap aislado loopback
node --import tsx scripts/media/test-postgres.ts
node --import tsx --test --test-concurrency=1 tests/media/legacy-adapters.test.ts tests/media/provider-contract.test.ts tests/media/playback.test.ts tests/media/publication.test.ts tests/media/managed-service.test.ts tests/uploads/engine.test.ts tests/uploads/providers.test.ts tests/uploads/repository.test.ts tests/uploads/r2-first.test.ts
node --import tsx --test --test-concurrency=1 tests/media/publication.test.ts tests/media/title-lifecycle.test.ts tests/media/title-service.test.ts tests/media/playback.test.ts tests/media/playback-service.test.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false
git diff --check
```

No desviación de alcance ni migración destructiva. Extensiones internas aditivas/RPC de coordinación documentadas arriba; no cambian DTO v1 ni estados/identidades/cuotas cerrados. La corrección de agotamiento cubre el criterio de4.3 de no dejar un processing atascado por jobdead. Es seguro iniciar **Fase5 desde5.2** sobre esta base; no equivale a activar producto/PeerTube ni a certificar la pasarela. Esa fase deberá conectar verificador a autorización SQL por petición y probar preview/retirada, spool y reescritura de todos los recursos HLS. E2E de navegador requiere además Studio/Player posteriores.

Rollback local/release: pausar admisión neutral; conservar DB aditiva y executor neutral para sesiones/cleanup ya creados. Volver UI a release previo solo con su gate de altas coherente; no reabrir LEGACY_MEDIA_WRITES_ENABLED por apagar UPLOAD_ENGINE_V2. Nunca revertir destruyendo assets, receipts, cuotas o snapshots. Las rutas/columnas/lectura MP4 y YouTube históricas se conservan.

Rama/HEAD permanecen `feature/upload-engine-v2` / `c5b3483b137624c96f389e487bb7c4d33897f41a`. SHA256 de `20261007_r2_capacity.sql` idéntico al inicial: `d218c7a8230cfbd7e139786397d8bd6e4a1e334886ce852f3fef34af052cbf30`. WIP previo conservado, coordinador anterior preservado en legacy-service. Sin commit: esta implementación depende de migration20261007 y de Fases1–3 todavía no rastreadas/preexistentes; incluirlas mezclaría trabajo previo. No se hizo push, deploy ni contacto con servicios remotos; PeerTube permanece desactivado.

## Fase 5 — continuación desde 5.2 (2026-10-07)

Snapshot previo: `work/media-phase5/preexisting.diff`, `.status`, `.sha256`; se conserva el WIP de Fases1–4 y la migración20261007. 5.1 no se reimplementa. Solo se reutiliza su verificador en la pasarela. Ningún cambio de Studio/Player ni inicio de Fase6.

### 5.2 — progreso de implementación

Pasarela Node HTTP loopback, endpoints transfer/auxiliary, chunks máximos16MiB e iniciales8MiB, capacidad Ed25519 verificada más autorización SQL por solicitud; writerclaim/release con heartbeat5s y fence. Spool privado/inmutable, fsync de fichero y directorio, offsets recuperados verificando SHA de los chunks; un orphan de disco se reconfirma en SQL bajo un nuevo lease. Original ensamblado por streaming y SHA completo antes del receipt. PUT vacío devuelve308/Range inclusivo o200 al terminar; HEAD no se usa para uploadx. Sin cuerpos de vídeo en routes Next.

RPC aditiva `202610080006_media_gateway.sql`: checkpoint privado del gateway con lease/generation/fence y estado válidos, lock global→session compatible con neutral commands; evita guardar un receipt desde writer antiguo tras takeover/cancel. No modifica migraciones anteriores. Se prueban también pérdida de la respuesta final, restart y shortage507 antes del commit. Parte PeerTube de forwarding/recovery se valida únicamente con dobles locales; permanece desactivada en configuración.

Requisito local detectado para5.4–5.8: no hay Docker/SupabaseCLI ni CLI en caché. El plan5.4 permite documentar esa ausencia, pero no certificar Auth/PostgREST/E2E. La prohibición de contactar servicios remotos impide descargar CLI/imágenes. Se preparará el stack con guardas y evidencia, sin suplantar SupabaseAuth mediante fixtures SQL.

5.2 verificado: `5.2-transfer.log`9/9 (HTTP Mock/aux, orphan/restart, lostfinalresponse, shortage, hash y writer), regresión de contratos/repositorio/verificador10/10, forwarding/recuperación PeerTube y contratos15/15 según suite del adaptador; PG nativo1/1 con20conexiones. No skip. La cancelación durante últimoPUT retiene cuota; el cleanup recupera únicamente una correlación privada única con checkpoint SHA/bytes/finalizingAt, borra su UUID tardío y confirma release una sola vez. Sin POST duplicado ni READY tardío. TypeScript y diff se vuelven a ejecutar en el cierre acumulado. Paso5.2 cerrado en ámbito local/dobles; PeerTube real sigue apagado.

Revisión crítica5.2 posterior: se encontró un temporal de ensamblado que podía quedar tras error de I/O. Corregido mediante finally de todo el intento, control del espacio necesario para original y reuso del original ya verificado al consultar tras respuesta perdida. Prueba de fallo real de lectura durante pipeline comprueba ausencia de `.complete-*` antes del retry. La integración de5.3 no avanza sin repetir recuperación/regresión afectada.

Corrección final de fencing5.2: la secuencia definitiva es **pending privado por fence/rango/SHA → fsync → commit SQL fenced → promoción inmutable → respuesta**. SQL es autoridad del offset. Si el commit es incierto o rechazado, nunca se promueve ese pending; al reiniciar solo se recupera un pending cuyo fence/rango/SHA constan en el recibo SQL. Un orphan sin recibo no adelanta el offset: el navegador debe reenviar el tramo y confirmarlo bajo lease actual. Esto reemplaza la adopción indiscriminada de ficheros de la primera versión. Pruebas multi-instancia con takeover reproducen la carrera y comprueban que solo el escritor vigente genera chunk canónico; recovery SQL→disco también comprobado. No se alteraron paths SQL ni DTO.

### 5.3 — integración HLS privada

Parser nuevo `lib/media/hls-parser.ts` separado del helper MPEG-TS R2; acepta URI de líneas y atributos MAP/MEDIA/I-FRAME, rechaza cifrado/KEY distinto de NONE, URI externos, traversal, query/fragment/redirect arbitrarios y construcciones no soportadas. Mock entrega exclusivamente outputs indexados y tamaño/MIME verificados, paths privados sin symlinks externos, Range único206/416 (incluye suffix/open), HEAD sin cuerpo y VTT/WebP/MP4 sintéticos de allowlist. Todas las referencias reescritas conservan capacidad, responses privadas no-store y CORS exacto. Helper preparado PeerTube valida origen/prefijo oficial y nunca entrega tokens OAuth/URLs upstream; transporte PeerTube real no se habilita en gateway local.

Migración aditiva007 `media_gateway_grants`: hash de la capacidad con contexto server-only (preview propio, título público, título propio retirado o avatar activo). No cambia la firma ni claims cerrados de5.1. SQL revalida estado/generation/referencia en cada output; token público no se convierte en preview después de retirar. PlaybackService registra el contexto tras emitir la fuente neutral. GrantFK conCASCADE permiten purga existente. Un avatar cambiado revoca su grant anterior.

Batería gateway inicial `5.3-gateway.log`:33/33sinfallos/omisiones; incluye upload/recovery/fencing, PeerTube double, HLS real con decodificación FFmpeg de vídeo+audio, Range/HEAD/CORS, dosVTT, y ACL. Regresión control/publish7/7 (`5.3-control.log`), recuperación/proveedor/legacy8/8 (`5.3-regression.log`). Revisión independiente adicional3/3 (spool2+avatar1) cubierta también en batería anterior. El cierre final repite todo tras el límite del grafo HLS y los runners.

### 5.3 — cerrado localmente

Última suite HLS11/11 y PeerTube gateway7/7:18/18, TypeScript strict y diffcorrectos. Se añadió validación del grafo completo por snapshot: ciclos, profundidad≤4, referencias agregadas≤10.000, ≤1MiB/manifest y ≤10MiB de manifests en total. No se modificó `lib/uploads/hls-delivery.ts`. La configuración real privada PeerTube/tokens upstream permanece enV.9; Player visual P01/P03 corresponde aFase7, no se simula aquí.

### 5.4 — baseline preparado y auditado; runtime pendiente

`infrastructure/media-local/{baseline.sql,config.toml,README.md,CONSULTAS-VERIFICADAS.md}`. Baseline incluye tablas, FKs/joins y columnas reales de catálogo/Studio/creadores/perfiles/progreso (ID película bigint/numeric y profile text), permisos/RLS y marcador de fixture privado. Auth/roles son propiedad del stack real; baseline falla si no existen, nunca los recrea. La suite SQL usa un Auth double explícito solo en PGlite para auditar esquema. Migraciones motor aplicadas por lista explícita hasta007, incl20261007sin cambios y titlelifecycle0031 en su orden lógico.

Pruebas SQL4/4,0fallidas/omitidas (`5.4-baseline.log`): queries reales/joins, separación owner y público, baseline no destructivo, inventario idempotente sin modificar reservas existentes. No se instaló la dependencia SupabaseCLI exacta ni se fabricó versión/lockfile: no hay paquete en caché y están prohibidas las descargas remotas. Docker/CLI/health/bindings/consultas con Auth/PostgREST reales pendientes. **5.4 no se declara cerrado**; se continúa preparando los pasos dependientes sin ejecutar seed/stack inexistente.

### 5.5 — seed preparado; Auth real pendiente

`scripts/media/local-seed.ts`: users creatorA/creatorB/viewer propios con metadata de fixture mediante Authadminlocal, passwords de test y signIn real; perfiles/sub_profiles, creatorpublicprofiles, artistas/junctions, géneros, película legacyMP4 y VTT/poster canónicos deallowlist. El marcador privado/URL/project se comprueban antes de mutar; un email existente ajeno se rechaza. Inventario RPC local una sola vez, conserva ledger/reservas neutrales. Consultas reales Auth/PostgREST y ownership/catálogo/progreso se verifican dentro del seed cuando exista stack.

Pruebas del contrato con doble explícito4/4 (`5.5-seed.log`),0fallidas/omitidas. No se ejecutó el seed contra un servidor ni se fabricó JWT. Reseed/signIn/joins reales dependen de5.4runtime; **5.5 no cerrado**. Se prepara el runner sin ejecutar operaciones dependientes sobre infraestructura inexistente.

### 5.6 — runner aislado y PostgreSQL local

Se implementó `scripts/media/local-stack.ts` con prepare/start/stop/reset y ownership de `work/media-local`; lista de migraciones explícita (baseline + 11 fuentes, incluida 20261007 intacta y 202610080007), copia ordenada, hash de fuentes/config, detección de symlinks y preservación de archivos/env no propios. El estado local se fija al proyecto exacto `gma-filmo-media-local`, URLs loopback/puertos configurados, bind Docker real `127.0.0.1`, contexto Unix local, nombres de contenedor del proyecto y manifiesto/pin/imágenes presentes. El runner no usa link, reset remoto, `npx` ni descarga.

Las credenciales de fixture son aleatorias, estables y 0600 dentro del workspace ignorado; los procesos hijos reciben un entorno nuevo que vacía todas las claves R2/Cloudflare/Stream/PeerTube/proxy y conserva PATH/variables básicas. La preparación de las fuentes de Next solo mapea CSS y WOFF2 que ya existen localmente, valida SHA y mantiene manifiesto; el arranque aborta si faltan. Se registran scripts npm de grupos de medios según §20.2 y `media:preflight`.

Verificación local: `local-runner.test.ts` **7/7**, `prepare` real copió 12 fuentes a staging y generó/validó el mapping offline de las fuentes; test unitario de medios **33/33**. `test-postgres.ts` ejecutó el cluster efímero propio y la prueba de concurrencia PostgreSQL **1/1** con 20 conexiones. No quedaron procesos PostgreSQL activos.

El intento controlado `media:local:start` terminó con `MEDIA_LOCAL_SUPABASE_CLI_MISSING` antes de invocar Docker. No hay CLI fijada/verificable en node_modules/lockfile ni Docker accesible, por lo que Auth/PostgREST y start/stop reales quedan pendientes. El runtime-images.json no se inventó: se necesita la lista de imágenes y digests correspondiente a una CLI aprobada que pueda obtenerse de una caché local autorizada. Paso 5.6 preparado y comprobado con PostgreSQL nativo/guardas, **pendiente de aceptación de stack**.

### 5.7 — CSP, preflight y tipos de esquema

`next.config.mjs` conserva R2, Stream, YouTube y orígenes históricos. Añade API/Auth/PostgREST/WebSocket `127.0.0.1:54341` y gateway `127.0.0.1:4319` solo cuando coinciden conjuntamente entorno local, aislamiento, project ID, ambos providers Mock, PeerTube/Stream apagados y ambas URLs Supabase/gateway exactas. El allowlist Next Image añade únicamente poster público del fixture local. Si no hay R2 URL heredada, conserva el hostname histórico por defecto para que la configuración de imágenes no quede inválida.

`types/database.ts` añade tipos explícitos para `creator_public_profiles`, grants de gateway, marcador local y RPC de renew/release/state/grant/output/inventory, sin borrar el mapping histórico. `local-schema-types.test.ts` contrasta en compilación y SQL las columnas nuevas. `.env.media.example` no incluye claves reales. `preflight.ts` lee exclusivamente el env fixture marcado/hash-validado y exige puertos/protocolos locales, storage propio, claves Ed25519 concordantes/permisos privados y providers externos apagados; no consulta Cloudflare.

Tests finales `csp-local.test.mjs`, `local-schema-types.test.ts` y `preflight-local.test.ts`: **4/4**; reejecución CSP tras preservar el fallback R2: **2/2**. TypeScript strict pasó después de hacer el env de tests estructuralmente compatible con `ProcessEnv`. La primera ejecución encontró dos assertions de test incorrectas (columnas en línea y orden de validación); se corrigieron y la batería final pasó completa. Sin browser/stack Supabase no se afirma CSP de navegador ni login real. Paso 5.7 preparado y verificado por configuración/test offline; su aceptación de ejecución sigue ligada a 5.4–5.6.

### 5.8 — backend local antes de UI

Integrada la prueba OS en `tests/media/gateway-process.test.ts` y su proceso hijo. Runner nativo crea dos bases desechables distintas en su propio cluster PostgreSQL: concurrencia y reinicio de gateway. La prueba mata un PID justo tras commit SQL y antes de promover el pending; otro PID recupera el recibo/fence, continúa por HTTP, resuelve respuesta final perdida sin duplicar SHA/receipt/reserva, procesa y publica, entrega HLS/Range/CORS, revoca al retirar y completa el borrado/release de cuotas. La conexión directa al test se protege mediante flag de aislamiento, loopback y nombre DB exacto. No se añade a los grupos genéricos ni toca rutas/UI. Auth del test nativo es fixture SQL explícita; no acredita Auth de Supabase.

Ejecución integrada `scripts/media/test-postgres.ts`: **2/2** (20 conexiones PostgreSQL + reinicio OS gateway), 0 fallidas/omitidas. Una ejecución manual directa de `gateway-process.test.ts` sin flags/URL se rechazó con `MEDIA_GATEWAY_PROCESS_ISOLATION_REQUIRED`; es el guardado fail-closed esperado y no forma parte del conteo de batería. El grupo de integración/Auth real sigue pendiente del CLI y runtime.

#### Estado acumulado de 5.4–5.8 antes del cierre global

El baseline/seed y las suites de contrato están preparados y pasan dobles SQL/HTTP locales. No se certifican stack real Supabase, Auth admin/signIn, PostgREST seed, CSP en navegador ni reset/reinicio de Supabase porque falta el runtime permitido. Por tanto 5.4–5.8 continúan **verificados parcialmente/preparados**, no se declaran cerrados hasta ejecutar esa aceptación con Supabase local real. No se activa PeerTube y no se inicia Fase6.

#### Batería final Fases 1–5 y resultado de cierre

Rama/HEAD verificados al terminar: `feature/upload-engine-v2` / `c5b3483b137624c96f389e487bb7c4d33897f41a`. SHA de `supabase/migrations/20261007_r2_capacity.sql` igual al snapshot previo (`d218c7a8230cfbd7e139786397d8bd6e4a1e334886ce852f3fef34af052cbf30`). `git diff --check`: limpio. TypeScript strict `tsc --noEmit --incremental false`: aprobado. No se generó lockfile inventado ni se añadió CLI Supabase sin su paquete/cache verificados.

Batería acumulada local final: **215 aprobadas, 0 fallidas, 0 omitidas** (`work/media-phase5/final-accumulated.log`); incluye todas las suites `tests/media/*.test.ts`/`.mjs` salvo los dos procesos que exigen runner PostgreSQL, y suites legacy uploads/providers/repository/R2/FFmpeg. La primera ejecución completa dio 214/215 porque el directorio temporal indicado a FFmpeg no existía; se creó localmente y se repitió toda la batería, que terminó 215/215. FFmpeg real aislado pasó además 2/2. Conteos de grupos exigidos (son subconjuntos/repeticiones y no se suman a 215): `test:media:unit` 33/33; `test:media:integration` 27/27; `test:media:peertube-contract` 2/2; `test:media:concurrency` con PostgreSQL nativo 2/2, incluidas 20 conexiones y reinicio OS del gateway. Regresión R2/Stream/MP4/YouTube dirigida 37/37; publicación/playback 15/15; CSP/tipos/preflight 4/4; runner 7/7; baseline 4/4; contrato de seed 8/8. Ninguna suite final registró fallos u omisiones.

La prueba del runner muestra que el arranque real se bloquea sin efectos externos: el comando `media:local:start` devuelve `MEDIA_LOCAL_SUPABASE_CLI_MISSING` antes de invocar Docker. Tampoco están disponibles Docker, runtime-images.json verificado ni una CLI fijada. Por tanto siguen sin prueba Auth admin/signIn, PostgREST, migración en Supabase real, reset/start/stop de contenedores, seed real, browser bajo CSP y E2E Auth→catálogo. La ejecución directa del test de reinicio sin su URL/flag devuelve `MEDIA_GATEWAY_PROCESS_ISOLATION_REQUIRED`, guard fail-closed esperado; el runner nativo sí lo ejecutó y aprobó 1/1.

**Cierre honesto:** 5.2 y 5.3 quedan cerrados y revalidados en local/dobles. 5.4–5.8 tienen implementación y pruebas offline/native PostgreSQL, pero quedan **parciales, no cerrados** hasta disponer del runtime local Supabase autorizado y ejecutar la aceptación real requerida. Fase5 no se declara CERRADA; no es seguro iniciar Fase6. No hubo llamadas a producción, servicios remotos, VPS, push ni deploy. No se creó commit: el árbol aún contiene WIP previo staged/unstaged/untracked y migration20261007 que el usuario pidió preservar sin absorber en un commit.

### Actualización de runtime local — 2026-10-08

Homebrew 7.0.8 ya quedó instalado por el usuario. Docker Desktop 4.94.0 está instalado y abierto; `docker info` y `docker compose version` pasan (Docker Engine 29.8.2 / Compose 5.5.1, contexto local `desktop-linux`). Node/npm del proyecto no están en PATH de esta sesión, así que se usó el runtime Node local de Codex solo para ejecutar npm; la dependencia de desarrollo `supabase` y package-lock quedaron fijados exactamente en **2.120.0**. `npx supabase --version`/binario del proyecto devuelve2.120.0. `media:local:prepare` pasó y creó/validó la fixture aislada. Se descargaron únicamente las siete imágenes oficiales correspondientes al stack local y se registraron en `infrastructure/media-local/runtime-images.json`; no hubo login/link ni conexión a un proyecto Supabase alojado.

El primer arranque confirmó PostgreSQL, Auth y PostgREST saludables, pero Docker publicó los puertos Supabase en `0.0.0.0`/IPv6. La prueba se detuvo y `supabase stop` apagó solo `gma-filmo-media-local`, conservando sus volúmenes. Se probó la red Docker exclusiva con `host_binding_ipv4=127.0.0.1` y la CLI `--network-id`; Docker Desktop siguió mostrando bindings `0.0.0.0`. El runner continúa fail-closed en `assertContainerLoopback`; `media:local:start` no alcanzó seed, gateway ni Next. **No aprobar la exposición externa** y no certificar 5.4–5.8 hasta obtener bindings loopback observables.

Corrección local incorporada: `localRuntime` acepta el contexto Docker Desktop actualmente seleccionado si y solo si su endpoint es un socket Unix; sigue rechazando `DOCKER_HOST`/`DOCKER_CONTEXT` heredados y endpoints TCP/SSH. La suite de runner pasa9/9. La publicación de puertos por la CLI es una limitación observada del runtime/CLI y está pendiente de una solución que mantenga la garantía loopback del plan.

Verificación final de esta sesión: `tests/media/*.test.ts`/`.mjs` (salvo los dos procesos incluidos en el runner PostgreSQL) **163/163**, 0 fallidas/omitidas; `test:media:unit` **33/33**; `test:media:integration` **27/27**; `test:media:concurrency` **2/2** con 20 conexiones PostgreSQL y reinicio OS; `test:media:peertube-contract` **2/2**; `test:uploads` **28/28**; `test:uploads:r2` **23/23**; `local-runner.test.ts` **8/8**; `media:local:prepare` aprobado; CLI exacta comprobada **2.120.0**; TypeScript strict aprobado; `git diff --check` limpio. El primer intento del grupo de 163 registró 162/163 únicamente porque faltaba el ejecutable FFmpeg; tras instalar FFmpeg9.0.2 se repitió la batería completa y pasó163/163. La concurrencia requiere el clúster desechable local; PostgreSQL17.11 se instaló sin arrancar su servicio de sistema.

No se certifican seed real, login Auth, migraciones consultadas por PostgREST, runner gateway/executor/Next, CSP/CORS en navegador ni E2E autenticado: `media:local:start` fail-closed al comprobar que Supabase CLI crea bindings `0.0.0.0`/IPv6. Auth/PostgREST respondieron HTTP200 y Studio/Inbucket HTTP307/200 durante el arranque diagnóstico directo; se apagaron solo los contenedores del proyecto y el volumen PostgreSQL local quedó preservado. Por ello **5.4–5.8 siguen ABIERTOS y Fase5 no puede declararse CERRADA; no iniciar Fase6**. La siguiente intervención requerida es resolver el binding loopback del Docker Desktop/Supabase CLI y volver a ejecutar `media:local:start`; el runner no acepta una exposición externa.

### Revalidación tras configuración Docker Engine — 2026-10-08

Se verificó `Docker Desktop 4.94.0`, Engine `29.8.2`, Compose `5.5.1`, contexto `desktop-linux` con socket Unix local. En el panel Docker Engine el JSON guardado muestra literalmente `default-network-opts.bridge["com.docker.network.bridge.host_binding_ipv4"] = "127.0.0.1"`; Apply aparece desactivado porque no hay cambios pendientes. Se reinició Docker Desktop y `docker info` volvió a responder.

Prueba aislada posterior al reinicio: red nueva con `--opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1` inspecciona esa opción como `127.0.0.1`; aun así, al publicar un puerto sin IP en un contenedor PostgreSQL temporal, `docker inspect` informa `HostIp=0.0.0.0` y `HostIp=::`, y `lsof` confirma un listener `*:54345`. El contenedor y la red de prueba se eliminaron al terminar; no había contenedores activos, no se tocó el volumen `supabase_db_gma-filmo-media-local`. Por tanto los puertos reales no quedan certificados como loopback incluso con la configuración aplicada, y no se ejecutó `media:local:start`: el supervisor lo rechazaría y está prohibido aceptar una exposición no local.

Revalidación sin mutar WIP: `media:local:prepare` aprobó; `test:media:unit` 33/33; `test:media:integration` 27/27; `test:media:concurrency` 2/2 (20 conexiones y reinicio OS); `test:media:peertube-contract` 2/2; `test:uploads` 28/28; `test:uploads:r2` 23/23; `local-runner.test.ts` 8/8; TypeScript strict y `git diff --check` aprobados. 0 fallidas/omitidas en estos grupos. `supabase` local exacta 2.120.0 disponible. No hubo llamadas a Supabase remoto, producción, VPS o PeerTube.

Resultado: la configuración está guardada, pero la comprobación efectiva de puertos falla. No se intentó seed ni navegador porque Auth/PostgREST no se arrancaron bajo una publicación no loopback; 5.4–5.8 siguen abiertos y la Fase5 no se cierra. Migración `20261007_r2_capacity.sql` conserva SHA256 `d218c7a8230cfbd7e139786397d8bd6e4a1e334886ce852f3fef34af052cbf30`; el volumen local permanece. No hubo commit, push ni deploy.
## Cierre final Fase 5 con Supabase local real (2026-10-09)

Esta sección supersede los estados anteriores de bloqueo/parcialidad de 5.4–5.8, que describían ejecuciones previas a la instalación y configuración correcta de Docker Desktop. Se completaron exclusivamente contra el proyecto aislado `gma-filmo-media-local`; no se usaron `login`, `link`, push/reset remotos, credenciales alojadas, VPS, PeerTube real, push Git ni deploy.

**Resultado: 5.4, 5.5, 5.6, 5.7 y 5.8 aceptados y Fase 5 CERRADA para el entorno local.** Docker Engine 29.8.2 y Compose 5.5.1; Supabase CLI local exacta 2.120.0; PostgreSQL, Auth, PostgREST, Studio e Inbucket saludables. Gateway y Next/GMA respondieron en sus health checks. `lsof` confirmó los puertos del stack en `127.0.0.1`/`::1` (DB 54342, Studio 54343, API 54341, Inbucket 54344–54346); gateway 4319 y GMA 4318 quedaron ligados a `127.0.0.1`. Ningún puerto quedó publicado en una interfaz de red externa.

La aceptación final con Chromium y las APIs reales locales pasó **9/9**, en `work/media-phase5-final/local-stack-live-after-008.log`: login Auth bajo CSP, seed/reseed idempotente de perfiles y catálogo, reserva/upload HTTP por chunks, pausa/reanudación, SHA, procesamiento READY, aislamiento entre creadores y denegación de lectura directa de tablas privadas, publicación por UUID, HLS privado con capacidades, VTT, Range/HEAD/CORS, retirada, republish, borrado con contabilidad única y lectura de contenido MP4 histórico. La página GMA generó **0 solicitudes salientes**; la protección local bloqueó 14 solicitudes de fondo ajenas a la fixture. No se interceptaron ni simularon respuestas Auth/PostgREST/gateway del flujo aceptado.

El runner real pasó **4/4** (`work/media-phase5-final/local-runner-live-closure.log`): preservó bytes y SHA del upload parcial tras stop/start; completó fallo/retry conservando identidad y cuota; canceló y eliminó limpiando spool y liberando la contabilidad una sola vez; el reset/start final dejó cero sesiones/jobs/objetos residuales, con seed, claves locales y hash de `20261007_r2_capacity.sql` estables. También se cubrió la recuperación segura de estado supervisor obsoleto: solo ante PID inexistente y usando la CLI local fijada al `--workdir` fixture. No se acepta PID activo o no verificable.

| Verificación final | Resultado |
| --- | ---: |
| Batería acumulada Fases 1–5, `acumulada-final.log` | 222/222; 0 fallidas, omitidas o canceladas |
| `test:media:unit` | 33/33 |
| `test:media:integration` | 27/27 |
| `test:media:concurrency` | 2/2 suites nativas (PostgreSQL concurrente y gateway con SIGKILL/reinicio) |
| `test:media:peertube-contract` | 2/2 |
| `test:media:local-runner-live` | 4/4 |
| `test:media:local-live` tras aplicar migración 0008 | 9/9 |
| TypeScript `--noEmit --incremental false` | correcto |
| `git diff --check` | correcto |

Las suites unitarias, integración y contrato PeerTube son subconjuntos de la batería acumulada y no se suman otra vez. En total hubo **237 ejecuciones de test únicas**, sin fallos, skips ni cancelaciones. La batería cubrió también reproductor y regresión R2/Stream/MP4/YouTube, contratos PeerTube, auxiliares, HLS/Range/CORS, SQL/mappers/ownership/cuotas/idempotencia y FFmpeg local fixture. Los archivos de salida citados están bajo `work/media-phase5-final/` y no contienen credenciales.

La prueba Auth/PostgREST detectó que un cliente autenticado podía mutar directamente `peliculas` saltándose el ciclo READY/publicación. Se corrigió el baseline local y se añadió la migración aditiva `202610080008_title_writes_server_only.sql`, que revoca INSERT/UPDATE/DELETE de `PUBLIC`, `anon` y `authenticated`; el servidor GMA conserva sus RPC/rutas con `service_role`. Se validó en el stack local real que PostgREST deniega escrituras directas y la publicación mediada por GMA sigue funcionando. No se alteró ni sobrescribió `20261007_r2_capacity.sql` (SHA256 confirmado: `d218c7a8230cfbd7e139786397d8bd6e4a1e334886ce852f3fef34af052cbf30`). La migración 0008 es nueva y aditiva; requiere revisión y despliegue futuro controlado antes de que una instalación alojada obtenga este endurecimiento.

**Límites y pasos siguientes:** la aceptación certifica el backend local Mock y el aislamiento del stack, no un despliegue. PeerTube, VPS, WebTorrent/P2P, CORS/HTTPS públicos, migraciones alojadas y la capacidad de 10–200 espectadores siguen sin probarse por diseño; no se declara capacidad de producción. Fase 6 puede comenzar según dependencias del Plan Maestro, pero no se ejecutó aquí. El branch sigue `feature/upload-engine-v2`, HEAD `c5b3483b137624c96f389e487bb7c4d33897f41a`; el working tree conserva WIP staged/unstaged/untracked previo y esta misión no creó commit.

## Cierre de Fase 6 — Studio y publicación neutral (2026-10-09)

**Resultado: pasos 6.1–6.8 completados; Fase 6 CERRADA. Es seguro comenzar Fase 7.** Se trabajó sobre `feature/upload-engine-v2`, HEAD analizado `c5b3483b137624c96f389e487bb7c4d33897f41a`. No se creó commit; se conservan los cambios previos, incluidas las migraciones aditivas y `20261007_r2_capacity.sql`.

- **6.1:** los transportes PUT, multipart, tus y uploadx se seleccionan por protocolo. uploadx envía bloques acotados de 8 MiB en serie, interpreta `308/Range`, refresca offsets después de pérdida de respuesta y renueva la capacidad caducada; las pruebas rechazan identidad/rangos inválidos. La transferencia de navegador se probó mediante el gateway loopback.
- **6.2:** `useUploadController` recupera detalle durable, serializa mutations/CAS y conserva caché scoped por usuario; no persiste capacidades bearer. Studio recargado restaura `processing` desde el servidor y mantiene la publicación bloqueada. El test de navegador fuerza 401, renueva sesión Supabase local y reintenta la petición.
- **6.3:** la cola neutral conserva `sessionId` y `mediaId` separados de `deliveryUrl`; los callbacks de principal y auxiliares llevan sus identidades. El READY del principal llega después del estado durable del asset; quitarlo invalida la selección.
- **6.4:** processing, error recuperable/terminal, retry, cancel y estado sintético se traducen desde las respuestas durables. Retry mantiene identidad/cuota; cancelar durante procesamiento no puede habilitar publicación.
- **6.5:** la publicación neutral envía exactamente `{draft_id, revision, main_media_id}`; exige principal READY, adjuntos READY y metadata confirmada. La duración que se muestra procede del servidor. El formulario y la composición visual existentes se mantienen.
- **6.6:** imágenes/VTT y roles auxiliares comparten validación; subtítulos conservan slots por idioma y previews usan la ruta neutral. Avatar usa Mock local, confirma la sustitución y deja limpieza durable del anterior. R2 continúa disponible como proveedor auxiliar configurado.
- **6.7:** Studio incluye títulos publicados, retirados y con eliminación pendiente; el mapper da precedencia al estado de borrado y acciones de retirada/republicación/borrado conservan revisión e idempotencia. El borrado visible no implica borrado físico prematuro.
- **6.8:** búsqueda final encontró `r2VideoUrl` solo en la rama histórica de publicación; no identifica nuevos medios ni entra en el payload neutral. La rama legacy sigue gated y mantiene compatibilidad.

La suite browser específica de Studio pasó **7/7**: subida Mock/uploadx y publicación UUID; restauración de processing después de reload; renovación JWT tras 401; avatar neutral; títulos retirados/borrado pendiente; y límites de viewport para Studio a **320, 768 y 1440 px**. La regresión browser histórica R2 multipart/reanudación pasó **2/2**. La suite específica de tests unitarios Studio pasó **11/11**.

Regresión acumulada ejecutada para el cierre: `test:media:unit` **33/33**, `test:media:integration` **27/27**, `test:media:peertube-contract` **2/2**, suites legacy uploads/playback/publicación **63/63**, Studio **11/11**, PostgreSQL/concurrencia y reinicio del gateway **2/2**, Studio browser y responsive **7/7**, browser R2 **2/2**. Total de esta batería sin duplicar archivos: **147 aprobadas, 0 fallidas y 0 omitidas**. TypeScript `tsc --noEmit --incremental false` y `git diff --check` aprobaron. La aceptación Fase 5 local con Auth/PostgREST reales ya registrada arriba conserva 9/9 browser y 4/4 runner.

Se ejecutó también, de forma separada y sin cambiar ni silenciar sus aserciones, la matriz responsive general del producto a 320/768/1440. **Falló 3/3** al entrar en las vistas antiguas de onboarding `creator-setup`/`viewer-setup`, que redirigen al login bajo el usuario sintético del fixture local. Los recorridos responsive específicos de Studio pasan 3/3 y se ejecutan en el mismo servidor loopback; por ello este fallo de fixture no bloquea la aceptación Studio 6.8, pero queda registrado para corregir antes de certificar esa matriz general. No se contactó el dominio Supabase alojado: el config responsive y sus interceptaciones quedaron apuntando a `127.0.0.1`.

No hubo migración de base de datos nueva en Fase 6. Se preservó la protección de escrituras server-only `202610080008_title_writes_server_only.sql`; no se activó PeerTube/R2/Stream remoto, VPS, producción, push ni deploy. El working tree continúa sin commit para no mezclar el WIP solicitado.

## Fase 7 — ejecución local (2026-10-09)

### 7.1 — mapping neutral

`toMovieMedia` añade `playbackRef` con identidad de título y clasifica media/R2 HLS/Stream como managed. Conserva `numericId`, URLs opcionales históricas, créditos, catálogo y caché. El mapper puro no hace I/O. Tests catálogo/U06/playback: **7/7**, 0 fallos/omisiones. El primer intento de importar queries desde Node encontró el `cache` exclusivo del runtime React server; se extrajo únicamente el mapper de referencia para probarlo sin alterar cachés. La guía solicitada por AGENTS en `node_modules/next/dist/docs/` no existe en esta instalación Next 14.2.35; se inspeccionan código/tipos instalados sin consultar servicios externos.

### 7.2 — engine neutral y hook

`useMediaPlayback` consume `PlaybackSource v1`; `PlaybackEngine` mantiene un controller por elemento, invalida imports asíncronos obsoletos y destruye hls.js/listeners al desmontar. MP4 y HLS nativo/hls.js usan el mismo contrato; `useHlsPlayback/useStreamPlayback` siguen como wrapper. Prueba de decodificación real Chromium **2/2** (HLS fMP4 privado firmado y MP4 con seek/pausa). El fixture levanta SQL aislado y el gateway existente en procesos locales; el proxy de pruebas se genera temporalmente y no es una ruta del producto desplegable. Se corrigió un 404 inicial del propio fixture: Next excluye carpetas que comienzan por underscore. No se simuló `video.play`. TypeScript pasó. WebKit/Firefox y su dependencia FFmpeg de Playwright se instalaron únicamente tras autorización explícita del usuario para esa descarga oficial.

### Continuación y cierre de Fase 7 (2026-10-10)

Se inspeccionó primero el working tree existente: branch `feature/upload-engine-v2`, HEAD `c5b3483b137624c96f389e487bb7c4d33897f41a`; los numerosos cambios staged/unstaged/untracked de Fases 1–6 se conservaron. No hubo reset, stash, commit, push ni deploy. `20261007_r2_capacity.sql` y las migraciones aditivas previas no se editaron.

**7.1 y 7.2 se revalidaron antes de continuar.** Mapping neutral `playbackRef` conserva `numericId`, datos y URLs opcionales históricas; el test U06 verifica modos managed/legacy y ausencia de consulta por tarjeta. Un título gestionado se resuelve por `/api/titles/:slug/playback`, sin identidad por URL. `useMediaPlayback` comparte un engine por elemento y discrimina HLS/MP4/YouTube; P01/P02 hicieron decode real, avance, pausa y seek. Se añadió comprobación de unmount: destruir el componente pausa el vídeo y retira el elemento. El splash y los controles GMA se verificaron en la pantalla real.

**7.3–7.6.** `PlayerScreen` usa `source.kind`, mantiene el mismo markup/CSS y sus controles, intro, donación, navegación y ended; los fallos iniciales presentan estado real y un 404 no inicia reloj ni permite retry. Se mantuvo renovación 60 segundos antes de expirar, renovación una vez ante 401 en hls.js, recuperación de red acotada, retención de pausa/posición y retorno de estado terminal. WebKit/Firefox renuevan antes de expiración y pasan 404; no exponen el status HTTP de HLS nativo para el caso 401. Subtítulos ES/EN se muestran como pistas `<track>`, se comprueba cue tras seek y exclusividad/Desactivado; el selector de audio solo enumera pistas reales. `useProgress` espera historial/metadata, mantiene `numericId`, prioriza `initialTime`, limita la posición a la duración y no guarda preview. El fullscreen usa fullscreen estándar y eventos nativos WebKit/iOS conservando `playsInline`; dispositivo iOS físico queda pendiente del runbook.

**7.7.** Miniaturas legacy se exponen únicamente con URL MP4 histórica permitida; subtítulos R2 usan el proxy same-origin y el parser/sprite no sirve una URL arbitraria. HLS nuevo conserva póster/tiempo sin sprites ni segunda precarga. Se completó fallback seguro: solo se anuncia cuando hay snapshot del mismo título, owner correcto, `playback_kind=legacy`, retención vigente y URL permitida por allowlist R2. El DTO lleva una ruta GMA, nunca la URL del snapshot; cada GET vuelve a comprobar que el título sigue publicado y sin borrado pendiente antes de redirigir. Test de integración verifica recurso permitido, ausencia de fallback cuando no existe evidencia y denegación tras retirada. Un 404 del playback detiene el flujo y no cae a MP4.

**7.8 — matriz de navegador.** `playwright.media.config.ts` ejecutó los 30 casos existentes en Chromium/WebKit/Firefox: **28 aprobados, 2 omitidos, 0 fallidos**. Las omisiones son solo inspección de 401 interno cuando WebKit/Firefox usan HLS nativo; el caso 401 se comprobó con hls.js en Chromium, y expiración/404 se probaron en los tres. Los tres motores decodificaron realmente HLS y MP4, con seek/pausa, intro/controles, subtítulos, Range/CORS y responsive 320/768/1440. Después se añadió el test explícito de cleanup/unmount y pasó en Chromium/WebKit/Firefox: **3/3**. En conjunto de ejecuciones browser Player: **31 aprobadas, 2 omitidas, 0 fallidas** (la suite inicial 30 más esos 3 casos nuevos).

Otras regresiones finales (cada conteo corresponde a su propio comando; no se suman suites solapadas):

| Grupo | Aprobadas | Fallidas | Omitidas |
|---|---:|---:|---:|
| `test:media:unit` | 33 | 0 | 0 |
| `test:media:integration` | 27 | 0 | 0 |
| contrato PeerTube offline | 2 | 0 | 0 |
| catálogo, playback, legacy adapters y playback service | 12 | 0 | 0 |
| Studio unitarias | 24 | 0 | 0 |
| uploads/providers/repository + R2 legacy | 52 | 0 | 0 |
| Player Chromium/WebKit/Firefox (suite + unmount) | 31 | 0 | 2 |
| Support / YouTube / donaciones | 7 | 0 | 0 |
| Studio browser y responsive 320/768/1440 | 7 | 0 | 0 |
| suite secundaria R01 | 14 | 2 | 0 |

Los dos fallos R01 son únicamente las aserciones de bienvenida de invitado a 390 px y 1440 px (expectativa de título/botón distinta en `/`); no involucran catálogo, reproducción, perfiles, Studio ni cambios del Player. Se dejan sin tocar por estar fuera de alcance. Se registró además un primer intento de correr el archivo Playwright con `node:test`, que no es un runner válido; repetido con Playwright, la suite concluyó con el resultado anterior. Un primer soporte arrancó sin mock local, Next intentó obtener Manrope de Google Fonts y se canceló inmediatamente (1 interrumpida/6 no iniciadas); no hubo descarga exitosa. La repetición con el mock tipográfico temporal local pasó 7/7 sin peticiones de red. Studio browser pasó 7/7; emitió un `ECONNREFUSED 127.0.0.1:54341` durante la restauración de una sesión sintética, pero la suite completó todos sus asserts.

Resultado final: U06/R01 pertinentes al Player, P01–P04, HLS/MP4 históricos, YouTube, soporte, fullscreen de navegador, pistas, progreso, Range/CORS y responsive local están validados. No se declara certificación de Safari/iOS físico, fullscreen real de dispositivo móvil ni reproducción contra VPS/PeerTube; P2P sigue `none`. TypeScript strict (`tsc --noEmit --incremental false`) y `git diff --check` pasan después de los cambios finales. **Fase 7 queda CERRADA en local y es seguro comenzar Fase 8 según dependencias; Fase 8 no se inició.** Sin servicios remotos, Supabase alojado, VPS ni PeerTube real.

## Fase 8 — ejecución local parcial (2026-10-10)

La rama y revisión conservadas son `feature/upload-engine-v2` / `c5b3483b137624c96f389e487bb7c4d33897f41a`. No se cambió HEAD, no se hizo staging/commit/reset/stash y se conservó el WIP previo. El status tenía 95 entradas, con 59 rutas rastreadas modificadas en el diff estadístico; los ficheros no rastreados siguen intactos, aparte de los entregables y pruebas de esta misión.

**8.1 y 8.3 — aceptados.** `test:media:e2e` recorrió login visual con Auth local real, Studio, selección de MP4, uploadx/gateway, processing, READY, publicación por `main_media_id`, consulta de catálogo y decode HLS real con avance/seek. Las acciones de Studio despublicaron, verificaron 404 y revocación de capacidad, republicaron y borraron con estado durable/cuota liberada una sola vez. Resultado final **1/1 aprobado**. Dos intentos previos fallaron por un draft incompleto dejado por una ejecución anterior de test; se abandonó ese único draft de la cuenta fixture por API autenticada local y el recorrido final pasó.

**8.2 — parcialmente aceptado, no cerrado.** Los escenarios deterministas `mock-processing`/`service-actions` pasaron **6/6** (fallo una vez, retry idempotente, cancelación durante procesamiento y fencing); integración/recovery **27/27** y PostgreSQL aislado con `SIGKILL`/restart/resume/lost response **1/1**. El runner live existente prueba ese recorrido HTTP pero empieza y termina con `media:local:reset`, que borra volumen y `work/media-local/storage`; no se ejecutó contra los datos acumulados. Falta convertirlo a un fixture desechable/no destructivo y comprobar failure/retry/cancel/restart en una única E02 con UI, HTTP y DB.

**8.4 — aceptado para la fixture.** Suite live con Auth/PostgREST real: **9/9 aprobada**, incluidos creator B contra objetos privados de A, publicación ajena denegada, MP4 histórico con Range/subtítulos y perfiles. `test:secondary`/R01 pasó **16/16**, incluidas bienvenida invitado en 390 y 1440 px. Sin acceso a Supabase alojado, R2 remoto, Stream remoto ni YouTube externo.

**8.5 — verificaciones aprobadas y una regresión visual abierta.** Unit media **33/33**; integración **27/27**; contrato PeerTube **2/2**; Studio unit **11/11**; legacy uploads/R2/Stream **29/29**; concurrencia PostgreSQL **1/1** más gateway process **1/1**; processing/actions **6/6**; live **9/9**; E01 **1/1**; R01 **16/16**. Player Chromium/WebKit/Firefox: **31 aprobadas, 2 omitidas, 0 fallidas** en 33 casos. Las dos omisiones son verificación del status HTTP 401 bajo playback HLS nativo en WebKit/Firefox: sus elementos de media no exponen la respuesta HTTP a JavaScript. La renovación ante 401 sí está cubierta en Chromium/hls.js; expiración y 404 pasan en los tres motores. No se ha añadido un fallback que evada autorización.

La matriz responsive completa de 26 tests se interrumpió tras **3 fallos**, **1 test interrumpido**, **22 no ejecutados**; los tres fallos ocurren al abrir `creator-setup`/`viewer-setup` y terminan en la home porque la fixture de usuario sintético no establece una sesión aceptada por esos componentes. La repetición selectiva a 320 px confirma **1 fallo** por el mismo motivo. No es una detección de overflow ni un fallo del Player, pero la incidencia histórica de perfil/onboarding sigue sin medir/resolver. Se aisló `.next-responsive` para evitar que un segundo Next corrompa los chunks del stack local. En un primer intento concurrente, la matriz anterior había compartido `.next` y la suite live devolvió 500 de runtime; al reiniciar el supervisor sin reset ni pérdida de spool, la suite live final pasó 9/9.

TypeScript strict aprobó. Lint aprobó sin errores después de retirar imports/variables sin uso; quedan cuatro advertencias previas de hooks/`img`. Build de producción local aprobó (Next 14.2.35, fuentes servidas por mapping local). `git diff --check` quedó limpio en la última revisión. No se ejecutó `npm audit` porque es una consulta de red fuera del alcance expresamente local; no se declara auditoría de dependencias.

**8.6 — parcialmente aceptado.** Se creó [RUNBOOK.md](RUNBOOK.md) con seguridad del runner, comandos reproducibles, respuesta operativa, estrategia de preservación WIP y prerequisitos VPS. `infrastructure/peertube/README.md` ya mantiene la conexión remota desactivada. Siguen sin implementarse los scripts del Plan Maestro `load-hls.ts`, `legacy-inventory.ts` y `legacy-migrate.ts`; no se generó una cifra de carga ni un inventario/dry-run no ejecutados.

**8.7 y 8.8 — abiertos.** No se ensayó rollback integral con backup restaurado, ni se inspeccionó un snapshot de recuperación; hacerlo mediante el runner actual implicaría destruir datos locales. No hubo revisión independiente de un segundo agente ni auditoría de advisories de red. Hay una estrategia de preservación/versionado del WIP en el runbook, pero no existe un commit limpio porque el HEAD contiene WIP preexistente y mezclarlo incumpliría las instrucciones.

### Recuento final por baterías de esta misión

| Batería final | Aprobadas | Fallidas | Omitidas/no ejecutadas |
|---|---:|---:|---:|
| Media unit + integración + contratos + Studio + legacy uploads + concurrency/gateway + processing/actions | 110 | 0 | 0 |
| Auth/PostgREST live | 9 | 0 | 0 |
| E01 producto real con ciclo de vida | 1 | 0 | 0 |
| R01 / secondary | 16 | 0 | 0 |
| Player Chromium/WebKit/Firefox | 31 | 0 | 2 (401 HLS nativo, limitación técnica) |
| Responsive general, ejecución completa interrumpida | 0 | 3 | 23 (1 interrumpida + 22 no ejecutadas) |
| Responsive dirigido a 320 px | 0 | 1 | 0 |
| TypeScript / lint / build / diff check | 4 gates aprobados | 0 | 0 |

Los dos primeros intentos de E01 y el primer intento de live test fallaron durante la investigación por fixture residual/colisión de `.next`; no se cuentan como aceptación y se detallan arriba. Ninguna de esas ejecuciones contactó un servicio no local.

**Decisión:** la Fase 8 **NO está cerrada** y no es seguro comenzar VPS PHASE. Faltan E02 de producto repetible con reinicio sin reset, la medición real de las pantallas responsive antiguas, scripts de inventario/dry-run/carga, ensayo de rollback con copia restaurable y un audit de dependencias compatible con la política de red del siguiente encargo. El Player preserva controles y compatibilidad MP4/YouTube; las rutas históricas R2/Stream conservan sus suites. PeerTube/P2P siguen desactivados. No hubo push, deploy, servicio remoto ni commit.

## Fase 8 — cierre de pendientes y entrega local (2026-10-11)

Esta sección sustituye el estado de aceptación parcial del 10 de octubre, conservado arriba como historial. Se cerraron **8.2, 8.5, 8.6, 8.7 y 8.8**. No se reimplementaron 8.1/8.3/8.4; se conservaron y revalidaron. Base: `feature/upload-engine-v2` / `c5b3483b137624c96f389e487bb7c4d33897f41a`. Sin push, deploy, commit, contacto remoto, reset de la fixture ni PeerTube/P2P.

### 8.2 — E02 real y recuperación sin reset

`tests/media/e2e/failure-flow.spec.ts` usa Supabase Auth, UI/acciones de GMA, APIs de producto, DB, gateway y executor reales. Solo pierde una respuesta del transporte después de commit HTTP y configura un escenario Mock privado local; ninguna API de producto se reemplaza. Reinicia mediante stop/start no destructivos, comprueba PIDs anteriores muertos y PIDs nuevos, offset durable de media transferencia, misma sesión/medio, reselección SHA y exactamente un PUT de la cola restante, no reenvío íntegro.

Falla processing una vez, reintenta misma identidad hasta READY con generación 2; consulta contabilidad única en SQL. Cancela un segundo activo durante processing y comprueba estado terminal sin READY tardío. READY genera reserve/confirm únicos por cuenta y release al borrar; cancel antes de READY genera reserve/release únicos y confirm=0. Limpieza limitada a borradores creados por el ensayo. E01 se ejecuta con B para conservar el borrador de A `461ed25b-59ac-45e6-94ec-14fd3a24d360`; no se abandona ni reutiliza ese WIP.

Dos correcciones de recuperación: `local-seed.ts` no cambia la contraseña de usuarios locales existentes (el PUT anterior revocaba sesiones al reiniciar); valida sus credenciales mediante login real. `managedClientState` reconoce ausencia de File local y exige reselección en transporte uploading; processing/ready siguen recuperándose sin archivo.

### 8.5 — resultado final por batería (sin duplicar casos)

| Batería / log dentro de `work/` | Aprobadas | Fallidas | Omitidas |
|---|---:|---:|---:|
| Fases 1–7, operaciones unitarias y Studio unitario — `phase8-media-accumulated-final.log` | 188 | 0 | 0 |
| Legacy motor/repositorio/R2/Stream — `phase8-legacy-unit.log` | 52 | 0 | 0 |
| PostgreSQL concurrencia + muerte/recovery real de gateway — `phase8-postgres.log` (dos grupos de 1) | 2 | 0 | 0 |
| FFmpeg/ffprobe reales — `phase8-ffmpeg.log` | 2 | 0 | 0 |
| E01/E02 UI-producto local real — `phase8-product-e2e-final3.log` | 2 | 0 | 0 |
| Auth/PostgREST/ownership/CSP/HLS/lifecycle reales — `phase8-local-live-final2.log` (incluye padre) | 9 | 0 | 0 |
| Inventario/dry-run PostgreSQL READ ONLY — `phase8-operations-live-final2.log` | 1 | 0 | 0 |
| Responsive general / perfiles — `phase8-responsive-final2.log` | 26 | 0 | 0 |
| R01/secondary — `phase8-secondary-final.log` | 16 | 0 | 0 |
| Player Chromium/WebKit/Firefox — `phase8-player-final2.log` | 35 | 0 | 1 |
| Studio navegador, incluidos 320/768/1440 — `phase8-studio-final2.log` | 7 | 0 | 0 |
| Soporte/donaciones/YouTube contrato — `phase8-support-final.log` | 7 | 0 | 0 |
| Navegador legacy, decode HLS/MP4 y transporte — `phase8-legacy-browser-final2.log` | 4 | 0 | 0 |
| **TOTAL final, 352 casos** | **351** | **0** | **1** |

Los 188 casos se seleccionan desde todos los `tests/media/*.test.ts`/`*.test.mjs` y Studio unitarios, excluyendo cinco runners gated. Concurrencia/gateway, live y operaciones-live se ejecutaron separadamente como indica la tabla. `local-runner-live` hace reset destructivo y NO se repite sobre esta fixture: se conserva su aceptación previa de Fase 5 y se valida ahora reinicio mediante E02 y DBs nuevas. Esta exclusión deliberada no se oculta como test Playwright aprobado ni se suma al único skip de Player. Los aliases unit/integration/contract quedan incluidos en la batería acumulada, no se suman otra vez.

E03/ownership se verifica en la batería real local; sus subtests están incluidos en los nueve casos, no son un E2E de UI adicional inventado. Matrices visuales responsive/Studio/soporte conservan doubles de negocio/transportes delimitados; ahora usan Auth local real. E01/E02 no tienen doubles de APIs de producto. YouTube comprueba contrato/iframe API/eventos offline, no decodificación de un servicio remoto. R2/Stream no contactan proveedores reales; HLS/MP4 sí decodifican bytes FFmpeg reales en navegador.

**Omisión única:** WebKit con HLS nativo no expone HTTP status de un fallo de segmento a HTMLMediaElement; la prueba de clasificación automática exacta 401 se omite con motivo explícito. Firefox/hls.js 401 ya pasa. Se añadió denegación nativa, renovación explícita y nueva decodificación, aprobadas en los tres engines. No se declara resuelta la limitación automática ni se certifica Safari/iOS físico.

**Responsive reparado:** bienvenida invitado 390/1440 pasa en R01 16/16. Perfiles/onboarding y demás pantallas generales pasan a 320/360/390/430/667/844/768/820/1024/1280/1440: 26/26. `tests/responsive/local-auth.ts` obtiene tokens auténticos de GoTrue local; fixture setSession utiliza UUID real y espera preparación. La vista de fixture se conserva si Catalog cambia query; filtros siguen afirmando parámetros y limpieza. No se eliminaron pruebas ni se cambiaron perfiles de producto para eludir fallos.

**Release:** `phase8-types-final.log` y comprobación posterior `phase8-types-delivery.log` strict/noUncheckedIndexedAccess, `phase8-lint-final.log` / `phase8-lint-delivery.log` 0 errores/3 warnings, `phase8-build-final.log` build real Next 14.2.35 completo, `phase8-diff-check-final.log` correcto. `media:build:local` rechaza stack activo, limpia variables dotenv heredadas y usa únicamente el env owned. No dev/build simultáneos, no fuentes remotas ni rutas temporales en release. `work/` se excluye de TS porque MPEG-TS tiene extensión `.ts`; no se excluyen fuentes/tests. Player memoiza subtítulos y corrige dependencies de effects sin rediseño.

Warnings: cleanup de ref en DM existente (fuera del alcance multimedia); dos `<img>` en Studio para preview blob/signed media (no se envían al optimizador/proxy para ocultar warning). No impiden build, quedan registrados; no se añadió disable de lint.

**Intentos previos fallidos corregidos, separados de la aceptación final:** responsive pasó por 22/4 y 25/1 antes de corregir Auth/cache y query de fixture; E02 esperaba erróneamente confirmación de cuota antes de READY; E01 tuvo 500 al generar rutas temporales de otra suite simultánea (rerun secuencial final 2/2); primer build Player falló por tipo NODE_ENV; primer Studio build leyó MPEG-TS runtime como TS; primer legacy playback falló por URL relativa fuera del contrato (se corrigió la fixture a loopback absoluto, no se relajó seguridad). Un intento live quedó bloqueado en teardown tras completar subtests: se terminaron solo los PIDs de ese ensayo y se cerró proxy antes del navegador con timeout; ejecución final 9/9 terminó normalmente. Los logs de intentos se conservan; ninguno se cuenta como aprobado final.

### 8.6 — herramientas e infraestructura preparadas, no desplegadas

`local-tools.ts` exige owner/hash/env 0600 sin symlinks, proyecto local literal y URLs loopback/flags Mock. `legacy-inventory.ts` usa `REPEATABLE READ READ ONLY`, enmascara referencias y detecta huérfanos. `legacy-migrate.ts` acepta solo dry-run, rechaza apply y no descarga/escribe; no convierte SHA de URL en mediaId. Prueba real READ ONLY deniega UPDATE, conserva fingerprints públicos/Auth y confirma cero huérfanos.

`load-hls.ts` crea únicamente su draft mediante Auth/product API, autoriza cada espectador y consume master/variant/init/segmentos a ritmo EXTINF; renueva grants si corresponde y espera todos los viewers antes de limpiar. Ensayo `phase8-load-final.log`: **10 viewers, 6 s, 50 requests, 0 errores, 0 failedViewers, 4.370.660 bytes, 0 renovaciones, certifiesCapacity=false**. JSON/CSV privados en `work/media-local/reports/`. Esto verifica el harness, no certifica 100 usuarios simultáneos.

`infrastructure/peertube/**` prepara policy/env/nginx/systemd/firewall/backup. Esquema/config v8.3.1 cacheados con procedencia/hashes: `media:peertube:validate` valida defaults+production+policy offline. `schemaValidated:true`, `p2p:false`, `deployable:false` por placeholders. Privacy 3/file-auth, HLS y originales retenidos; signup/federación/import/tracker/P2P apagados. No hubo instalación ni llamada a PeerTube.

### 8.7 — seguridad y rollback restaurable

`phase8-rollback-final.log`: copia privada **`work/media-rollback/copy-ZmniPV`**, nuevo cluster PostgreSQL loopback, nuevas bases literales; originalUnchanged=true, snapshotRestored=true, securityRestored=true, admissionPaused=true, readsAndHls=true, cancel=true, legacyWritesClosed=true. Backup public + Auth users/identities, ACL/roles/RLS, storage, keys, env/owner/credenciales/seed/workdir; permisos privados. Verifica fingerprint de fuente y restauración, gate de admisión, lectura/playback firmado/cancel; borra exclusivamente un asset de la copia y restaura segundo snapshot a otra DB/carpeta. Nunca restaura sobre 54342 ni destruye datos actuales.

`DEPENDENCIAS-SEGURIDAD.md`: caché de audit inicial conserva **24 avisos: 2 críticos/16 altos/4 moderados/2 bajos**; lockfile contrastado, incluido riesgo Next 14.2.35/proxy-addr. Audit offline vacío NO prueba ausencia de vulnerabilidades. Audit vigente requiere red no autorizada; no se ejecutó force-fix ni major incidental. **Exposición externa bloqueada** hasta audit vigente autorizado/remediación, TLS/CORS/firewall/IPv6/SSRF reales y gates VPS. La aceptación local con ese bloqueo es la condición explícita del paso 8.7, no una declaración de seguridad productiva.

### 8.8 — revisión, preservación y versionado

Segunda pasada del mismo ejecutor documentada en `REVISION-ENTREGA.md`, no revisión independiente de otra persona/agente. Reconciliación local sin huérfanos, herramientas/checklist y runbook reproducibles. Las 34 migraciones presentes al iniciar esta continuación permanecen SHA idénticas; `20261007_r2_capacity.sql` conserva SHA `d218c7a8230cfbd7e139786397d8bd6e4a1e334886ce852f3fef34af052cbf30`. Sin pérdida de fuentes iniciales y staging vacío.

Alcance respecto a HEAD: 37 de 185 archivos TypeScript de producto rastreados modificados (**20%, 80% intactos**) y 55 archivos de producto añadidos. Es porcentaje de archivos, no de líneas ni exclusivamente Fase 8; incluye fases previas. Esta continuación solo cambia producción de Player memo/subtítulos y recuperación Studio/client-state, además del seed/runner local y herramientas/pruebas/docs. Inventario comparativo en `work/phase8-change-inventory.json` separa la base de Fase 1 y el snapshot inicial de esta continuación.

Snapshot privado de entrega: `/Users/aseidkonna/Documents/Codex/2026-10-07/new-chat/outputs/phase8-delivery-snapshot-20261011/manifest.json`; fuentes SHA, tracked/staged patches y branch/HEAD/status. Fuente/datos runtime separados: snapshot no contiene env/keys/work; rollback conserva datos privados. `snapshot-wip.ts` verifica copias y Git sin staging. No se hace commit: la base neutral previa no rastreada y migration 20261007 son dependencias ajenas a este delta; un commit autocontenido las absorbería silenciosamente. Primero atribuir/consensuar/versionar la base y luego deltas revisables en copia de integración. No `git add -A`, reset, stash ni checkout destructivo.

**Desviaciones explícitas:** E01 usa B en lugar de A para preservar WIP; fixtures visuales producción/real Auth en lugar de auth sintética; release usa wrapper de aislamiento (build real intacto); ensayo rollback sobre cluster/copia nueva en lugar de reset; audit externo diferido con gate cerrado por restricción de red; sin commit por WIP previo; segunda pasada del ejecutor sin alegar revisión independiente. Todas preservan contratos/seguridad y no habilitan proveedores reales.

**Decisión final:** pasos 8.1–8.8 y fases **1–8 CERRADOS funcionalmente en local**. Se puede comenzar planificación/preflight de **VPS PHASE**; no exposición pública ni despliegue hasta resolver gates de seguridad. Quedan PeerTube/uploadx/FFmpeg privados reales, TLS/CORS/DNS y firewall público, backup/restore bajo infraestructura real, dispositivos físicos, carga 10/25/50/100/150/200 y gate P2P independiente. Ninguno se presenta como realizado ni como capacidad prometida.

**Comprobación posterior de entrega:** Docker estaba cerrado al retomar la sesión; se abrió y se arrancó el runner sin reset. `phase8-start-delivery.log`: START_OK; `phase8-preflight-delivery.log`: PREFLIGHT_OK. `phase8-health-delivery.log`: Auth/PostgREST/gateway/GMA HTTP 200, PostgreSQL disponible, borrador previo de A en draft con cero assets, B sin borradores activos y cero huérfanos. Siete contenedores propios; todos los puertos publicados en 127.0.0.1/::1. Executor y gateway bajo supervisor propio, Mock activado y PeerTube/Stream/P2P apagados. Strict/lint/diff repetidos al entregar, sin nuevos errores ni cambios de advertencias. El stack queda arrancado localmente; no se reinstala ni conecta infraestructura externa.

## V.1 — preflight externo iniciado (2026-10-11), todavía NO cerrado

Se ejecuta únicamente V.1. El usuario identifica VPS Host Ilimitado `77.42.52.127`, hostname `xptawLk3.ilimitado.host`, SSH22/root, Ubuntu24.04/noVNC según panel. No se han medido recursos ni leído firewall remotamente: todavía no hay login seguro. La clave dedicada Ed25519 no existe en el Mac. Keyscan obtuvo candidata `SHA256:jo9VT5Z9U3L4Yq5VdBdCRXPr2uc15Yo3JLI3gX2eDi8`; **no se considera verificada ni se acepta en known_hosts**. Hostname no resuelve desde este Mac. Por instrucción del usuario se espera la huella del otro agente desde noVNC antes de cualquier autenticación SSH; no se generó clave ni modificaron credenciales/permisos/firewall del VPS.

**Snapshot/WIP:** verificados los 538 SHA del snapshot F8, sin faltantes/corrupción/diferencias respecto a fuentes al inicio de V.1. HEAD/branch anteriores, staging vacío. Los 23 logs se conservan; no se reejecuta una restauración ni se confunde snapshot de fuentes con backup DB. Existe copia `work/media-rollback/copy-ZmniPV` privada 0700 y reporte de restore anterior; no se transfiere/restaura ahora sin aprobar fuente/destino. V.1 solo añade/actualiza documentación, informes y procedencia; código/migraciones/lockfile previos intactos.

**Seguridad vigente:** consulta de solo lectura al registro npm mediante audit package-lock-only/ignore-scripts, sin fix/install. Exit1 por vulnerabilidades, sin error de registro. **27 entradas (2 críticas/19 altas/4 moderadas/2 bajas)** sobre1005 deps; no número de CVEs/exploits. JSON completo nuevo en `docs/media/security/dependency-audit-20261011.registry.json`, SHA `26339c1cc1a3e23570268cca840a34a523b4b2c6d8803d396a652d4bc3dff110`. Lockfile sigue `a022df72ebe44b608173c2948f85168e6d82aa437f0fea40e0af0ae6b521a163`. Next14.2.35 y proxy-addr2.0.7 siguen afectados; express5.2.1 es la ruta ascendente del segundo. No se instala major ni se corrige transitiva incidentalmente. Exposición pública bloqueada, análisis/remediación/regresión pendientes.

**PeerTube oficial:** API releases/latest mantiene v8.3.1, estable28-09-2026; commit completo `3324876a0b0f846f8b6632470b3d9d53ef74b8b7`. Descarga local tar.xz 34.511.084 bytes, SHA `b2026b99ee6a2e07098230bb68fafbad634b44ce5a67a3e48e0b163ba9b5304a`, coincide digest de API. No extraído/ejecutado/instalado/transferido. Manifest `infrastructure/peertube/reference/v8.3.1/RELEASE-VERIFIED.json` conserva URL/tag/commit/digest y estado de firmas: GitHub verificado, GPG detached local no comprobado. Upstream YAML coincide con caché; primera comparación binaria de JSON schema falló por formato/terminación, comparación de objetos demuestra igualdad semántica. Se conservan ambos SHA y caché original, sin presentar igualdad binaria falsa. Tag exige pnpm>=10.9/packageManager10.15.1, más estricto que guía general>=10. Versiones instaladas/arquitectura VPS no verificadas.

**Pruebas V.1 locales:** peertube-contract **2 aprobadas/0 fallidas/0 omitidas**, schema config validado (`deployable:false`, P2Pfalse), preflight local correcto, diff-check correcto. Son doubles/contratos locales, no test REST de PeerTube real. Fases1–8 conservan su batería351/0/1; no se afirma que se repitiera entera por editar docs. Las lecturas OS/CPU/RAM/discos/red/firewall, identidad/auth y restore externo **no ejecutadas** son criterios pendientes, no tests aprobados ni skips ocultos.

**Staging/backup preparados, no creados:** `V1-PREFLIGHT.md` contiene dominios con marcador de dominio aprobado, GMA/gateway/engine separados, DB GMA independiente del Supabase alojado y del PG/Redis PeerTube, operadores/usuarios de servicio/cuenta técnica no-admin, claves exclusivas y egress cerrado. La [oferta oficial del proveedor](https://www.hostilimitado.com/servidores-vps?language=english) describe snapshots/restaurar como otro cloud server, pero no acredita inclusión, coste, retención o existencia en el servicio contratado. Consulta del panel/soporte pendiente; no se pulsó crear/restore/reinstalar. Diseño de restore solo sobre nuevo cluster/carpeta local o VM nueva expresamente autorizada, sin tocar la fixture actual ni el VPS contratado; evidencia GMA/Auth/RLS/objects/SHA/HLS y source-unchanged requerida.

**Aprobaciones pendientes:** host key contrastada y generación/aprovisionamiento de clave; cambios SSH/usuarios/permisos/firewall; dominio base/DNS/staging/secretos; backup/snapshot/coste/retención y fuente/destino de restauración; remediación de dependencias con revisión de WIP. Runbook y checklist V.1 actualizados, sin V.2 ni instalación PeerTube/P2P, R2/Supabase remoto/producción, push/deploy/commit. **V.1 no puede cerrarse todavía**: faltan identidad/auth, mediciones y staging/backup restaurable autorizado. Se espera la huella fiable mientras se conserva la preparación local.


## V.1 — continuación: clave, operador y lecturas reales (2026-10-11)

Esta entrada actualiza el estado inicial anterior: ya existen acceso autenticado, clave dedicada y operador. No reinterpreta retroactivamente la huella como certificada. Usuario autorizó expresamente crear gmaadmin/sudo, instalar exclusivamente la nueva pública y sus permisos, manteniendo root/firewall/sshd. Operación de acceso adelantada a V.1 por instrucción expresa; **no V.2**.

**Mac y conexión:** Ed25519 cifrada con passphrase humana, privada0600/pública0644/directorio0700; par verificado sin registrar privada. Pública `SHA256:M++R+F22q252IN3YeZI0NzKN0qKq/mmwgwTb3bRUYJQ`. Alias con IdentitiesOnly/publickey, sin password fallback, host checking estricto y sin forwarding. Host Ed25519 `SHA256:jo9VT5Z9U3L4Yq5VdBdCRXPr2uc15Yo3JLI3gX2eDi8` fijado desde aceptación personal del usuario, **TOFU, canal independiente pendiente**. Known_hosts original intacto. Terminal segunda sesión confirma `Authenticated ... using "publickey"`, prompt gmaadmin; contraseña SSH no utilizada para ella.

**VPS autorizado:** gmaadmin UID1000/grupo sudo27. Clave pública única, `.ssh`0700/authorized_keys0600 propiedad gmaadmin. Contraseña creada directamente por el usuario en Terminal; `passwd` éxito, visudo correcto. `sudo -v` interactivo seguido de `sudo -n id -u` devuelve **0** y `sudo -n -l` confirma `(ALL : ALL) ALL`; sudo realmente operativo. Postcheck verifica una clave y la misma huella pública, propietario/modos correctos y política root/password/X11/forwarding y firewall intactos. Root original permanece abierto. No secreto en scripts/informes.

**Lecturas reales:** Ubuntu24.04.5LTS, kernel6.8.0-138-generic/x86_64/KVM; 8vCPU XeonGold5412U presentadas, RAM16.371.228.672 bytes (15,25GiB), sin swap. Disco bruto240GiB, raízext4 248.505.155.584 bytes (231,44GiB), libres246.042.599.424 bytes (229,15GiB), uso/inodos1%. eth0IPv4/32/defaultonlink, IPv6solo linklocal. SSH22IPv4/IPv6 y DNSloopback; sin listeners app/PG/Redis/PeerTube observados. UFWinactive/nft sin reglas/iptablesv4v6ACCEPT; proveedorfirewalldesactivado comunicado desde panel. 0 unidades fallidas/NTPsinc; reboot-required(libc6/kernel146/linux-base), NO reinicio. Sin node/pnpm/psql/redis-server/ffmpeg en PATH. Timerdpkg-db-backup no es backupGMA.

**Evidencia privada:** `work/vps-preflight/{local-key-checks.json,remote-readonly-20261011.log,remote-admin-create-20261011.log,admin-sudo-20261011.log,access-postcheck-20261011.log}`. El readonly inicial dice usuario ausente porque precede a creación; los otros logs acreditan estado final. Claves privadas/passphrases/passwords nunca en estos archivos. Tar.xz v8.3.1 SHA revalidado exactamente, sin extraer/subir/instalar.

**Batería local de este avance:** contrato PeerTube **2 aprobadas / 0 fallidas / 0 omitidas**, HTTP solo local y fixtures; log `peertube-contract-access-20261011.log`. No se vuelve a sumar la batería351/0/1 de F8 a este contador. SSH/sudo/permisos/firewall/postcheck son verificaciones operativas reales, no tests PeerTube real. Config/schema/preflight y preservación/diff se registran tras comprobación final.

**Pendiente:** `SOLICITUD-SOPORTE-V1.md` preparado, no enviado; soporte debe confirmar huella por canal independiente, recursos/egress y snapshots del producto5515/VM106. noVNC login falló y no es recuperación probada. Staging/cuentas de aplicación/DNS y restauración nueva requieren aprobación; copia de rollback F8 no usada ni transferida. Audit27/2críticas intacto, sin remediación incidental ni exposición. Snapshot F8 y checkpoint V1 anterior no sobrescritos; nuevo snapshot privado del avance de acceso, solo fuentes. No stage/commit/push/deploy.

**V.1 NO CERRADO; no iniciar V.2** hasta identidad independiente, staging aprobado y backup/restauración acreditados. Clave/gmaadmin/sudo sí operativos. No se solicita una nueva autorización para estas operaciones ya aprobadas; firewall/policySSH/reboot/restore/costes requieren permisos separados.


**Verificación final del avance V.1:** contratos 2/0/0; schema PeerTube offline validado (`deployable:false`, P2Pfalse); preflight local `MEDIA_LOCAL_PREFLIGHT_OK`; SHA tar.xz coincide y tamaño34.511.084bytes. Snapshot F8 conserva íntegros sus538fuentes y checkpoint anterior V1 sus541fuentes; ningún faltante. Comparación con checkpoint V1: solo cinco documentos ya existentes modificados y un nuevo borrador de soporte; producto/lock/todas las migraciones preservados, staging vacío/HEADbaseigual. migration20261007 mantiene SHA `d218c7a8230cfbd7e139786397d8bd6e4a1e334886ce852f3fef34af052cbf30`. Nuevo checkpoint privado `outputs/v1-access-snapshot-20261011`, 542fuentes; excluye env/work/claves/dumps, no commit. Informes de esquema/preflight/preservación se conservan en work. Prueba SSH por clave, sudo real y postcheck correctos; root/firewall/sshd preservados. TypeScript strict (`tsc --noEmit --incremental false`) correcto, exit0; git diff-check final correcto. No batería fallida u omitida en este avance (contratos 2/0/0); los requisitos externos pendientes no se cuentan como tests aprobados.


## V.1 — nuevo ensayo desde backup guardado y staging sin dominio (2026-10-11)

**Autorización nueva:** el usuario aprobó el ensayo exclusivamente en este Mac, fuente de solo lectura `work/media-rollback/copy-ZmniPV`, carpeta/base nuevas y puertos distintos, sin modificar fixture/VPS/Supabase alojado. Anuncia envío personal del ticket a Host Ilimitado; **respuesta independiente pendiente**, no se afirma que esté enviado o contestado. Dirección GMA comunicada `gma-filmo.vercel.app`; no dominio propio confirmado. Arquitectura de staging preparada como etiquetas lógicas; sin DNS/certificados/exposición ni subdominios inventados de vercel.app.

**Implementación acotada:** `scripts/media/restore-backup-local.ts` y `tests/media/restore-backup-local.test.ts`, sin reemplazar ni ejecutar el runner anterior sobre la fixture activa. CLI sin argumentos, autorización explícita, source literal aprobado, guardas anti-symlink/base/puertos/config remota. PostgreSQL17.11 nativo ya instalado en el Mac; no instalar paquetes ni usar SSH en este avance. SCRAM/password aleatoria 0600 dentro de carpeta0700; roles técnicos NOLOGIN, credenciales/global owners de producción no importados. Live DB conexión READ ONLY, datos/seguridad y storage/keys/env fuente comparados antes/después.

**Restauración real final:** `work/vps-preflight/restores/saved-backup-u1bbkH`, PGloopback51962, bases nuevas `v1_source`/`v1_saved_rollback`/`v1_roundtrip`. Dump existente `source.dump` + `rollback.dump`; source/restored-storage y keys sintéticas copiados con SHA/modos idénticos. **69tablas**, **3usuarios/3identities**, **41activos/41sesiones**, **75outputs**, **17películas**, **6historiales**. SHA de todas las filas public/Auth igual tras nuevo dump/restore; UUID/generaciones/offsets/ledger conservados. ACL/RLS/políticas/search_path/SECURITY DEFINER preservados entre snapshots y roundtrip; publicación navegador INSERT/UPDATE/DELETE/EXECUTE denegada a anon/authenticated y comando permitido a service_role.

**Playback/rollback real:** HLS HTTP por capacidad nueva solo en el gateway desechable, ownership A/B comprobado, sin capacidad401, FFmpeg decodifica vídeo+audio2s sin errores. Pausa bloquea admisión, mantiene lectura y cancelación; escritura legacy cerrada. Abandono/borrado del activo copiado confirma estado deleted y deniega playback, sin tocar fuente. La copia final corresponde al ensayo extendido; primera copia `saved-backup-mLlVHt` también pasó/restauró datos y queda conservada/detenida. Tiempo final **4,819s** para fixture pequeña, no RTO/RPO/capacidad VPS. Nuevos gateway/PG detenidos al finalizar; pg_ctl status/pid comprobados, sin limpieza de copias existentes.

**Límites sin ocultar:** Auth users/identities/sessions y ACL/RLS restaurados; **no GoTrue/Auth HTTP/PostgREST/GMA web nuevos** sobre la copia. No se declara este ensayo E2E de login ni certificación de snapshots/backups externos. Globals propietarios/passwords no están en pg_dump y se sustituyen por identidades técnicas aisladas. No transferencia de dumps/env/claves al VPS, ninguna URL firmada/contraseña/clave privada en logs o snapshots de fuentes. Reporte/manifest privados en destino y `restore-saved-backup-final-20261011.log`.

**Verificación:** test del guard autorizado/no autorizado y rechazo puertos/base **1 aprobada / 0 fallidas / 0 omitidas**; ensayo real final **correcto** (ejecución con asserts, separado del contador Node). TypeScript strict y lint de los archivos nuevos correctos, sin nuevos any. Diagnóstico inicial TypeScript TS2741 por NODE_ENV requerido en ProcessEnv se corrigió agregando `NODE_ENV:test` al entorno saneado; compilación final exit0. Se conservan las baterías F8 y acceso V1 previas; no se suman como repetidas. Contratos PeerTube/config offline y diff/preservación se registran tras verificación final.

**WIP/entrega:** comparación contra `outputs/v1-access-snapshot-20261011` conserva producto/lock/migraciones y staging vacío; solo5documentos actualizados +2archivos del ejecutor/test. Nuevo checkpoint privado `outputs/v1-restore-snapshot-20261011`, 544fuentes, excluye work/env/claves/dumps. SnapshotF8 y checkpointsprevios no sobrescritos. No stage/commit/push/deploy.

**V.1 NO CERRADO:** ensayo de backup sintético local acreditado; aún falta huella independiente, contrato/egress/snapshots del proveedor y dominio/staging definitivo. Gate27vulnerables/2críticas intacto; remediación antes de exposición. **No V.2**, no instalación PeerTube/FFmpeg/PG/Redis remotos ni P2P, firewall/reboot/sshd intactos.


**Cierre de verificación de este avance:** batería Node nueva **3 aprobadas / 0 fallidas / 0 omitidas** (1guarda de restauración +2contratosPeerTube), `restore-unit-contract-20261011.log`. Ensayo real extendido con asserts correcto, contador separado; ambos clusters nuevos detenidos y puertos51790/51962 sin listener. TypeScript strict final exit0; lint de script/test exit0, sin advertencias; schema PeerTube offline válido/P2Pfalse/deployablefalse. `git diff --check` y comprobación whitespace de nuevos archivos correctos. Manifiestos de F8 y checkpoint acceso intactos, source delta solo5documentos +2archivos nuevos; producto/lock/migraciones/HEAD/staging preservados. Evidencia privada `preservation-restore-20261011.json`, nuevo checkpoint544fuentes. No se repitió la batería351/0/1 de F8 por este ensayo ni se declararon requisitos externos pendientes como tests superados.


## V.1 — backups aplazados y preparación privada (2026-10-11)

**Decisión incorporada, no instalación:** D-VPS-TEST-01 aprobada por el usuario. Los backups externos definitivos se aplazan para ensayos privados con medios recuperables. A) Linux casero con HDD de 400 GB/SSH y Restic cifrado e incremental; B) Backblaze B2 para configuraciones, bases de datos y datos críticos. Ambos **NO IMPLEMENTADOS**. Condiciones oficiales B2 consultadas y discrepancia de tarifas documentada en `BACKUPS-FUTUROS.md`; no cuentas, buckets, claves, costes ni copias externos creados. V.13 y todo contenido irrecuperable siguen requiriendo un backup verificable de alcance completo y rollback.

**Trabajo completado conservado:** el ensayo local de restauración y sus 3/3 pruebas permanecen acreditados; **no se repitieron**. Snapshot de 544 fuentes y evidencias privado conservado. También comprobados por SHA los snapshots anteriores de 538, 541 y 542 fuentes; ninguno modificado. Los resultados históricos no se cuentan como pruebas nuevas.

**Preparación concreta:** `V2-PREPARACION-PRIVADA.md` define orden, permisos, aislamiento, controles de acceso, riesgos de paquetes/firewall/reinicio y gates V.2–V.9. PeerTube privado propuesto en loopback y por túnel, sin abrir 80/443, sin dominio definitivo ni contenido real. La guía oficial advierte sobre cambiar hostname: esta instancia sería desechable y se recrearía al elegir dominio. El runner/gateway actual sigue en Mock; se documenta el cableado pendiente para PeerTube y un proyecto GMA/Auth local distinto. No se cambian la fixture ni sus credenciales, puertos o volúmenes.

**Dependencia pendiente:** EX-VPS-PRIVATE-01 preparada para consultar explícitamente el alcance privado V.2→V.3→V.4 con V.1 abierta. La decisión de aplazar backups no aprueba automáticamente esta excepción ni cambios de firewall, paquetes, cuentas o reinicio. La huella independiente del proveedor sigue pendiente; no se atribuye certificación al pin TOFU. gmaadmin/publickey/sudo ya están comprobados por evidencia anterior: no se recrean. noVNC no acreditado; reinicio/hardening del acceso exige recuperación probada y permiso específico. Los criterios de recuperación/persistencia de V.2–V.4 no se omiten ni se cierran por validar una plantilla.

**Comprobaciones efectivamente ejecutadas en este avance:** `ssh -G` local confirma el alias, comprobación estricta del host, solo identidad dedicada y sin forwarding/password fallback; no conexión remota. Permisos locales privada/config 0600 y pública 0644. SHA del artefacto v8.3.1 coincide con `b2026b99ee6a2e07098230bb68fafbad634b44ce5a67a3e48e0b163ba9b5304a`. Validador privado offline contra schema oficial y política GMA **1 verificación aprobada / 0 fallidas**, P2P apagado, HLS privado, DB/Redis loopback, `deployable:false`, `provisioned:false`; sintaxis Node correcta. No batería de aplicación nueva, no omisiones nuevas ni repetición de las 351/0/1 de F8. TypeScript/lint anteriores conservados; no se atribuye una ejecución nueva de esos comandos a cambios documentales/CJS/YAML.

**WIP y entrega:** fuentes de producto, package-lock, todas las migraciones y HEAD base intactos; staging vacío. Delta respecto al snapshot de 544 fuentes: siete documentos existentes y cuatro archivos nuevos de documentación/configuración/validador, sin código de aplicación modificado. `git diff --check` y whitespace de archivos nuevos correctos. Checkpoint nuevo `outputs/v1-private-preparation-snapshot-20261011`, 548 fuentes verificadas, separado del snapshot previo; sin env, work, claves ni dumps. Evidencia privada `work/vps-preflight/{private-lab-preparation-20261011.log,preservation-private-preparation-20261011.json}`.

**V.1 ABIERTA; V.2 NO INICIADA.** Bloqueos estrictos: identidad independiente, excepción explícita y aprobación/inspección de cada modificación. Dominio y backups definitivos no bloquean por sí solos el ensayo privado recuperable aprobado, pero no se declaran resueltos. Audit de 27 entradas/2 críticas mantiene el bloqueo de exposición pública. No conexión administrativa nueva, instalación, firewall/reboot/SSH-policy, producción, Supabase alojado, R2 real, PeerTube/P2P activado, stage/commit/push/deploy.
