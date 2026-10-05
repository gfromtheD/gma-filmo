# Motor de subidas v2 — entrega local y activación pendiente

Fecha: 2026-10-05. Rama: `feature/upload-engine-v2`. Base comprobada antes de editar: `93fbea02b0e69eb7d3f054b59e55f9caa6a37351`. El informe investigaba `25b706e`; la diferencia hasta esta base incluye la documentación. Se ha conservado el trabajo previo de dependencias y módulos de subidas.

## Estado de la entrega

| Nivel | Estado | Evidencia / límite |
|---|---|---|
| Implementación local | Implementada y comprobada en pruebas aisladas | SQL, permisos, cuotas, estados, contratos, proveedores simulados, interfaz y compilación |
| Integración con Supabase/R2/Stream reales | Pendiente | Sin credenciales utilizables; inventario y piloto externos bloqueados |
| Preparación para producción | Configuración y procedimiento preparados; activación bloqueada | Banderas desactivadas, cuota sin inventario y presupuesto/calidad/piloto sin aceptación real |

No se han aplicado migraciones externas, subido archivos reales ni desplegado producción. Un build correcto no valida transcodificación, facturación, permisos reales o CORS.

## SUB-R02 / SUB-R03: reproducción y corrección

`tests/uploads/providers.test.ts` ejecuta la ruta histórica obtenida del commit base con almacenamiento y autenticación simulados. Dos solicitudes concurrentes de 4 GiB con `sessionUsed=0` reciben autorización para 8 GiB aunque la sesión nominal permite 6 GiB. Una consulta SQL fallida también recibía HTTP 200. Esto reproduce defectos del código; no identifica por sí solo la causa exacta del intento original del usuario sin su traza.

La consulta histórica ahora devuelve 503 ante error SQL. Las reservas del nuevo motor se realizan dentro de PostgreSQL antes de entregar una URL. Un bloqueo global y un orden fijo de bloqueo serializan el cálculo global/propietario/borrador. Los errores nunca se convierten en cuota cero. La ruta histórica continúa siendo el modo de compatibilidad cuando la bandera está apagada: su autorización no tiene las garantías atómicas de v2. Cuando v2 está activo, sus rutas de transferencia antiguas devuelven 410 y la publicación exige un borrador.

La prueba PostgreSQL real usa conexiones independientes: de diez reservas de 100 bytes con un máximo global de 500, exactamente cinco pasan; veinte reintentos conservan la misma sesión; veinte trabajadores obtienen una sola concesión; se recupera una concesión vencida y se rechaza el trabajador antiguo. El clúster temporal se detiene y elimina al terminar.

## Archivos y responsabilidades

| Área | Ubicación |
|---|---|
| Política, contratos y configuración | `lib/uploads/policy.ts`, `contracts.ts`, `config.ts`, `.env.uploads.example` |
| Persistencia y permisos | `supabase/migrations/20261005_upload_engine_v2.sql`, `lib/uploads/repository.ts` |
| Orquestación y reconciliación | `lib/uploads/service.ts`, `scripts/uploads/executor.ts`, `app/api/uploads/jobs/route.ts` |
| Stream, firma y observación | `lib/uploads/stream.ts`, `app/api/webhooks/stream/route.ts` |
| R2, imágenes y subtítulos | `lib/uploads/auxiliary.ts`, `app/api/media/[id]/route.ts`, `app/api/subtitle-proxy/route.ts` |
| Borradores/sesiones y acciones | `app/api/upload-drafts/**`, `app/api/uploads/**` |
| Cliente y hash incremental | `lib/uploads/browser.ts`, `workers/upload-hash.worker.ts`, `client-models.ts` |
| Interfaz conservada | `studio-upload-view.tsx`, `studio-upload-orbital.tsx`, perfiles y onboarding |
| Edición/publicación/retiro | `app/api/titles/**`, `studio-edit-modal.tsx`, `studio-screen.tsx` |
| HLS / compatibilidad | `hooks/use-stream-playback.ts`, `player-screen.tsx`, `lib/supabase/queries.ts`, `types/catalog.ts` |
| Pruebas | `tests/uploads/**`, `playwright.uploads.config.ts`, pruebas existentes de responsive |

