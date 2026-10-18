# Runbook del motor multimedia GMA-Filmo

Aceptación funcional **solo local: Fase 8 CERRADA (2026-10-11)**. El detalle y los resultados definitivos se registran en `EVIDENCIAS-IMPLEMENTACION.md`. La exposición externa sigue bloqueada por `DEPENDENCIAS-SEGURIDAD.md`; preparación local y autorización para publicar son gates diferentes.

## Entorno aislado y datos existentes

```sh
npm run media:local:prepare
npm run media:local:start
npm run media:preflight
```

El runner exige proyecto literal `gma-filmo-media-local`, DB `127.0.0.1:54342`, Auth/PostgREST `127.0.0.1:54341`, GMA `127.0.0.1:4318`, gateway `127.0.0.1:4319` y puertos Docker ligados a loopback. Mock está activado; PeerTube, Stream y P2P apagados. CLI Supabase local fijada en package-lock. No ejecutar login/link/db push contra una instancia alojada. `.env.media.local`, owner, credenciales y claves son privados, no se imprimen ni se versionan.

`media:local:stop` conserva volumen/spool/keys/env; `start` valida las credenciales existentes sin cambiar contraseñas ni revocar sesiones Auth. `media:local:reset` es destructivo y **no pertenece a la batería sobre esta fixture**. Tampoco ejecutar `test:media:local-runner-live` sobre ella: esa prueba anterior hace reset; sus cuatro criterios de Fase 5 se conservan y el reinicio actual se acepta con E02, sin reset.

El creador A conserva un borrador previo; no abandonarlo para preparar un test. E02 usa B, exige cero borradores activos de B y solo limpia IDs creados por el propio test. E01 puede usar `MEDIA_E2E_ACTOR=creator-b` para no adoptar el borrador de A. Si la cuenta elegida contiene otro borrador, parar y revisar su procedencia; no limpiar masivamente.

## Baterías reproducibles

```sh
npm run test:media:unit
npm run test:media:integration
PG_BIN_DIR=/opt/homebrew/opt/postgresql@17/bin npm run test:media:concurrency
npm run test:media:peertube-contract
npm run test:media:operations
npm run test:media:local-live
MEDIA_LOCAL_LIVE_ACCEPTANCE=true npx tsx --test tests/media/operations-live.test.ts
MEDIA_E2E_ACTOR=creator-b npm run test:media:e2e
npm run test:media:studio
npm run test:media:studio:browser
npm run test:responsive
npm run test:secondary
npx playwright test --config playwright.media.config.ts
npm run test:support
npm run test:uploads
npm run test:uploads:r2
VIDEO_BROWSER_FIXTURE="$PWD/work/media-phase8-legacy-playback" FFMPEG_PATH=/opt/homebrew/bin/ffmpeg FFPROBE_PATH=/opt/homebrew/bin/ffprobe npm run uploads:hls-test-fixture
VIDEO_BROWSER_FIXTURE="$PWD/work/media-phase8-legacy-playback" npm run test:uploads:browser
VIDEO_TEST_TEMP="$PWD/work" FFMPEG_PATH=/opt/homebrew/bin/ffmpeg FFPROBE_PATH=/opt/homebrew/bin/ffprobe npm run test:uploads:ffmpeg
```

La batería acumulada adicional usa `tests/media/*.test.ts` y `*.test.mjs` excepto los cinco runners gated (`database-concurrency`, `gateway-process`, `local-runner-live`, `local-stack-live`, `operations-live`) y añade `tests/media/studio/*.test.ts`, con `tsx --test --test-concurrency=1`. Selección exacta reproducible:

```sh
python3 - <<'PY'
from pathlib import Path
import subprocess
excluded = {'database-concurrency', 'gateway-process', 'local-runner-live', 'local-stack-live', 'operations-live'}
files = sorted(str(p) for p in Path('tests/media').glob('*.test.*') if p.suffix in {'.ts', '.mjs'} and p.name.split('.test.')[0] not in excluded)
files += sorted(str(p) for p in Path('tests/media/studio').glob('*.test.ts'))
subprocess.run(['node_modules/.bin/tsx', '--test', '--test-concurrency=1', *files], check=True)
PY
```
 Estos cinco se ejecutan explícitamente según aislamiento; no se cuentan como omitidos silenciosamente ni se arranca el runner destructivo.

