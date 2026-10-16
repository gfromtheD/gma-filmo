# V.1 — Preflight externo y versión compatible

Fecha: 2026-10-11. **EN CURSO / NO CERRADO.** Solo V.1; no se inicia V.2. Fases 1–8 permanecen aceptadas localmente (351 aprobadas / 0 fallidas / 1 omisión documentada). Este informe separa observaciones directas, datos del panel comunicados por el usuario y propuestas todavía no aprobadas.

## Estado observado y bloqueos

| Área | Resultado real | Pendiente para aceptación |
|---|---|---|
| VPS | Host Ilimitado, producto 5515 / VM 106, IPv4 `77.42.52.127`; hostname Ubuntu `xptawLk3` | Contrastar recursos con el contrato del panel |
| SSH | Root por contraseña comprobado por el usuario; segunda conexión `ssh gma-filmo-vps` autenticada mediante **publickey**, usuario `gmaadmin` | Confirmación independiente del proveedor de la host key |
| Huella del servidor | Ed25519 `SHA256:jo9VT5Z9U3L4Yq5VdBdCRXPr2uc15Yo3JLI3gX2eDi8`; coincide con la aceptada por el usuario y la leída en el servidor | **TOFU, NO identidad certificada**. Dos lecturas SSH no son dos canales independientes |
| Clave dedicada del Mac | Ed25519 cifrada con passphrase, fichero privado 0600; par público/privado concordante; clave privada nunca copiada | Conservar protección local; no registrar passphrase |
| Operador | `gmaadmin` UID 1000 / grupo sudo 27; authorized_keys contiene exclusivamente la pública GMA, propietario correcto, directorio 0700 / fichero 0600 | Sudo comprobado: UID 0, política `(ALL : ALL) ALL`, con contraseña |
| Sistema | Ubuntu **24.04.5 LTS**, x86_64/KVM, kernel **6.8.0-138-generic** | Reinicio requerido, NO realizado; plan/ventana requieren autorización |
| CPU/RAM | **8 vCPU**, Xeon Gold 5412U presentado por KVM; RAM 16.371.228.672 bytes (**15,25 GiB**), sin swap | No demuestra cores físicos dedicados ni capacidad de espectadores |
| Disco | `/dev/sda` 240 GiB; raíz ext4 **231,44 GiB** útiles, **229,15 GiB** disponibles, uso/inodos 1% | Presupuesto originales/HLS/spool/scratch/backup y alerta 15% en fases posteriores |
| Red | eth0 IPv4 /32, ruta onlink; IPv6 link-local, sin ruta global observada | Egress/transferencia contractual y benchmark pendientes; hostname de panel no resuelve desde el Mac |
| Firewall | UFW inactivo, iptables IPv4/IPv6 políticas ACCEPT, nft sin reglas observadas; proveedor desactivado según panel comunicado | Ninguna regla cambiada. No hay aislamiento de red certificado |
| Listeners | SSH en IPv4/IPv6 :22 y DNS de sistema loopback; sin listeners de aplicación/DB/Redis/PeerTube observados | El inventario local no sustituye certificación externa de puertos |
| Staging | Usuario identifica `gma-filmo.vercel.app` como dirección actual; no confirma dominio propio. Operador SSH existe; cuentas/hosts de staging no | Dominio definitivo pendiente; preparar arquitectura sin DNS/certificados/exposición |
| Backup | Ensayo local COMPLETADO, evidencias/snapshot544fuentes conservados, no repetir | Soluciones externas aplazadas/NO implementadas; gate real/V.13 permanece |
| Dependencias | 27 entradas vulnerables: **2 críticas / 19 altas / 4 moderadas / 2 bajas** | Exposición pública bloqueada hasta remediación y regresión |
| PeerTube | v8.3.1 oficial y SHA local comprobado; contrato local repetido 2/2 | No instalado, no activado; REST/runtime reales pertenecen a V.4 y posteriores |
| WIP | Rama `feature/upload-engine-v2`, HEAD `c5b3483b137624c96f389e487bb7c4d33897f41a`; snapshots privados preservados | Atribución del trabajo anterior antes de versionar; sin commit |