## Persistencia, cuota e idempotencia

- Borradores por propietario, revisión optimista, metadatos en servidor y recuperación al volver a entrar. El almacenamiento local histórico queda separado por usuario; no se reutiliza el antiguo borrador global.
- Una sesión corresponde a un activo. Relaciones de borrador y título incluyen rol, posición e idioma: principal, tráiler, extras, intro, carteles, subtítulos y avatar. Principal y roles únicos tienen cardinalidad; extras son múltiples y subtítulos se distinguen por idioma.
- Reservas de bytes fuente y segundos máximos de vídeo para global, usuario y borrador. Confirmación sustituye los segundos reservados por duración comprobada. Cancelar no libera cuota hasta confirmar la limpieza y cerrar la ventana de transferencia emitida. La limpieza que espera esa fecha se reprograma directamente al vencimiento para evitar agotar reintentos antes de tiempo.
- Defaults: principal 4 GiB; tráiler/extras 1 GiB; intro 500 MiB; cartel 10 MiB; subtítulos/avatar 5 MiB; borrador 6 GiB; propietario 10 GiB; global comercial 100 GiB; global Stream 1000 minutos; propietario Stream 600 minutos; tres transferencias activas y veinte borradores activos por propietario. Son límites configurables en la tabla de política, no límites del proveedor ni una promesa de plan gratuito.
- El máximo reservado por rol es 4 h principal, 1 h extras, 10 min tráiler y 5 min intro. Un vídeo breve puede reservar inicialmente mucho más de su duración: es una política conservadora que debe calibrarse en el piloto.
- Clave de idempotencia del cliente + huella semántica estable, independiente de la revisión. Publicación y confirmaciones duplicadas no duplican título/cuota. Las revisiones detectan modificaciones concurrentes y sustituciones basadas en metadatos antiguos.
- RLS: lectura propia, sin escrituras directas ni ejecución de operaciones privilegiadas para navegador. Las rutas verifican el token con Supabase. La visibilidad de títulos retirados también se restringe en SQL, manteniendo contenidos históricos publicados o con estado nulo.
- Borrados de cuenta pasan por limpieza durable antes de quitar autenticación/propiedad. El modo histórico de cuenta sigue disponible antes de instalar la migración. El ejecutor completa la eliminación una vez liberadas todas las reservas; no elimina objetos históricos de `gma-media`.

**Semántica de métricas:** `expected_input_bytes` es la entrada comercial; `received_bytes` es la recepción validada; `provider_reported_size` registra el tamaño que Stream informa y no se sustituye por la entrada; `duration_seconds` determina los minutos. Los bytes comerciales no equivalen a almacenamiento físico R2 ni a minutos entregados por CDN.

## Transferencia y recuperación

