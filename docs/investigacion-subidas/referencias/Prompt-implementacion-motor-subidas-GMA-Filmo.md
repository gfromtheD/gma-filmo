# Prompt de implementación — motor de subidas de GMA-Filmo

Actúa como ingeniero principal encargado de **implementar y verificar** la reconstrucción del motor de subidas de GMA-Filmo.

Repositorio: https://github.com/gfromtheD/gma-filmo

**Empieza a trabajar en el código.** Inspecciona el estado actual, concreta un plan breve y ejecuta la implementación por fases hasta entregar un flujo funcional y revisable. Resuelve las decisiones rutinarias con criterio técnico. Si falta una credencial o configuración externa, termina el trabajo independiente y señala exactamente qué comprobación o activación queda bloqueada.

## 1. Objetivo y contexto

GMA-Filmo es una plataforma de películas, cortometrajes y creadores. “Mi Estudio” permite subir un vídeo principal y complementos, editar sus datos y publicar el título.

Queremos sustituir un motor frágil para archivos de varios GiB por una ingesta reanudable, segura y duradera, con cuotas fiables, recuperación ante fallos, procesamiento verificable y publicación controlada.

Ya se compararon una propuesta inicial de R2 multipart y una investigación independiente. La decisión destilada es:

- **Núcleo de negocio propio de GMA:** borradores, sesiones, permisos, cuotas, medios, publicación y reconciliación.
- **Cloudflare Stream con tus:** ruta inicial para películas, cortos y demás vídeos destinados a reproducción.
- **R2:** recepción privada de pósteres, subtítulos y archivos auxiliares.
- **Maestros originales exactos:** política opcional. Si se exige conservarlos, navegador → R2 multipart → importación a Stream; una sola subida desde el equipo del creador.

La prioridad es la solidez práctica. Usa mecanismos mantenidos y una arquitectura proporcionada al proyecto. Separa responsabilidades mediante módulos dentro del backend existente.

Esta orden se centra en el **funcionamiento interno y sus integraciones necesarias**. La futura organización visual será: panel junto a estadísticas, perfil junto a mis títulos, y la sección de subir como espacio central. Desacopla ahora el motor para permitir esa reorganización posteriormente.

## 2. Fuentes y comprobación inicial

Si están adjuntos, lee:

1. `Actúa como arquitecto de software especializado en.md`: investigación externa.
2. `GMA-Filmo-arquitectura-subidas-dictamen.md`: comparación y decisión final.

Este prompt recoge las decisiones ejecutables. El dictamen corrige algunas simplificaciones de la investigación externa; no copies sus ejemplos sin comprobar las garantías reales.

El código investigado correspondía a `main`, commit `41494c6289e3c60af9ef94a65875cadcac6508b8`. **Comprueba el HEAD actual:** los hallazgos siguientes son una referencia histórica.

Antes de editar:

- Lee `AGENTS.md`, instrucciones aplicables y configuración del proyecto. La instrucción observada pide consultar la documentación pertinente de `node_modules/next/dist/docs/`; verifica su disponibilidad y usa documentación oficial de la versión instalada si no está presente.
- Comprueba `package.json`, lockfile, migraciones, autenticación, políticas RLS y despliegue.
- Identifica todos los consumidores de URLs de vídeo: reproductor, catálogo, vista previa, perfil, mis títulos y caché.
- Confirma el modelo real de creador y sus permisos.
- Trabaja en una rama dedicada y conserva cambios ajenos.

Stack observado: Next.js, React, TypeScript, Supabase/PostgreSQL y SDK S3 para R2. **Conserva el stack y el sistema de autenticación.** Instala únicamente dependencias necesarias, compatibles con las versiones reales, y actualiza el lockfile.

## 3. Puntos del código que debes revisar

| Punto observado | Problema o responsabilidad |
|---|---|
| `components/features/studio/studio-upload-orbital.tsx`, función `uploadFile()` | Un XMLHttpRequest PUT envía el archivo completo; el progreso y los contadores viven en el navegador. |
| `components/features/studio/studio-upload-view.tsx` | Borrador local, pasos del formulario y publicación mediante URLs. |
| `app/api/upload/presign/route.ts` | Firma un PUT; recibe `sessionUsed` del cliente y la consulta de cuota no trata correctamente sus errores. |
| `app/api/upload/file/route.ts` | Recepción de archivos en el servidor; localiza sus usos antes de sustituirla, incluidos posibles avatares. |
| `lib/r2/client.ts` | Cliente, configuración y límites de almacenamiento. |
| `app/api/titles/route.ts` | Publica usando URL, tamaño y duración aportados por el cliente. |
| `supabase/migrations/20260712_publish_creator_pelicula_rpc.sql` | La RPC ya tiene atomicidad local y ejecución restringida; amplíala conservando esas garantías. |
| `lib/api/auth.ts` | Verifica JWT de Supabase; añade autorización de negocio. |
| `components/features/player/player-screen.tsx` | Reproductor propio con HTMLVideoElement y fuente MP4; necesita integración HLS. |