## Acceso realmente configurado y excepción autorizada

El usuario aceptó personalmente la huella inicial en Terminal y accedió como root. La verificación independiente noVNC/proveedor **continúa pendiente**; no se presenta el keyscan ni la lectura SSH como certificación. El usuario autorizó expresamente crear `gmaadmin`, añadir sudo, instalar solo la pública y fijar permisos manteniendo root, firewall y sshd intactos. Esta autorización acota una preparación de acceso adelantada a V.1; **no autoriza el resto de V.2**. Se usa la confianza TOFU existente, fijada en archivo dedicado, y no se reduce la comprobación de host.

- Mac: `~/.ssh/gma_filmo_vps_ed25519`, Ed25519 cifrada con bcrypt y passphrase introducida exclusivamente por el usuario. Privada 0600, pública 0644, `.ssh` 0700. No se sobrescribieron otras claves.
- Huella **pública del cliente**: `SHA256:M++R+F22q252IN3YeZI0NzKN0qKq/mmwgwTb3bRUYJQ`. No confundir con la huella del servidor.
- Alias `gma-filmo-vps` en `~/.ssh/config` 0600: HostName IP, puerto 22, User gmaadmin, IdentityFile dedicado, IdentitiesOnly yes, PreferredAuthentications publickey, PasswordAuthentication/KbdInteractiveAuthentication no, StrictHostKeyChecking yes, UpdateHostKeys no, HostKeyAlgorithms ssh-ed25519, ForwardAgent/ForwardX11 no, ClearAllForwardings yes, AddKeysToAgent/UseKeychain no. Timeout 10 s. No cambios en el SSH del servidor.
- `~/.ssh/gma_filmo_vps_known_hosts` 0600 fija únicamente la Ed25519 aceptada por el usuario; el known_hosts original se conserva. El archivo dedicado no acredita un canal independiente.
- VPS: usuario `/bin/bash` con home; `.ssh` 0700 y authorized_keys 0600, ambos gmaadmin:gmaadmin. Contraseña propia introducida directamente en Terminal (`passwd` confirmó éxito). `visudo -c` correcto; **no** NOPASSWD ni cambios en sudoers.
- Segunda sesión desde el Mac: el diagnóstico confirma `Authenticated to 77.42.52.127 ... using "publickey"` y prompt `gmaadmin@xptawLk3`. No hubo fallback a contraseña SSH. Root original sigue abierto.
- Sudo **operativo y realmente probado**: el usuario introdujo su contraseña en Terminal para `sudo -v`; `sudo -n id -u` devolvió **0** y `sudo -n -l` confirmó `(ALL : ALL) ALL`. El prompt de gmaadmin se recuperó. Informe privado `admin-sudo-20261011.log`. La comprobación posterior repitió host-policy/firewall y visudo: valores intactos y una sola clave autorizada; `access-postcheck-20261011.log`.

Si una futura conexión denuncia cambio de host key, detenerse y contrastar con soporte; no eliminar known_hosts ni aceptar una clave nueva automáticamente. Para confirmar identidad, usar el ticket preparado en `SOLICITUD-SOPORTE-V1.md`, desde el panel HTTPS autenticado. No es necesario insistir en noVNC para conectarse; sí hace falta un canal independiente para certificar la identidad.

## Lecturas remotas ejecutadas — sin instalaciones

Informe privado `work/vps-preflight/remote-readonly-20261011.log`: OS/kernel/CPU/KVM, free/df/inodos/lsblk, ip/ss, UFW/nft/iptables IPv4 e IPv6, sshd -T, estado/NTP/timers/mounts. El informe precede a la creación del usuario: su `GMAADMIN_ABSENT` acredita el estado inicial, no el estado final.

