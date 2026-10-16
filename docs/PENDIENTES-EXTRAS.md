# Pendientes de la sección Extras

Fecha: 15 de octubre de 2026. Estado: sección de Extras **terminada en local** (frontend, API y tabla), **sin commitear ni desplegar**. El trabajo vive en la rama local `trabajo-local` (carpeta `streaming-app`); la base de la primera parte está en `feature/extras` (commits `90463fd` y `1d31150`, carpeta `streaming-app-base`).

Este documento está pensado para **fusionarse con la lista de pendientes que llegará con el paquete del Mac** (motor de subidas, MediaProvider R2/Stream/Mock/PeerTube) y con `PENDIENTES-NUEVA-VERSION.md`. Sigue su mismo formato: marcar cada casilla solo tras comprobar el resultado y conservar las tareas terminadas con fecha y evidencia.

Estados: **pendiente**, **en análisis**, **en implementación**, **en validación**, **resuelto**, **bloqueado**. Prioridades: **esencial** (bloquea publicar), **alta**, **normal**.

| ID | Sección | Prioridad | Estado | Dependencias |
| --- | --- | --- | --- | --- |
| EXT-01 | Eliminar los extras de muestra antes de publicar | Esencial | Pendiente | Ninguna |
| EXT-02 | Conectar Studio y la publicación con los extras | Esencial | Bloqueado | Paquete del Mac (motor de subidas / MediaProvider) |
| EXT-03 | Revisiones y pruebas antes de desplegar | Alta | Pendiente | EXT-01 |
| EXT-04 | Tipo de archivo explícito (imagen o vídeo) | Normal | Pendiente | EXT-02 |
| EXT-05 | Validación en dispositivos reales | Alta | Pendiente | Ninguna |
| EXT-06 | Mejoras de diseño que se dejaron fuera | Normal | Pendiente | Decisión de diseño |
| EXT-07 | Extras también en las películas (largometrajes) | Alta | Pendiente | Ficha de películas por crear |

## Qué está hecho (resumen)

- **Base de datos:** tabla `pelicula_extras` creada en el Supabase real (proyecto `zeodvghjdjnfxsqbvefc`, el 15/10/2026) con `supabase/migrations/20261015_pelicula_extras.sql`. Solo aditiva; RLS activa con lectura pública de los extras con `status = 'published'`; escritura solo por servidor (service role). Incluye `provider` y `media_ref` para otros proveedores de medios.
- **API:** `app/api/extras/route.ts`. GET público (limitado por IP); POST, PATCH y DELETE solo para el creador del título (token + `peliculas.creator_user_id`), con URLs https validadas.
- **Lógica y consultas:** `lib/extras/extras.ts`, `lib/extras/queries.ts`, `hooks/use-extras.ts`, tipos en `types/database.ts` y `types/catalog.ts`.
- **Interfaz:** pestaña «Extras» (última, solo si hay extras) en la ficha del corto; visor con vídeo o imagen, flechas laterales en escritorio, pill de navegación en móvil y «+ Más info» con el texto desplegable. Componentes en `components/features/detail/extras-*.tsx`, `extra-video-player.tsx`, `extra-player-controls.tsx` y `extras-player-dialog.module.css`.
- **Pruebas:** `e2e/extras.spec.ts` y `e2e/unit/extras.spec.ts`.

## EXT-01 — Eliminar los extras de muestra antes de publicar

**Situación.** Hay tres filas de muestra **en la base de datos real**, solo en el corto `yasha-gozen` (`pelicula_id = 1`, ids 1, 2 y 3), con título que empieza por «[PRUEBA]». Reutilizan el vídeo y el póster propios de la película. Se dejan a propósito para enseñar la sección mientras se termina el resto. Si se despliega sin borrarlas, la pestaña Extras aparecerá en la web pública.

**Aceptación.**

- [ ] Borrar las filas de muestra: `delete from pelicula_extras where title like '[PRUEBA]%';` (con `supabase db query --linked --project-ref zeodvghjdjnfxsqbvefc "..."`).
- [ ] Comprobar que no queda ninguna: `select count(*) from pelicula_extras;` debe dar 0 (o solo extras reales).
- [ ] Confirmar que ningún otro corto tiene extras de muestra (a 15/10/2026 solo existe `yasha-gozen`).
- [ ] Verificar en la ficha de `yasha-gozen` que la pestaña Extras ya no aparece.

## EXT-02 — Conectar Studio y la publicación con los extras

**Situación.** Studio ya tiene un tipo de activo «Extras» (`components/features/studio/studio-upload-orbital.tsx`, límite de 1 GB en `lib/r2/client.ts`) y `app/api/upload/presign/route.ts` devuelve `{ presignedUrl, key, publicUrl }`. Pero la publicación (`app/api/titles/route.ts` → RPC `publish_creator_pelicula`, `supabase/migrations/20260712_publish_creator_pelicula_rpc.sql`) **descarta** los extras: nada de lo que se suba llega a `pelicula_extras`.

**Trabajo y aceptación.**

