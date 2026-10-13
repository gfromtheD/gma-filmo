# Prompt de investigación para Perplexity — arquitectura de subidas

Copia el texto siguiente en un agente de investigación de Perplexity. Este documento prepara la investigación; no se ha enviado a ningún servicio externo.

---

Actúa como investigador técnico de arquitecturas de subida y publicación de vídeo para una plataforma de cine independiente con cuentas de creadores. Investiga buenas prácticas, soluciones y aplicaciones de referencia. Necesito un informe fundamentado que sirva a un agente de desarrollo para diseñar una arquitectura sólida y un plan de migración gradual. No implementes código ni des por comprobada la configuración de nuestra infraestructura.

## Contexto del proyecto

Repositorio público: https://github.com/gfromtheD/gma-filmo. Base de nuestro diagnóstico: commit `41494c6289e3c60af9ef94a65875cadcac6508b8`. Si puedes acceder al código, cita el archivo y línea de cada hallazgo; si no puedes, usa los hechos siguientes como contexto aportado y declara esa limitación. El código posterior puede incorporar correcciones ajenas al motor de subidas.

Stack actual: Next.js 14.2, React 18, TypeScript, Supabase Auth/PostgreSQL y RLS, almacenamiento Cloudflare R2 mediante API S3 y despliegue previsto en Vercel. Se suben vídeos principales, tráileres, extras, intros, imágenes y subtítulos. Se desea reproducción web y publicar obras asociadas al creador y su muro público.

Recorrido actual: el navegador pide una URL firmada a `/api/upload/presign`, hace PUT directo a R2 con XMLHttpRequest y después publica en `/api/titles`; una RPC PostgreSQL crea película y relación de género. Existe otra ruta `/api/upload/file` que recibe el archivo completo en el servidor y lo copia a memoria; se usa también para avatares. La selección de archivos inicia transferencias concurrentes automáticamente. La URL firmada dura 3.600 segundos. El borrador se guarda en localStorage con una clave común.

Límites de producto declarados, todavía NO medidos: principal 4 GiB; tráiler/extras 1 GiB por archivo; intro 500 MiB; cada póster 10 MiB; subtítulos/avatar 5 MiB; sesión 6 GiB y cuota gratuita por usuario 10 GiB. Los mensajes actuales llaman GB/MB a cantidades binarias. Estos números no son límites certificados del proveedor ni capacidad contratada. Mantén esa distinción.

Riesgos identificados estáticamente: el cliente envía `sessionUsed`, tamaño y MIME; se firma sin reservar cuota central; el consumo se calcula sumando solo tamaños de vídeos principales publicados; no cuenta recursos secundarios ni objetos huérfanos. Las consultas concurrentes pueden ver la misma cuota. La ruta alternativa no aplica cuota total/sesión. Publicar acepta URLs y tamaños del cliente sin confirmación server-side del objeto y propietario. Retirar una película borra su fila pero no los objetos. Tráiler, extras, intro y ambos pósteres no quedan todos asociados al publicar. No se observa multipart/reanudación ni idempotencia de publicación. La identidad de creador autenticado y el perfil público usan modelos distintos.

## Preguntas que debes resolver

