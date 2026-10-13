# Adaptación de GMA Filmo a móviles y tablets

Fecha: 5 de octubre de 2026. Rama de trabajo: `mejora/temas-secundarios`.

**Estado: implementación y validación de navegador completadas; despliegue en preparación.** Este documento relaciona la auditoría visual con los cambios de código y las comprobaciones de aceptación. Las comprobaciones en dispositivos físicos se registran por separado.

## Alcance y criterios

La petición es que las pantallas internas se puedan utilizar en teléfonos y tablets de tamaños diferentes, conservando la presentación de escritorio. Se han sustituido columnas rígidas, dimensiones que excedían la pantalla y acciones dependientes del ratón por disposiciones adaptables.

- El contenido debe caber sin desplazamiento horizontal de toda la página. Los carruseles y las barras de pestañas sí pueden desplazarse dentro de su propio contenedor.
- Textos, nombres, metadatos y botones deben poder ajustarse o envolverse sin taparse entre sí.
- Los formularios y ventanas deben permitir llegar a sus acciones con el teclado del teléfono abierto y al girar la pantalla.
- Las acciones principales disponen de espacio táctil de al menos 44 px. Las acciones secundarias también se incluyen en la revisión visual.
- Se respetan las zonas del dispositivo ocupadas por cámara, bordes y barra inferior. La adaptación conserva el zoom del navegador.
- La presentación de subidas se adapta; los límites, las transferencias, las cuotas y la publicación siguen sujetos a `SUB-01` y `SUB-02`.

### Base común

| Hallazgo | Implementación | Archivos |
| --- | --- | --- |
| Alturas basadas solo en `100vh` y falta de márgenes seguros | Alturas dinámicas donde procede, `viewportFit: cover` y márgenes de zona segura | `app/layout.tsx`, `components/layout/app-shell.tsx`, módulos CSS de navegación y reproductor |
| Teclado virtual puede ocultar ventanas fijas | Ventanas ajustadas al área visible mediante `visualViewport`, con desplazamiento interior | `hooks/use-visible-viewport.ts`, ventanas de edición, PIN, diario, mensajes y valoraciones |
| Campos pequeños en pantallas táctiles | Tamaño de letra legible de 16 px en los campos afectados | `app/globals.css` y formularios adaptados |

## MOB-01.1 — Navegación, buscador, configuración y Mi Espacio

**Hallazgos:** la barra superior acumulaba marca, navegación y cuenta en una sola fila; el buscador reservaba una columna de 380 px; ajustes y diario usaban columnas de escritorio; las acciones del diario dependían del ratón.

**Cambios aplicados:**

- [x] Navegación en dos filas en móvil/tablet; barra principal y pestañas del estudio con desplazamiento propio y controles accesibles.
- [x] Buscador apilado con resultados debajo del campo; teclado gráfico reservado a escritorio y cuadrículas con menos columnas en teléfono.
- [x] Ajustes en una columna en teléfono, recuperación de dos columnas cuando hay espacio, formularios y cabeceras envolventes.
- [x] Mi Espacio: pestañas, cabecera, tarjetas y diario adaptados; edición/eliminación visibles en dispositivos táctiles y ventana de edición ajustable.

**Código:** `components/layout/navbar.tsx`, `navbar.module.css`, `app-shell.tsx`; `components/features/search/search-screen.tsx`; `components/features/settings/settings-screen.tsx`; `components/features/space/my-space-screen.tsx`, `my-space-screen.module.css`.

**Aceptación de navegador completada:** pestañas de ajustes, menú de cuenta y navegación del estudio al girar, búsquedas con/sin resultados, nombres largos y editor del diario. Se recupera el foco al cerrar Cuenta y se muestra la edición del avatar al tabular. El teclado físico del teléfono queda en la validación externa.

## MOB-01.2 — Inicio, catálogo, filtros y carruseles

**Hallazgos:** cuadrículas, encabezados, portadas y filas conservaban tamaños de escritorio; algunas acciones de tarjetas solo aparecían al pasar el ratón; el panel de filtros requería mejor ajuste de altura y foco.

**Cambios aplicados:**