- [ ] Tras publicar el título (o al añadir extras a uno existente), enviar cada extra subido a `POST /api/extras` con `peliculaId`, `title`, `kind`, `videoUrl` (la `publicUrl` de la subida), `provider`, `mediaRef`, `posterUrl`, `durationSeconds` y `fileSizeBytes`.
- [ ] Decidir si la creación va dentro de la RPC de publicación (una sola transacción) o como llamadas posteriores a la API.
- [ ] Alinear con el `MediaProvider` del paquete del Mac: `provider` (`r2`, `stream`, `peertube`, `external`) y `media_ref` ya están en la tabla para no depender de R2.
- [ ] Permitir en Studio editar el orden, ocultar o borrar extras (la API ya admite PATCH y DELETE).
- [ ] Generar miniatura y duración del vídeo al subirlo (hoy el póster es opcional y la duración puede quedar vacía).
- [ ] Probar el flujo completo: subir, publicar, ver el extra en la ficha, borrarlo.

## EXT-03 — Revisiones y pruebas antes de desplegar

- [ ] Revisión de seguridad de `app/api/extras/route.ts` (escribe en la base de datos con permisos de servidor): autenticación, comprobación de autoría, validación de entrada, límite de peticiones.
- [ ] Revisión de código de los componentes nuevos y de la migración (RLS, índices, restricciones).
- [ ] El límite de peticiones (`lib/api/rate-limit.ts`) es en memoria y por instancia: no es fiable con varias instancias en Vercel; valorar uno distribuido.
- [ ] Suite completa de Playwright en `streaming-app-base` (puerto 3100) y `npm run test:responsive` con servidor limpio. Tras los últimos cambios solo se repitieron los tests de Extras.
- [ ] Commit, push, PR, vista previa, merge a `main` y comprobar el despliegue de producción. La tabla ya existe en producción, no hace falta volver a aplicar la migración.
- [ ] Sincronizar `streaming-app` con `main` tras desplegar.

## EXT-04 — Tipo de archivo explícito (imagen o vídeo)

**Situación.** El tipo (vídeo o imagen) se **deduce de la extensión** de la URL (`.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`, `.gif` son imagen; todo lo demás, vídeo). Si el motor del Mac guarda archivos sin extensión o con claves opacas, la deducción fallará.

- [ ] Añadir una columna `media_type` (`video` | `image`) a `pelicula_extras` con valor por defecto `video`, y rellenarla desde Studio.
- [ ] Usar la columna en `rowToExtra` (`lib/extras/extras.ts`) dejando la extensión solo como respaldo.

## EXT-05 — Validación en dispositivos reales

Todo el diseño móvil se comprobó con simulación de pantalla táctil y capturas, **no en un móvil físico**.

- [ ] Abrir el visor en un móvil real (vertical y horizontal): pill de navegación, animación de nacimiento, «+ Más info» con el degradado, margen de 16 px a los lados.
- [ ] Reproducción con un vídeo real: controles compactos, pantalla completa con el título arriba a la izquierda, volumen oculto en táctil.
- [ ] Comprobar tabletas y ventanas de escritorio estrechas (cambio de flechas laterales a pill).
- [ ] Revisar la «mancha oscura» detrás del reproductor en escritorio que se comentó: se quitó la sombra grande del vídeo como causa probable, pero no se llegó a reproducir; falta confirmar dónde se ve y con qué ventana.

Cómo ver la versión local en el móvil: misma red Wi-Fi en `http://192.168.1.142:3000` (puede requerir abrir el puerto 3000 en el cortafuegos de Windows) o por Tailscale en `http://100.90.143.117:3000`.

## EXT-06 — Mejoras de diseño que se dejaron fuera

- [ ] Deslizar el dedo para cambiar de extra en móvil (en imágenes es sencillo; en vídeos choca con los gestos del reproductor).
- [ ] El vídeo arranca solo y con sonido al abrir un extra; valorar empezar en pausa.
- [ ] Salir de pantalla completa con Escape también cierra el visor.
- [ ] El tipo del extra (Making of, Entrevista…) ya no se ve en las tarjetas, solo «Vídeo» o «Imagen»; sigue guardado en la base de datos.
- [ ] Descripción en escritorio: una sola columna a todo el ancho (líneas largas, unos 120 caracteres). Valorar un ancho máximo.
- [ ] La descripción admite 500 caracteres como máximo (límite de la tabla).
- [ ] Revisión de accesibilidad completa del visor (foco al abrir y al cerrar, lectores de pantalla).

## EXT-07 — Extras también en las películas (largometrajes)

**Requisito.** Los extras deben existir tanto para cortos como para películas.

**Situación a 15/10/2026.** La tabla `pelicula_extras` cuelga de `peliculas(id)`, que es la tabla de **todos** los títulos (hoy 81, todos servidos por `/cortos/[id]`), así que a nivel de datos ya vale para películas. Pero `/peliculas` es hoy una pantalla «Próximamente» (`ComingSoonScreen`) y **no existe ficha de película**: cuando se cree, tendrá que mostrar los extras igual que la de cortos.

