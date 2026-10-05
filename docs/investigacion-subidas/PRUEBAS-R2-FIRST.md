# Validación de la redirección R2-first

Fecha: 5 de octubre de 2026. Base auditada: `2ce609d312dfd0867fcf845f0fe5d1967721be4f` en `feature/upload-engine-v2`.

Código, migración, configuración y pruebas guardados en el commit local `979d72043714a43a6297af988570c2bdb5d6790e` (`feat: redirect upload engine to R2 multipart and GMA HLS processing`). Las pruebas finales de PostgreSQL y FFmpeg y el build/TypeScript incluyen la última versión de esta migración. No se ha hecho push ni despliegue.

## Resultados

| Prueba / gate | Resultado | Alcance |
|---|---|---|
| Contratos, proveedores y SQL | 49/49 | 26 anteriores conservadas + 23 R2/pipeline/fallos; PGlite y proveedores simulados |
| PostgreSQL 17.10 real | 1/1 | 20 conexiones; contención de cuota, idempotencia, leases, 20 finalizaciones R2 → un job |
| FFmpeg/ffprobe 9.0 reales | 2/2 | Fuente sintética de siete segundos; HLS 720/480, sin upscale, AAC, póster, decodificación completa, corrupción/HLS incompleto/timeout rechazados; worker + SQL con storage simulado |
| Chrome / navegador | 4/4 | HLS y MP4 reales, seek/pausa/layout; auxiliares; multipart, reload, SHA distinto, respuesta de parte perdida, firma caducada y refresh JWT 401; proveedor/API simulados |
| Responsive existente | 8/8 | Subidas a 320/768/1440, cola, estudio/perfil, giro y reproductor móvil/horizontal |
| TypeScript | Correcto | Sin errores |
| Lint | Correcto | Tres avisos previos: cleanup de ref DM y dos imágenes HTML en el estudio |
| Build Next | Correcto | Incluye rutas multipart y HLS privadas; no equivale a integración externa |

El navegador real detectó el problema de conexión HLS durante la intro. Se corrigió conectando el hook cuando el vídeo puede montarse. La prueba reproduce el camino real con hls.js, sin sustituir `play` por un mock. MP4 legacy usa Range y reproducción real. Las pruebas responsive anteriores conservan sus fixtures de controles.

El caso de R2 completo + SQL no disponible usa el `UploadService` real con R2 simulado: Complete ocurre una vez, SQL falla, el job queda pendiente y el reintento recupera HEAD sin crear otra subida ni otro job. Otro caso ejecuta FFmpeg real y pierde la respuesta SQL después de confirmar ready; los outputs permanecen disponibles.

La cancelación comprueba que no se libera cuota con lease vivo/writes recientes. Un callback de fallo tardío no puede retirar un medio ready. Un worker agotado acaba en dead y cancelación durable. El janitor conserva temporales con lease vivo y elimina el intento muerto después de su margen. El inventario detecta derivados/originales huérfanos y playlists incompletas sin borrar objetos.

## Repetir localmente

```sh
npm run test:uploads
npm run test:uploads:r2
npm run test:uploads:concurrency
npm run test:uploads:ffmpeg
npm run test:uploads:browser
npm run test:responsive -- --grep 'subida:|estudio|perfil creador|editar|reproductor:'
npx tsc --noEmit
npm run lint
npm run build
```

- Concurrencia requiere `PG_BIN_DIR` y `UPLOAD_TEST_TEMP` apuntando a PostgreSQL real y temporales del workspace; el runner crea y destruye su propia base. No usar una base Supabase real como fixture.
- FFmpeg requiere `FFMPEG_PATH`, `FFPROBE_PATH` y `VIDEO_TEST_TEMP`. Se usa el modo explícito `local-test` sólo para fuentes sintéticas confiables.
- Para que las dos pruebas de reproducción no se salten: configurar esos binarios y `VIDEO_BROWSER_FIXTURE`, ejecutar `npm run uploads:hls-test-fixture`, mantener `VIDEO_BROWSER_FIXTURE` al ejecutar `test:uploads:browser`.
- No ejecutar build/dev/responsive simultáneamente porque comparten `.next`. Los fixtures públicos temporales se eliminan al terminar las pruebas.

Binarios de prueba macOS arm64 guardados únicamente en `Documents/Codex/Temporal/gma-filmo/ffmpeg`, fuera de Git. [Distribución y checksums del compilador de los binarios](https://www.osxexperts.net/):

```text
ffmpeg  591260c945d0eef150e3bf82b0ef988bd36a9cecc18ff05d6679617159f0a95e
ffprobe e11c17e8200b3ee4c4c186d245e2b4053f01d56957336c1817fca0b997469106
```

Se comprobaron ambos SHA antes de ejecutarlos. Producción debe usar su imagen/binarios Linux y verificar sus propias versiones. Docker/bubblewrap no se ejecutaron en este Mac.

## Pruebas externas bloqueadas

| Pendiente | Acceso/recurso necesario | Qué comprobar |
|---|---|---|
| Esquema efectivo, RLS y migraciones staging | URL/anon/service-role y PostgreSQL de un proyecto aislado | Preflight, esquema real, backup, inventario legacy y ledger |
| R2 real | Account ID, bucket privado separado y claves restringidas | Create/ListParts/signatures/Complete/HEAD/Copy/PUT/GET/Abort/delete paginado |
| Navegador contra R2 | Dominio de staging, CORS real, usuario creador | PUT directo, firmas, Range, internet interrumpido, expiraciones, dos pestañas |
| Procesamiento externo | Linux con namespaces, bubblewrap, FFmpeg/ffprobe, secretos y scratch | Red/FS aislados, CPU/memoria/disco, matar/reiniciar worker, lease y salidas reales R2 |
| Piloto producto | Archivos legales representativos y cuentas de prueba | 4 GiB, varias horas, codecs/SDR, publicación/sustitución, reproducción y cleanup |
| Compatibilidad dispositivos | Safari/iOS, Firefox, Android y tablet reales | HLS nativo/hls.js, fullscreen, subtítulos y posición |
| Producción | Piloto aprobado, dependencias corregidas, monitorización y rollback ensayado | Capacidad, costes y autorización del release |

El preflight local sólo encontró el token OIDC de Vercel en el archivo local, no credenciales operativas Supabase/R2. No se utilizaron secretos redactados, no se modificó la base externa ni se desplegó.

## Herramientas listas para el piloto

- `npm run uploads:preflight`: configuración y consultas de sólo lectura, sin imprimir secretos Stream.
- `npm run uploads:r2-smoke`: requiere `UPLOAD_ENVIRONMENT=staging`, gates de aislamiento y `UPLOAD_R2_SMOKE_ACK=isolated-bucket-only`; crea unos 5 MiB con UUIDs propios, prueba firmas/partes/copia/derivados/lectura y limpia su namespace. No se ha ejecutado aquí.
- `npm run uploads:storage-audit`: inventario paginado R2 + PostgreSQL READ ONLY; no borra, no concede visibilidad pública y no migra legado.
- `npm run uploads:video-worker`: proceso Linux independiente; exige aislamiento.

Estados finales: **IMPLEMENTADO**, **PROBADO LOCALMENTE**, **PROBADO CON FFMPEG REAL**. **R2 REAL**, **PILOTO** y **PRODUCCIÓN** siguen pendientes.