Inventaría también tráileres, intros, extras, subtítulos y pósteres horizontal/vertical: en el código auditado algunos se subían pero no quedaban vinculados completamente al título publicado.

Los límites observados eran 4 GiB para el principal, 6 GiB por sesión y 10 GiB por usuario. Verifica su significado actual y preserva inicialmente la restricción comercial equivalente; no conviertas el máximo del proveedor en el límite de GMA. Identifica GB/GiB correctamente. La contabilidad de Stream necesita además duración, independiente de los bytes.

## 4. Arquitectura y separación obligatorias

Implementa estas responsabilidades:

1. **Cliente de transferencia:** selección, progreso, pausa, reintentos y reanudación.
2. **API de GMA:** permisos, validación, reservas y coordinación.
3. **PostgreSQL:** estado durable, asociaciones e idempotencia.
4. **Adaptadores de proveedor:** Stream y R2, pequeños y concretos.
5. **Eventos y reconciliación:** recuperar diferencias y operaciones inciertas.
6. **Publicación y playback:** comprobar disponibilidad y autorizar reproducción.

El cliente depende de contratos del motor mediante hooks o servicios reutilizables. Un cambio de posición visual no debe modificar la lógica de cuotas o transferencia.

Usa Uppy core y su integración tus, o el cliente tus mantenido si existe una incompatibilidad justificada. Prefiere integración sin imponer una nueva interfaz. Comprueba APIs y compatibilidad antes de fijar versiones; los ejemplos antiguos de Uppy y los de su integración S3 no son intercambiables.

El navegador transfiere vídeos directamente al proveedor. Evita pasar películas completas por rutas Next.js o cargarlas enteras en memoria. Credenciales administrativas y tokens de API quedan en servidor.

Para empezar, outbox/inbox SQL y un ejecutor periódico compatible con el despliegue pueden bastar. Haz duraderos los trabajos: no dependas de procesos en memoria, temporizadores de una instancia serverless o promesas abandonadas después de responder.

## 5. Modelo de datos y estados

Adapta nombres a las convenciones reales y reutiliza entidades existentes cuando sea apropiado. Necesitas:

- Borradores persistidos con propietario y revisión.
- `upload_sessions`: sesión, propietario, borrador, tipo, proveedor, referencia externa, tamaño esperado, reserva, caducidad, clave idempotente, revisión y coordinación.
- `media_assets`: ID interno, propietario, referencia de proveedor, estado, metadatos verificados y política de acceso/retención.
- Relaciones borrador/título → medios, con rol y versión.
- Cuentas y ledger de cuotas.
- Inbox de eventos y outbox/trabajos duraderos, con reintentos y deduplicación.

Guarda IDs y referencias estables. Las URLs de transferencia y reproducción son autorizaciones temporales, nunca la identidad permanente del medio.

Separa los estados:

| Dominio | Estados orientativos |
|---|---|
| Transferencia | provisioning, uploading, paused, uploaded, cancelling, cancelled, expired, failed |
| Medio | received, validating, processing, ready, rejected, deleting, deleted |
| Título | draft, published, unpublished |

Define transiciones permitidas y operaciones condicionales por estado/revisión. Un medio listo puede retirarse o borrarse; la máquina no debe asumir que todo evento únicamente avanza.

Crea restricciones únicas para idempotencia por propietario/operación, referencias externas y movimientos de cuota. Usa RLS para proteger datos del usuario y RPC/transacciones para cambios sensibles. Revisa privilegios y `search_path` en funciones privilegiadas.

## 6. Cuotas y consistencia

Reserva cuota **antes de autorizar la transferencia**, junto con la sesión y el movimiento del ledger, en una transacción.

- Comprueba uso confirmado + reservas + petición con bloqueo o actualización condicional apropiados.
- Separa bytes de R2, duración reservada/almacenada de Stream y límites comerciales de GMA.
- Para Stream configura `maxDurationSeconds` desde una política del servidor y reserva el máximo autorizado; la duración local es una pista.
- Incluye límites por creador, borrador, tipo, concurrencia y capacidad global.
- Si la base de datos falla, devuelve un error controlado: no asumas cuota cero.
- Configura duración máxima y presupuestos con límites finitos y validación. Documenta qué valores requieren decisión comercial.
- Libera reservas o uso solo cuando aborto, expiración o eliminación del recurso facturable estén confirmados.

