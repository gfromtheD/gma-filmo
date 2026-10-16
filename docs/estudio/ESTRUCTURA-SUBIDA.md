# Estructura de la subida de un título (ingeniería inversa de Festhome → adaptación a GMA Filmo)

Fuente: editor de película de Festhome (`filmmakers.festhome.com/edit_film/<id>`), recorrido con una sesión de usuario real,
**solo lectura** (no se guardó ni se subió nada). Se documenta el **esqueleto**: qué se pide, en qué orden, de qué tipo,
qué es obligatorio y qué opciones hay. No se copian textos largos, estilos ni código.

## 1. Cómo está organizado en Festhome

- Una sola página de edición con una **columna lateral de 9 pasos**, cada uno con un círculo de estado (✓ completo, ✗ con lo
  obligatorio sin rellenar, vacío si es opcional). Los pasos con carencias se marcan en rojo y la página muestra una etiqueta
  «Incompleto» por bloque.
- Los campos se editan **en el sitio** (clic sobre el valor → pequeño editor → guardar). Cada campo se guarda al instante; no hay
  un botón global de «guardar».
- Los archivos (imágenes, subtítulos, documentos) se suben desde **pantallas independientes** (una por archivo) con sus reglas.
- Arriba hay un interruptor «Inscripciones» (abre/cierra la participación en festivales): **no aplica a GMA**.

Pasos, en su orden: **Vídeo · Descripción · Idioma · Imágenes · Información · Reparto y Equipo · Selecciones · Documentos ·
Utilización de IA.**

## 2. Contenido de cada paso

### 2.1 Vídeo
- Tres vías para aportar la película: **subir un archivo**, **enlace de Dropbox** (archivo compartido públicamente, **máx. 5 GB**)
  y **enlace de Vimeo** (URL + contraseña opcional + duración).
- Existe además una versión «On demand / Festhome TV» (canal, PayPal, precio 0,99–1,99 USD, anuncios): **monetización, no aplica a GMA**.
- Permite varias versiones del vídeo («Película / Versión»).

### 2.2 Descripción (ficha de cabecera)
| Campo | Tipo | Obligatorio |
|---|---|---|
| Título | texto | sí |
| Título original | texto | sí |
| Duración | número (minutos) | sí |
| País de producción | selector de país (único) | sí |
| Otros países de producción | selector múltiple de países | no |
| Provincias / regiones de producción | selector múltiple, depende del país | no |
| Países de rodaje | selector múltiple de países | no |
| Fecha de producción | fecha | sí |
| Categoría | casillas múltiples | sí |
| Edad recomendada | selector | no |
| Fecha de estreno | fecha | no |
| Ópera prima | casilla | no |
| Montaje provisional | casilla | no |
| Escuela de cine (+ nombre de la escuela) | casilla + texto | no |

- **Categorías:** Animación · Documental · Experimental · Fantástico · Ficción · Otros · Terror · Videoclip.
- **Edad recomendada:** Todas las edades · 0–6 · 6+ · 9+ · 12+ · 16+.

### 2.3 Idioma
- **Idioma principal** (selector, obligatorio; ~110 idiomas, con «Otro» al principio).
- Casilla **Película muda / sin diálogos**.
- **Subtítulos grabados en la imagen:** hasta 5 idiomas (selectores, «ninguno» por defecto).
- **Subtítulos SRT:** hasta 5 archivos `.srt`, cada uno con su idioma.

### 2.4 Imágenes (cada una se sube aparte; JPG/JPEG/PNG/GIF, **máx. 10 MB**)
| Imagen | Tamaño sugerido | Obligatoria |
|---|---|---|
| Cartel de la película | 595 × 842 (A4, vertical) | sí |
| Banner de la película | 1920 × 1080 | sí |
| Retrato de director/a | 595 × 842 | sí |
| Fotogramas 1, 2 y 3 | 1920 × 1080 | sí |
| Fotograma 4 | 1920 × 1080 | no |

### 2.5 Información
- **Tráiler / pitch / enlace** (URL) y su **contraseña** (opcional).
- **Género** (múltiple): 43 opciones (3D, Acción, Adolescente, Arte, Aventura, Bélica, Biopic, Catastrófico, Ciencia ficción, Cine
  negro, Comedia, Coreografía, Crimen, Danza, Deportes, Derechos humanos, Drama, Erótico, Fantasía, Histórico, Horror, Infantil,
  Melodrama, Mockumentary, Mudo, Musical, Otro, Procesos judiciales, Psicológico, Realidad virtual, Reality, Retrato, Road
  movie, Romántico, Series, Series web, Sexual, Superhéroes, Thriller, Videoarte, Western, Wildlife movie, Zombis).
- **Temática** (múltiple): 127 opciones (de Adolescente y Alcohol a Viaje y Violencia, pasando por Ambiental, Animales, Arte
  callejero, Cambio climático, Cultura, Educativo, Familia, Guerra, Humor, Infancia, Inteligencia artificial, Mujer, Música,
  Naturaleza, Política, Salud mental, Sátira, Soledad…). Lista completa en `lib/studio/catalogs.ts`.
- **Presupuesto** (USD, número).
- **Enlaces del proyecto** (5): web, IMDb, Instagram, X, Facebook.
- **Sinopsis corta** (límite de 250 caracteres) y **sinopsis corta en inglés**; **sinopsis larga** y **larga en inglés**; **bio-filmografía
  del director/a**. Todas obligatorias salvo las de inglés y la bio en algunos casos.
- Casillas de publicación: **Permitir comentarios** (activada por defecto), **aceptar los términos de uso** (obligatoria).

