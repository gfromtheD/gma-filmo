# Backups externos futuros — aplazados, NO IMPLEMENTADOS

Decisión D-VPS-TEST-01 del usuario, 2026-10-11: concentrarse en pruebas recuperables del motor, sin exigir todavía las dos soluciones externas definitivas. Ensayo de restauración local COMPLETADO y snapshot privado544fuentes conservado; no reejecutarlo por esta decisión. Esto no es una garantía de backup externo ni autorización de contenido real, facturación, cuentas, compras o acceso al servidor casero.

## A. Servidor Linux casero / HDD400GB / SSH

Recurso indicado por el usuario, todavía **no inspeccionado ni aprovisionado para backups**. Propuesta: Restic con copias cifradas e incrementales en repositorioSFTP por SSH. La [documentación oficial de Restic](https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html#sftp) describe este backend; contraseña de repositorio separada de SSH y recuperable fuera del VPS. Consultada también la [verificación de repositorios](https://restic.readthedocs.io/en/stable/045_working_with_repos.html).

Antes de implementar: identificar IP/alias/huella independiente del host casero; verificar SSH/SFTP, espacio real, salud/montaje del HDD, conectividad, permisos, retención y destino exacto.400GB nominales no son espacio libre ni capacidad certificada. Reservar espacio para crecimiento/retención y scratch de mantenimiento; no confiar en compresión del vídeo.

Cuenta backup restringida al directorio, clave dedicada, SSH host checking y repositorio cifrado. No reutilizar clave gmaadmin ni contraseña root. No exponer SSH casero a Internet sin diseño/aprobación de red; preferir acceso restringido/red privada aprobada. SFTP con permisos de escritura también puede permitir borrar: no llamarlo immutable/append-only. Separar privilegios de ingestión/mantenimiento y conservar una copia independiente.

Alcance futuro: configuraciones/manifests, dumps consistentes PG GMA y PeerTube separados, originales/HLS/aux y estado de spool/generaciones cuando sean necesarios para recuperación. Las claves de cifrado/firma se custodian separadamente en copia cifrada protegida; nunca únicamente dentro del repositorio que necesitan descifrar.

Validación futura: `restic check` y lectura de datos, restore a DB/carpeta nueva, verificación de SHA/ownership/RLS/playback privado; solo entonces marcar operativo. Retención/prune y programación necesitan presupuesto y permiso; ningún comando init/backup/prune o tarea programada se ejecuta ahora.

## B. Backblaze B2 — pequeña copia externa de datos críticos

**Cuenta/bucket/repositorio/credenciales/backup NO creados ni verificados.** Propuesta: bucketprivado para configuraciones, dumps y metadata críticos cifrados, sin originales cinematográficos al inicio. No confundir B2 con el producto Computer Backup.

Consulta oficial 2026-10-11: [tarifas B2](https://www.backblaze.com/cloud-storage/pricing) indican **10GB iniciales de almacenamiento gratuitos**; descarga incluida hasta3veces el almacenamiento medio mensual, exceso0,01USD/GB; almacenamiento fuera de lo incluido se anuncia desde6,95USD/TB/mes. Es oferta limitada, no backup ilimitado/gratuidad garantizada para el proyecto. [Tarifas API](https://www.backblaze.com/cloud-storage/transaction-pricing): clasesA/B/C gratuitas, claseD2.500llamadas/día incluidas y después0,004USD/10.000; uploadsin cargo de transferencia.

Contradicción visible en fuentes oficiales: la nota de la páginaAPI aún muestra0,005USD/GB/mes para almacenamiento; la página comercial vigente muestra6,95USD/TB/mes. No usar la nota antigua como presupuesto. Revisar tarifas/condiciones de cuenta/región al alta y antes de habilitar billing; resolver cualquier diferencia con proveedor. No crear cuenta ni cargar tarjeta con esta planificación.

Límite operativo propuesto: mantener repositorio/config+dumps+versiones **por debajo de8GB** para margen, controlar espacio real total/calls/egress y alertar antes de superar lo gratuito. Versiones/retención y metadatos del repositorio consumen almacenamiento. El presupuesto8GB es propio, no una cuota dura aplicada ni un tope de facturación probado. No asumir que alertas impiden cargos o que ObjectLock no consume espacio.

Antes de usar: aprobar cuenta/región/bucket/retención y política de costes, validar estado de billing/caps, credenciales restringidas al bucket, cifrado cliente y secreto fueraGit, verificación/restore aislado. No activar lifecycle que pueda borrar bloques de un repositorioRestic activo; cualquier retención debe coordinarse con el formato/herramienta. Herramienta B2 definitiva por confirmar en la fase de backup; no hace falta decidirla para V.2.

## Condiciones comunes y gate de contenido real

Ambas soluciones pendientes; no estimar RPO/RTO sin pruebas. No copiar datadirPostgreSQL activo como backup consistente; preparar dumps y objetos coordinados con admisión/executor/leases, namespace/generaciones y manifiestos. La copia de fuentes544archivos no contiene DB/Auth/storage y no reemplaza esto.

Las pruebas del VPS pueden avanzar solamente por excepción privada aprobada con medios regenerables/fuentes conservadas y sin únicos irrepetibles. No poner datos únicos o reales hasta disponer de backup verificable/restore/rollback. **V.13 requiere backup que cubra también el original de la película**, fuenteR2retenida y rollback probado; configurar únicamente B2 para DB/config no satisface ese gate.
