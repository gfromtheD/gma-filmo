# V.2 y siguientes — preparación del laboratorio privado

Fecha: 2026-10-11. **PREPARADO; NO EJECUTADO. V.1 ABIERTA.** Este documento registra la decisión de aplazar backups externos y propone una excepción de dependencias. No autoriza firewall, paquetes, cuentas de servicio, reinicio, túneles ni instalaciones. Ensayo local69tablas/3usuarios/41activos/17títulos y batería3/3 **COMPLETADOS**; snapshot544fuentes se conserva, no repetir restore.

## Decisión y excepción separadas

- **D-VPS-TEST-01, aprobada por el usuario:** los backups definitivos se aplazan mientras solo existan datos/vídeos de prueba recuperables. No son requisito previo de un ensayo reversible privado. No se declaran implementados ni se retira el gate de contenido real/V.13.
- **EX-VPS-PRIVATE-01, propuesta y PENDIENTE de aprobación explícita:** tras verificar host por canal independiente y completar checks de acceso/seguridad, permitir ejecutar únicamente los alcances privados de V.2→V.3→V.4 mientras V.1 sigue abierta por dominio/backups externos. No cerrar V.1, no saltar V.3, no abrir80/443, no mover contenido real. Cada modificación sigue requiriendo aprobación concreta basada en el estado real. V.5 público y la cadena V.6–V.9 quedan sin ejecutar; preparar posteriormente su aceptación privada y autorización antes de alterar esa dependencia.
- La nueva decisión sobre backups no se interpreta como aprobación automática de EX-VPS-PRIVATE-01, de paquetes, firewall, claves, sudoers o reboot.

## Matriz de bloqueos

| Requisito | Estado observado | Efecto real |
|---|---|---|
| Identidad SSH independiente | Pendiente respuesta Host Ilimitado; TOFU fijado | Bloquea nuevas modificaciones administrativas por esta ruta; no repetir keyscan como verificación |
| gmaadmin/clave/sudo | Verificados en V.1 | No repetir creación/instalación de claves; confirmar sesión vigente inmediatamente antes de modificar |
| Excepción de dependencia | Propuesta, no aprobada | V.2 no se ejecuta mientras V.1 abierta sin excepción explícita |
| Inventario fresco de host y cambios/recovery | Lecturas previas guardadas; root/password intactos, noVNC login no probado | Read-only inmediato antes de modificar. Ante datos/servicios ajenos, detener. Reboot/hardening de SSH exige recuperación probada y permiso específico |
| Firewall/protección del laboratorio | UFW inactivo y políticas ACCEPT en lectura previa; panel desactivado informado | Aprobar defensa antes de arrancar nuevos servicios; mantener22 operativo y confirmar segunda sesión. Nunca aprovechar firewall inactivo para exponer aplicaciones |
| 27 entradas vulnerables/2 críticas GMA | Sin remediar | Bloquea exposición externa y contenido/datos reales; no se declara que todos los avisos sean vulnerabilidades de PeerTube. Ensayo privado solo con operadores/datos sintéticos, sin URLs/medios arbitrarios |
| Backups externos definitivos | Aplazados, no implementados | No bloquean ensayo privado recuperable; sí contenido irrepetible, V.13 y aceptación pública |
| Dominio definitivo/DNS/TLS público | Sin dominio propio confirmado | No bloquea instancia **desechable** loopback; bloquea instancia duradera y V.5 público |
| Plan/egress/snapshots proveedor | Contrato pendiente | Información pendiente; no benchmark/cargos. Antes de descargas, aprobar alcance y presupuesto de tráfico, sin asumir gratuidad |
| GMA/Auth/PostgREST de pruebas | Fixture F8 existente protegida; lab PeerTube todavía inexistente | No usar Supabase de producción ni modificar el proyecto local actual para activar PeerTube. Requiere entorno de integración separado en V.7 |

## Identidad y canal de recuperación

Esperar la respuesta de soporte con origen independiente de la Ed25519 `SHA256:jo9VT5Z9U3L4Yq5VdBdCRXPr2uc15Yo3JLI3gX2eDi8`. Conservar ticket/fecha/procedencia y comparar exactamente con pin local. Un resultado diferente bloquea operaciones; no reemplazar known_hosts. Root existente y gmaadmin son accesos comprobados, no certificación de noVNC. No hay contraseña que enviar al chat.

Antes de una acción autorizada, confirmar gmaadmin, sudo interactivo y segunda sesión sin cerrar root; comprobar que las lecturas de filesystem/listeners/unidades actuales siguen sin datos/servicios ajenos. El usuario teclea passphrase/contraseña solo en Terminal. No reutilizar el permiso anterior para nuevos cambios de SSH/root.

## Secuencia V.2 privada propuesta (sin ejecutar)

