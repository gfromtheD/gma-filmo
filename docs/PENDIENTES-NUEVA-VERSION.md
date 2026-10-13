# Pendientes de la próxima versión de GMA Filmo

Fecha: 3 de octubre de 2026. Base inspeccionada: rama `main`, commit `41494c6289e3c60af9ef94a65875cadcac6508b8`.

Este documento registra lo solicitado y lo relaciona con la copia local del código de GitHub. El diagnóstico original fue estático. Tras la autorización posterior se han aplicado correcciones locales de temas secundarios en la rama `mejora/temas-secundarios`; véase el registro de implementación al final. No se han ejecutado subidas ni modificado Supabase, R2 o Vercel. Los errores comunicados por el usuario se consideran pendientes de reproducción salvo cuando su comportamiento se ve directamente en el código. Los límites de infraestructura y la configuración desplegada siguen sin verificar.

## Seguimiento

Marcar cada casilla solo después de comprobar su resultado. Una tarea revisada no equivale a una tarea arreglada. Conservar las tareas terminadas y añadir fecha, commit y evidencia; no borrarlas del historial.

Estados: **pendiente**, **en análisis**, **en implementación**, **en validación**, **resuelto**, **bloqueado**. Prioridades: **esencial** (subidas), **alta** (comportamientos incorrectos), **normal** (diseño general). Estas prioridades organizan el trabajo, no son hallazgos de seguridad.

| ID | Sección | Prioridad | Estado | Dependencias |
| --- | --- | --- | --- | --- |
| INV-01 | Invitado visible en la bienvenida | Alta | Verificado localmente; pendiente entorno real | Revisión de sesión y rutas |
| EST-01 | Estudio sin actividad ficticia | Alta | En validación | Datos reales y estados vacíos |
| SUB-01 | Diagnóstico completo del motor de subidas | Esencial | Pendiente | Entorno local y acceso a registros/configuración |
| SUB-02 | Rehacer el flujo, los límites y la publicación | Esencial | Pendiente | SUB-01 y decisiones de capacidad |
| SOC-01 | Redes sociales clicables y correctas | Alta | En validación; integración pública pendiente | Identidad pública del creador |
| DON-01 | Donaciones y QR del creador real | Alta | Corrección parcial; validación móvil pendiente | CRE-01 y enlaces reales |
| CRE-01 | Nombre clicable y muro del creador | Alta | Corrección parcial; relación de identidad pendiente | Relación cuenta–perfil público–obras |
| UI-01 | Revisión general del frontend | Normal | Pendiente | Dirección visual por definir |
| MOB-01 | Adaptación interna a móviles y tablets | Normal | Código y navegador completados; despliegue en preparación | Validación física externa pendiente |

## INV-01 — Acceder como invitado antes de iniciar sesión

**Problema solicitado.** La página inicial debe dejar visible que se puede entrar sin registrarse ni entregar datos. La opción debe aparecer antes de pulsar «Iniciar sesión» o «Registrarse».

**Ubicación actual.**

- `app/page.tsx:3`: la raíz muestra `LandingHero`.
- `components/ui/landing-hero.tsx:17`: alterna bienvenida, login y registros; las acciones iniciales están alrededor de las líneas 116–137.
- `components/ui/login-card.tsx:204`: «Continuar como invitado» está dentro del formulario de login. Su acción cierra sesión, fija `gma_guest=1` durante 24 horas y navega a `/inicio`.
- `middleware.ts:57`: reconoce la cookie de invitado y aplica restricciones.
- `hooks/use-is-guest.ts`, `components/ui/guest-gate.tsx` y los layouts protegidos: restricciones y mensajes posteriores.

**Hallazgo confirmado.** La capacidad existe, pero su descubrimiento exige entrar primero en la pantalla de login.

**Trabajo pedido y aceptación.**

- [x] Mostrar «Continuar como invitado» directamente en la bienvenida, claramente visible en móvil y escritorio.
- [x] Explicar brevemente que permite explorar sin crear cuenta; conservar las opciones de registro e inicio de sesión.
- [ ] Revisar cierre de sesión, cookies y posibles restos del onboarding de creador para evitar redirecciones inesperadas.
- [ ] Verificar navegación, catálogo y reproducción como invitado; las acciones que sí requieran cuenta deben explicarlo al usarlas.
- [ ] Verificar entrada desde un navegador limpio y desde una sesión previa, sin pedir datos para explorar.

## EST-01 — Limpiar el estudio del creador

**Problema solicitado.** Una cuenta nueva no debe aparentar tener películas, visualizaciones, seguidores, valoraciones o almacenamiento usado.

**Ubicación y comportamiento actual.**

- `components/features/studio/studio-data.ts:14`: `STUDIO_DATA` contiene una identidad ficticia, títulos de ejemplo, comentarios, tendencias y estadísticas. En la línea 28 figuran 131.039 visualizaciones y 8.420 seguidores.
- `components/features/studio/studio-screen.tsx:24`: inicializa todo el estudio con esa demostración. La consulta del perfil sustituye algunos campos, pero conserva otros con `...d.creator`; no recalcula sus estadísticas.
- `studio-screen.tsx:61`: carga títulos por `creator_user_id`. Si la consulta falla, retorna sin sustituir los ejemplos; el comentario de la línea 97 reconoce la conservación de los datos de muestra. Las visualizaciones de los títulos reales se rellenan con cero, sin una consulta de actividad real.
- `components/features/studio/studio-dashboard-view.tsx:15`: almacenamiento fijo de 3,2 sobre 10 y cinco archivos; también hay porcentajes de tendencia fijos.
- `components/features/studio/studio-stats-view.tsx:35`: combina los títulos con estadísticas y series de muestra; incluye tendencias y número de valoraciones literales.
- `components/features/studio/studio-profile-view.tsx:48`: sincroniza el formulario al recibir datos, pero parte inicialmente de la identidad de muestra.

**Trabajo pedido y aceptación.**

