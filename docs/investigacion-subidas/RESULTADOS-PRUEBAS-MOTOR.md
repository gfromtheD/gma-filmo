# Resultados de pruebas del motor de subidas

Fecha: 2026-10-05. Rama: `feature/upload-engine-v2`. Base: `93fbea02b0e69eb7d3f054b59e55f9caa6a37351`.

| Comprobación | Resultado | Alcance |
|---|---|---|
| Pruebas SQL/contratos/proveedores | **26/26 pasan** | Migración, RLS, cuota, idempotencia, cancelación, validación, subtítulos/idiomas, sustitución, borrado de cuenta, JWT HLS, errores y POST incierto |
| PostgreSQL 17.10, conexiones independientes | **1/1 pasa** | 10 reservas concurrentes → solo 5 dentro del máximo; 20 reintentos → una sesión; 20 trabajadores → una concesión; recuperación del trabajador caído |
| Navegador del motor v2 | **1/1 pasa** | Worker SHA real, PUT directo interceptado, validación antes de listo, recuperación tras recarga y anchura móvil de 320 px |
| Regresión responsive existente | **7/7 pasan** | Subidas a 320/768/1440 px, cola, estudio/perfil, navegación y orientación; motor v2 apagado |
| TypeScript | **Pasa** | Sin errores de tipos |
| Lint durante build | **Pasa con avisos** | Avisos existentes sobre imágenes y una referencia del módulo de mensajes; ningún error |
| Build Next 14.2.35 | **Pasa** | Rutas compiladas y generación completa; no valida servicios reales |
| Preflight local | **Bloquea activación** | Sin variables utilizables de Supabase/R2/Stream; ambas banderas false |
| Auditoría de dependencias de producción | **21 avisos** | 3 bajos, 3 moderados, 14 altos y 1 crítico; Next está entre los pendientes de revisión. No se fuerza una actualización mayor |

## Reproducción del fallo histórico

El test ejecuta la ruta de presign del commit base con dobles de sus dependencias. Dos peticiones de 4 GiB reciben 200 y suman 8 GiB autorizados con un límite nominal de 6 GiB. Un error SQL también recibía 200. El test comprueba que el código actual devuelve 503 para ese error y que las nuevas reservas SQL no exceden los límites.

Esta reproducción controlada demuestra fallos de autorización del código. La causa concreta de la subida fallida del usuario sigue pendiente de su traza real y del entorno efectivo.

## Qué se probó realmente

- PGlite ejecuta PostgreSQL y la migración sobre una fixture mínima derivada del contrato histórico; no es una conexión al Supabase del proyecto.
- El clúster PostgreSQL temporal independiente permite probar contención real con conexiones simultáneas. Se inicializa bajo `Documents/Codex/Temporal/gma-filmo`, se escucha únicamente en localhost y se elimina al finalizar.
- Los proveedores en pruebas están simulados. Se decodifica una imagen real con sharp, se normaliza y se comprueba la separación entre ingest, salida definitiva y marcador de cancelación. No se afirma haber comprobado la condición contra R2 remoto.
- La prueba de navegador calcula un SHA auténtico con el worker y recarga el borrador. Las respuestas de Supabase y R2 se interceptan. El servidor de la fixture registra un aviso DNS del dominio ficticio: no es un fallo de una cuenta real ni una prueba de integración externa.
- La firma JWT HLS se comprueba con RSA local. La decodificación audiovisual de manifiestos reales y la renovación en Safari/Android necesitan el piloto externo.

## Bloqueos y acceso que los resuelve

| Prueba externa pendiente | Acceso necesario |
|---|---|
| Esquema efectivo, RLS, cuotas existentes y migración aislada | Supabase de pruebas: URL/anon, URL/service-role y conexión PostgreSQL; inventario autorizado de producción |
| Transferencia tus, offset final, transcodificación y límites reales | Cuenta Stream aislada, API token y customer code |
| Eventos, replay y firma de reproducción | Webhook secret, URL única del entorno y clave RSA de Stream con su ID |
| PUT/HEAD, CORS, normalización, claves finales y limpieza | Bucket R2 privado aislado, credenciales y permiso para inspeccionar CORS/lifecycle |
| Durabilidad del ejecutor y límites de funciones | Ejecutor persistente o planificador externo, secreto y acceso al preview Vercel |
| Calidad y capacidad/coste | Material de piloto, aceptación de hasta 1080p/SDR/estéreo sin máster, presupuesto y métricas/alertas del proveedor |
| Aptitud para producción | Piloto completo aprobado y revisión de los avisos de dependencias |

La consulta de secretos a Vercel recibió 403. El archivo local temporal de producción contenía valores redactados. No hay una integración real certificada, ni migración aplicada a producción, ni un despliegue nuevo de este motor.

Configuración, diez correcciones, comandos y orden de activación: [IMPLEMENTACION-MOTOR-SUBIDAS.md](IMPLEMENTACION-MOTOR-SUBIDAS.md).