Ejecutar matrices Next secuencialmente. Responsive/Studio usan `.next-responsive` con build/start de producción y Auth real local; Player usa build/start de producción en `.next-player`; soporte `.next-support`. La fuente Manrope procede del mapping local `work/media-local/fonts/google-font-responses.cjs`. No descargar fuentes ni navegadores; los binarios ya están instalados. Los temporales de rutas se comprueban mediante marcadores antes de retirarlos. Ninguna ruta temporal se entrega en un build del producto.

Después de las matrices, detener el supervisor sin reset, y ejecutar secuencialmente:

```sh
npm run media:local:stop
npx tsc --noEmit --incremental false
npm run lint
npm run media:build:local
git diff --check
npm run media:local:start
npm run media:preflight
```

El directorio runtime `work/` se excluye de TypeScript: los segmentos MPEG-TS `.ts` son bytes audiovisuales, no fuentes. No se excluyen tests ni fuentes del producto.

`media:build:local` ejecuta el build real de Next, limpia variables heredadas/dotenv y exige el env local propio; rechaza rutas temporales. No usar `npm run build` directamente con un `.env.local` de otra instancia.

No compilar dev/build sobre `.next` simultáneamente. Las advertencias del build/lint y los límites de HLS nativo deben permanecer en las evidencias, incluso cuando el exit code sea cero. Playwright WebKit es una prueba local de engine; no certifica Safari/iOS físico. No hay decode YouTube remoto: solo regresión local de su contrato/eventos/UI.

## Inventario y dry-run (sin migrar)

```sh
npm run --silent media:legacy:inventory > work/media-local/reports/legacy-inventory.json
npm run --silent media:legacy:dry-run > work/media-local/reports/legacy-dry-run.json
MEDIA_LOCAL_LIVE_ACCEPTANCE=true npx tsx --test tests/media/operations-live.test.ts
```

El guard exige `.env.media.local` 0600, owner/hash/paths propios sin symlinks, URL loopback y flags Mock. PostgreSQL fuerza `REPEATABLE READ READ ONLY`. El informe identifica títulos/owners/main UUID, estados y namespaces huérfanos; las referencias legacy pierden query/fragment y nunca incluyen credenciales. El SHA de la referencia es un identificador de inventario, **no** un nuevo mediaId. El dry-run solo propone mapping y bloqueos de ownership/SHA/duración/VPS; `--apply` se rechaza. No descarga, migra ni borra un archivo histórico.

## Diagnóstico de carga local

```sh
npm run media:load:local -- --viewers 10 --duration 6 --scenario local-fixture
```

Crea exclusivamente su propio borrador mediante Auth/product API, sube bytes al gateway, espera READY y autoriza cada espectador. Lee master/variant/init/segmentos siguiendo EXTINF; renueva antes de expiración. Espera todos los espectadores antes de limpiar su borrador y conserva fallos en JSON/CSV. Los informes no contienen capacidades ni URLs firmadas. Argumentos acotados a 1–200 espectadores y 1–3600 segundos; no acepta un servidor remoto.

Este ensayo comprueba el harness, no certifica 100 espectadores reales. VPS PHASE deberá medir 10/25/50/100/150/200 con contenido y codecs reales, distintos clientes, latencia, stalls, CPU/RAM/I/O/egress y duración sostenida. Cambiar proveedor o activar P2P requiere otra aceptación.

## Reinicio y recuperación

1. Consultar draft/session/media owner-scoped. Una interrupción de transporte requiere reseleccionar el mismo archivo, verificar SHA y recuperar offset; no crear otro medio para retry de processing.
2. E02 pierde una respuesta después de confirmar media transferencia en HTTP real; reinicia gateway/executor, comprueba PIDs, recupera la misma identidad y envía únicamente el resto. Luego falla processing una vez, reintenta hasta READY y cancela otro processing.
3. En READY existe reserve/confirm únicos por cuenta; al borrar se libera una vez. Cancelar antes de READY libera la reserva sin inventar confirmación de uso. No modificar ledger para hacer pasar una prueba.
4. Para retirada, observar 404 de nuevas autorizaciones y revocación del grant, republicar por propietario y borrar mediante trabajo durable. Un callback obsoleto no puede resucitar READY.

## Ensayo de rollback sobre copia privada

```sh
PG_BIN_DIR=/opt/homebrew/opt/postgresql@17/bin npm run media:rollback:local
```