- [x] Retirar las demostraciones del flujo de cuentas reales y revisar todas las pestañas, no solo «Mis títulos».
- [x] Distinguir carga, cuenta vacía, dato todavía no disponible y error de consulta; un error no debe convertirse en una cifra ficticia ni en un cero presentado como verificado.
- [ ] Definir la fuente y el cálculo de títulos, reproducciones, valoraciones, seguidores y almacenamiento. Si una métrica no existe todavía, ocultarla o indicarlo.
- [ ] Calcular almacenamiento desde los archivos reales y conectarlo con SUB-02.
- [ ] Comprobar una cuenta nueva sin contenido, una con actividad y una con error de conexión; no mostrar identidades ajenas durante la carga.

## SUB-01 / SUB-02 — Subidas: prioridad esencial

**Problema solicitado.** La pasarela actual tiene fallos y no permite subir correctamente. Se pide analizarla con profundidad y rehacer su estructura, su interfaz y el motor de recepción. Antes de fijar la solución deben conocerse los límites reales, el recorrido completo y los resultados de pruebas.

### Recorrido actual en el código

1. `components/features/studio/studio-upload-view.tsx:17` organiza tres pasos: archivo, detalles y vista previa. Conserva un borrador en `localStorage` con la clave global `gma_studio_upload_draft`.
2. `components/features/studio/studio-upload-orbital.tsx:71` lee duración y clasifica archivos. La selección inicia subidas automáticamente; los vídeos detectados automáticamente se asignan al tipo `main`.
3. `studio-upload-orbital.tsx:419` pide una URL firmada a `/api/upload/presign`, enviando token, tipo, nombre, tamaño, MIME y `sessionUsed` del navegador.
4. `app/api/upload/presign/route.ts:14` valida identidad y algunos límites, consulta tamaños de películas del usuario y firma un `PutObject` en R2 con vigencia de 3.600 segundos.
5. `studio-upload-orbital.tsx:455` hace un `PUT` directo desde el navegador a R2, muestra progreso y comunica la URL al formulario al recibir un resultado HTTP satisfactorio.
6. `studio-upload-view.tsx:150` publica mediante `/api/titles`, enviando URL y tamaño del vídeo principal, un póster y subtítulos.
7. `app/api/titles/route.ts:86` usa la función `publish_creator_pelicula`; `supabase/migrations/20260712_publish_creator_pelicula_rpc.sql:16` inserta película y relación de género en una transacción.

**Ruta adicional.** `app/api/upload/file/route.ts:12` recibe un formulario y copia el archivo completo a memoria del servidor antes de mandarlo a R2. La ruta orbital inspeccionada usa firma y PUT directo, no esta ruta. Es necesario inventariar sus otros consumidores antes de decidir qué hacer con ella.

### Límites declarados, no capacidad demostrada

Fuente: `lib/r2/client.ts:15`. El código llama GB/MB a cantidades calculadas con potencias de 1024; aquí se expresan como GiB/MiB para evitar confusión.

| Recurso | Límite declarado | Bytes |
| --- | --- | --- |
| Vídeo principal | 4 GiB | 4.294.967.296 |
| Tráiler | 1 GiB | 1.073.741.824 |
| Extras, por archivo | 1 GiB | 1.073.741.824 |
| Intro | 500 MiB | 524.288.000 |
| Póster y variantes horizontal/vertical, por archivo | 10 MiB | 10.485.760 |
| Subtítulos o avatar, por archivo | 5 MiB | 5.242.880 |
| Sesión | 6 GiB | 6.442.450.944 |
| Cuota gratuita por usuario | 10 GiB | 10.737.418.240 |

No consta una medición de que el despliegue pueda completar esos tamaños. Hay que separar límite de producto, límite del proveedor por operación, capacidad total contratada, concurrencia soportada y rendimiento observado. No interpretar los 10 GiB por usuario como capacidad contratada de R2.

### Hallazgos y riesgos concretos para investigar

**A. Sesión y concurrencia.** `presign/route.ts:18` acepta `sessionUsed` del cliente; `studio-upload-orbital.tsx:402` lo guarda en memoria y lo incrementa solo después de completar un archivo. Las selecciones y reintentos lanzan varios archivos sin esperar (`:489`, `:546`, `:580`). Varias firmas pueden ver el mismo consumo antes de que termine ninguna subida. No se observa una reserva central ni un identificador persistente de sesión en estas rutas.

**B. Cuota incompleta.** `presign/route.ts:48` suma `peliculas.file_size_bytes`; `studio-upload-view.tsx:178` envía únicamente el tamaño principal. Los objetos secundarios y los objetos subidos sin publicar no están incluidos en ese cálculo. El error de la consulta de cuota no se inspecciona en la ruta y la ausencia de datos se trata como suma vacía. La ruta `/upload/file` comprueba el límite por archivo, pero no los de sesión y cuota total.

**C. Publicación y propiedad.** `titles/route.ts:31` recibe URLs y tamaño desde el navegador; no verifica allí la existencia del objeto, su tamaño real ni que pertenezca al usuario. `lib/api/auth.ts:3` confirma identidad mediante token, pero las rutas inspeccionadas no exigen explícitamente que exista un perfil de creador autorizado. La validación de duración y metadatos también necesita revisión: el frontend pide duración, pero el servidor puede convertir un valor vacío o no reconocido en cero.

**D. Archivos secundarios desconectados.** El formulario admite tráiler, extras, intro y dos pósteres, pero el cuerpo enviado a `/api/titles` solo lleva vídeo principal, un póster y un subtítulo. Un archivo puede haber llegado a R2 sin quedar asociado al contenido publicado. La elección visible de póster debe contrastarse con la selección enviada: actualmente se prioriza `poster_h` si existe.

**E. Eliminar y cambiar archivos.** `studio-upload-orbital.tsx:598` retira la entrada local sin avisar al formulario padre para invalidar `mainFile` o `assetUrls`. `:584` intercambia posiciones y tipos de archivos sin rehacer las asociaciones ya comunicadas. Se deben reproducir ambos casos para comprobar si se publica una URL antigua o un recurso con tipo incorrecto. `app/api/titles/[slug]/route.ts` borra la película en Supabase, pero no elimina sus objetos de R2: la cuota aparente puede bajar mientras el almacenamiento físico permanece ocupado.