### 2.6 Reparto y Equipo
- Cuatro tipos de ficha de persona/empresa: **Director/a**, **Productor/a**, **Distribuidora**, **Empresa productora**.
  - Persona (director/productor): nombre\*, apellido\*, nacionalidad\*, país de residencia, fecha de nacimiento, teléfono (código +
    número), e-mail.
  - Empresa (distribuidora/productora): empresa, país\*, código postal, web, teléfono (código + número), e-mail, persona de contacto
    (nombre\* y apellido\*).
- **Equipo y reparto:** filas de «nombre + apellido + rol (+ nota)». Roles disponibles (~66): ayudantes de dirección,
  continuidad, producción (director de producción, productor asociado/ejecutivo…), reparto (actor/actriz principal y secundaria,
  casting, extras, voz en off), guion (argumento, autor del material original, coguionista, guionista), fotografía (director de
  fotografía, operador de cámara, steadicam, electricista…), postproducción (animación, edición, colorista, efectos digitales,
  dibujante…), sonido y música (diseño de sonido, mezcla, grabación, música), arte (director de arte, decorador, cartelista,
  fotografía fija…), vestuario/maquillaje/peluquería, especialistas, coreografía, FX, asesor, otro. Lista en `lib/studio/catalogs.ts`.

### 2.7 Selecciones
- Lista de **premios y selecciones** del título (festivales por los que ha pasado), con acciones de editar/borrar, y **alta individual o
  en grupo** (un cuadro de texto para pegar varias líneas).
- Cada selección: festival (de una lista o «otros»), nombre, **fecha\***, país, edición, localidad, **tipo de premio** (Premio del
  Jurado · Premio del Público · Selección Oficial · Mención Especial · Otros) y nombre del premio.

### 2.8 Documentos (PDF, **máx. 20 MB**)
- **Memoria de dirección**, **memoria de producción**, **presupuesto detallado** (solo PDF).
- **Documentos extra** (hasta 5, cualquier formato, máx. 20 MB), con una nota: quedan disponibles para los eventos a los que se inscribe.

### 2.9 Utilización de IA
- Texto explicativo (algunos festivales y premios exigen declarar el uso de IA).
- **¿Se han usado herramientas de IA?** (sí/no).
- **Uso general de la IA en el proyecto** (obligatorio si se usó): Mínimo · Bajo · Moderado · Alto · Total.
- Lista de **usos concretos** con «Añadir uso» y borrado con confirmación. *(No se pudo observar el formulario de cada uso sin
  modificar datos de la cuenta; se propone el diseño propio de la sección 4.)*

### 2.10 Otras pantallas del proyecto (no son la subida)
Listado, Copias de proyección (DCP, etc.), Estadísticas por festival, Sala de proyecciones (enlaces privados). **No aplican** a GMA.

## 3. Qué se queda, qué se adapta y qué se deja fuera en GMA Filmo

| Festhome | En GMA Filmo |
|---|---|
| Inscripciones, On demand/DRM/PayPal/precios, anuncios, copias de proyección, sala de proyecciones, estadísticas por festival | **Fuera** (GMA es gratuita y sin publicidad). |
| Subir archivo / Dropbox / Vimeo | **Se adapta:** subir archivo (motor propio) y enlace externo opcional. El motor real se conecta después. |
| Descripción, Idioma, Imágenes, Información, Reparto y Equipo, Selecciones, Documentos, IA | **Se mantienen como pasos**, con nuestro estilo y textos. |
| Edición «en el sitio», guardado por campo | **Se sustituye** por una pasarela guiada con borrador guardado automáticamente y un resumen final. |
| Casilla «Permitir comentarios» | Se mantiene (ya existe el sistema de comentarios). |
| Términos de uso obligatorios | Se mantiene, enlazando a `/terminos`. |

## 4. Pasarela de GMA (propuesta que se implementa)

Panel lateral con pasos y estado (✓ / pendiente / opcional) y un contenido a la derecha, un paso cada vez (no todo en una página):

1. **Vídeo** — archivo, o enlace externo; versión.
2. **Datos del título** — título, título original, duración, año/fecha de producción, categoría, edad recomendada, ópera prima,
   escuela de cine, fecha de estreno, países.
3. **Idioma y subtítulos** — idioma, muda, subtítulos grabados, SRT.
4. **Imágenes** — cartel, banner, retrato, fotogramas, con las medidas y el peso de cada una.
5. **Sinopsis y detalles** — sinopsis corta/larga (+ inglés), bio del director/a, género, temática, tráiler, enlaces, presupuesto.
6. **Reparto y equipo** — director/a, productor/a, empresas, equipo con roles.
7. **Selecciones y premios** — alta individual o por lote.
8. **Documentos** — memorias, presupuesto y extras.
9. **Uso de IA** — declaración y usos concretos.
10. **Revisión y envío** — lista de lo que falta, vista previa de cómo se verá la ficha, términos y «Enviar a revisión».

**Obligatorio para poder enviar:** vídeo; título; título original; duración; país de producción; fecha de producción; categoría;
idioma; cartel; banner; retrato; fotogramas 1–3; sinopsis corta y larga; (si se usó IA) nivel de uso; aceptar los términos.

## 5. Conexión con el motor (el «enchufe»)

El front trabaja contra una única interfaz (`lib/studio/engine.ts`). Hoy la implementa un motor provisional que usa lo que ya hay
(subida directa a R2 con URL prefirmada y `POST /api/titles` con los campos que la tabla `peliculas` admite hoy) y guarda el resto
del borrador en el navegador. Cuando llegue el motor definitivo, solo se sustituye esa implementación. Los campos nuevos que
necesiten columnas o tablas (reparto, selecciones, documentos, IA…) requerirán una migración **que se pedirá antes de aplicar**.