- [ ] Al crear la ficha de películas, reutilizar `MovieDetail` (pasa `extras` y ya incluye la pestaña, el visor y todo el diseño) y cargar los extras con `getExtrasByPeliculaId(movie.numericId)` como hace `app/(platform)/cortos/[id]/page.tsx`.
- [ ] Si las películas acaban en otra tabla distinta de `peliculas`, añadir una tabla equivalente o generalizar `pelicula_extras` con una referencia al tipo de título.
- [ ] Revisar `/api/extras` (comprobación de autoría por `peliculas.creator_user_id`) para que cubra también los largometrajes.
- [ ] Decidir si las **series** (`/series/[id]`, `series-detail.tsx`) también tendrán Extras: hoy no los tienen.
- [ ] Verificar en una película de muestra el mismo comportamiento que en cortos (escritorio y móvil).
- [ ] Pasar `workType="pelicula"` a `MovieDetail` en la ficha de películas: así los comentarios dicen «Añadir momento de la película» en lugar de «del cortometraje» (por defecto es cortometraje).

## Relacionado, fuera de Extras

- **Comentarios, momento de la obra (15/10/2026):** el campo ahora se nombra «del cortometraje» o «de la película» según la sección y se valida contra la duración (cliente y servidor; `lib/comments/timestamp.ts`). Si una obra no tiene duración parseable (p. ej. «Corto»), solo se valida el formato. El comentario de prueba con momento 13:11 (id 1 de `yasha-gozen`) ya estaba borrado.
- **Comentarios, respuestas (15/10/2026):** la API valida el comentario padre (existe, no borrado, misma obra, primer nivel), ignora el momento en respuestas, valida el cuerpo y no devuelve mensajes internos; el contador suma respuestas. Reglas en `lib/comments/validation.ts` con tests en `e2e/unit/comment-validation.spec.ts` y `e2e/comments-replies.spec.ts`. Pendiente (sin urgencia): el listado carga todos los comentarios de la obra de una vez (sin paginación en servidor); no hay restricción en la base de datos contra anidados profundos (se cubre en el servidor); el texto de error «El cortometraje dura…» necesita adaptar el artículo para películas.
- **Avatares de perfil, un único sistema (15/10/2026).** El avatar de un perfil ya no depende del navegador: vive en la base de datos y se resuelve con un único criterio en todo el sitio.
  - **Datos:** `profiles.avatar_id` (perfil principal; migración `20261017_profiles_avatar_id.sql`, aplicada) y `sub_profiles.avatar_id` (secundarios, ya existía) con la misma convención: icono del catálogo, ruta propia, URL https o imagen subida reducida. `comments.profile_id` (`20261016_comments_profile_id.sql`, aplicada) guarda con qué perfil se comentó; las valoraciones ya guardaban `profile_id`.
  - **Criterio (perfil principal):** foto de creador → avatar elegido → foto de la cuenta de Google → inicial sobre el color del perfil; «sin avatar» elegido expresamente fuerza la inicial. Secundarios: su avatar o la inicial. Código: `lib/profiles/avatar.ts`, `author-avatar.ts`, `author-lookup.ts`.
  - **Dibujo:** un solo componente, `components/ui/profile-avatar.tsx` (comentarios, valoraciones, barra superior, menú de cuenta, selector de perfiles, ajustes y Mi espacio).
  - **Imágenes subidas:** se reducen en el navegador a 256 px (WebP/JPEG, máx. 256 KB; `lib/profiles/image-resize.ts`) y se sirven por `/api/avatar?u=…&p=…&v=…` con caché permanente; las listas llevan solo esa dirección corta. SVG incrustado no se admite.
  - **Migración de datos:** el avatar que alguien tenía solo en su navegador se sube a la base de datos automáticamente la primera vez que entra.
  - **Seguridad de imágenes:** se añadió `lh3.googleusercontent.com` a `img-src` (fotos de cuentas de Google).
  - **Pendiente:** (1) guardar las imágenes subidas en almacenamiento de objetos (R2) con CDN en vez de en la base de datos, cuando el motor de subidas del Mac lo permita: el contrato (`avatarUrl`) no cambia; (2) los comentarios ya publicados antes de `comments.profile_id` se muestran con el perfil principal; (3) no se han revisado otros sitios con avatar (estudio, páginas de creadores, mensajes); (4) la suite `test:responsive` conviene repasarla en dispositivos reales.
- **Comentarios a la YouTube (15/10/2026, estudio de la sección pública de YouTube + documentación oficial).** Hecho: orden «Destacados» / «Más recientes»; contador abreviado («1,9 K») y nombres accesibles descriptivos; enlace permanente en la fecha (`#comentario-ID`, abre la pestaña, despliega y resalta); momentos del texto («10:32») clicables si caben en la duración; insignia «Creador»; editar el propio comentario con «(editado)»; fijar comentario y corazón del creador; respuestas de 10 en 10 con «Mostrar más respuestas». Lógica en `lib/comments/presentation.ts` y `validation.ts`; tests en `e2e/unit/comment-presentation.spec.ts` y `e2e/comments-community.spec.ts`.
  - **Pendiente de aplicar:** `supabase/migrations/20261018_comments_community.sql` (columnas `edited_at`, `pinned_at`, `creator_hearted`; aditiva). Hasta entonces editar funciona sin «(editado)» y fijar/corazón avisan de que aún no están disponibles.
  - **No hecho (decisión o pendiente):** «No me gusta» (se descarta a propósito); moderación con retención de comentarios y estados (publicado/retenido/spam/rechazado) para el creador; menciones `@nombre` con aviso; «Leer más» en comentarios muy largos; carga por lotes desde el servidor (hoy el listado trae todos); notificaciones al creador/autor; artículo «El/La» en el aviso de duración para películas.
