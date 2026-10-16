# Solicitud preparada para soporte — V.1

Borrador; **no enviado**. Enviar desde el ticket del panel HTTPS autenticado de Host Ilimitado. No adjuntar claves privadas, contraseñas, dumps ni enlaces temporales de consola.

## Texto para copiar

Solicito comprobaciones de solo lectura para mi VPS, producto **5515**, VM **106**, IPv4 **77.42.52.127**, hostname de panel **xptawLk3.ilimitado.host**.

1. Confirmen por este canal autenticado la huella SHA256 de la clave pública SSH **Ed25519** del servidor, obtenida directamente desde su consola/hypervisor o registro fiable de provisión. Huella que veo en SSH: **SHA256:jo9VT5Z9U3L4Yq5VdBdCRXPr2uc15Yo3JLI3gX2eDi8**. Indiquen procedencia y fecha. Una nueva conexión SSH o ssh-keyscan no proporciona verificación independiente.
2. Confirmen recursos contratados: vCPU y si son compartidas/dedicadas, RAM, disco, límites de I/O, velocidad de red, tráfico/egress incluido y posibles costes de exceso. Observación Ubuntu: 8 vCPU, 16.371.228.672 bytes RAM, disco bruto 240 GiB y filesystem raíz 231,44 GiB.
3. Confirmen qué backups/snapshots incluye exactamente este producto: si existe alguno ahora, fecha/estado, retención, destino, coste, consistencia y posibilidad de restaurar **como una VM nueva y aislada**, sin revertir la actual. ¿El snapshot incluye todos los discos? ¿Qué garantiza para PostgreSQL en ejecución?
4. noVNC aparece disponible pero falló su login. Indiquen cómo comprobar el acceso de recuperación sin restablecer credenciales ni afectar al VPS. El acceso SSH desde mi Mac funciona. El hostname del panel no resuelve desde el Mac: aclaren si es una etiqueta interna o nombre que debe tener DNS.

**Esta solicitud no autoriza** cambios de contraseña, claves, firewall, permisos, reinstalaciones, reinicios, restauraciones ni contratación/cargos. Solicito primero información y procedimiento; aprobaré por separado cualquier acción.

## Evidencia requerida al recibir respuesta

Guardar número de ticket, fecha, fuente de la huella y comparación exacta. Si difiere, detener operaciones administrativas y revisar con soporte sin reemplazar la clave fijada. Registrar límites/backup del contrato separadamente de la oferta comercial. Nunca marcar como existente o restaurable un backup sin identificar origen, fecha, alcance y destino de prueba.