**F. Recuperación.** Las transferencias son PUT de archivo completo. No se observa implementación de subida multipart reanudable, timeout explícito del XHR ni cancelación de las transferencias activas en la limpieza al desmontar. Los reintentos vuelven a pedir una firma y generan otra clave; hay que medir duplicados, interrupciones, consumo y limpieza. El borrador usa una clave común sin usuario o proyecto y puede restaurar URLs de otra sesión sin verificarlas.

**G. Validación del archivo.** `addFiles` filtra principalmente MIME o extensión; `addFilesForced` no replica ese filtro. La API de firma usa `contentType` recibido. `readVideoDuration` no tiene tiempo máximo de espera y puede devolver cero en error. Revisar formatos, contenedores, códecs, subtítulos, dimensiones y errores de metadatos; poder subir un archivo no garantiza que el reproductor lo pueda reproducir.

**H. Fallo comunicado todavía sin causa reproducida.** No atribuir la imposibilidad de subir a un único motivo sin registros. Revisar credenciales R2, permisos del bucket, CORS del PUT desde los dominios local/preview/producción, URL pública, sesión Supabase, variables de Vercel, respuesta de la firma y migraciones/RPC aplicadas. La inspección local no demuestra cómo están configurados esos servicios.

### Desglose del diagnóstico esencial

- [ ] SUB-01.1 Preparar ejecución local y registrar versiones, entorno y cuenta de prueba; no hacer pruebas grandes contra contenido real sin un espacio de prueba definido.
- [ ] SUB-01.2 Reproducir la incidencia con un vídeo pequeño y guardar fase exacta, HTTP, error de navegador y registro de servidor, sin tokens ni URLs firmadas en el documento público.
- [ ] SUB-01.3 Seguir selección → detección → autenticación → firma → CORS/PUT → confirmación → publicación → catálogo → reproducción → muro del creador.
- [ ] SUB-01.4 Inventariar todas las rutas de subida y sus consumidores, incluidos avatar, formularios alternativos y llamadas fuera de la interfaz orbital.
- [ ] SUB-01.5 Comprobar políticas y valores reales en Vercel/R2: plan, operación PUT o multipart, tamaños, duración, expiración, orígenes, permisos, memoria cuando intervenga servidor y costes/capacidad. Registrar fuente oficial y fecha en la revisión futura.
- [ ] SUB-01.6 Comprobar tablas, columnas, función RPC, permisos y relación de propiedad en el Supabase desplegado; no asumir que las migraciones locales ya se ejecutaron.
- [ ] SUB-01.7 Medir concurrencia, velocidad, tiempo, fallos y almacenamiento con muestras crecientes y redes distintas. Definir capacidad verificada con condiciones concretas, no solo un número máximo.
- [ ] SUB-01.8 Entregar diagnóstico y decisión de arquitectura antes de rehacer el motor. Conservar lo que se haya demostrado útil y justificar cada cambio.

### Estructura objetivo a diseñar

- [ ] SUB-02.1 Una sesión de subida vinculada al usuario, con inventario de todos los archivos y estado persistente; distinguir archivo recibido de contenido publicado.
- [ ] SUB-02.2 Reserva de cuota en servidor antes de firmar, control de concurrencia y conciliación con bytes reales. Definir liberación de reservas tras error, cancelación o expiración.
- [ ] SUB-02.3 Política única de tamaños y tipos aplicada en interfaz y servidor. Decidir si los valores actuales se mantienen después de medirlos; no subir límites por intuición.
- [ ] SUB-02.4 Transferencia directa y, si el diagnóstico lo justifica, multipart/reanudación para archivos grandes; reintentos limitados, cancelación real y manejo de sesión expirada.
- [ ] SUB-02.5 Confirmación desde servidor de objetos, tamaño, tipo y propietario antes de publicar; proteger publicación frente a doble clic o reintento.
- [ ] SUB-02.6 Asociación persistente de vídeo, tráiler, extras, intro, ambos pósteres y subtítulos, con cardinalidad y orden definidos.
- [ ] SUB-02.7 Limpieza de objetos huérfanos y retirada coherente de archivos al reemplazar, cancelar o eliminar una película.
- [ ] SUB-02.8 Borradores aislados por usuario y contenido; recuperación verificable y sin compartir restos entre cuentas.
- [ ] SUB-02.9 Interfaz de subida reconstruida con pasos comprensibles, límites visibles antes de seleccionar, progreso por archivo, errores concretos y controles de reintento/cancelación.
- [ ] SUB-02.10 Registros con identificador de operación y métricas de éxito/fallo por fase; no exponer secretos.

### Pruebas de aceptación que deberán ejecutarse

Todas estas pruebas están pendientes. Guardar resultado esperado/real, entorno, tamaño exacto, fecha y evidencia.

| Área | Casos necesarios | Resultado esperado |
| --- | --- | --- |
| Tamaño por tipo | Un byte por debajo, exacto y un byte por encima; archivo vacío | Aceptar o rechazar según política antes de consumir almacenamiento innecesario |
| Sesión | Varios archivos cuya suma llega y supera 6 GiB; dos pestañas y peticiones simultáneas | Reserva central y límite consistente si se mantiene esta política |
| Cuota | Llegar/superar 10 GiB contando todos los recursos; error de consulta | No omitir secundarios ni permitir nuevas cargas cuando el consumo no se puede determinar |
| Identidad | Invitado, sesión expirada, usuario normal, creador y URL/objeto ajeno | Solo los permisos definidos pueden subir y publicar sus recursos |
| Red | Corte, lentitud, timeout, CORS, 401/403/413/5xx, firma expirada | Error entendible, recuperación controlada y sin objetos o publicaciones duplicadas |
| Interfaz | Arrastrar, selector, varios vídeos, cambiar tipo, borrar principal ya subido | Formulario y archivos persistidos mantienen la misma asociación |
| Recuperación | Recargar, cambiar de pestaña, abandonar, volver, cambiar de cuenta | Borrador válido y aislado; cancelación/limpieza coherentes |
| Publicación | Fallo de RPC tras subir, doble envío, ausencia de migración | Sin éxito falso; reintento coherente y sin duplicar títulos |
| Multimedia | Vídeo aceptado pero no reproducible; SRT/VTT; pósteres y tráiler | Validación y asociación correctas; reproducción verificada |
| Capacidad | Archivos crecientes hasta límite y varias cargas controladas | Informe medido de tamaños, tiempos y concurrencia realmente soportados |
| Eliminación | Quitar recurso, sustituir, cancelar y borrar título | Inventario, cuota y objetos físicos reconciliados |