- [x] Cabeceras, botones, filtros activos, tarjetas y filas del catálogo ajustados al ancho disponible.
- [x] Hero con tamaños de título, espaciado y créditos adaptables.
- [x] Carruseles con tarjetas adaptables y desplazamiento horizontal dentro de su contenedor.
- [x] Acciones de portadas visibles en pantallas táctiles y también accesibles con foco de teclado.
- [x] Filtros limitados a la pantalla, contenido desplazable, acciones accesibles y comportamiento de diálogo con Escape/foco.
- [x] Pantalla «Próximamente» y estados vacíos con distribución adaptable.

**Código:** `components/features/home/home-screen.tsx`; `components/features/catalog/catalog-screen.tsx`, `catalog-filter-drawer.tsx`, `coming-soon-screen.tsx`; `components/features/media/hero.tsx`; `components/ui/carousel.tsx`, `poster-card.tsx`, `poster-card.module.css`, `poster-art.tsx`.

**Aceptación de navegador completada:** distribución de Inicio/catálogo, portadas y acciones táctiles, filtros con rieles de año separados, entrada numérica, aplicar/limpiar, altura reducida simulada, desplazamiento, Escape y recuperación de foco, además de regresión de escritorio. «Próximamente» se comprueba a 320, 768 y 1440 px. La bienvenida y su fondo animado mantienen las preferencias acordadas anteriormente.

## MOB-01.3 — Fichas, reproducción, valoraciones, comentarios y mensajes

**Hallazgos:** fichas con columna lateral fija de 304 px; episodios y créditos que no envolvían; progreso del reproductor comprimido junto al resto de controles; título de pausa de 62 px; paneles fuera de teléfonos pequeños; mensajes de 360/480 px por 520/660 px; selectores de emoji/reacciones que no consideraban el teclado; puntuación de diez botones en una fila.

**Cambios aplicados:**

- [x] Fichas de corto/película y serie en una columna antes de escritorio; información y relacionados reorganizados.
- [x] Temporadas envolventes, miniaturas de episodio más pequeñas en teléfono y títulos/metadatos ajustables.
- [x] Progreso de reproducción a ancho completo en móvil y controles táctiles; márgenes seguros y paneles de ajustes/siguiente limitados y desplazables.
- [x] Título de pausa fluido y créditos envolventes, en dos columnas compactas al girar el teléfono; primer toque con controles ocultos los muestra sin pausar el vídeo.
- [x] Valoraciones con cabecera adaptable; puntuaciones en cinco columnas por dos filas en móvil; diálogo desplazable con ajuste al teclado, foco, Escape y recuperación del foco anterior.
- [x] Comentarios con texto envolvente, acciones en varias filas, campos legibles y menos sangría en respuestas.
- [x] Mensajes limitados al área visible, lista desplazable y campo de escritura accesible; acciones de mensaje visibles en dispositivos táctiles; selectores acotados a pantalla/teclado.

**Código:** `components/features/detail/movie-detail.tsx`, `series-detail.tsx`; `components/features/player/player-screen.tsx`, `player-screen.module.css`; `components/features/ratings/ratings-block.tsx`, `login-prompt-input.tsx`; `components/features/comments/comments-block.tsx`; `components/features/dm/dm-window.tsx`, `dm-window.module.css`.

**Aceptación de navegador completada:** fichas de corto y serie con contenido largo, comentarios anidados, valoración, controles de reproducción a 320 px y en horizontal, pausa/ajustes y mensajes/emojis con altura visible reducida. Revisión de controles de progreso/volumen/brillo y sus teclas. El cierre horizontal comprueba además que el enlace completo del creador quede dentro del área visible a 667 × 375 y 844 × 390 px. Las 7 pruebas de apoyo conservan los eventos de finalización nativa/YouTube y la condición de métodos reales. El vídeo de la prueba de distribución utiliza eventos controlados; no se acredita streaming ni gestos del sistema de un dispositivo físico.

## MOB-01.4 — Estudio del creador y presentación de subidas

**Hallazgos:** tablero con varias columnas rígidas; tablas anchas; herramientas de títulos y formularios sin espacio suficiente; editor y vista previa de perfil en paralelo; interfaz orbital dividida; pasos, metadatos y vista previa de subida pensados para escritorio.