- **Comentarios: pendientes (15/10/2026).**
  - [ ] **Aviso a la persona a la que respondes:** hoy no recibe ninguna notificación cuando alguien le contesta o la menciona.
  - [x] **La mención va con la persona, no con el nombre (hecho 15/10/2026):** al responder a una respuesta se guarda `comments.reply_to_id` (migración `20261020_comments_reply_to.sql`) y el texto ya no lleva el «@Nombre». Se muestra «@» + nombre ACTUAL del autor (si cambia de nombre, se actualiza sola), como enlace al comentario mencionado; si ese comentario se borra, sale «@comentario eliminado». Los comentarios antiguos con «@Nombre» en el texto se siguen resaltando como antes.
  - [ ] **Aviso al mencionado:** con `reply_to_id` ya se sabe a qué comentario (y, por tanto, a qué cuenta y perfil) se responde; falta crear la notificación.
  - [ ] **Moderación de comentarios:** retención para revisar, estados (publicado, retenido, spam, rechazado) y panel para el creador; hoy solo existe «Denunciar».
  - [ ] **«Leer más» en comentarios largos:** plegar los textos muy largos con un enlace para desplegarlos.
- **Ficha «Detalles» al estilo Filmin: faltan los datos nuevos (15/10/2026).** Hecho: tarjetas a dos columnas (Sinopsis · Dirección y reparto · Audio y subtítulos · Más información) con lo que ya existe; una fila o tarjeta sin dato no se muestra. `language` está vacío en los 81 cortos, así que «Audio y subtítulos» aún no aparece. Falta (necesita migración y cambios en Studio, pedir permiso antes):
  - [ ] **Campos nuevos en `peliculas`:** título original, país, fecha de estreno, idiomas de audio, idiomas de subtítulos, temas (8–15 etiquetas), premios y festivales, reparto, equipo técnico (guion, fotografía, música, montaje), productora, técnica (animación 2D, stop-motion, imagen real…), clasificación por edad real con motivos (hoy `rating` es «TODOS» fijo y no se muestra), accesibilidad (audiodescripción, subtítulos para sordos, lengua de signos).
  - [x] **Sinopsis plegable «… Más»:** en escritorio, si la sinopsis no cabe en la altura natural de la columna derecha se corta con «…» y un botón «Más» la despliega (y «Menos» la pliega); en móvil se muestra entera. Pendiente de decidir: si también debe plegarse en móvil con un límite de líneas.
  - [ ] **Sinopsis largas de los demás cortos:** solo YASHA GOZEN tiene sinopsis larga (`lib/data/film-long-synopses.ts`, escrita con datos verificados del manga original y su autora; el argumento del corto no se pudo confirmar y no se inventó). Quedan 80. Muchos son obras originales de la comunidad, así que no hay nada que investigar en internet: lo correcto es que cada creador escriba la suya en Studio. Para los que sean adaptaciones (como «Chi no wadachi» o «Siul») se puede investigar la obra original.
  - [ ] **Frase corta + sinopsis larga:** la cabecera de la ficha ya muestra la frase corta (`tagline`; si no hay, las primeras frases de la sinopsis, máx. 180 caracteres) y la tarjeta «Sinopsis» el texto completo, a la altura de las dos tarjetas de la derecha. Falta guardar la frase corta del creador en la base de datos (columna `peliculas.tagline`; hoy solo existe en el archivo estático `lib/data/film-taglines.ts`) y pedirla en Studio («Una frase que acompañe al título, máx. 180 caracteres») junto a la sinopsis larga.
  - [ ] **Studio:** pedirlos al subir y al editar, con sugerencias; los 81 cortos actuales los tendría que rellenar el creador o nosotros a mano.
  - [ ] **Tarjetas nuevas** al tener datos: «Premios y nominaciones» y «Temas» (pastillas), y usar los temas como señal de similitud en las recomendaciones.
- **Recomendaciones: revisar el rediseño completo (opción B) (15/10/2026).** Ya hecho el arreglo rápido (A): «Recién llegados» y «Nuevos para ti» rotan con azar por carga de página, las afinidades se normalizan a 0–1, lo mostrado hace poco baja en TODAS las filas (memoria de 48 h) y lo que solo se mostró ya no cuenta como gusto. Hay un simulador de repetición en `e2e/unit/recommendation-rotation.spec.ts`. Queda por estudiar:
  - [ ] **Filas con función distinta:** «Porque viste», afinidad de géneros, una fila de **descubrimiento** etiquetada («Fuera de tu zona») y colecciones.
  - [ ] **Muestreo tipo Thompson/bandido** en lugar del azar fijo, para que lo poco visto tenga opción real sin romper la relevancia.
  - [ ] **Memoria de lo mostrado por perfil en la base de datos** (hoy es `localStorage`, se pierde al cambiar de navegador o limpiar datos) y garantía de que, tras uno o dos días, al menos la mitad de la portada sea nueva.
  - [ ] **Popularidad real** (reproducciones y finalizaciones de los últimos 7 días) en lugar de la posición en la lista.
  - [ ] **Similitud más rica:** duración, tono, director y año, además de la categoría; filtrado colaborativo cuando haya suficientes usuarios.
  - [ ] **Métricas:** repetición entre visitas, cobertura del catálogo a 7 días, títulos que nunca se muestran.
  - [ ] **«Top 10 en GMA» no es un top:** son 8 títulos del héroe (azar con sesgo por gustos); usar un ranking real o renombrar la fila.
  - [ ] Opcional: que el héroe también use la memoria de lo mostrado.