**Cierre esencial.** No marcar SUB-01/SUB-02 como resueltos solo porque una subida pequeña funcione. El cierre exige límites y capacidad documentados, pruebas anteriores con evidencia, persistencia completa de recursos y un recorrido de publicación/reproducción confirmado.

## SOC-01 — Redes sociales funcionales

**Problema solicitado.** Los enlaces añadidos por el usuario deben poder pulsarse y abrir el perfil correcto de cada red.

**Ubicación y comportamiento actual.**

- `components/ui/social-links-panel.tsx:18`: define prefijos y campos de usuario; la línea 113 guarda el texto tal como se escribe.
- `components/features/studio/studio-profile-view.tsx:151`: limpia espacios y guarda `social_links` en `creator_profiles`; en la línea 281 presenta cada red como `<span>`, sin enlace.
- `types/creator.ts`: el perfil público espera `redes_sociales` como lista de plataforma y URL.
- `lib/supabase/queries.ts:425`: busca el perfil público en `creator_public_profiles` o `artistas`, mientras el editor escribe en `creator_profiles`.
- `components/features/creator/creator-profile.tsx`: muestra banner, identidad, donaciones y filmografía, pero no renderiza `redes_sociales`.

**Trabajo y aceptación.**

- [x] Definir un formato canónico por red y convertir usuario, `@usuario` o URL completa al enlace correcto sin duplicar prefijos.
- [ ] Revisar especialmente YouTube con rutas de canal, TikTok, Facebook, Vimeo, X, Threads y web propia; definir formatos admitidos.
- [x] Crear enlaces reales en las vistas de lectura y conservar los controles de edición en el formulario.
- [ ] Conectar los datos editados con el perfil público; comprobar si hay mecanismos de sincronización fuera del repo antes de migrar nada.
- [x] Validar esquema y destino, impedir protocolos inesperados y dar mensajes concretos si el enlace es inválido.
- [ ] Guardar, recargar y comprobar el destino real de cada plataforma en móvil y escritorio; campos vacíos no deben producir botones muertos.

## DON-01 — Donaciones y escaneo móvil del QR

**Problema solicitado.** Revisar y terminar el recorrido de apoyo al creador, especialmente Patreon y el acceso desde móvil mediante QR.

**Ubicación y comportamiento actual.**

- `components/features/player/donation-panel.tsx:45`: un TODO deja el QR apuntando a `${appUrl}/donatest`, en vez del creador de la película.
- `components/features/player/player-screen.tsx:889`: proporciona el creador y `NEXT_PUBLIC_APP_URL`, con fallback al dominio de Vercel.
- `app/donatest/page.tsx`: identidad ficticia, destinos PayPal/Patreon de prueba y una barrera de login GMA antes de abrirlos.
- `components/features/detail/movie-detail.tsx:241`: algunos botones usan sitios genéricos de PayPal/Patreon cuando falta información del creador.
- `components/features/creator/creator-profile.tsx:126`: usa los destinos del perfil cuando existen.
- `app/auth/callback/route.ts`: retorno de OAuth, si finalmente el recorrido requiere autenticación GMA.

**Trabajo y aceptación.**

- [x] Sustituir el destino de prueba por la página pública del creador correcto y verificar el dominio según entorno.
- [ ] Comprobar que QR, película, nombre y beneficiario corresponden a la misma identidad.
- [ ] Revisar captura/edición de datos de donación y su disponibilidad en el perfil público.
- [ ] Resolver como decisión de producto si se exige cuenta GMA para apoyar; el prototipo la exige, pero no se ha solicitado expresamente mantener esa condición. Separar esa decisión del login que pida la plataforma externa.
- [x] Evitar destinos de demostración o genéricos presentados como donación al creador; tratar claramente la ausencia de opciones de apoyo.
- [ ] Probar QR desde iPhone y Android, con y sin sesión; retorno desde proveedor/OAuth y apertura sin depender de ventanas emergentes bloqueadas.
- [ ] Verificar URL y perfil receptor sin realizar pagos reales durante la validación ordinaria.

## CRE-01 — Nombre clicable y muro público del creador

**Problema solicitado.** Donde se muestre el nombre del creador, poder pulsarlo y abrir su muro: banner, avatar, identidad, biografía, redes y selección/lista de contenidos propios. La referencia a un muro social describe la presentación; no implica añadir seguidores, publicaciones sociales u otras funciones no pedidas. «R.I.P.» en el dictado queda pendiente de aclarar y no se toma como un campo nuevo.

**Ubicación y comportamiento actual.**

- `app/(platform)/creadores/[slug]/page.tsx:18`: la ruta pública ya existe y consulta perfil y filmografía.
- `components/features/creator/creator-profile.tsx:65`: ya hay banner, avatar, nombre, biografía, donaciones y cuadrícula de obras; se puede evolucionar desde esta base.
- `lib/supabase/queries.ts:425`: resuelve perfil público o artista; `:476` filtra el catálogo con la lista de slugs `titulos`. La identidad de cuenta usada al subir no se resuelve aquí por `creator_user_id`.
- `app/(platform)/cortos/[id]/page.tsx:26`: busca el creador a partir de slugs de `artistas`.
- `components/features/detail/movie-detail.tsx:353`: director e ilustrador tienen enlace solo si se dispone de slug.
- `components/features/player/player-screen.tsx:657`: los créditos estructurados pueden tener enlace; el fallback de texto no tiene slug.
- `components/features/media/hero.tsx:27`: convierte nombres en texto y los dibuja en párrafos, sin enlaces.
- `app/api/titles/route.ts` y `supabase/migrations/20260712_publish_creator_pelicula_rpc.sql`: registran autor textual y `creator_user_id`; la RPC inspeccionada no crea la relación con `artistas` ni actualiza la lista de títulos del perfil público.