La gratuidad de R2 pertenece a la cuenta y no a cada usuario. Las alertas de gasto complementan los controles de uso.

Supabase y el proveedor **no comparten una transacción**. Persiste intención/correlación antes de crear un recurso externo. Si se pierde su respuesta, registra resultado incierto y reconcilia antes de repetir.

Garantiza idempotencia en la API propia mediante clave y hash de solicitud: misma operación devuelve su resultado; misma clave con otro contenido devuelve conflicto. Eventos y trabajos pueden entregarse repetidamente; sus consumidores deben ser idempotentes.

## 7. API y flujo de implementación

Adapta rutas si el proyecto ya tiene convenciones equivalentes:

| Operación | Resultado exigido |
|---|---|
| Crear/actualizar borrador | Persistencia del servidor y control de revisión |
| `POST /api/uploads` | Autorizar, reservar, crear/recuperar sesión y devolver contexto temporal |
| `GET /api/uploads/:id` | Estado autorizado de sesión y medio |
| `POST /api/uploads/:id/resume` | Coordinar recuperación y comprobar vigencia del recurso |
| `POST /api/uploads/:id/cancel` | Intención durable, cancelación/borrado confirmado y contabilidad |
| `POST /api/uploads/:id/complete` | Verificación de recepción; nunca publicación automática |
| `POST /api/titles/:id/publish` | Publicación por IDs internos y revisión del borrador |
| `POST /api/webhooks/stream` | Verificación, persistencia y procesamiento idempotente |
| Endpoint de playback del título | Aplicar acceso público/privado y emitir contexto autorizado |

Valida entradas con esquemas, límites y errores estables. Comprueba usuario, permiso de creador, propiedad y borrador en cada operación. El servidor decide proveedor, bucket, clave y UID.

Para Stream, el backend provisiona la subida tus y conserva el UID. El cliente comunica el fin de la transferencia; GMA consulta al proveedor para actualizar procesamiento y disponibilidad.

Para auxiliares pequeños en R2, un PUT autorizado puede bastar si finalización, tamaño, contenido y propiedad se verifican. Para archivos grandes que el producto permita en R2, usa multipart con firma limitada de partes, consulta paginada de `ListParts` y finalización/aborto controlados por backend.

## 8. Recuperación e identidad del archivo

Implementa pausa/reanudación, backoff con jitter, renovación de autenticación y recuperación del borrador.

- El offset tus o las partes confirmadas por R2 determinan lo recibido. El contador del navegador no es autoridad.
- Tras recargar o cerrar, recupera la sesión y permite reseleccionar el archivo.
- Una huella de tamaño, nombre, fecha y muestras no demuestra igualdad completa.
- Para reanudar tras perder el File original, utiliza una identidad fuerte del archivo, por ejemplo SHA-256 completo conocido desde la selección original, calculado incrementalmente en Worker sin cargar la película en RAM. Una estrategia equivalente debe justificar y probar su garantía.
- Si no existe identidad suficiente o no coincide, impide mezclar archivos en el recurso anterior y ofrece una sesión nueva.
- No dupliques películas completas en IndexedDB. Golden Retriever es opcional y no resuelve por sí solo la persistencia de archivos de varios GiB.
- El cierre del navegador detiene la transferencia normal; comunícalo correctamente.
- Una URL R2 caducada puede renovarse si el multipart sigue activo. Un recurso tus expirado o abortado puede exigir comenzar otro recurso.
- Ajusta chunks tus a la documentación vigente de Stream y limita concurrencia/memoria.

Coordina pestañas mediante lease/revisión y rechaza comandos antiguos. **Una lease SQL no revoca URLs externas ya entregadas.** Para exclusión estricta verifica las garantías del proveedor y cancela/invalida el recurso previo cuando sea necesario.

## 9. Validación, webhooks y reconciliación

Para publicar un vídeo de Stream verifica el estado actual y la política técnica/editorial. El criterio inicial de estreno exige `readyToStream === true`, `status.state === "ready"` y procesamiento completo de las calidades, conforme a los campos reales de la API vigente.

Para R2, comprueba existencia y tamaño mediante proveedor, decodifica imágenes y valida dimensiones; analiza y normaliza subtítulos con límites de texto/formato. MIME y extensión del cliente son pistas.