- **Nota media en el catálogo y efecto de Filmin (16/10/2026).** Hecho: la nota media de la gente (0–10, un decimal) sale solo en la capa de descripción, al pasar el cursor, abajo a la izquierda: «★ 8.4 · N valoraciones». Se probó una insignia gris fuera de la portada y se quitó. Los títulos sin valoraciones no muestran nada. Se calcula desde la tabla `ratings` (`lib/ratings/summary-server.ts`, caché de 2 min). Efecto al pasar el cursor como el de Filmin: la capa negra al 80 % entra en 350 ms y sale en 250 ms, y el título de debajo se desenfoca 3 px. Cuadrícula con los cambios de columnas de Filmin (1 / 2 / 3 / 4 / 5 en 720 / 1000 / 1150 / 1500 px).
  - [ ] **Con muchas valoraciones, calcular las medias en la base de datos** (vista o función SQL) en vez de leerlas todas por páginas; hoy son 12 valoraciones en 11 títulos y no importa. Requiere migración.
  - [ ] **Con una sola valoración la nota es ese voto** (un 5★ da «10.0»). Decidir si se oculta hasta tener un mínimo de votos (por ejemplo 3) o si se muestra el número de votos junto a la insignia.
  - [ ] **La nota solo sale en la capa del catálogo.** No está en las filas de la portada ni en el buscador (la tarjeta flotante ya muestra la nota de la comunidad). Falta decidir si debe salir también ahí.
  - [ ] **Filmin muestra en la capa:** «solo para suscriptores», clasificación por edad (12+) y el botón de guardar. En GMA falta la edad (no hay dato real) y el guardar sigue siendo el botón de la esquina.
- **Observaciones de Cinejoy y Movy (16/10/2026): lo que vi y no implementé.** Medido solo con geometría y comportamiento, sin copiar nada. Ya hecho: filtros en píldoras (Categoría, Año, Duración, Orden, «En mi lista», «Sorpréndeme») y cuadrícula de portadas con columnas que cambian antes (banda 215–410 px; movy.sx mantiene 282–357).
  - [ ] **Comprueba el zoom de tu navegador en `localhost:3000`.** Al medir, el navegador de pruebas tenía `localhost` al 90 % (devicePixelRatio 0,9): todo se ve un 10 % más pequeño que en otra web a 100 %. Pulsa Ctrl+0 en la pestaña de GMA. Puede explicar parte de la sensación de «más pequeños».
  - [ ] **Movy muestra texto bajo cada portada** (título y «★ nota · año · tipo»). En el catálogo de GMA el título va encima de la imagen y no hay año ni colección a la vista. Ya pasa en las filas de la portada de GMA; falta en el catálogo.
  - [ ] **Movy cambia a portadas verticales (2 columnas, ratio 0,6) por debajo de ~600 px.** En GMA seguimos con horizontales (1 columna por debajo de 480 px, 2 hasta 879 px) porque aún no hay verticales. Cuando existan, decidir si se usan en móvil.
  - [ ] **Márgenes y espaciado:** movy usa 96 px laterales en pantalla ancha y 6 px entre columnas (24 px entre filas, por el texto de debajo). GMA usa 64 px y 16 px. Se mantuvo el nuestro porque la cabecera y los carruseles de GMA ya usan 64 px.
  - [ ] **Filas de la portada:** las tarjetas de GMA ya miden 320 px a partir de 768 px, igual que las de movy (320×223 con texto, 6 px de separación). No se tocó.
  - [ ] **En móvil los filtros quedan casi 2.000 px más abajo**, tras la lista de colecciones apilada (1 columna). Ideas: colecciones en fila deslizable en móvil, o píldoras fijas arriba al desplazar.
  - [ ] **Cinejoy tiene una fila «Próximamente»** con tarjetas marcadas «Coming soon» encima de la cuadrícula. GMA podría tener «Próximamente» con los cortos programados.
  - [ ] **Cinejoy y movy filtran por País y Proveedor.** GMA no tiene esos datos (no hay columna de país y `language` está vacío en los 81 cortos). El panel antiguo ofrecía País e Idioma, pero **nunca se aplicaban** (no filtraban nada); los quité. Cuando existan los campos nuevos de la ficha, añadir las píldoras «País» e «Idioma».
  - [ ] **El filtro de duración no funcionaba:** entendía «12 min» pero no «1m 36s», el formato real de los cortos, así que con una duración elegida no salía ninguno. Corregido, con tests.
  - [ ] **Las «categorías» del filtro son las colecciones de GMA** (+18, 3D, Stop Motion, TOP…), no géneros de cine. Si más adelante se separan colecciones y géneros, el filtro debería ofrecer ambos.
  - [ ] **El buscador (`/buscar`) tiene sus propios filtros** (`use-catalog-filters` y chips), distintos de las nuevas píldoras. Conviene unificarlos.
  - [ ] **«La Película»** aparece como una opción más en Categoría. Si se quiere un filtro de tipo (cortos / películas), mejor como píldora aparte.
  - [ ] **Carruseles:** si las tarjetas de una fila se reordenan al cargar los datos del usuario, ahora la fila vuelve sola al principio (antes «Colecciones para ti» arrancaba en la 2.ª o 4.ª tarjeta). Está en el componente común, así que sirve para todas las filas.