El script rechaza destinos aportados por el operador. Lee la fixture y crea `work/media-rollback/copy-*` 0700 con dumps 0600 (schemas public/Auth), almacenamiento, claves, env/owner/credenciales/seed y workdir Supabase. No se imprime contenido secreto. Restaura ACL, roles sin credenciales, políticas/RLS en un **cluster PostgreSQL nuevo**, puerto loopback aleatorio y bases literales `rollback_copy`/`rollback_restored`; jamás restaura sobre 54342. Los owners nativos del ensayo son técnicos del cluster aislado, no credenciales de producción.

Compara fingerprints de tablas y seguridad antes/después, verifica admisión pausada, lecturas/HLS firmado, cancelación y gate legacy cerrado. Toma un segundo snapshot, borra solo un medio de ensayo dentro de la copia, restaura ese snapshot a otra DB/carpeta vacía y vuelve a reproducir HLS. El reporte exige `originalUnchanged`, `snapshotRestored` y `securityRestored`. Detiene únicamente el cluster propio y conserva la copia para recuperación/revisión. Sin esos checks no reutilizarla. Los backups incluyen Auth y claves: mantener privados, no subir a Git ni compartir el directorio.

Esto ensaya reversibilidad del esquema actual; no autoriza bajar migraciones destructivamente ni restaurar un snapshot viejo sobre nuevos datos. La recuperación real necesitará backup consistente/PITR, rotación de claves y verificación de auth/proxy/discos bajo infraestructura real.

## Preservación y versionado del WIP

HEAD base `c5b3483b137624c96f389e487bb7c4d33897f41a`, rama `feature/upload-engine-v2`. No `git add -A`, reset, stash, checkout, rebase ni commit de todo el árbol. El snapshot del paso 1.1 está en `work/media-audit/`; el inicio de esta continuación está en `new-chat/outputs/phase8-continuation-snapshot`; la entrega está en `new-chat/outputs/phase8-delivery-snapshot-20261011/manifest.json`.

```sh
npx tsx scripts/media/snapshot-wip.ts --output /ruta/absoluta/fuera/del/repo/snapshot-nuevo
```

La ruta debe ser nueva y tener padre existente. Copia fuentes rastreadas/no rastreadas con SHA, diff binario HEAD y staged, manifiesto de branch/HEAD/status; comprueba que origen y copia son consistentes, sin modificar Git. Excluye work/env/keys/dumps/caches; datos de runtime requieren el backup aislado anterior. Estos snapshots son privados, no listos para publicación.

Para versionar después: comparar snapshot inicial/final, asignar procedencia por fase, listar exclusiones y probar una copia de integración. Revisar especialmente archivos mixtos (`package.json`, Player, Studio, queries y migraciones). `20261007_r2_capacity.sql` precede a esta misión y es dependencia compartida: no absorberlo silenciosamente. Integrar primero la base previa consensuada; después separar fixes/pruebas/docs de Fase 8 en commits revisables. Si no existe atribución segura, mantener sin stage. No hacer commit en esta misión: un commit autocontenido requiere aceptar previamente WIP base no atribuible a Fase 8.

## Infraestructura futura (sin instalar)

`infrastructure/peertube/reference/v8.3.1` contiene esquema/config oficial cacheados con hashes y procedencia. `npm run media:peertube:validate` valida offline defaults+production+policy contra el esquema oficial; devuelve `deployable:false` porque dominios/secretos/storage/VPS son placeholders. No significa que exista un PeerTube funcionando.

Revisar policy/env/nginx/systemd/firewall/backup de esa carpeta antes de V.1. Mantener privacy 3, autenticación de archivos privados, signup/federación/import/tracker/P2P desactivados, HLS activado y originales retenidos. Crear PostgreSQL/Redis exclusivos de PeerTube, FFmpeg, TLS, proxy y storage separados de Supabase. OAuth/channel/password/file tokens permanecen server-only; GMA mantiene UI y permisos. Transferencia uploadx y playback pasan por gateway autorizado, nunca por Vercel ni iframe PeerTube como Player principal.

## Gates externos pendientes

`DEPENDENCIAS-SEGURIDAD.md` conserva la caché histórica de Fase 8 (24 avisos) y ahora registra el audit vigente V.1: 27 entradas, incluidos 2 críticos. El audit vigente inicial ya se ejecutó; queda remediación, revalidación y pruebas antes de tráfico público. No ejecutar `npm audit fix --force` ni upgrade major incidental de Next.

Quedan para VPS: TLS/CORS/IPv6/firewall público, SSRF/DNS, credenciales/config PeerTube real, uploadx/FFmpeg/HLS privado, rotación y revocación, backup remoto/restore, iOS físico y benchmarks escalonados. No activar P2P hasta su gate independiente. No hubo instalación, conexión ni despliegue externo en esta entrega.