- 0 unidades fallidas; reloj sincronizado/NTP activo. Reinicio pendiente por libc6, linux-image-6.8.0-146-generic y linux-base; **no reiniciado**.
- sshd efectivo permite root/password/pubkey, X11 y TCP forwarding. No se endureció ni modificó. Se necesita política autorizada posterior, probando recuperación antes de retirar métodos actuales.
- No aparecen node/pnpm/psql/redis-server/ffmpeg en PATH; Python sí. Esto no sustituye un inventario de todos los paquetes.
- 17 timers; `dpkg-db-backup.timer` protege la base de paquetes, **no GMA/Auth/media**. No se identificó un backup de aplicación. Los snapshots del proveedor no pueden inferirse a partir de esos timers.
- No speedtest, carga, apt update/upgrade, instalaciones, cambios DNS/firewall/sshd, reinicio ni restauración remota. No inspección de secretos/env remotos.

Evidencias privadas: `local-key-checks.json`, `remote-admin-create-20261011.log`, `admin-sudo-20261011.log` y `access-postcheck-20261011.log`. Los informes no contienen claves privadas ni contraseñas. Las lecturas autorizadas y la creación de gmaadmin son las únicas operaciones remotas de este avance.

## Propuesta de staging — no son recursos existentes

El usuario confirma como dirección actual **`gma-filmo.vercel.app`**, sin un dominio personalizado confirmado bajo su control. Se registra como dato comunicado, no como un recurso de staging verificado; no se accede ni cambia ese proyecto. **No generar `staging.gma-filmo.vercel.app` ni presumir que se controla la zona vercel.app.** Para el frontend puede aprobarse posteriormente un proyecto/preview Vercel aislado con su hostname propio; ningún proyecto/env está creado en V.1. `media-staging` y `engine-staging` quedan como etiquetas lógicas hasta aprobar una zona DNS propia. Mientras tanto, pruebas locales y futuros túneles explícitos autorizados, sin TLS público/DNS/certificados ni exposición. El alias SSH tiene forwarding desactivado por defecto; cada túnel futuro debe ser deliberado.

**Recomendación:** este VPS será exclusivamente staging durante el piloto, sin producción ni bucket histórico. Primer acceso a aplicaciones por túnel SSH explícito/loopback, una vez autorizado y verificado SSH. No abrir puertos públicos de GMA mientras quedan críticas sin remediar.

`<dominio-GMA-aprobado>` es un marcador, no una afirmación de titularidad. DNS, certificados, firewall y despliegue se ejecutarán en las fases previstas y con autorización:

| Nombre propuesto | Uso futuro | Política |
|---|---|---|
| `staging.<dominio-GMA-aprobado>` | UI/API GMA de staging | Cuentas de prueba, sin conexiones productivas; inicialmente acceso restringido |
| `media-staging.<dominio-GMA-aprobado>` | Gateway autorizado HLS/upload/aux | Único origen audiovisual visible al navegador, sin secretos PeerTube |
| `engine-staging.<dominio-GMA-aprobado>` | Host técnico PeerTube | Backend técnico oculto, acceso administrativo restringido; no navegación de usuarios |

No redirigir los dominios actuales ni reutilizar claves Supabase/Cloudflare productivas. CORS usará el origen exacto de staging; OAuth/tokens de archivo permanecen server-only. PG/Redis/9000/gateway internos sin publicación directa. P2P, signup, federación/import remoto apagados.

La DB GMA de staging debe ser separada del proyecto Supabase alojado y de PeerTube: preferencia inicial, stack Supabase de prueba independiente en loopback o una instancia nueva de staging explícitamente autorizada. No usar el URL/keys de producción por defecto. PeerTube tendrá PG/Redis exclusivos en V.3. Ninguno está creado ahora. Vercel preview, si se decide utilizar, será proyecto/env separado y no enviará bodies grandes por sus APIs.

### Cuentas técnicas propuestas