**Trabajo y aceptación.**

- [ ] Diseñar la relación estable entre cuenta creadora, perfil público y obra; no identificar personas solo por coincidencia de nombres.
- [ ] Comprobar y resolver la coexistencia de `creator_profiles`, `creator_public_profiles` y `artistas`, incluido contenido histórico y autores colaboradores.
- [ ] Inventariar todas las apariciones de nombres y añadir navegación coherente en fichas, créditos, Home y demás vistas que los muestren.
- [ ] Definir qué hacer cuando un crédito histórico carezca de perfil; no fabricar una URL inexistente.
- [ ] Evolucionar la página actual a la presentación de muro solicitada, con redes funcionales y lista de obras reales, orden y selección claros.
- [ ] Vincular las nuevas subidas automáticamente al muro del propietario, sin mantener listas manuales que queden desactualizadas.
- [ ] Revisar caché e invalidación: el perfil está cacheado durante una hora y publicar actualmente invalida `peliculas`; comprobar cuándo se actualizan perfil, identidad y obras.
- [ ] Probar creador nuevo, histórico, con varias obras, sin obras y con campos opcionales vacíos; los nombres deben llevar siempre a la identidad correcta cuando haya perfil.

## UI-01 — Revisión general del frontend

**Petición registrada.** Rehacer o mejorar la presentación del frontend. La dirección visual quedó incompleta en el dictado; no hay todavía una especificación suficiente para elegir un estilo nuevo.

**Archivos relacionados.** `app/globals.css`, `components/layout/app-shell.tsx`, `components/layout/navbar.tsx`, `components/ui/landing-hero.tsx`, `components/features/studio/studio-ui.tsx` y las vistas de estudio, ficha y creador anteriores.

- [ ] Definir alcance y referencias visuales antes de un rediseño global.
- [ ] Revisar jerarquía, consistencia, formularios, estados vacíos/error, contraste, teclado y tamaños en móvil/escritorio.
- [ ] Integrar las mejoras visuales de invitado, subidas y muro con una navegación coherente.
- [ ] Validar los recorridos esenciales completos; no considerar terminado el frontend por la apariencia de una sola pantalla.

## Condiciones previas y orden propuesto para una futura ejecución

1. Completar variables locales y servicios de prueba reales. Node se ha localizado en el runtime de la aplicación y npm se ha preparado en `Documentos/Codex/Temporal/herramientas/`; dependencias instaladas tras reparar el lockfile. La compilación y la bienvenida funcionan en pruebas aisladas. Sigue sin haber `.env.example` pese a que el README lo menciona.
2. Terminar la validación de los temas secundarios implementados y la conexión de identidad pública. La retirada de demostraciones del estudio ya está aplicada.
3. Resolver la investigación SUB-01 y después SUB-02 al final, como ha pedido el usuario; comprobar publicación, catálogo, reproducción y propiedad de extremo a extremo.
4. Conectar muro, nombres, redes y donaciones; hacer visible el acceso invitado y comprobar sus restricciones.
5. Aplicar la dirección visual acordada y completar validación de los recorridos.

Configuración a revisar cuando se autorice trabajar: variables Supabase públicas y service role, cuenta/credenciales/bucket R2, URL pública R2, dominio permitido para subtítulos (`R2_PUBLIC_DOMAIN` o `NEXT_PUBLIC_R2_DOMAIN`), `NEXT_PUBLIC_APP_URL`, CORS, redirecciones OAuth, entorno Vercel y migraciones realmente aplicadas. No guardar valores secretos en este documento.

Los planes existentes en `docs/superpowers/` sirven como contexto de decisiones pasadas, no como prueba de que las funciones estén implementadas o desplegadas.

## Registro de resolución

| ID | Estado nuevo | Fecha | Commit | Verificación y asuntos restantes |
| --- | --- | --- | --- | --- |
| INV-01 | Verificado localmente | 2026-10-03 | Rama `mejora/temas-secundarios` | Invitado en bienvenida; probado en Chrome a 390 y 1440 px. El destino `/inicio` se sustituye en la prueba para no consultar servicios reales. |
| EST-01 | En validación | 2026-10-03 | Misma rama | Sin identidad/actividad ficticias; estados de carga/error y títulos reales. Métricas sin fuente quedan no disponibles. Pendiente prueba con cuenta real y medición de almacenamiento. |
| SOC-01 | En validación | 2026-10-03 | Misma rama | Normalizador compartido, enlaces en estudio/perfil público y validación al guardar. Pendiente sincronización entre los modelos de perfil y comprobación de cuentas externas. |
| DON-01 | Parcial | 2026-10-03 | Misma rama | QR a perfil real, perfil accesible sin cuenta, enlace alternativo; fuera los botones genéricos. Pendientes escaneo real, datos de apoyo y decisión de login GMA. |
| CRE-01 | Parcial | 2026-10-03 | Misma rama | Créditos del hero clicables cuando existe slug. No se fabrican perfiles desde texto. Pendiente relación cuenta–perfil–nuevas obras. |

## Referencias exactas a la versión inspeccionada

Estos enlaces apuntan al commit analizado para que las líneas sigan siendo verificables cuando el código cambie.