Verifica webhooks sobre el cuerpo original, timestamp y comparación segura. Persiste eventos autenticados antes de procesarlos. No inventes un `event_id` universal de Stream: deduplica con los campos documentados o una clave/hash adecuado y consulta el estado actual para resolver retrasos.

Implementa un reconciliador periódico que detecte:

- Provisionamientos inciertos y recursos huérfanos.
- Subidas recibidas cuyo estado no se confirmó en SQL.
- Procesamiento sin evento o con error.
- Reservas antiguas y recursos caducados.
- Cancelaciones/eliminaciones pendientes.
- Divergencias de cuota.

Usa reclamación de trabajos, reintentos limitados y registro de fallos. Protege el ejecutor y evita carreras con publicación, reemplazo o limpieza.

## 10. Publicación y reproducción

La publicación usa IDs de medios. El servidor obtiene propiedad, estado, duración y referencias verificadas. No aceptes URLs arbitrarias ni duración/tamaño del cliente como autoridad.

Conserva la atomicidad de la RPC existente y añade validación, revisión e idempotencia. Publica metadatos, relaciones y acción outbox de forma transaccional.

Preserva inicialmente el criterio observado: corto por debajo de 40 minutos y película desde 40 minutos; deriva la clasificación de duración verificada.

Conecta todos los complementos admitidos, incluidas orientaciones de póster. Para reemplazar un vídeo publicado crea una versión nueva y cambia la referencia solo cuando esté lista.

Integra HLS en el reproductor actual:

- HLS nativo cuando proceda y un adaptador mantenido para los demás navegadores.
- Conserva controles, subtítulos, progreso, búsqueda, fullscreen y comportamiento existente.
- Distingue referencias legacy R2/MP4 de medios Stream.
- Aplica la política de acceso al emitir playback; una portada pública no hace públicos los originales.
- Diseña TTL/renovación para películas largas, pausas y reanudación. Comprueba cambios de token sin perder posición.
- Evita precarga de múltiples películas en catálogo; puede generar tráfico facturable.

Los tokens firmados controlan acceso y no equivalen a DRM.

## 11. Seguridad y política de originales

Protege ingesta en R2 mediante bucket/política realmente privados. Un prefijo `ingest/` no aporta privacidad por sí solo. No alteres de golpe un bucket que sostiene reproducción legacy.

Configura CORS/CSP para hosts, métodos y encabezados necesarios. CORS no sustituye autenticación. Excluye tokens, URLs de subida, credenciales y datos sensibles de logs y analytics.

Stream no debe presentarse como archivo original exacto ni como garantía automática de 4K, HDR o audio multicanal. Verifica capacidades actuales y calidad con material real.

**No actives conservación obligatoria de maestros por defecto.** Deja la extensión preparada y documentada; si ya existe un requisito explícito de archivo exacto, implementa la rama completa R2 multipart → verificación → importación privada a Stream, sin doble subida doméstica. No habilites una ruta incompleta.

En multipart, no confundas ETag con SHA-256 del archivo completo. Comprueba checksums por operación y compatibilidad real de R2. La integración S3 elegida debe permitir el control backend de finalizar/abortar; no firmes una finalización libre que eluda validaciones.

## 12. Orden de trabajo y migración

Ejecuta y verifica por fases, sin detenerte después del primer entregable:

1. **Inventario y contratos:** dependencias, consumidores, datos y límites.
2. **Núcleo:** migraciones aditivas, borradores, sesiones, medios, permisos, cuotas e idempotencia.
3. **Transferencia:** Stream/tus, auxiliares R2 y conexión a la UI existente.
4. **Fiabilidad:** eventos, reconciliación, cancelación, eliminación y fallos.
5. **Producto completo:** publicación validada y reproductor HLS.
6. **Piloto y retirada:** feature flag, documentación operativa y plan de migración legacy.

Conserva los títulos y objetos existentes. Registra/adapta sus referencias con un proceso verificable e idempotente; no marques todo como listo sin inspección.

La coexistencia no debe dejar una ruta antigua que permita saltarse cuotas o publicar URLs arbitrarias. Si se admiten borradores antiguos, verifica propiedad/objeto y vincúlalos al nuevo modelo.

Retira código de subida obsoleto después de validar los nuevos flujos y localizar sus consumidores. Conserva los usos legítimos de auxiliares pequeños.

Deja activación y migraciones de producción preparadas y documentadas; ejecuta cambios externos solo en un entorno autorizado. Las decisiones rutinarias de implementación no requieren confirmaciones por fase.

## 13. Pruebas y criterios de aceptación