- **Denunciar comentarios: botón retirado de la interfaz (15/10/2026); decidir cómo incluirlo.** Se probó junto a «Responder», abajo a la derecha y arriba a la derecha, con bandera y con escudo, y ninguna opción convenció (arriba no queda claro de qué comentario es cada botón). La API (`/api/comments/report`, tabla `comment_reports`) sigue activa y sin uso.
  - [ ] Buscar un sitio claro dentro del comentario (por ejemplo, un menú «⋯» con varias acciones) o una vía externa (denunciar al perfil desde su página).
  - [ ] Al volver a poner el botón, reactivar `e2e/comment-report.spec.ts` (ahora saltado).
- **Comentarios con varios perfiles en una misma cuenta: decidir y resolver (15/10/2026).** Caso: una cuenta (un correo) con dos perfiles, A y B (por ejemplo, el de una persona y el de su madre), con fotos, nombres y recomendaciones distintas. ¿Qué pasa cuando entra con el perfil B y va a la sección de comentarios: gestiona los comentarios de toda la cuenta o solo los de su perfil?
  - **Hoy (cuenta entera):** los comentarios guardan la cuenta (`user_id`) y el perfil con el que se escribieron (`profile_id`, solo para mostrar el avatar y el nombre). Pero la propiedad se decide por cuenta: con cualquier perfil de la cuenta aparece «Tú», «Editar» y «Eliminar» en los comentarios que escribió otro perfil de la misma cuenta, y la API lo permite (editar y borrar comprueban solo la cuenta). Los «De acuerdo» también se guardan por cuenta, no por perfil. Las valoraciones sí distinguen el perfil.
  - [x] **Decidido (15/10/2026): opción A, cada perfil gestiona solo lo suyo.** Hecho: «Tú», «Editar» y «Eliminar» solo en los comentarios del perfil activo; la API de editar y borrar exige también el perfil (`lib/comments/ownership.ts`); los comentarios antiguos sin perfil son del perfil principal. Tests: `e2e/unit/comment-ownership.spec.ts` y uno en `comments-community.spec.ts`.
  - [x] **«De acuerdo» por perfil, hecho:** migración `20261019_comment_likes_profile_id.sql` aplicada en la base real (los 2 existentes quedaron en el perfil principal); la API de «De acuerdo» y el listado distinguen el perfil.
  - (Opciones que se barajaron) ] **Decidir el modelo:** (a) cada perfil gestiona solo lo suyo (recomendado: encaja con perfiles separados, como en Netflix); (b) cualquier perfil gestiona todo lo de la cuenta; (c) solo el perfil principal puede gestionar todo y los demás solo lo suyo.
  - [ ] **Si es por perfil:** mostrar «Tú», «Editar» y «Eliminar» solo en los comentarios del perfil activo; exigir también `profile_id` al editar y borrar en la API; guardar los «De acuerdo» por perfil (`comment_likes.profile_id`); que un perfil no pueda ver ni tocar lo de otro, incluidos los perfiles infantiles.
  - [ ] **Casos a probar:** perfil A comenta, entra B (misma cuenta) y no debe poder editar ni borrar; B responde a A (misma cuenta) y se ven como personas distintas (nombre y foto); cambiar de perfil con la ficha abierta; comentarios antiguos sin `profile_id` (se asumen del perfil principal); denunciar y dar «De acuerdo» entre perfiles de la misma cuenta; recomendaciones y «Mi lista» separadas por perfil.
- La migración `supabase/migrations/20261013_comment_reports.sql` (denuncias de comentarios) **sigue sin aplicarse**: «Denunciar» muestra «Error, reintentar» hasta entonces.
- La cadena del tráiler (columna en base de datos, RPC y carga desde Studio) sigue pendiente del paquete del Mac.

## Tarjeta flotante de Inicio (notas de diseño)
- La imagen de la tarjeta NO es clicable (cursor normal): está reservada para el tráiler (silenciado, con botón de sonido) cuando existan. La zona clicable (`[data-preview-hit-area]`) empieza donde acaba la imagen. Al añadir tráiler, el botón de sonido/pausa va dentro de `[data-preview-image]` (ahí no hay enlace por debajo).
- «Mi Lista» en Inicio solo aparece si había algo guardado al cargar la página; las recomendaciones usan la lista «tal como llegó» (`getLoadedSnapshot`), así guardar no reordena filas bajo el cursor. Lo guardado cuenta en la próxima visita.