**Cambios aplicados:**

- [x] Tablero en dos columnas en tablet y una en teléfono, estadísticas envolventes y filas de actividad con etiquetas.
- [x] Títulos en cuadrículas/listas adaptables, búsqueda y herramientas envolventes; información de tablas redistribuida con sus etiquetas.
- [x] Formulario de perfil y vista previa apilados, enlaces sociales y ayudas ajustados al espacio.
- [x] Presentación orbital apilada, inventario de archivos adaptable y controles contenidos en la pantalla.
- [x] Pasos, borrador, campos, metadatos, botones y vista previa de publicación adaptados.
- [x] Edición de título y paneles auxiliares con ancho/altura limitados y desplazamiento disponible.

**Código:** `components/features/studio/studio-screen.tsx`, `studio-dashboard-view.tsx`, `studio-stats-view.tsx`, `studio-titles-view.tsx`, `studio-profile-view.tsx`, `studio-upload-view.tsx`, `studio-upload-orbital.tsx`, `studio-edit-modal.tsx`, `studio-ui.tsx`, `studio-responsive.module.css`; `components/ui/social-links-panel.tsx`.

**Aceptación de navegador completada:** panel, títulos en lista/cuadrícula, perfil, estadísticas, editor y los tres pasos de subida; archivos locales en cola, menú de tipo y vista previa a 320/768/1440 px. Detalles de título accesibles con teclado, Escape y restauración de foco. Etiquetas de archivo con espacio reservado para nombres largos. Los datos y las transferencias de las pruebas son controlados; no se publica contenido real.

**Subidas:** estos cambios no reparan el motor ni prueban sus límites. El diagnóstico profundo, la capacidad real, recuperación, cuota, propiedad de archivos y publicación permanecen pendientes en `SUB-01`/`SUB-02`.

## MOB-01.5 — Perfiles, PIN, onboarding y creador público

**Hallazgos:** selección de perfiles y nombres grandes; controles de edición dependientes de hover; ventanas de avatar/PIN y formularios con alturas o filas fijas; identidad, redes y cuadrícula pública que necesitaban tamaños de teléfono.

**Cambios aplicados:**

- [x] Selector de perfiles en dos columnas en teléfono, avatares y nombres adaptables, edición accesible en dispositivos táctiles.
- [x] Editor de perfil y selectores de avatar/personalización contenidos, con disposición y desplazamiento ajustables.
- [x] PIN con campos más pequeños, altura visible y desplazamiento cuando aparece el teclado.
- [x] Configuración inicial de perfil normal/creador con márgenes, campos y acciones adaptables.
- [x] Perfil personal, muro público del creador, redes, filmografía y ficha móvil de apoyo ajustados a móvil/tablet.

**Código:** `components/features/profiles/profile-selector.tsx`, `profile-edit-modal.tsx`; `components/features/profile/profile-screen.tsx`; `app/configurar-perfil/page.tsx`, `app/configurar-perfil-creador/page.tsx`; `components/features/creator/creator-profile.tsx`, `creator-support-page.tsx`; `components/ui/social-links-panel.tsx`.

**Aceptación de navegador completada:** selección/edición de perfiles, PIN, editor en horizontal, configuración normal, cuatro pasos de configuración de creador, muro público y ficha de apoyo. Las pruebas de regresión verifican las asociaciones de créditos y los destinos sociales. La configuración real de cuentas de donación sigue siendo una tarea independiente.

## QA — Validación local completada, publicación en preparación

Las casillas anteriores registran implementación visible en el código. La siguiente validación corresponde a esta actualización de las pantallas internas. Las pruebas previas de bienvenida y QR se ejecutaron además como regresión.

### Matriz de tamaños

| Familia | Tamaños de referencia (ancho × alto, px) | Estado |
| --- | --- | --- |
| Teléfono pequeño | 320 × 568; 360 × 640 | Correcto en Chrome |
| Teléfono habitual/grande | 390 × 844; 430 × 932 | Correcto en Chrome |
| Teléfono horizontal | 667 × 375; 844 × 390 | Correcto en Chrome |
| Tablet vertical | 768 × 1024; 820 × 1180 | Correcto en Chrome |
| Tablet horizontal | 1024 × 768 | Correcto en Chrome |
| Regresión escritorio | 1280 × 800; 1440 × 900 | Correcto en Chrome |