Vídeo: creación tus en backend y transferencia directa en navegador con `tus-js-client`, fragmentos de 5 MiB, una transferencia a la vez, reintentos acotados. No se utiliza Uppy ni sus callbacks S3. El identificador se toma de `stream-media-id`; se conserva la URL de transferencia. [Contrato tus de Cloudflare](https://developers.cloudflare.com/stream/uploading-videos/resumable-uploads/).

SHA-256 completo se calcula en un worker en fragmentos de 8 MiB. Sirve para exigir el mismo archivo al reseleccionar; **no afirma que Stream haya comprobado el digest original**. El backend comprueba longitud y offset tus y persiste la recepción antes de que desaparezca la URL. Si no puede verificarla, la publicación queda bloqueada. Un estado de procesamiento observado durante la transferencia no la marca como completada.

Antes del POST externo se guarda intención durable. Si se pierde la respuesta, se busca por propietario y correlación. No se repite ese POST a ciegas. Si aparece el vídeo pero se perdió su URL de recepción, se conserva su UID y se exige cancelar/limpiar y crear una nueva sesión; si no puede establecerse su existencia/ausencia, requiere revisión del operador y la cuota permanece retenida.

R2: PUT únicamente a `ingest/propietario/sesión`. El servidor comprueba longitud, lee con ETag, compara digest y decodifica. Genera WebP sin metadatos o VTT analizado y normalizado. La salida definitiva está limitada a 4 MiB para la ruta de entrega; una salida mayor se rechaza explícitamente, aunque la entrada sea válida por tamaño.

El navegador nunca recibe una firma para `ready/propietario/activo`. La escritura final usa condición de inexistencia y huella de la salida normalizada. La cancelación coloca un marcador de cero bytes que impide que un trabajador antiguo restaure el archivo. No se borran estos marcadores con una regla de ciclo de vida sobre todo `ready/`. La reserva de R2 se conserva hasta que expire la posibilidad de reutilizar PUT y se confirme que no hay entrada ni contenido final. [Semántica de URLs prefirmadas](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).

Los borradores listos sin publicar se retiran tras siete días de retención; un avatar sin referencia pública se limpia tras la ventana de recepción. La reconciliación elimina entradas sobrantes después de expirar sus firmas, conserva relaciones publicadas y atiende sesiones pendientes sin depender del navegador.

## Eventos y ejecución durable

Webhooks: HMAC del cuerpo original y tolerancia temporal de cinco minutos; deduplicación de eventos y trabajo persistente. El evento despierta una verificación contra la API del proveedor. Solo se acepta listo con `readyToStream=true`, estado ready, `pctComplete` numérico 100, duración permitida y recepción comprobada. [Webhooks de Stream](https://developers.cloudflare.com/stream/manage-video-library/using-webhooks/).

Las respuestas RPC compuestas admiten tanto fila como lista de una fila, y la migración recarga la caché de esquema de PostgREST. [Contrato RPC y caché de esquema](https://docs.postgrest.org/en/stable/references/api/functions.html).

Trabajos con exclusión mutua, vencimiento de concesión, reintentos y estado `dead` tras doce intentos. La reconciliación usa una selección limitada y justa; no vuelve a elegir siempre los mismos treinta activos. Un trabajo muerto exige inspección y reanudación administrativa; debe alertarse mediante un monitor del ejecutor. No se declara recuperado por ocultar ese error.

El ejecutor persistente `scripts/uploads/executor.ts` puede operar fuera de Vercel. Alternativamente, un planificador externo invoca POST `/api/uploads/jobs` con `Authorization: Bearer UPLOAD_EXECUTOR_SECRET`; procesa un trabajo por invocación con límite explícito de 60 segundos. No se instala un cron de frecuencia incompatible con Hobby. El planificador, su disponibilidad y las alertas deben configurarse externamente.

## Publicación, edición y reproducción

Publicación transaccional desde borrador propio, activos listos y relaciones completas; clasificación por duración del proveedor. La edición de metadatos ahora guarda de verdad y verifica la revisión. La sustitución usa un borrador creado con `title_slug`, mantiene el slug y el MP4 histórico, y retira los activos v2 anteriores después del cambio atómico. Esta operación está preparada en API; no se añade un rediseño visual para sustituir vídeo dentro del modal de metadatos.

HLS: manifiestos firmados, soporte nativo o hls.js, buffers limitados, renovación del token y recuperación de posición. Los títulos antiguos siguen usando MP4/YouTube. Las fuentes auxiliares y sus idiomas/orden están disponibles en `/api/titles/slug/media`; la ampliación visual de extras queda para la reorganización posterior. Las miniaturas MP4 antiguas no se intentan generar desde el manifiesto HLS.

## Las diez correcciones del informe, sección 12

| Nº | Incorporación local | Validación real pendiente |
|---|---|---|
| 1 | Commit verificado; edición persistente; reordenación conserva roles; quitar limpia selección y sesión; avatar/onboarding integrado | Flujos reales por cuenta |
| 2 | Aceptación explícita de hasta 1080p/SDR/estéreo sin máster; minutos separados de bytes | Aprobar calidad y presupuesto; monitorizar entrega. No hay archivo máster ni multipart en esta fase |
| 3 | Sesiones/borradores durables; recepción/proveedor/minutos diferenciados | Comparar métricas del proveedor |
| 4 | SHA completo incremental para reselección; ninguna afirmación de digest Stream | Reselección/interrupción real |
| 5 | 100 numérico; HMAC/replay; observación del proveedor | Webhook único por cuenta y cuenta Stream dedicada por entorno |
| 6 | tus directo con fragmentos/reintentos acotados; R2 solo auxiliares pequeños; completado en backend | Navegadores/redes reales; multipart excluido porque no se ofrece archivo máster |
| 7 | Ingest separado, normalización, clave final condicional y marcador de cancelación | Firmas reutilizadas y escrituras tardías en R2 real |
| 8 | PostgreSQL aislado real; preflight SQL; migración aditiva; ejecutor externo preparado | Inventario efectivo Supabase, recursos aislados y ejecución continua |
| 9 | Proxy con dominio cerrado/HTTPS/sin redirecciones/límite; CSP Stream/tus/HLS | CORS del bucket y orígenes reales |
| 10 | Flags apagadas; inventario bloquea reservas; puerta de producción; checklist de piloto | Evidencia de calidad, capacidad, limpieza, gasto y seguridad antes de activar |

## Configuración y acceso externo necesarios

La comprobación local no encuentra credenciales de Supabase, R2 o Stream utilizables. `.env.local` contiene solo la variable OIDC de Vercel. El intento de leer valores de Vercel recibió HTTP 403; el archivo temporal de producción tenía valores redactados. Los nombres de variables conocidos por la investigación no demuestran su configuración efectiva actual.

1. **Supabase de pruebas:** URL pública/anon, URL servidor/service-role y conexión PostgreSQL para inventario/migración. Debe ser distinto del proyecto de producción. Comprobar columnas/tipos/FK/políticas/funciones actuales con `scripts/uploads/preflight.ts`; no ejecutar seeds ni migraciones históricas que trunquen contenido.
2. **R2 privado de pruebas:** credenciales limitadas al nuevo bucket; CORS para PUT desde los orígenes del piloto. GET/HEAD del servidor no necesitan exponer públicamente el bucket. Regla de ciclo de vida solo sobre `ingest/`, con al menos dos días y superior a la ventana de firma; no sobre activos finales o marcadores.
3. **Stream:** cuenta aislada, token API, customer code, webhook secret y clave de firma RSA (PEM o base64 del PEM con su ID). Una cuenta tiene un único webhook; no compartirlo entre producción y pruebas. Los vídeos se crean con reproducción firmada.
4. **Vercel/ejecutor:** permiso para inspeccionar configuración y crear preview; confirmar el runtime y límites efectivos. Guardar secretos de servidor sin prefijo NEXT_PUBLIC. El ejecutor necesita acceso continuo, secreto y alertas de trabajos muertos, retraso y uso de proveedor.
5. **Inventario/cuota:** registrar la ocupación previa de cada propietario y global, incluidos activos existentes de Stream ajenos a v2. Sembrar `used_bytes`/`used_seconds` con métricas verificadas, sin inferir que un `file_size_bytes=0` significa objeto vacío. Solo entonces marcar `legacy_inventory_verified=true`. En un proyecto aislado recién inventariado vacío, la ocupación confirmada puede ser cero.
6. **Decisiones de piloto:** aceptar transformación visual/audio y ausencia de máster; fijar presupuesto de almacenamiento y minutos entregados. La cuota interna limita entradas y minutos almacenados; **no impone un techo monetario al tráfico CDN**. Hace falta monitorización/alerta real de entrega antes de producción.

El preflight imprime presencia de variables, esquema/políticas y configuración CORS/lifecycle/webhook mediante consultas de lectura; no imprime valores secretos ni crea recursos. Para cargar variables locales: `node --env-file=.env.uploads.local --import tsx scripts/uploads/preflight.ts`. Activar `UPLOAD_PREFLIGHT_PROVIDERS=true` solo para comprobar los proveedores elegidos.

## Orden de integración y rollback

1. Crear recursos aislados y completar inventario efectivo. Copiar `.env.uploads.example` a un archivo local ignorado y rellenarlo fuera de Git.
2. Aplicar únicamente la migración nueva a pruebas tras cotejar el esquema; verificar RLS con dos usuarios y visitante. Los scripts locales usan fixtures mínimas del contrato histórico y no certifican el esquema remoto.
3. Configurar CORS/lifecycle, webhook y ejecutor. Inventariar y actualizar política/cuotas. Aprobar la política de calidad.
4. Habilitar ambas banderas en preview, con `UPLOAD_ENVIRONMENT=staging`, `UPLOAD_ISOLATION_ACK=true`. La bandera pública exige reconstruir el cliente.
5. Ejecutar el piloto de la sección siguiente. Resolver cualquier divergencia sin atribuir éxito a tests simulados.
6. Producción solo tras evidencias aceptadas y revisión de dependencias: `UPLOAD_PRODUCTION_READY=true`, entorno production y ambas banderas true. Migración antes del código que usa edición/RLS; no activar admisión durante ese intervalo.
7. Rollback: `UPLOADS_PAUSED=true` bloquea nuevas autorizaciones/publicación, incluyendo rutas antiguas. Apagar flags v2 y reconstruir interfaz si procede; conservar credenciales, ejecutor y claves de reproducción hasta drenar trabajos. No retirar tablas ni restaurar URLs públicas para activos privados.

## Pruebas locales y piloto bloqueado

Pruebas ejecutadas y resultados finales se registran en `RESULTADOS-PRUEBAS-MOTOR.md`. Comandos reproducibles:

- `npm run test:uploads`: PostgreSQL embebido, proveedores simulados y reproducción de la ruta del commit base.
- `npm run test:uploads:concurrency`: PostgreSQL independiente con `PG_BIN_DIR` y `UPLOAD_TEST_TEMP` dentro de la carpeta aislada. El paquete de binarios no es una dependencia de producción. [Origen del paquete utilizado](https://github.com/leinelissen/embedded-postgres).
- `npm run test:uploads:browser`: worker y transferencia en navegador, con respuestas externas interceptadas.
- Pruebas responsive de subidas/estudio: modo histórico apagado, móvil/tablet/escritorio.
- TypeScript, lint y build. Los avisos de imágenes y el aviso existente de DM no certifican ni bloquean calidad audiovisual.

Pendientes externos concretos, todos necesarios antes de producción:

- [ ] Inventario del esquema efectivo y ocupación de Supabase/R2/Stream; aplicar migración aislada y comprobar políticas reales.
- [ ] Transferencias reales pequeñas y cerca de los límites, vídeo >200 MB, fragmentos tus, múltiples usuarios y agotamiento de cuota/minutos/capacidad del proveedor.
- [ ] Corte de red, recarga/cierre, reelección idéntica/distinta, pérdida de respuesta POST, pausa/cancelación y expiración en dispositivos reales.
- [ ] Webhook autenticado/replay/fuera de orden y único por entorno; trabajador caído, reintentos, dead jobs y reconciliación sin navegador.
- [ ] R2: PUT repetido, identidad/tipo corruptos, clave final protegida, cancelación durante validación, expiración y marcadores sin resurrección.
- [ ] Publicar/editar/retirar/sustituir, múltiples extras e idiomas, avatar de onboarding y eliminación completa de cuenta con limpieza real.
- [ ] HLS en Safari/iOS y hls.js en escritorio/Android, expiración/renovación/seek, red lenta, MP4 antiguos y subtítulos.
- [ ] Calidad: fuentes 4K/HDR/múltiples pistas y audio multicanal; aprobar conscientemente la salida y ausencia de máster.
- [ ] Medir duración, tamaño fuente/recepción/proveedor/final y minutos entregados; fijar presupuesto y comprobar alertas del proveedor.
- [ ] Revisar vulnerabilidades de dependencias antes de despliegue: la auditoría actual de dependencias de producción registra 21 avisos, incluido uno crítico en Next. No se ha forzado una migración mayor del framework dentro del motor.