## Tipografía: Satoshi (ANTES DE PUBLICAR)
- Toda la web usa solo Satoshi (fuente variable 300–900 y su cursiva), cargada con `next/font/local` desde `app/fonts/satoshi/`. Ya no hay Manrope, serif ni monoespaciadas (los números usan `tabular-nums`). Los títulos que eran serif cursiva ahora son Satoshi cursiva (peso 500).
- Licencia ITF FFL 2.0 (`app/fonts/satoshi/FFL.txt`): gratis y comercial, se puede alojar en nuestra web, pero **prohíbe redistribuir los archivos (también en repositorios públicos) y modificarlos** (subset, conversión). Por eso los `.woff2` están en `.gitignore` y NO van al repositorio (hoy público).
- **Pendiente de decidir**: Vercel construye desde git, así que sin los `.woff2` la compilación de producción fallaría. Opciones: (a) hacer privado el repositorio y quitar la línea de `.gitignore`; (b) cargar Satoshi desde la API de Fontshare (permitido, pero es una petición a un tercero, a tener en cuenta por privacidad/RGPD) y quitar `next/font/local`; (c) descargar los archivos en el build desde un almacenamiento privado.

## Paleta de la interfaz: negro casi neutro + fondo de aurora
- Fondo de TODA la web (`components/layout/site-aurora.tsx`, montado en `app-shell.tsx` y en el layout legal): sobre el negro de la página, cuatro manchas muy suaves (dos verdes, un violeta y un teal) que derivan despacio. Es el fondo «líquido» del buscador llevado a todas las páginas. Va fijo con `z-index: -1` (detrás de todo), con degradados radiales (sin filtro de desenfoque, más barato) y solo anima `transform`; con movimiento reducido queda quieto. Para ajustar la intensidad o los colores: la lista `BLOBS` de ese archivo.
- Negros (en `app/globals.css`, `:root`): `--gma-bg #070709` (fondo; toque mínimo de violeta), `--gma-surface-2 #0E0E11`, `--gma-panel #141417`, `--gma-surface #1C1C21`, `--gma-border #26262B`, `--gma-line-strong #33333A`, y textos grises neutros (`--gma-text-*`). En componentes se usan `bg-gma-*`, `border-gma-*` o `var(--gma-*)`: cambiar de paleta = cambiar esos valores.
- En Inicio y en la ficha de cada título (`/cortos/<id>`, cortos y películas) NO hay aurora (función `hasOwnBackground` en `site-aurora.tsx`): ahí el fondo lo da el color de la portada (`ambient-backdrop.tsx`), así cada título tiene su fondo propio; las colecciones y el resto de páginas sí llevan aurora. La ficha de series (`/series/<id>`) aún no tiene este fondo. La imagen de cabecera de la ficha se funde hacia abajo con máscara para no dejar escalón sobre el brillo: allí el fondo lo da el color de la portada del hero (`ambient-backdrop.tsx`, opaco sobre el negro) y se mezclarían. El pie es casi opaco (90 %) para que su texto se lea sobre cualquier mancha.
- `e2e/unit/palette.spec.ts` impide colores oscuros sueltos en los componentes; `e2e/forest-palette.spec.ts` y `e2e/site-aurora.spec.ts` comprueban lo que se pinta de verdad.
- Quedan sin tocar: las paletas de portadas generadas sin imagen (`lib/supabase/queries.ts`, `components/features/studio/studio-data.ts`) y los colores con significado (acento verde, rojo de error…).
- Probado y descartado por el usuario: negro neutro puro, «Bosque oscuro» (verdoso) y blancos rotos (se mostraron en una comparativa; no se aplicaron).

## Navegación: Mi Espacio y Mi Estudio (decisión del usuario)
- Hecho (escritorio): «Mi Espacio» ya no está en el menú de texto; se abre SOLO desde el icono de guardados (marcador), a la izquierda de la foto de perfil. «Mi Estudio» es un enlace normal en el menú, solo para creadores (sin ruleta ni doble clic). Lista del menú en `lib/layout/nav-items.ts`.
- **Pendiente (móvil)**: la barra inferior flotante se sustituirá por una **barra lateral**. En móvil también se entrará a Mi Espacio desde el icono de guardados de la cabecera, y «Mi Estudio» irá en la barra lateral (como ahora va en la barra superior en escritorio). Hoy en móvil: barra inferior con 4 accesos (Inicio, Películas, Cortos, Mi Espacio/Entrar) y el icono de guardados oculto (`lg:flex`).

## Mi Estudio: pasarela de subida (simplificada)
- Quitado de la pasarela: otros países de producción, países de rodaje, presupuesto, enlaces del proyecto, retrato y bio de la dirección, sinopsis en inglés, subtítulos grabados en la imagen y «película muda» (ya existe el género «Mudo»). La traducción la hace el navegador.
- **Pasa al Perfil de creador** (por hacer): foto de perfil, biografía, enlaces (web, IMDb, Instagram, X, Facebook). Un título se asocia solo al perfil de quien lo sube.
- Tráiler (archivo o enlace) y Extras (fotogramas, pósters, vídeos) dentro de «Tu ficha». El tráiler se usará en el banner del Home.
- Roles del equipo reducidos a los principales (reparto, guion, productor ejecutivo, fotografía, edición, música, sonido, arte, animación, otro).
- Pendiente de decidir: ópera prima, montaje provisional, escuela de cine, fecha de estreno, contraseña de enlace, datos de contacto/nacimiento de directores y productores, empresas, selecciones y premios, documentos, y la «Categoría» (se solapa con Género).