## V.1 — acceso verificado y preflight pendiente, sin instalaciones

[V1-PREFLIGHT.md](V1-PREFLIGHT.md) registra observaciones y permisos. Usuario autorizó exclusivamente clave/gmaadmin/sudo/authorized_keys. La clave privada cifrada permanece en el Mac y nunca se incorpora a Git, backups de fuentes, VPS o informes. Root, firewall y configuración SSH se mantienen. La huella aceptada por el usuario se fija por TOFU; **verificación independiente todavía pendiente**. No tratar otra consulta SSH como canal independiente.

### Acceso operativo

En Terminal del Mac:

```sh
ssh gma-filmo-vps
```

Alias: `gmaadmin@77.42.52.127:22`, identidad Ed25519 dedicada, host checking estricto con archivo dedicado, sin fallback a contraseña SSH ni forwarding. Cuando pida la passphrase de la clave, introducirla únicamente en Terminal. Después:

```sh
id
sudo -v
sudo -n id -u
sudo -n -l
```

La contraseña de sudo es la de gmaadmin; solo Terminal. Se verificaron UID1000/grupo sudo, sudo UID0 y `(ALL : ALL) ALL`. No NOPASSWD ni rotación/desactivación root. Dejar la sesión root de recuperación abierta hasta completar cambios autorizados posteriores. Una discrepancia de host key bloquea acciones: no borrar known_hosts ni usar StrictHostKeyChecking=no.

### Comprobaciones y bloqueos

Ubuntu24.04.5/KVM/x86_64, 8vCPU, RAM15,25GiB/sin swap, raíz231,44GiB/229,15GiB libres; SSH:22 IPv4/IPv6, DNS loopback. UFW inactivo, iptables ACCEPT; firewall del panel desactivado según usuario. Reinicio pendiente, no ejecutado. No hay app/DB/Redis/PeerTube escuchando en la muestra; no demuestra aislamiento contractual ni capacidad de100 espectadores.

PeerTube v8.3.1 fijado, tar.xz solo local con SHA `b2026b99ee6a2e07098230bb68fafbad634b44ce5a67a3e48e0b163ba9b5304a`; manifest de procedencia conservado. pnpm>=10.9/packageManager10.15.1. Contratos locales repetidos 2/2 y schema offline; no instancia real.

Enviar personalmente el [borrador de soporte](SOLICITUD-SOPORTE-V1.md) desde el panel HTTPS para huella independiente, contrato/egress, backup/snapshot y recuperación noVNC. No se envió por el agente ni se autorizan cambios/cargos en ese texto. El usuario anuncia envío del ticket, respuesta pendiente. Staging sigue propuesto: dirección actual `gma-filmo.vercel.app`, dominio propio no confirmado; no inventar subdominios de vercel.app. No DNS/TLS/exposición. El usuario autorizó restaurar el backup sintético guardado en otra copia local; ensayo terminado con fuente y fixture actuales intactas, sin transferir archivos al VPS. El snapshot F8 protege fuentes, no DB/Auth/objetos.

Nueva evidencia privada en `work/vps-preflight/`: lectura inicial, creación autorizada, comprobación sudo y postcheck. Checkpoint del avance en `outputs/v1-access-snapshot-20261011`; conserva snapshots anteriores, excluye work/env/claves/dumps. Revisar atribución del WIP antes de commits; no stagear el árbol completo.

**V.1 NO CERRADO; V.2 no iniciado.** Faltan huella independiente y alcance privado explícitamente aprobado; dominio/backup externo se aplazan para fixtures según la decisión vigente al final del runbook. La restauración del backup sintético local ya está acreditada; no certifica Auth HTTP nuevo ni snapshots del proveedor. 27 entradas vulnerables/2 críticas mantienen el gate externo. No reboot, instalación, firewall, SSH-policy, R2/Supabase alojado/P2P/push/deploy/commit.


### V.1 — restaurar backup guardado en copia nueva (2026-10-11)

Autorización humana específica recibida: fuente literal `work/media-rollback/copy-ZmniPV`, destino nuevo local; no incluye restore remoto. Ejecutor separado del rollback F8 que captura la fixture activa:

```sh
MEDIA_RESTORE_BACKUP_AUTHORIZED=true \
PG_BIN_DIR=/opt/homebrew/opt/postgresql@17/bin \
node_modules/.bin/tsx scripts/media/restore-backup-local.ts
node_modules/.bin/tsx --test tests/media/restore-backup-local.test.ts
```

