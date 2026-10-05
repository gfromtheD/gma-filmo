# Redirección R2-first

## Punto de partida auditado

Rama `feature/upload-engine-v2`, commit `2ce609d312dfd0867fcf845f0fe5d1967721be4f`, árbol limpio antes de editar. La migración previa se conserva: no se reinicia el motor ni se altera el bucket histórico.

Implementación revisable en el commit local `979d72043714a43a6297af988570c2bdb5d6790e`. Consultar [validación y pruebas pendientes](PRUEBAS-R2-FIRST.md) para distinguir las pruebas locales de la integración externa.

| Clasificación | Componentes | Acción |
|---|---|---|
| Reutilizable | Borradores, relaciones por rol, reservas/ledger, propietario/RLS, idempotencia, revisiones, inbox/outbox, cancelación, edición/sustitución | Conservar contratos y pruebas |
| Generalizable | Sesiones, jobs/leases, reconciliación, publicación, selección HLS, configuración | Añadir proveedor y procesamiento R2 sin sustituir el dominio |
| Específico de Stream | tus, creación/recovery Cloudflare, observaciones, webhook HMAC, JWT de playback | Adaptador futuro opcional; desactivado por defecto |
| Faltante | Multipart/ListParts, verificación original, worker ffprobe/FFmpeg, perfiles HLS, entrega privada R2, métricas físicas | Implementar de forma aditiva |