| Orden | Acción concreta posterior | Riesgo y límite | Verificación / marcha atrás |
|---|---|---|---|
| V2.P1 | Leer OS/kernel, CPU/RAM/disco/inodos, sockets, reglasIPv4/IPv6, failed units y paquetes presentes | Lectura, sin apt update/reboot ni dumps de credenciales. Capturar diferencias respecto a V.1 | Detener ante servicios/datos ajenos; no reinstalar Ubuntu |
| V2.P2 | Guardar configuración administrativa existente en copia privada del Mac: SSH/UFW/servicios a modificar, lista/versiones de paquetes, ownership/permisos | No se configura backup definitivo. Datos sensibles0600, fueraGit. Confirmar qué existe, no asumir un snapshot del proveedor | Manifest/reporte verificado antes de modificar; root intacto. No incluir shadow/passwords/env de terceros |
| V2.P3 | Aplicar defensa autorizada: conservar22; denegar ingreso nuevo a aplicaciones, DB y Redis, tambiénIPv6 | Firewall puede perder acceso. Aprobación separada con reglas exactas; no cambio del firewall del panel simultáneo | Mantener sesión root, permitir22 **antes** de default-deny/enable; segundo login gmaadmin y sudo. Ante fallo revertir solo reglas creadas desde sesión existente; no reset global |
| V2.P4 | Preparar actualización/parches y dependencias a partir de simulación apt y artefactos oficiales/versionados | Paquetes pueden activar/reiniciar servicios. Aprobar lista/versiones/tamaño y efecto de postinst antes de instalar; no upgrade/dist-upgrade/autoremove/sshd upgrade incidental | No ejecutar removals sugeridas ni reboots automáticos. Si cambia SSH/kernel o hay servicios ajenos, dividir en acción con aprobación específica. Registrar resultado; rollback de paquete no se promete sin versión previa disponible |
| V2.P5 | Crear identidades de servicio no-login `peertube` y `gma-media`, rutas nuevas separadas | Cambios de cuentas/permisos requieren autorización. Rechazar cuentas/rutas ya existentes no atribuidas | Root/gmaadmin/sudoers inalterados. HomePeerTube `/var/www/peertube`, config0750, secrets0600; GMA `/srv/gma-media-lab`, sin datos productivos |
| V2.P6 | Confirmar NTP, límites de proceso/FFmpeg, disco y listeners tras cada cambio | Reboot pendiente NO automático. No apertura80/443 | ConcurrenciaFFmpeg1/threads1; admitir solo si disco>=15%libre. El ensayo de reinicio de V.2 queda pendiente hasta permiso y recuperación probada |

Primera regla de firewall propuesta: conservar el acceso actual22/TCP sin estrechar origen hasta conocer CIDR administrativo y recuperación. Restricción a CIDR requiere aprobación distinta; no fijar un IP de salida del Mac no comprobado. No copiar estos pasos como un shell monolítico ni ejecutar `ufw reset`, cerrar root/password, cambiar puertoSSH o activar hardening global como parte incidental.

Dependencias: Node22LTS dentro del rango versionado>=22.12/<25, pnpm10.15.1; fijar patch/SHA oficiales antes de instalación. PostgreSQL/Redis pertenecen a V.3 y FFmpeg/PeerTube a V.4. La simulación/instalación no puede escoger silenciosamente latest fuera del rango. No introducir contenedores con puertos0.0.0.0 ni servicios públicos por defecto.

Presupuesto inicial propuesto: originales10GiB + spool10GiB + HLS10GiB + scratch5GiB; logs/paquetes/OS aparte. Fixtures cortas y reproducibles; no subir obras reales. Son límites de operación a implementar/verificar, no reservas ya aplicadas. Mantener umbral15%libre, CPU/transcoding1 y ningún benchmark masivo en esta etapa.

## V.3 privada: bases independientes

Después del alcance privado V.2 autorizado/aceptado: instalar PG/Redis oficiales compatibles en loopback, impedir arranque con bind público y verificar puerto antes de continuar. PeerTube usa DB nueva `peertube_gma_lab`, rol restringido `peertube_lab`, `pg_trgm`/`unaccent`; Redis propio protegido. No tablas PeerTube en Supabase ni rol/datos GMA compartidos. Credenciales nuevas fueraGit; no passwords del dump local ni de root/gmaadmin. V.3 requiere permiso de instalación/configuración separado. Antes de ensayar recuperación de DB, usar **base nueva** y datos sintéticos, sin repetir el ensayo ya cerrado de V.1.

## V.4 privada: motor oficial desechable

Artifact fijado v8.3.1/SHA ya verificado localmente; no descargar ni instalar latest silencioso. Verificar de nuevo SHA al copiar al destino, no repetir contratos/restore completos sin una razón nueva. Usar release oficial sin fork y cuentas de servicio. FFmpeg/config/PG/Redis/servicio necesitan aprobación del lote concreto.