No admite argumentos ni destinos aportados. Requiere fixture propia/URL exacta local; la conexión a la actual es **READ ONLY**. Crea carpeta0700 bajo `work/vps-preflight/restores/saved-backup-*`, cluster nuevo con SCRAM, puerto loopback distinto y bases literales nuevas. Public/Auth desde dumps existentes, ACL/RLS/funciones y todas las filas verificadas en roundtrip. Roles globales recreados NOLOGIN, sin passwords originales y con owner técnico propio. Storage/keys copiados; origen y fixture comprobados intactos. Password técnica generada queda en carpeta privada, no en argumentos/log/snapshot.

Ensayo final `saved-backup-u1bbkH`, puerto51962: 69tablas, 3usuarios, 41activos, 17títulos; HLS firmado/ownership/denegación sin capacidad y decodificación real audio/vídeo. Pausa bloquea admisión y conserva lectura/cancelación; legacy writes cerrado. Tiempo4,819s para esta fixture, no capacidad/RTO externo. Gateway/PG detenidos, copia conservada. Auth HTTP/PostgREST/GMA nuevos no arrancados: no declarar este ensayo E2E de login. Reporte privado `report.json`; globals/Auth HTTP externo/restauración de VM requieren verificación posterior.

Primera copia de ensayo `saved-backup-mLlVHt` también permanece detenida y sin borrar. No usar el puerto54342 como destino, no reset/stash/checkout ni eliminar copias/fixtures. No copiar dump/password/env/claves a un commit o snapshot de fuentes.


## Decisión vigente: avanzar con laboratorio privado recuperable (2026-10-11)

D-VPS-TEST-01 aprobada: backups externos definitivos aplazados. Ensayo local69tablas/3Auth/41activos/17títulos y batería3/3 COMPLETADOS; **no volver a ejecutar restore** por esta decisión. Snapshot544fuentes/evidencias intactos.

[BACKUPS-FUTUROS.md](BACKUPS-FUTUROS.md): A) servidorLinuxcasero/HDD400GB/SSH, Restic cifrado/incremental; B) B2 para config/DB/datoscríticos, con límites verificados antes de usar. **Ambos NO IMPLEMENTADOS**. No cuentas/buckets/repositorios/cron, claves, costes ni restauraciones externas autorizados. Datos/vídeos de prueba recuperables pueden ensayarse sin backups definitivos; únicos/reales/V.13 requieren backup verificable completo y rollback.

[V2-PREPARACION-PRIVADA.md](V2-PREPARACION-PRIVADA.md) es el procedimiento preparado con riesgos y comprobaciones. **EX-VPS-PRIVATE-01 PENDIENTE**: ejecutar solo V.2–V.4 privados con V.1 abierta, después de identidadindependiente y aprobación de cada modificación. No interpretar D-VPS-TEST-01 como permiso automático para saltar dependencias. V.5 público no se ejecuta; alcance privado futuro V.5–V.9 exige autorización distinta antes de cambiar esa dependencia.

Bloqueos para iniciar: confirmación independiente Ed25519, EXexplícita, inventario/recovery y reglas/paquetes/cuentas/lotes concretos aprobados. gmaadmin/sudo ya verificados, no recrearlos. Antes de modificar, confirmar acceso actual sin cerrar root. Firewall aún inactivo en evidencia previa, no es defensa válida del laboratorio; preparar reglasmanteniendo22 y sin abrir80/443. Reboot/endurecerSSH requieren recuperación probada y permiso específico. Contrato/egress pendiente; no prometer descargas/coste/capacidad.

Validación **offline**, no arranca PeerTube ni contactosVPS:

```sh
node scripts/media/validate-peertube-private-lab.cjs
```

Overlay privado es plantilla con placeholders, no desplegable. Puerto9000loopback y URLupstream127.0.0.1 coherentes; HLSprivado/privacy3, P2P/signup/federación/import apagados. Al fijar dominio, crear instancia nueva y recargarfixtures; PeerTube no soporta oficialmente renombrar hostname sin riesgos. No reutilizar `.env.media.local`/proyectoDocker de F8 para activar PeerTube: integración requiere labGMA/Auth propio y transporte/entrega reales en V.7.

**V.1 ABIERTA; V.2 solamente preparada.** No instalaciones/modificaciones remotas en esta decisión, ninguna apertura pública ni Supabase de producción/R2real/P2P.