Escribe pruebas de comportamiento y fallos, con PostgreSQL real para invariantes transaccionales cuando esté disponible. Usa dobles controlables del proveedor para fallos deterministas y pruebas externas para validar su comportamiento real.

| Caso | Resultado esperado |
|---|---|
| Archivo grande con red interrumpida | Reanuda desde lo confirmado y limita retransmisión |
| Recarga, cierre y reselección | Recupera sesión y verifica identidad del archivo |
| JWT o autorización temporal caducados | Recuperación específica, sin duplicación ciega |
| Peticiones simultáneas con cuota al límite | Reservas correctas; no se excede el límite |
| Dos pestañas o comandos de revisión antigua | Control coherente de sesión y publicación |
| Timeout tras creación/completado externo | Estado incierto reconciliado |
| Cancelación, completado y limpieza simultáneos | Un resultado lógico y cuota correcta |
| Webhook falso, duplicado o retrasado | Rechazo o procesamiento idempotente coherente |
| Vídeo reproducible con codificación incompleta | Aún no publica con la política de estreno |
| Archivo corrupto o duración fuera de política | Rechazo controlado |
| Medio perteneciente a otro usuario | Acceso/publicación denegados |
| Proveedor y SQL desincronizados | Reconciliación recupera el estado |
| Reemplazo de título publicado | La versión anterior funciona hasta activar la nueva |
| Película de más de una hora | Playback, pausa y renovación funcionan |
| Safari, Chrome, Firefox y móvil | HLS, subtítulos, búsqueda y fullscreen |
| Título legacy, tráileres, extras y pósteres | Sin regresión y con asociaciones persistentes |

Ejecuta los checks pertinentes del repositorio: tipos, lint, build y tests aplicables. Prueba calidad audiovisual con cortos y películas reales: movimiento, grano, sombras, relación de aspecto, audio, subtítulos y seek.

Distingue **verificado localmente**, **verificado con proveedor real** y **pendiente**. No declares aprobado un piloto que no has ejecutado.

## 14. Entrega exigida y comienzo inmediato

Entrega:

- Código integrado y migraciones aditivas.
- Feature flag reversible y configuración validada.
- Ejemplo de variables sin secretos; instrucciones de Stream, R2, webhook, CORS/CSP y ejecutor.
- Pruebas pertinentes y resultados reales.
- Runbook de recuperación, limpieza, cuotas, diagnóstico y rollback.
- Resumen de cambios, limitaciones y decisiones de producto pendientes.
- Cambios revisables en la rama y PR preparado si el entorno lo permite.

Expón métricas útiles: éxito de transferencia, reanudaciones, bytes retransmitidos cuando se puedan medir, sesiones atascadas, antigüedad de reservas, huérfanos, tiempo de procesamiento y errores de playback.

Si faltan credenciales, capacidad de Stream o acceso al entorno, implementa y prueba todo lo independiente. Mantén la nueva ruta desactivada hasta disponer de configuración válida y enumera la activación pendiente con precisión.

**Comienza ahora:** inspecciona el repositorio y sus instrucciones, identifica las diferencias respecto de la auditoría, crea la rama de trabajo e implementa el núcleo. Continúa hasta completar transferencia, fiabilidad, publicación y playback dentro del alcance.

## Documentación primaria de consulta

Comprueba la documentación vigente de las versiones que implementes:

- Stream: [subida directa](https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/), [tus](https://developers.cloudflare.com/stream/uploading-videos/resumable-uploads/), [webhooks](https://developers.cloudflare.com/stream/manage-video-library/using-webhooks/).
- Stream: [reproductor propio](https://developers.cloudflare.com/stream/viewing-videos/using-own-player/web/), [acceso firmado](https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/), [FAQ](https://developers.cloudflare.com/stream/faq/).
- Stream: [importación por enlace](https://developers.cloudflare.com/stream/uploading-videos/upload-via-link/), [precios](https://developers.cloudflare.com/stream/pricing/).
- R2: [multipart](https://developers.cloudflare.com/r2/objects/upload-objects/), [compatibilidad S3](https://developers.cloudflare.com/r2/api/s3/api/), [lifecycle](https://developers.cloudflare.com/r2/buckets/object-lifecycles/).
- Clientes: [Uppy tus](https://uppy.io/docs/tus/), [Uppy S3](https://uppy.io/docs/aws-s3/), [cambios Uppy 6](https://uppy.io/blog/uppy-6.0/), [Golden Retriever](https://uppy.io/docs/golden-retriever/), [protocolo tus](https://tus.io/protocols/resumable-upload/1-0-x).
- Seguridad: [OWASP File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).