`private-lab.yaml.example` es un overlay **no desplegable** que fija listen/webserver a `127.0.0.1:9000`, HTTP solo loopback, DB nueva y Redisloopback. Merge: default oficial → production oficial → policy GMA → private-lab overlay → secretos del laboratorio fueraGit. HLS y originales conservados, privacy3, P2P/tracker/signup/federación/import desactivados. Validar contra schema del tag antes de iniciar; no usar placeholders como secretos.

La [guía oficial PeerTube](https://docs.joinpeertube.org/install/any-os) advierte que el cambio de hostname de una instancia existente no tiene soporte oficial. Por eso este origen127.0.0.1 es **desechable**: no crea identidad duradera ni contiene contenido real. Al elegir dominio, levantar instancia nueva y volver a subir fixtures legales conservadas; no renombrar automáticamente esta DB ni prometer migrar sus UUID.

Pruebas privadas iniciales: `GET /api/v1/config` por túnel autorizado, `serverVersion=8.3.1`, listener9000solo loopback, trackerfalse/HLStrue, usuario del proceso no-root, logs sin secretos; pendientes de ejecución. No cerrar V.4 por instalar ficheros sin runtime/config/FFmpeg reales comprobados.

Ejemplo **no ejecutado** de acceso técnico posterior, solo después de autorización del túnel:

```sh
ssh -o ClearAllForwardings=no -o ExitOnForwardFailure=yes \
  -L 127.0.0.1:9000:127.0.0.1:9000 -N gma-filmo-vps
```

El alias actual bloquea forwarding por defecto: override explícito limitado a este puerto y bind del Macloopback; no configurar un alias global permisivo. El puerto debe estar libre en el Mac y conservarse coherente con origen upstream. El usuario final no utiliza UI/iframe PeerTube; acceso técnico no es el recorrido GMA.

## Preparación de V.5–V.9: dependencias NO ejecutadas ni omitidas

- V.5 público necesita dominio definitivo/TLS y no se realiza con esta propuesta. Para seguir con V.6–V.9 en privado debe aprobarse **otro alcance explícito** de V.5 privado y sus criterios (orígenes, proxy/autenticación, CORS/Range, acceso solo por túnel). No saltar V.5 basándose en que el puerto9000 responde.
- V.6 crea cuenta/canal técnicos no-admin y verifica server-only OAuth/private file tokens. Nunca canal/root de producción ni tokens en el navegador.
- V.7 integra gateway/executor y entorno GMA **nuevos**: proyecto Supabase local independiente propuesto `gma-filmo-peertube-lab`, puertos API55441/DB55442, UI52918/gateway52919. Verificar puertos libres y separación de volumen/owner/firmantes. PeerTube necesita DB aparte del proyectoGMA.
- Código real: `MediaConfig` permite HTTPgateway solo con entorno`local`/loopback y Mockaux solo con Supabase loopback; `staging` requiere HTTPSgateway. No rebajar ese contrato. Usar entorno local poseído distinto, sin claves/env de producción y sin modificar `.env.media.local` actual. Si se elige staging, preparar TLS privado válido y aprobación de confianza local por separado.
- `scripts/media/local-stack.ts`/`preflight.ts` están cerrados a la fixtureMock original; **no cambiar su project_id ni activar PeerTube en ella**. No ejecutar sus resets/start/prepare contra otra carpeta asumiendo aislamiento: Dockerproject_id coincide. El nuevo lab necesita runner/owner marker propios, pruebas de no afectación y manifest de fixtures antes de ejecutar.
- `scripts/media/gateway.ts` activa actualmente solo Mock; transferPeerTube y parser/cliente server-only están preparados en librería. V.7 debe cablear deps.peerTube y entrega privada real de playlists/init/segmentos; no declarar integración lista porque existan clases o tests de contrato. Mantener origins/capacidades/index/Range y sin vídeos grandes por Vercel.
- V.8→V.9: fixtures legales originales con SHA y copia en el Mac, uploadx/restart/retry/cancel/fencing/transcoding/HLS privado+decode en PlayerGMA y pruebas sin mocks de APIs producto. No marcar estadosREADY por un POST exitoso. No P2P ni URLs privadas publicadas.

## Gates que no se aplazan

Contenido de prueba debe poder regenerarse o conservar su fuente/manifest en el Mac antes de subir. Metadatos/logs críticos de una prueba nueva se exportan privadamente antes de cualquier reset; si se vuelven únicos, **pausar** hasta backup verificable. No llevar secretos productivos/DB real a este VPS. GMA con críticas no se expone; las vulnerabilidades no se consideran remediadas por usar SSH.

**V.13 sigue bloqueado** hasta backup externo verificable con alcance suficiente para el original real, metadata/DB/objetos, recuperación ensayada y rollback a la fuenteR2. B2 solo para configuraciones/DB no acredita copia de una película. No abrir tráfico público ni cerrar los pasos originales pendientes con resultados del lab.