- Operador real `gmaadmin`: creado y añadido al grupo sudo por autorización expresa del usuario en V.1. Clave dedicada instalada; segunda conexión por clave probada. La política de sudo se conserva sin cambios. noVNC está disponible en panel pero su login falló: no dar por probado ese canal de recuperación. Root/password continúan operativos; no desactivarlos en V.1.
- Usuarios Linux de servicio `peertube` y `gma-media`: sin login interactivo, directorios y unidades separados. Pasarela y executor bajo identidad GMA, no root. Crear en fases de sistema/despliegue, no ahora.
- PG `peertube_staging` / rol restringido PeerTube y Redis propio: V.3. Sin roles/schemas compartidos con GMA.
- Cuenta de aplicación PeerTube `gma-media-staging` no administradora y canal técnico: V.6; cuenta admin de instalación separada, guardada en gestor seguro. No inventar ahora channel ID ni OAuth.
- Supabase/GMA: dos creadores y viewer sintéticos, roles actuales/RLS sin ampliaciones; claves y firmantes exclusivos de staging. No reutilizar passwords/keys del backup local como credenciales externas.
- Backup: identidad independiente con acceso mínimo al destino cifrado aprobado, sin credenciales de administración del proveedor dentro de GMA.

## Backup del proveedor: confirmado públicamente, contrato pendiente