### Pasarela en 5 pasos (Vídeo · Tu ficha · Datos e idioma · Reparto y equipo · Revisión)
- **Quitado: «Documentos»** (memoria de dirección, memoria de producción, presupuesto detallado y documentos extra). Era material de apoyo para festivales y programadores. Si GMA llega a servir de trampolín a festivales, se puede volver a añadir como paso opcional.
- **«Selecciones y premios» pasa a ser light**: un desplegable opcional («Premios y selecciones») dentro de «Detalles» de Tu ficha, con solo festival y premio. Se quitó la carga en lote y los datos de edición, ciudad, país y fecha.
- **Reparto y equipo simplificado**: solo nombre y papel (director/a, productor/a y los roles principales). Se quitaron nacionalidad, residencia, fecha de nacimiento, teléfono, correo y las empresas productoras. Los datos de contacto del propietario de la cuenta se piden en el **perfil de creador / onboarding** (por hacer); solo esa persona tiene ficha. Al subir se da por hecho que quien sube es el propietario de la obra (recogerlo en los términos de uso).
- «Ópera prima», «montaje provisional» y «trabajo de escuela de cine» siguen como casillas en «Datos e idioma» (sin el nombre de la escuela). Pendiente: mostrarlas como chips en «Detalles» de la ficha pública.
- **Pasarela en 4 pasos** (Vídeo · Tu ficha · Datos e idioma · Revisión y envío). «Reparto y equipo» pasó a ser una sección de «Tu ficha».
- Una sola fecha: **año de estreno** (obligatorio). Quitados fecha de producción, fecha de estreno y el calendario propio. País de producción opcional (el de la productora, no dónde se rodó). «Idioma original» = idioma del audio. Edad recomendada gana «18+». De las marcas solo queda «Ópera prima».
- **Pasarela en 3 pasos + página de revisión** (Vídeo · Tu ficha · Datos e idioma → «Revisar y enviar»). La revisión ya no es un paso: es una página aparte con la vista previa de la ficha, lo que falta (con «Ir al paso»), permitir comentarios, la confirmación de propiedad y términos, y el botón de enviar. El pie de la web solo sale ahí.
  - **Tu ficha** (creativo): banner, cartel, título (el original es opcional), sinopsis corta y larga, tráiler y extras (plegados).
  - **Datos e idioma** (selección rápida): año, duración, país, categoría, género, temática, edad, ópera prima, idioma original, subtítulos .srt, reparto y equipo, premios (plegados) y aviso de IA.
- **Vídeo y tráiler: solo subir archivo** (se quitó «Usar un enlace»: reproducir desde Vimeo/Dropbox no está construido y Dropbox no sirve para streaming). Se sube en una caja de arrastrar y soltar (`video-dropzone.tsx`) con progreso. Si algún día se quiere, Vimeo se podría incrustar con su reproductor.
- **Caja de subida con «halo»** (`halo-surface.tsx`, adaptada del Halo Dropzone de cult-ui): relleno translúcido (se ve el fondo) y dos luces en el borde (una verde y otra teal, a medio perímetro de distancia para que no se junten) que lo recorren con el ratón encima, el foco o al arrastrar. Probamos manchas y partículas flotando por dentro y se descartaron. Con «reducir movimiento» queda quieta. La luz usa `offset-path: rect()`; en navegadores muy antiguos no se ve.
- **Pantalla de carga del vídeo** (`processing-bucket.tsx`, adaptada del componente Bucket de 21st.dev, sin `lucide`/`hugeicons`): al terminar de subir el vídeo, la caja pasa a «Procesando tu vídeo» con una cubeta de cristal donde van cayendo las tareas (convirtiendo, optimizando, creando calidades, casi listo). El texto es orientativo: no mide el avance real. Contrato con el motor: `UploadEngine.uploadAsset(..., onProcessing?)` avisa de que empieza el procesado y el archivo pasa a `status: "processing"` hasta que el motor lo da por bueno. El motor local lo simula 3 s. Mientras procesa, el paso no cuenta como completo.
- **Extras como galería visual** (en «Crea tu ficha»): miniaturas en rejilla con insignia del tipo (fotograma, póster o vídeo, deducido del archivo: vídeo, imagen vertical o apaisada) en una fila de cuatro casillas del mismo tamaño que se reparten todo el ancho a partes iguales (dos por fila en móvil): tres sugeridas (fotograma, póster, vídeo; cada una desaparece al añadir uno de su tipo) y una cuarta, igual, con «+» para seguir añadiendo, también varios a la vez por clic o arrastrando. Hasta 12. Los botones «Anterior/Siguiente» van al final del contenido (no flotan); la caja del vídeo se ajusta para que se vean sin bajar en pantallas normales.