- [Entrada invitado: login-card, línea 204](https://github.com/gfromtheD/gma-filmo/blob/41494c6289e3c60af9ef94a65875cadcac6508b8/components/ui/login-card.tsx#L204)
- [Datos ficticios del estudio: studio-data, línea 14](https://github.com/gfromtheD/gma-filmo/blob/41494c6289e3c60af9ef94a65875cadcac6508b8/components/features/studio/studio-data.ts#L14)
- [Carga y sustitución parcial: studio-screen, línea 24](https://github.com/gfromtheD/gma-filmo/blob/41494c6289e3c60af9ef94a65875cadcac6508b8/components/features/studio/studio-screen.tsx#L24)
- [Límites: cliente R2, línea 15](https://github.com/gfromtheD/gma-filmo/blob/41494c6289e3c60af9ef94a65875cadcac6508b8/lib/r2/client.ts#L15)
- [Motor del navegador: upload-orbital, línea 419](https://github.com/gfromtheD/gma-filmo/blob/41494c6289e3c60af9ef94a65875cadcac6508b8/components/features/studio/studio-upload-orbital.tsx#L419)
- [Validación y firma: presign, línea 14](https://github.com/gfromtheD/gma-filmo/blob/41494c6289e3c60af9ef94a65875cadcac6508b8/app/api/upload/presign/route.ts#L14)
- [Recepción alternativa: upload/file, línea 12](https://github.com/gfromtheD/gma-filmo/blob/41494c6289e3c60af9ef94a65875cadcac6508b8/app/api/upload/file/route.ts#L12)
- [Publicación: titles, línea 27](https://github.com/gfromtheD/gma-filmo/blob/41494c6289e3c60af9ef94a65875cadcac6508b8/app/api/titles/route.ts#L27)
- [Redes sin enlace en el estudio: profile-view, línea 276](https://github.com/gfromtheD/gma-filmo/blob/41494c6289e3c60af9ef94a65875cadcac6508b8/components/features/studio/studio-profile-view.tsx#L276)
- [QR con destino de prueba: donation-panel, línea 45](https://github.com/gfromtheD/gma-filmo/blob/41494c6289e3c60af9ef94a65875cadcac6508b8/components/features/player/donation-panel.tsx#L45)
- [Resolución del perfil público: queries, línea 425](https://github.com/gfromtheD/gma-filmo/blob/41494c6289e3c60af9ef94a65875cadcac6508b8/lib/supabase/queries.ts#L425)
- [Nombres sin enlace en el hero: hero, línea 27](https://github.com/gfromtheD/gma-filmo/blob/41494c6289e3c60af9ef94a65875cadcac6508b8/components/features/media/hero.tsx#L27)


## Registro de implementación local — temas secundarios

Los apartados «Ubicación y comportamiento actual» anteriores describen el commit base del diagnóstico; algunas líneas han cambiado después de estas correcciones. Las casillas marcadas representan cambios locales comprobados, no un despliegue completado.

- Bienvenida: botón de invitado visible y adaptación del contenedor en móvil; acción compartida con login, errores visibles y retirada de cookies residuales del onboarding al entrar como invitado.
- Estudio: eliminadas identidad, títulos, comentarios, gráficos, tendencias, almacenamiento y verificaciones ficticias. Retirado el calculador comercial de muestra sin compra real. Títulos cargados por propietario; errores con reintento y sin fallback de demostración; métricas sin fuente mostradas como no disponibles.
- Redes: normalización compartida de handles/URLs, validación de plataforma, enlaces reales en las vistas de lectura y mensaje de validación al guardar. No se ha cambiado el modelo de persistencia ni migrado perfiles.
- Créditos: nombres del hero enlazan cuando hay slug estructurado; los créditos históricos solo textuales se conservan sin una URL inventada.
- Donaciones: QR deja de llevar a `/donatest`; usa el perfil real y el dominio configurado o el de la página. Se añade enlace alternativo y se oculta QR si no hay creador. La ruta pública de creadores se abre sin cookie invitado ni login. Se ocultan destinos de apoyo ausentes en la ficha; la página de prueba permanece en el repo, fuera del recorrido del QR.
- Preparación: instalado entorno de dependencias; reparación acotada del lockfile de dependencias opcionales WASM. Los tipos de `peliculas` reflejan columnas que ya figuran en las migraciones/RPC; no se ha ejecutado ningún cambio de base de datos.
- Investigación: prompt preparado en `docs/PROMPT-PERPLEXITY-SUBIDAS.md`, listo para copiar a Perplexity. No se ha lanzado un agente ni modificado el motor de subidas.

### Verificación y límites

Compilación de producción completada, comprobación TypeScript y lint; permanecen avisos anteriores en mensajes directos, reproductor e interfaz de subidas. Las nueve pruebas de `npm run test:secondary` cubren normalización de enlaces, ausencia de demostraciones, estadísticas vacías, redes del perfil público, créditos y QR, además del acceso invitado en móvil/escritorio. Las pruebas usan datos ficticios locales y no escriben en servicios reales.

Pendiente: probar estudio/perfil con cuentas reales y configuración externa, confirmar sincronización del perfil público con lo editado, escanear QR en dispositivos físicos y terminar las decisiones de donación. La capacidad y arquitectura de subidas se dejan para la investigación final. El usuario ha autorizado publicar esta actualización en producción el 3 de octubre de 2026. El resultado del envío a `main` se verificará en Vercel y en la web pública; la validación con cuentas reales sigue pendiente.


## Ampliación: perfiles históricos sin cuenta — 4 de octubre de 2026

- [x] Créditos textuales de director/creador/ilustrador enlazan a fichas públicas independientes del registro.
- [x] Directorio original revisado: 195 fichas, 171 con redes disponibles. Fuente: https://generacionmaldita.com/artistas/.
- [x] Datos de origen y fecha de revisión conservados en `lib/data/catalog-creators.json`; biografías nuevas resumidas y enlace a la ficha original visible.
- [x] Fichas históricas existentes completadas con redes y obras. Las páginas muestran «Ficha del catálogo»; no representan una cuenta registrada ni dan permisos sobre obras.
- [x] Nombres sin ficha histórica identificada obtienen una página estable con sus créditos y filmografía; biografía, foto y redes ausentes no se inventan.
- [x] Filmografía incluye asociaciones por créditos aunque falte una relación en la tabla de artistas. Los perfiles registrados mantienen prioridad.
- [x] 12 pruebas pasan, incluida cobertura de artistas históricos y créditos sin cuenta. Compilación de producción correcta.
- [ ] Revisar editorialmente las identidades sin correspondencia confirmada con el directorio original y completar datos cuando exista fuente verificable.
- [ ] Implementar, en otra fase, la reclamación de una ficha histórica por su titular con verificación de identidad.

La ampliación sustituye la limitación anterior de mantener sin enlace los autores guardados únicamente como texto. No modifica el motor de subidas ni atribuye cuentas o donaciones a terceros.

## Restricción de fichas a creadores con cortos — 4 de octubre de 2026

- [x] Cruzar las 195 fichas con los 80 cortos del catálogo y con sus créditos.
- [x] Retirar 75 fichas sin un corto asociado de `creators-data.json` y `lib/data/catalog-creators.json`.
- [x] Conservar 120 fichas documentadas y 28 básicas vinculadas a cortos existentes.
- [x] Completar créditos de directores/ilustradores usando únicamente asociaciones explícitas de «Mis trabajos» con un identificador de corto que existe en la aplicación.
- [x] Restringir todas las páginas de creador, incluidas las fichas antiguas de base de datos, a personas con un corto asociado; devolver 404 en los demás casos.
- [x] Eliminar enlaces a fichas no elegibles y referencias de filmografía a obras ausentes.
- [x] Pasar 14 pruebas, incluidos casos de ficha sin obras, obra ausente, persona con solo una película y asociación original verificada.

El inventario y la evidencia por persona se encuentran en `docs/REVISION-FICHAS-CON-CORTOS.md`. Esta revisión sustituye la publicación anterior de las 195 fichas del directorio completo.

## QR al finalizar y página móvil de apoyo — 4 de octubre de 2026

- [x] Al finalizar un vídeo con métodos de apoyo configurados, abrir el panel con QR y detener el salto automático al siguiente corto hasta que el usuario lo decida.
- [x] QR de alto contraste en escritorio/TV; botón directo en móvil, sin escanear la propia pantalla.
- [x] Ruta pública `/creadores/[slug]/apoyar`, con identidad, breve biografía y métodos disponibles, sin login de GMA ni navegación de gestión de cuenta.
- [x] Destinos PayPal/Patreon de sus dominios admitidos y dirección Bitcoin con formato de recepción. La validación de formato no certifica la titularidad ni ejecuta pagos.
- [x] Bitcoin: abrir cartera o copiar dirección, con confirmación y alternativa manual si no hay acceso al portapapeles.
- [x] Ocultar QR/panel cuando no haya métodos admitidos. Ruta sin métodos muestra un mensaje y acceso al perfil.
- [x] Añadir «Apoyar al creador» al perfil cuando tenga métodos admitidos.
- [x] Elegir primero el crédito de director/creador para asociar el apoyo al corto.
- [x] Recibir el fin real del vídeo nativo y el evento ENDED de la API de YouTube; permitir sus scripts oficiales en la política de contenido. Mapear los enlaces de YouTube ya guardados como fuente alternativa.
- [x] Comprobar 15 pruebas de regresión y 5 escenarios del recorrido: escritorio, móvil, ausencia de métodos, copiar Bitcoin y fin de YouTube con API simulada.

No se crean cuentas ni se inventan enlaces de donación. Las páginas de prueba se generan temporalmente durante las pruebas y se eliminan antes de compilar/publicar. El motor de subidas sigue pendiente.

### QR también en el muro del creador

- [x] Mostrar el QR junto a «Apoyar al creador» en el perfil público, únicamente con métodos de apoyo admitidos.
- [x] Usar la misma ruta pública `/creadores/[slug]/apoyar`, con la dirección del dominio desde el que se está visitando GMA.
- [x] Mantener el botón directo para quien consulte la ficha desde su propio móvil.

### Comprobación de datos reales de apoyo — 4 de octubre de 2026

Se han solicitado los 148 perfiles públicos vinculados al catálogo. En los 147 accesibles no hay configurado ningún enlace PayPal, Patreon o dirección Bitcoin. La ficha `mar_oblivion%e2%99%a1` devuelve 404 y no ha podido comprobarse. Por ello, la condición acordada oculta el QR tanto en el muro como al finalizar el vídeo. Las pruebas positivas previas utilizaron datos de prueba; no acreditaban un beneficiario real configurado en producción.

- [ ] Incorporar una configuración de métodos de apoyo para el creador y conectar su guardado con el perfil público que consume el reproductor. Actualmente no existe ese formulario en el estudio.
- [ ] Añadir enlaces reales proporcionados/verificados por sus titulares; no utilizar cuentas de ejemplo ni convertir enlaces sociales en métodos de donación.
- [ ] Verificar el recorrido con un creador real configurado en producción.

El QR está programado para el evento de finalización del vídeo. No se muestra durante los últimos diez segundos; ese periodo mantiene «Siguiente corto» cuando no hay métodos de apoyo disponibles.

- [ ] Corregir y comprobar la ficha histórica `mar_oblivion%e2%99%a1`, detectada con respuesta 404 en esta auditoría.

### Demostración pública de apoyo — 4 de octubre de 2026

- [x] Activar temporalmente QR al finalizar el corto y en el muro aunque el creador no tenga métodos configurados. Sustituye la condición anterior de ocultarlos en este caso.
- [x] Conservar la identidad del creador en la ficha móvil pública y marcar el recorrido como «Demostración de apoyo».
- [x] Botones de demostración únicamente a los accesos oficiales de PayPal y Patreon; no hay beneficiario asociado ni se realiza una donación. No se inventan direcciones de criptomonedas.
- [x] Dar prioridad a métodos reales válidos cuando existan. El interruptor temporal está en `lib/creator-support.ts`, y los tres puntos de presentación comparten `supportExperience`.
- [ ] Completar la configuración real de apoyo del creador y comprobar su publicación antes de retirar la demostración.

Verificación: pruebas de finalización nativa/YouTube, ficha móvil y muro con QR; regresión de los temas secundarios. El QR aparece al finalizar, no durante los diez segundos previos. Queda pendiente escanearlo en dispositivos físicos.

### Retirada de demostración — 4 de octubre de 2026

- [x] Eliminar el interruptor, enlaces genéricos y mensajes de demostración. QR y panel vuelven a depender exclusivamente de métodos reales admitidos.
- [x] Mantener la ficha pública sin login y el mensaje de ausencia de métodos cuando no hay ninguno configurado.
- [ ] Sigue pendiente la pantalla del estudio para configurar cuentas y guardar/publicar sus métodos de apoyo. Actualmente no basta con esperar a que los usuarios se registren: este paso todavía debe implementarse.

La presentación del QR y sus destinos está verificada con pruebas; la configuración y recepción real de una donación no se han validado con una cuenta beneficiaria real.

### Bienvenida y acceso renovados — 4 de octubre de 2026

- [x] Sustituir la composición dividida por portadas del catálogo en un fondo de pantalla completa, con perspectiva y desplazamiento diagonal.
- [x] Retirar el gradiente verde inferior y proteger la lectura del texto mediante una capa oscura detrás del contenido.
- [x] Presentación con título, propuesta de la plataforma y un botón «Entrar a GMA Filmo» que abre las opciones de acceso.
- [x] Iniciar sesión, registrarse e invitado con igual tamaño; invitado debajo del registro, sin exigir datos para explorar.
- [x] Conservar formularios de acceso/registro, acceso de creadores y enlaces directos de autenticación.
- [x] Control de pausa para el fondo y respeto de la preferencia de movimiento reducido.

Esta actualización corresponde a la bienvenida; la revisión global del frontend y el motor de subidas siguen pendientes. La verificación se registra tras las comprobaciones de composición y navegación.

Verificación de bienvenida: 16 pruebas de regresión pasan, incluido el acceso invitado desde el nuevo selector a 390 y 1440 px. Revisión visual y de encuadre a 360×640, 390×844, 1024×600 y 1440×900; igualdad de botones y navegación al login y vuelta; pausa efectiva y animaciones desactivadas con movimiento reducido. Sin errores de interfaz en estos recorridos. Comprobación TypeScript correcta; compilación de producción correcta y despliegue publicado en `https://gma-filmo.vercel.app`. Comprobación pública: respuesta 200, selector con las tres opciones, 70 portadas visibles cargadas y ningún error de interfaz en el recorrido verificado.

### Recuperación del título animado — 4 de octubre de 2026

- [x] Recuperar «El lugar para / descubrir, compartir, sentir, disfrutar / cine», con una palabra verde que cambia cada tres segundos.
- [x] Reservar una línea de altura y anchura estables para evitar saltos o recortes al cambiar de palabra.
- [x] El control de pausa detiene tanto las portadas como las futuras rotaciones del título; la preferencia de movimiento reducido mantiene el título estático.
- [x] Mantener una descripción completa y estable del título para lectores de pantalla.

### Portadas más grandes en escritorio — 4 de octubre de 2026

- [x] Reducir a seis columnas el fondo de bienvenida en pantallas de al menos 768 px, ampliando las portadas y conservando el plano y bucle diagonal.
- [x] Mantener la geometría y distribución de portadas de la versión móvil.
- [x] Adaptar la resolución solicitada de las imágenes a su nuevo tamaño en escritorio.
- [x] Retirar el control visible de pausa, manteniendo el respeto a movimiento reducido del sistema. La animación periódica del título sigue activa.

Esta preferencia sustituye el control de pausa descrito en las dos actualizaciones anteriores.


## MOB-01 — Adaptación interna a móviles y tablets — cierre de 5 de octubre de 2026

El usuario ha autorizado adaptar todos los puntos detectados de las pantallas internas a teléfonos/tablets, conservando escritorio. La implementación y la validación de navegador están **completadas**; el despliegue está en preparación. El desglose de hallazgo, solución, componentes y aceptación está en [ADAPTACION-MOVIL-TABLET.md](ADAPTACION-MOVIL-TABLET.md).

### Implementación aplicada

Estas casillas identifican cambios constatables en el código y comprobados en navegador. La validación física externa se registra por separado.

- [x] MOB-01.1 Navegación/barra de cuenta y pestañas del estudio; buscador apilado; ajustes en columnas adaptables; tarjetas/diario y editor de Mi Espacio.
- [x] MOB-01.2 Inicio, hero, catálogo, «Próximamente», cuadrículas/listas, filtros y carruseles; acciones de portadas disponibles en dispositivos táctiles.
- [x] MOB-01.3 Fichas de corto/película/serie, episodios, controles y paneles del reproductor, valoraciones, comentarios y mensajes directos.
- [x] MOB-01.4 Tablero, estadísticas, títulos, perfil, edición y presentación de los tres pasos de subida del estudio.
- [x] MOB-01.5 Selección/edición de perfiles, PIN, onboarding, perfil personal, muro de creador y ficha móvil de apoyo.
- [x] Base común: viewport del dispositivo, zonas seguras, campos legibles y ventanas ajustadas al área visible donde procede.

### Validación y cierre

- [x] Matriz de Chrome completada: 11 tamaños de móvil, horizontal, tablet y escritorio; 26 casos únicos superados al cerrar las incidencias.
- [x] Cinco grupos recorridos con datos largos, formularios, filtros, listas, acciones, foco, ventanas y área visible reducida simulada.
- [x] Compilación de producción y tipos correctos; 16 pruebas secundarias y 7 de apoyo superadas. Evidencia registrada en el documento de adaptación.
- [ ] Registrar el despliegue, si se realiza, y verificar páginas públicas en la versión publicada.
- [ ] Comprobar físicamente Safari/iPhone, Chrome/Android y una tablet; declarar por separado cualquier prueba que solo sea emulada.

La adaptación de `studio-upload-view.tsx` y `studio-upload-orbital.tsx` es visual. **SUB-01 y SUB-02 siguen pendientes:** no se ha reparado el motor ni verificado capacidad, cuota, reanudación o publicación real. Esta actualización tampoco implementa la configuración de cuentas de donación.