La [oferta oficial de Host Ilimitado](https://www.hostilimitado.com/servidores-vps?language=english) describe snapshots para restaurar una imagen guardada y crear otro cloud server. Eso **no confirma** que el plan contratado los incluya, su precio, retención, consistencia o que exista un snapshot actual. La información comercial también menciona backup; se debe contrastar en el servicio real del panel o soporte.

El otro agente que accede al panel puede consultar, sin pulsar crear/restaurar/reinstalar: producto/plan exacto, CPU/RAM/discos/transferencia, pestañas backup/snapshot, fechas/estado/retención/coste y opción restaurar como nuevo servidor. No descargar secretos ni exponer URL de consola temporal. Falta autorización antes de crear snapshots facturables o que puedan pausar I/O; ningún reboot/reinstalación/revert del VPS actual.

### Backup local y nuevo ensayo autorizado — EJECUTADO

El usuario autorizó expresamente el ensayo desde `work/media-rollback/copy-ZmniPV`, fuente de solo lectura, a carpeta/cluster nuevos en este Mac. No se reutiliza el runner que toma un snapshot nuevo de la fixture activa: `scripts/media/restore-backup-local.ts` restaura específicamente los dumps guardados autorizados. Rechaza argumentos, ejecución sin `MEDIA_RESTORE_BACKUP_AUTHORIZED=true`, configuración no local, symlinks, bases ajenas y puertos de la fixture. No contiene nuevas credenciales productivas ni instala paquetes.

- Fuente: `source.dump` y `rollback.dump`, PostgreSQL17.11/custom; `source-storage`, `restored-storage`, claves sintéticas locales. Backup de datos separado del snapshot de fuentes F8 (538fuentes/23logs). No versionar dumps/env/passwords/claves ni transferirlos al VPS.
- Destino final: **`work/vps-preflight/restores/saved-backup-u1bbkH`**, 0700, PostgreSQL17.11 nuevo en loopback **51962**, con SCRAM/password aleatoria privada y sin socket público. Bases nuevas literales `v1_source`, `v1_saved_rollback`, `v1_roundtrip`. El puerto54342 y los servicios existentes nunca fueron destinos de restore/reset.
- Dumps restaurados con ACL/políticas/RLS, identidades técnicas recreadas **NOLOGIN** sin importar contraseñas de roles. `--no-owner` utiliza el owner del cluster desechable: no se pretende reproducir propietarios administrativos/globales de producción. La política GMA restringe escritura de títulos y comandos a service_role; anon/authenticated no pueden INSERT/UPDATE/DELETE títulos ni EXECUTE gma_media_command.
- **69 tablas** public/Auth verificadas mediante SHA de todas sus filas y dump/restauración roundtrip. **3 usuarios / 3 identities, 41 activos / 41 sesiones / 75 outputs, 17 títulos / 6 filas de historial**. Datos de UUID/generaciones/offsets/ledger incluidos en igualdad de filas; no se reasignan identidades. ACL, SECURITY DEFINER/search_path, RLS/políticas comparados entre snapshots guardados y roundtrip.
- Storage y claves copiadas con SHA/modos idénticos; clave de firma exclusivamente sintética local, nunca enviada al servidor. Nuevas capacidades de prueba solo en el gateway desechable; no se imprimen ni guardan URLs firmadas en reportes.
- Propietario correcto obtiene HLS por HTTP; otro creador es rechazado; ausencia de capacidad responde401. **Decodificación real de vídeo y audio con FFmpeg**, no solo status200 de playlist. Admisión pausada conserva lectura; escritura legacy bloqueada. Abandonar/cancelar el activo copiado y confirmar DELETE durable funciona con pausa; playback posterior denegado. Solo se modifica la copia desechable.
- Origen completo (incluidas claves/dumps/env almacenados), DB actual public/Auth, seguridad actual, storage/keys y `.env.media.local` comparados antes/después: **sin cambios**. No login en Auth de la fixture durante el ensayo: evitaría introducir sesiones nuevas en los datos protegidos.
- Tiempo medido **4,819s** para esta fixture pequeña; no SLA/RTO/RPO del VPS. PostgreSQL y gateway nuevos detenidos al terminar. Verificado `pg_ctl status`: sin servidor, sin postmaster.pid. Copia privada conservada para revisión; ninguna limpieza destructiva.
- Primera ejecución de comprobación en `saved-backup-mLlVHt` también pasó y queda intacta/detenida. Tras añadir la comprobación de cancelación y cierre de conexiones se ejecutó el ensayo final en otro destino nuevo, sin reusar/destruir el anterior.

**Alcance real de Auth:** se restauran datos users/identities/sessions y sus políticas/ACL. **No se arrancó un nuevo GoTrue/Auth HTTP ni PostgREST/GMA web sobre la copia**; este ensayo no se declara E2E de login. El E2E local de Fase8 conserva su evidencia previa. La certificación de backup externo/staging debe añadir runtime Auth/API y credenciales nuevas cuando exista ese entorno aprobado.

Reproducción autorizada (genera siempre otra copia, no restablece las existentes):

```sh
MEDIA_RESTORE_BACKUP_AUTHORIZED=true \
PG_BIN_DIR=/opt/homebrew/opt/postgresql@17/bin \
node_modules/.bin/tsx scripts/media/restore-backup-local.ts
```

Reportes privados: `work/vps-preflight/restore-saved-backup-final-20261011.log`, `restores/saved-backup-u1bbkH/{report.json,source-manifest.json,roundtrip.dump}`. Dump/password/keys solo dentro de la carpeta0700; no incluirlos en snapshots de fuentes. Prueba del guard en `tests/media/restore-backup-local.test.ts`. El ensayo acredita restauración del backup sintético **local**, no disponibilidad/consistencia de snapshots del proveedor, copia externa cifrada, Auth HTTP externo o recuperación noVNC.

### Restauración externa — pendiente, no autorizada

Identificar desde soporte backup real del producto5515/VM106: fecha, alcance, consistencia PG, retención/coste, destino cifrado y posibilidad de restaurar **como nueva VM**. Nunca revertir `77.42.52.127` ni copiar datos reales de producción. Fuente/destino/coste y toda acción remota requieren permiso separado. RPO24h/RTO4h son propuestas a aprobar y medir. No extrapolar el tiempo de esta fixture ni confundir snapshot de VM con backup consistente de GMA/Auth/objetos.

## PeerTube fijado y procedencia

Se mantiene **v8.3.1**, release estable oficial del 28-09-2026; consulta actual de latest devuelve el mismo tag. [Release oficial](https://github.com/Chocobozzz/PeerTube/releases/tag/v8.3.1), [metadatos oficiales](https://api.github.com/repos/Chocobozzz/PeerTube/releases/tags/v8.3.1).

- Commit `3324876a0b0f846f8b6632470b3d9d53ef74b8b7`; tag anotado `1d0f5bc35db31047e0268f9009a63dc719fb41d4`. GitHub informa firma verificada del tag/commit; no se afirma validación GPG local de firma detached.
- `peertube-v8.3.1.tar.xz`, **34.511.084 bytes**, SHA256 **`b2026b99ee6a2e07098230bb68fafbad634b44ce5a67a3e48e0b163ba9b5304a`**. Descargado únicamente en work local; digest calculado coincide con GitHub API. No extraído, ejecutado, instalado ni subido al VPS.
- `reference/v8.3.1/RELEASE-VERIFIED.json` conserva origen/commit/digest y verificaciones. Cache YAML default/production coincide byte a byte con upstream. JSON schema difiere en formato/terminación, pero objetos JSON son idénticos: se registra hash upstream/caché sin sobrescribir WIP ni atribuir falsamente igualdad binaria.
- [Dependencias del tag](https://github.com/Chocobozzz/PeerTube/blob/v8.3.1/support/doc/dependencies.md): Node LTS >=22.12 y <25, PG>=14, Redis>=6.2, FFmpeg>=4.3, Python>=3.8/pip. `package.json` exige pnpm>=10.9 y fija packageManager pnpm10.15.1; aplicar el requisito más estricto y esa versión declarada, sin instalar nada en V.1. Arquitectura/compatibilidad efectiva y parches del runtime requieren lecturas del VPS.
- Contratos locales **2 aprobados, 0 fallidos, 0 omitidos**, repetidos después de verificar acceso/sudo; config oficial validada offline, P2P false/deployable false. REST `serverVersion`, uploadx y vídeo real corresponden a V.4/V.8/V.9, no son resultados de este preflight.

## Gate de seguridad y versionado del WIP

`DEPENDENCIAS-SEGURIDAD.md` conserva el audit vigente: Next 14.2.35 y proxy-addr 2.0.7 afectados; Express 5.2.1 es la ruta ascendente de proxy-addr. Los avisos se deben contrastar con plataforma/configuración; no declarar remediación por ausencia de explotación observada. No audit fix-force ni upgrade major incidental. **No exponer GMA ni el motor públicamente hasta remediación y regresión**. SSH ya estaba accesible; se mantiene sin cambios de firewall por instrucción del usuario.

Snapshot F8 inmutable: `outputs/phase8-delivery-snapshot-20261011` (538 fuentes / 23 logs). Checkpoint previo V.1 `outputs/v1-preflight-snapshot-20261011` se conserva. Checkpoint nuevo del avance: `outputs/v1-access-snapshot-20261011` (542 fuentes), sin sobrescribir aquellos. Nuevo checkpoint del ensayo local: `outputs/v1-restore-snapshot-20261011` (544fuentes), preservando los anteriores. La captura excluye work/env/claves/dumps; no sustituye backup de datos. El acceso SSH se configura fuera de Git y sus secretos nunca se añaden al snapshot.

Rama/HEAD y staging intactos. Cambios de producto, lock y migraciones anteriores no se reescriben. Clasificar especialmente migration20261007 y `lib/uploads/repository.ts` por procedencia; revisar en copia de integración. No stagear el árbol entero. Versionar base F1–8 revisada y delta V.1 separados solamente después de acordar atribución. Si no, entregar manifiestos/hashes/patches y dejar sin commit.

## Aprobaciones y requisitos pendientes

**Ya autorizados y ejecutados:** clave local cifrada, alias con pin TOFU, creación gmaadmin/sudo, instalación exclusiva de pública/permisos y segunda conexión por clave. Sudo también verificado; nuevo ensayo local de restauración autorizado y ejecutado. No hay petición pendiente de contraseña.

**Pendientes:**

1. Soporte del proveedor: huella por canal independiente, recursos/egress exactos y política real de snapshots/backups del producto 5515 / VM106. Ticket preparado; el usuario anuncia que lo enviará. **Respuesta pendiente**; el agente no lo envía ni asume confirmación.
2. Dominio propio todavía sin confirmar; arquitectura propuesta autorizada, dominio definitivo/DB/secretos/cuentas/DNS/exposición pendientes de aprobación. `gma-filmo.vercel.app` es la dirección actual, no un hostname nuevo de staging.
3. **Ensayo local completado**, no repetir. Backups externos definitivos aplazados, no implementados; condiciones del proveedor pendientes de soporte. No contratar VM/snapshot ni restaurar remotamente con la autorización local anterior.
4. Aprobar remediación de dependencias como trabajo separado y comprobar regresiones antes de exposición. No desactivar el gate público.
5. Firewall, política SSH/root/password/forwarding, reboot, usuarios de servicio, DNS/certificados y costes requieren aprobación por operación y corresponden a fases posteriores.

**Estado actual de cierre V.1:** continúa ABIERTA. Identidad independiente y aceptación del aislamiento/staging siguen pendientes. Los backups definitivos están aplazados para datos recuperables por decisión expresa del usuario; no presentarlos como un bloqueo absoluto de un ensayo privado autorizado ni como existentes. La dependencia original V.2→V.1 no se ignora: EX-VPS-PRIVATE-01 está preparada y requiere aprobación explícita antes de comenzar. Riesgos críticos mantienen el gate externo. No se ejecuta V.2 ni se modifica el VPS en este avance.

## Decisión D-VPS-TEST-01 y preparación independiente (2026-10-11)

Ensayo local anterior **COMPLETADO**, no reejecutado; snapshot privado544fuentes preservado. Usuario aplaza los backups externos y permite preparar pruebas recuperables. Soluciones futuras **NO IMPLEMENTADAS**:

- A. Linux casero, HDD400GB y SSH; propuesta Restic con copias cifradas e incrementales. Recurso/espacio/SSH/SFTP/salud no inspeccionados; no clave/repo/programación creados.
- B. BackblazeB2 para configuraciones, DB y datos críticos; límites gratuitos vigentes revisados y fuente oficial en `BACKUPS-FUTUROS.md`. Cuenta/bucket/repositorio/backup no creados. No llamarlo gratuito ilimitado ni copia de películas.

La [propuesta operativa V.2 privada](V2-PREPARACION-PRIVADA.md) separa bloqueos estrictos: hostindependiente, EX aprobada, inspección previa y permiso por modificación/defensa de red. Dominio/backups definitivos pueden diferirse para un motor desechable en loopback; no se asume acceso público ni instancia duradera. La guía oficial PeerTube desaconseja cambiar hostname existente: al fijar dominio, nueva instancia con fixtures conservadas.

Preparación local: overlay `infrastructure/peertube/private-lab.yaml.example`, listen/webserver127.0.0.1:9000, PostgreSQL/Redisloopback, DB nueva; no PeerTube real activado. Validador offline `scripts/media/validate-peertube-private-lab.cjs` comprueba schema y privacidad/P2Poff; el resultado no significa instalación/configuración aplicada. Preparados orden/riesgos de V.2–V.4, separación GMA/Supabase de pruebas y gatesV.5–V.9, sin tocar fixtureMock actual.

Antes de abrir/publicar, remediar vulnerabilidades y validar TLS/CORS/seguridad. Antes de contenido único/real y V.13, backup verificable+restore+rollback que incluya el original. No modificar firewall/SSH/root/reboot/usuarios de servicio o servicios sin autorización; no perder acceso por acelerar instalación.