1. ¿Qué arquitectura incremental encaja con este stack? Compara mantener R2 con un servicio de vídeo gestionado y una solución autogestionada. No propongas sustituir todo el stack por defecto.
2. ¿Cuándo conviene PUT firmado, multipart S3, protocolo tus o un servicio gestionado? Distingue compatibilidad nativa real de cada proveedor de adaptadores que haya que operar. Incluye cancelación, reanudación tras recargar, expiración, limpieza de partes y reintentos.
3. ¿Qué límites y restricciones actuales tienen R2, Vercel y Supabase relevantes para estas operaciones? Comprueba tamaños de petición/objeto/parte, tiempo, memoria, rate limits, CORS y permisos. Separa hosting serverless del envío directo navegador–almacenamiento. Cada dato necesita fuente oficial, fecha de consulta y alcance según plan/operación.
4. ¿Cómo reservar, contabilizar y liberar cuota atómicamente entre pestañas y transferencias concurrentes? Propón tablas de sesiones/recursos/reservas, conciliación de bytes reales, estados, expiración y separación entre almacenamiento usado, reservado y capacidad comercial.
5. ¿Cómo confirmar tamaño, tipo, checksum, existencia y propiedad del objeto desde servidor antes de publicar? Explica qué garantías dan y no dan las firmas, Content-Length y MIME declarados. Trata contenido inválido, URLs ajenas y autorización del rol creador.
6. ¿Cómo modelar vídeo, tráiler, extras, intro, pósteres y subtítulos para no perder asociaciones? Define cardinalidad, orden, sustitución, borrado y titularidad sin publicar datos privados del usuario.
7. ¿Cómo coordinar almacenamiento y PostgreSQL sin una transacción distribuida? Propón idempotencia, compensaciones, outbox/jobs y un proceso de limpieza que no borre recursos todavía válidos.
8. ¿Cómo separar recepción, validación, procesamiento y publicación? Compara MP4 directo frente a transcodificación/HLS, costes y códecs/navegadores. No afirmar que subir cualquier archivo asegura reproducción.
9. ¿Qué herramientas del cliente y servidor conviene comparar? Considera Uppy, tus/tusd, AWS SDK S3 y alternativas mantenidas, y servicios como Cloudflare Stream, Mux y equivalentes pertinentes. Confirma compatibilidad, mantenimiento/licencia y restricciones reales. Las aplicaciones de referencia deben aportar un patrón concreto; no inventes su arquitectura interna.
10. ¿Cómo diseñar una interfaz comprensible con progreso por archivo, límites antes de seleccionar, pausas/reintentos/cancelación, borrador por cuenta y mensajes recuperables? Prioriza escritorio y móviles con redes lentas.
11. ¿Cómo medir capacidad sin confundir la cuota de un creador con capacidad total o un máximo teórico? Diseña pruebas de tamaños crecientes, concurrencia, fallos y latencias con umbrales de aceptación, entorno aislado y presupuesto limitado.
12. ¿Qué pruebas son imprescindibles para límites exactos ±1 byte, cuotas compartidas, carreras, expiración de sesión/firma, CORS, error de RPC, doble publicación, recursos ajenos, interrupción, objetos huérfanos y eliminación? Detalla evidencia esperada y riesgos de migración.

## Entregables

- Resumen de decisión con recomendación principal y condiciones que la harían cambiar.
- Tabla comparativa de 3–4 arquitecturas: compatibilidad, operaciones requeridas, garantías, límites, coste aproximado por escenario, complejidad de mantenimiento y experiencia de recuperación.
- Diagrama del recorrido de archivos y otro de estados de sesión/recurso/publicación.
- Modelo de datos propuesto y contratos de endpoints, con responsabilidades del navegador, servidor, R2, Supabase y workers.
- Diseño preciso de reserva de cuota e idempotencia; ejemplos de carreras y cómo se resuelven.
- Plan gradual con tareas pequeñas, orden, rollback y condiciones de aceptación. Distingue arreglos mínimos de reconstrucción posterior.
- Matriz de pruebas y protocolo medible de capacidad, incluyendo presupuestos y exclusión de pagos/datos de producción.
- Lista de decisiones pendientes del propietario: formatos admitidos, tamaños, retención, cuotas, borradores, publicación y presupuesto. No asumir tráfico, plan contratado o presupuesto desconocidos.
- Fuentes oficiales enlazadas junto a cada afirmación técnica. Prioriza documentación del proveedor/protocolo y repositorios oficiales; fecha de verificación, límites según plan y contradicciones. Separa hechos, inferencias y recomendaciones. No uses precios o límites desactualizados como hechos actuales.

Responde en español. No necesitas credenciales y no debes pedir secretos. El resultado debe poder convertirse en tareas de implementación verificables; evita consejos genéricos o una lista de herramientas sin justificar.