La guía Next instalada no incluye `node_modules/next/dist/docs`. Se consultó la [documentación oficial de Route Handlers de Next 14](https://nextjs.org/docs/14/app/building-your-application/routing/route-handlers).

Referencias de implementación: [R2 multipart](https://developers.cloudflare.com/r2/objects/upload-objects/), [compatibilidad S3](https://developers.cloudflare.com/r2/api/s3/api/), [firmas R2](https://developers.cloudflare.com/r2/api/s3/presigned-urls/), [ffprobe](https://ffmpeg.org/ffprobe.html), [HLS en FFmpeg](https://ffmpeg.org/ffmpeg-formats.html#hls).

## Modelo final implementado

```text
Browser (SHA Worker + dos partes simultáneas)
  → API autenticada (reserva y autorización, nunca recibe la película completa)
  → PostgreSQL (draft/session/asset, revisión, ledger, permisos)
  → R2 multipart privado (16 MiB, ListParts autoritativo)
  → Complete backend + HEAD (recibo; ETag no es SHA)
  → uploaded / validating + job process durable
  → VideoProcessingWorker (SHA completo de los bytes + ffprobe)
  → processing / FFmpeg / verificación de playlists y decodificación
  → original privado + HLS + póster en R2
  → ready (lease vigente y escritura SQL cercada)
  → publicación transaccional mediante IDs internos
  → manifiestos controlados GMA / segmentos privados con URL temporal R2
```

### Qué se conservó

La migración anterior no se modifica. Se conserva su función de dominio mediante una versión aditiva que mantiene borradores, relaciones por propietario y rol, RLS, idempotencia, revisiones optimistas, cuotas/ledger, publicación, edición, sustitución y retirada de títulos. Se conservan imágenes/subtítulos normalizados, cancelación durable, jobs, reconciliación, SHA incremental del navegador y las 26 pruebas anteriores.

La cuota comercial usa el original esperado (principal 4 GiB, draft 6 GiB, propietario 10 GiB). PostgreSQL sigue siendo la autoridad. `gma_upload_policy.main_bytes` añade configuración del límite principal; el cliente mantiene la política inicial de 4 GiB, por lo que elevar el máximo exige actualizar también su política y validar capacidad del worker. Los minutos de Stream sólo se reservan para sesiones del adaptador Stream; R2 no los consume.

`original_bytes`, `processed_bytes`, `auxiliary_bytes`, métricas del intento y `gma_video_metrics` separan uso comercial y almacenamiento físico. No usar la suma física de HLS para cobrar de nuevo la reserva del original.

### Proveedor y Stream futuro

`VideoIngestProvider` separa el contrato del SDK. `R2VideoProvider` es la implementación activa; `FutureManagedVideoProvider` encapsula la transferencia futura de Stream. El normalizador de observaciones, tus, recovery por metadatos, webhook HMAC y JWT RSA de Stream se mantienen compilables. Sólo se construyen al operar un activo/sesión Stream. `STREAM_PROVIDER_ENABLED=false` impide nuevas sesiones Stream; no borra sus activos existentes ni bloquea su reproducción si sus claves opcionales están configuradas.

La instalación R2 no requiere token, webhook, customer code ni signing key de Stream. Mux u otro proveedor requerirían un adaptador real y sus pruebas, sin reescribir cuotas, drafts o publicación.

### Multipart y recuperación

- Clave `ingest/{owner}/{session}/{uuid}` generada en SQL, nombre original sólo como metadato.
- `object_key`, `multipart_upload_id`, `part_size`, `transfer_generation`, SHA, tamaño, expiración y revisión persisten junto a la sesión.
- Backend autoriza número/tamaño de parte y renueva URLs de hasta 15 minutos; el navegador sólo hace PUT de partes. Dos transferencias simultáneas como política inicial.
- ListParts paginado decide las partes recibidas; el browser no manda una lista de ETags para completar.
- Complete comprueba todas las partes y tamaños. HEAD recupera respuestas Complete perdidas y SQL fallido; SQL crea un solo job por sesión/generación.
- Una creación incierta se recupera con ListMultipartUploads de la clave exacta. No se hace otro Create a ciegas. Si no aparece o hay varios IDs, conservar reserva/error y revisar en staging; no iniciar de nuevo varios GiB silenciosamente.
- Tras recargar, reseleccionar File y comprobar SHA completo + tamaño antes de reanudar. Sólo se envían partes ausentes o de tamaño incorrecto. JWT 401 permite un refresh de sesión; error de parte provoca consulta del proveedor y nueva firma.
- Cancelar aborta multipart, conserva el estado y limpia por namespace del activo. La cuota no se libera antes de expiración/ausencia confirmada, ni con lease de procesamiento vivo o escrituras recientes. Hay tres minutos adicionales para volver a comprobar los writes R2 del worker.

### Procesamiento y almacenamiento

Una sola cola PostgreSQL y un worker audiovisual; el executor de API excluye `process`. Leases de 120 segundos, heartbeat, 12 intentos máximos y estado `dead`. Cada intento obtiene un prefijo SQL diferente: `media/{asset}/hls/{job}/{attempt}/`. Un worker antiguo no puede marcar ready ni sobrescribir los outputs del nuevo.

Original permanente: `media/{asset}/original/source`. Se copia una vez antes de ready; la reconciliación elimina el ingest después de confirmar ready. Esto evita conservar dos originales indefinidamente. La limpieza de auxiliares mantiene su ventana anterior por sus URLs de PUT.

La política versionada `gma-hls-v1` genera 1080/720/480 sólo cuando la fuente lo permite; fuentes menores usan su tamaño sin upscale. H.264 y AAC estéreo si existe audio, HLS VOD con master/variantes/segmentos y póster. ffprobe verifica duración, contenedor, codecs, dimensiones, FPS, canales, bitrate y streams. SHA se calcula leyendo el original completo, sin cargarlo entero en RAM. Se decodifican los outputs y se verifican referencias, tamaños, duración y HEAD R2 antes de ready.

Los archivos se procesan con argv fijo y sin shell, namespace de red/sistema de archivos, entorno sin secretos, hard rlimits y supervisión del tamaño temporal. Un `Dockerfile` prepara el worker Linux; esa imagen/aislamiento aún necesita prueba real en Linux. macOS sólo ha ejecutado fixtures confiables.

Un callback de fallo tardío o una respuesta SQL perdida después de ready no puede retirar el asset ni borrar sus derivados. Los temporales de intentos muertos se limpian sólo con marcador, antigüedad y comprobación del lease.

### Publicación y reproducción

La publicación exige que todos los roles adjuntos estén ready y utiliza IDs. La duración verificada mantiene el corte de 40 minutos entre corto y película. Los activos R2 publican `playback_kind=r2_hls`, Stream conserva su tipo y legacy conserva MP4/YouTube. No se reescriben ni se eliminan objetos históricos. El póster generado es el fallback si no hay un póster adjunto.

GMA entrega playlists pequeñas tras comprobar propietario o relación con un título publicado. Sólo se pueden pedir outputs enumerados y verificados. PostgreSQL verifica la pertenencia de cada segmento; las respuestas de estado y de segmentos omiten el inventario completo de HLS para no reenviarlo continuamente. Los segmentos/imagen se redirigen directamente a GET firmado de R2; el original no tiene endpoint público. Los segmentos no se transportan completos por Next/Vercel. Las URLs temporales son credenciales de lectura durante su vigencia: no constituyen DRM y una retirada no revoca una URL ya emitida inmediatamente.

El piloto debe medir el coste/latencia de comprobar permisos y firmar cada segmento. A mayor tráfico puede trasladarse esa entrega a un edge Worker con el mismo contrato; no es requisito de este MVP.

## Configuración externa necesaria

El preflight local encontró ausentes las variables reales Supabase/R2 y del worker. No hubo operaciones contra los servicios ni cambios en producción.

1. Proyecto Supabase de staging separado: URL, anon key, service-role y conexión PostgreSQL para preflight/migración; un usuario creador de prueba. Comprobar el esquema efectivo antes de aplicar las dos migraciones en orden. Inventariar legado y ajustar uso real antes de `legacy_inventory_verified=true`.
2. Cuenta R2 y bucket privado nuevo, credenciales restringidas a ese bucket. Configurar CORS con el dominio de staging para PUT/GET/HEAD, headers y Range. Ejemplos en `infrastructure/r2/`; no se han aplicado. No cambiar `gma-media` ni su dominio público.
3. Worker Linux con bubblewrap/FFmpeg/ffprobe, CPU/RAM/scratch dedicados, secretos inyectados, supervisor y executor de reconciliación. Requisitos y límites en `infrastructure/video-worker/README.md`.
4. Hosting web con las variables de `.env.uploads.example`; `NEXT_PUBLIC_UPLOAD_ENGINE_V2` se incorpora durante build. Activar primero staging y worker, después admisión. Las flags quedan desactivadas en el ejemplo; `VIDEO_PROVIDER=r2` es el default.
5. Observabilidad: jobs dead, intentos/reintentos, leases, cola, disco temporal, multipart abiertos, sesiones abandonadas, bytes HLS y divergencias de cuota. `uploads:storage-audit` es un inventario paginado de sólo lectura; detecta objetos huérfanos, recibos sin SQL y HLS incompleto. Revalidar los hallazgos antes de cualquier reparación.

## Recursos/costes obligatorios para el MVP

PostgreSQL/Supabase, almacenamiento y operaciones R2, hosting de la API y una máquina/contenedor persistente para FFmpeg con disco temporal. No es obligatorio contratar Stream, Mux, Kubernetes o un servicio nuevo de transcodificación. Un ordenador de desarrollo sirve para pruebas; el servicio público necesita un worker disponible y supervisado.

El gasto dependerá de originales retenidos, HLS generado, operaciones multipart/lectura y horas CPU. Consultar [tarifas oficiales R2](https://developers.cloudflare.com/r2/pricing/) y el plan real de Supabase/Vercel/compute. No se ha fijado presupuesto ni capacidad de usuarios: faltan mediciones de películas largas y del tráfico de reproducción.

## Estado de entrega y riesgos

- **IMPLEMENTADO:** dominio conservado + multipart + worker + HLS + entrega controlada + migración + configuración + rollback.
- **PROBADO LOCALMENTE:** contratos/SQL, PostgreSQL real, navegador con transporte R2 simulado, responsive, TypeScript/lint/build.
- **PROBADO CON FFMPEG REAL:** fuentes sintéticas, HLS/decodificación y pipeline SQL con almacenamiento simulado.
- **PROBADO CONTRA R2 REAL:** pendiente por credenciales. Los mocks no validan CORS, firmas ni comportamiento real del proveedor.
- **PENDIENTE DE PILOTO:** Linux sandbox/imagen, fallos reales R2, películas largas/4 GiB, throughput, costes, móviles reales y Safari/Firefox.
- **PRODUCCIÓN:** pendiente; sin push ni despliegue en esta entrega.

Riesgos concretos: creación multipart incierta que necesite intervención; writes externos tardíos que deban detectarse por inventario; archivos HDR/rotados rechazados por la política inicial; capacidad de worker y colas sin medir; firmas/CORS/Range aún no probados en R2; imagen Linux no ejecutada; dependencia Next con vulnerabilidad crítica ya detectada en el inventario previo. Esa vulnerabilidad requiere una actualización compatible y regresión antes de producción; esta redirección no cambia el framework a una versión mayor automáticamente.

## Checklist de piloto y producción

- [x] Verificar rama/commit, conservar dominio y migración previa.
- [x] Proveedor R2 por defecto, Stream opcional.
- [x] Multipart, recovery, cuotas, SHA, cancelación y jobs.
- [x] ffprobe/FFmpeg reales → HLS, SQL ready y publicación local.
- [x] Reproducción real HLS/MP4 en Chrome y regresión responsive.
- [x] Documentar rollback y configuración sin secretos.
- [ ] Verificar esquema/policies efectivos de Supabase staging y aplicar migraciones.
- [ ] Inventariar cuota histórica y reconciliar el ledger.
- [ ] Ejecutar `uploads:r2-smoke` en bucket aislado y pruebas reales de navegador/CORS/Range.
- [ ] Probar aislamiento/rlimits/imagen en Linux y caída real del worker.
- [ ] Piloto extremo: 4 GiB, corte de red/JWT/URL, dos pestañas, pérdida de respuesta, cancelación y limpieza.
- [ ] Verificar publicación, sustitución y reproducción de los derivados realmente almacenados en R2.
- [ ] Medir archivos largos, disco, CPU, memoria, tiempo, tamaños y coste.
- [ ] Safari/iOS nativo, Firefox, Android, subtitles/fullscreen/recuperación de posición reales.
- [ ] Resolver auditoría de dependencias y acordar límites operativos/alertas.
- [ ] Ensayar rollback en staging; activar la puerta de producción sólo después de revisar el piloto.

## Rollback

1. `UPLOADS_PAUSED=true`: detener nuevas reservas conservando flags v2 y sesiones existentes. Las acciones de recuperación, cancelación, lectura y reproducción siguen disponibles.
2. Si falla procesamiento, `VIDEO_PROCESSING_ENABLED=false`: pausar la toma de nuevos jobs. Detener el worker con su supervisor; los leases vencen y los intentos quedan recuperables. No eliminar originales ni marcar ready manualmente.
3. Mantener executor/reconciliación para limpiar cancelaciones, conservar cuotas y detectar discrepancias. No reactivar jobs dead masivamente; reparar la causa y revisar el intento concreto.
4. Restaurar el último despliegue R2 compatible manteniendo esquema aditivo y credenciales privadas. No ejecutar down migration, borrar buckets ni cambiar visibilidad del legado.
5. No desplegar `2ce609d` como rollback de datos R2: esa versión no reconoce multipart/HLS R2. Tampoco apagar v2 y dejar abierto el presign legacy como sustitución automática. Conservar v2 pausado hasta recuperar una versión compatible.
6. Tras corrección/piloto, reanudar worker y comprobar inventario/ledger; quitar `UPLOADS_PAUSED` al final. Guardar copia de seguridad PostgreSQL antes de toda migración/release.