El diseño se adapta a anchos intermedios; esta matriz no implica que solo funcionen los tamaños enumerados.

### Comprobaciones de navegador

- [x] Registrar resultados de TypeScript/compilación y pruebas de regresión de esta actualización.
- [x] Completar navegación, búsqueda, ajustes, Mi Espacio, Inicio y catálogo/filtros.
- [x] Completar fichas, series, reproducción, valoraciones, comentarios y mensajes.
- [x] Completar todas las pestañas del estudio, interfaz de subida y edición de títulos.
- [x] Completar selección/edición de perfiles, PIN, onboarding y perfiles de creador.
- [x] Comprobar ausencia de desbordamiento global; permitir desplazamiento solo en los contenedores previstos.
- [x] Comprobar nombres/URLs/títulos largos, estados vacíos, carga y errores con datos controlados.
- [x] Comprobar ventanas con teclado abierto/área visible reducida y cambio de orientación.
- [x] Comprobar navegación por teclado, foco visible, Escape y recuperación de foco en los diálogos adaptados.
- [x] Comprobar que las acciones táctiles no exigen hover y que los controles principales conservan espacio suficiente.
- [ ] Registrar si se despliega esta actualización y comprobar sus páginas públicas tras el despliegue.

**Resultado y evidencia — 5 de octubre de 2026:**

- Chrome automatizado con Playwright: **26 casos únicos superados**, sumando la matriz inicial y las repeticiones de cierre de los casos corregidos. La matriz cubre 21 pantallas/componentes en 11 tamaños; los recorridos adicionales comprueban «Próximamente», resultados de búsqueda, listas y ventanas. Escritorio también utiliza ratón sin emulación táctil.
- Regresión de funciones anteriores: **16/16 pruebas secundarias y 7/7 de apoyo superadas**.
- Compilación local de producción completada, incluida validación de tipos y lint; comprobación final de TypeScript correcta tras ajustar el área visible de los filtros. No hay rutas temporales de pruebas en `app/` al preparar producción.
- Fallos corregidos durante el cierre: PIN rígido, rieles de año superpuestos, entrada de año que corregía cada dígito, foco perdido en Cuenta, controles de ajustes sin nombre, edición del avatar invisible al tabular, controles de tablet pequeños, apertura de título sin botón, mensaje de búsqueda larga desbordado y etiqueta Archivo comprimida.
- Las medidas esperan a que terminen las animaciones de apertura. Se comprobó visualmente Inicio, estudio, filtros, perfiles, valoración, mensajes, reproducción y subidas con capturas.
- Área visible reducida y orientación se simulan en el navegador. El teclado, las barras, el vídeo y los gestos de dispositivos físicos continúan en la comprobación externa.
- Registros y capturas locales: `/Users/aseidkonna/Documents/Codex/Temporal/gma-filmo/`, archivos `responsive-resumen-validado.json`, `responsive-complete.json`, `responsive-cierre.json`, `responsive-ultimos-casos.json`, `responsive-filtros-final.json`, `responsive-player-horizontal-final.json`, `regresion-responsive-secondary.log`, `regresion-responsive-support.log`, `build-responsive.log` y carpetas `qa-responsive-*`.

Las pruebas con datos locales no acreditan guardado con cuentas reales ni transferencias a R2.

### Comprobaciones físicas externas pendientes

- [ ] Safari en iPhone: teclado, rotación, zonas seguras, desplazamiento de ventanas y reproducción táctil.
- [ ] Chrome en Android: teclado, selector de archivos, rotación, reproducción y navegación táctil.
- [ ] Safari en iPad o tablet Android: navegación/tabletas, ventanas, formularios y cambio de orientación.

No se ha declarado ninguna de estas comprobaciones como realizada. La emulación de tamaños o de `visualViewport` ayuda a detectar fallos, pero no reemplaza el teclado, vídeo, barras del navegador ni gestos del sistema en un dispositivo físico.
