# Valoraciones y comentarios — auditoría funcional y rediseño

> Fecha: 2026-10-13 · rama `experiment/filmin-layout`. Referencia visual: estructura observada en Filmin
> (escala de nota grande, comentario tras elegir nota, tarjetas centradas de 768 px con nota, comentario y fecha).
> No se copian textos ni etiquetas de Filmin: la escala 1–10 usa etiquetas propias.

## 1. Cómo funciona (verificado en código)

| Pieza | Comportamiento |
|---|---|
| Guardado | `POST /api/ratings` hace `upsert` por `(user_id, profile_id, pelicula_id)`. Estrellas 0,5–5; nota 1–10 = estrellas × 2. |
| Visibilidad | `GET /api/ratings/community` es público: media, nº de votos y reseñas **con comentario** de todos los usuarios. |
| Privado | `GET /api/ratings` devuelve solo las del usuario y perfil activos; «Mi Espacio» usa el mismo hook. |
| «De acuerdo» | `POST /api/ratings/community/like` (no sobre la propia reseña). |
| Comentarios | `/api/comments` (GET público, POST con sesión), hilos de respuestas, «De acuerdo», momento del vídeo. |

## 2. Fallos encontrados y qué se hizo

| # | Hallazgo | Estado |
|---|---|---|
| 1 | `setRating` no comprobaba la respuesta: si fallaba (429, red, sesión) la UI mostraba «guardada» y se perdía. | **Arreglado**: comprueba `ok`, deshace el cambio local y avisa; devuelve `Promise<boolean>`. |
| 2 | Solo se veían 5 reseñas, sin forma de ver más. | **Arreglado** (aditivo): `limit`/`offset`/`sort` opcionales; sin parámetros devuelve lo de siempre. «Ver más valoraciones» y orden Más votadas / Más recientes. |
| 3 | No había botón de quitar la propia valoración (API y hook ya lo soportaban). | **Arreglado**: «Quitar» con confirmación y deshacer si falla. |
| 4 | La casilla «Publicar con mi perfil» no hacía nada (nunca se enviaba). | **Eliminada** (era engañosa sobre la privacidad). |
| 5 | Comentarios: errores al publicar silenciosos; no se podían borrar. | **Arreglado**: mensajes de error, «Eliminar» propio con confirmación (`DELETE /api/comments`, borrado lógico con `is_deleted`). |
| 6 | Una carga fallida se mostraba como «aún no hay valoraciones». | **Arreglado**: estado de error con «Reintentar». |
| 7 | **«Denunciar» no guarda nada**: el endpoint tiene un `TODO` y la interfaz dice «Denunciado». | **Pendiente — requiere decisión**: necesita una tabla de denuncias (cambio de base de datos). |

Hallazgos de la revisión de código independiente corregidos: pérdida de lo escrito al fallar el guardado, condición de carrera
al cargar más reseñas tras cambiar el orden, varios perfiles por cuenta (nuevo campo aditivo `profileId`), apertura con
`?valorar=1`, foco que saltaba al comentario al elegir nota con teclado, parpadeo al quitar, estado de «De acuerdo» obsoleto.

## 3. Cambios de API (todos aditivos y compatibles)

- `GET /api/ratings/community`: parámetros opcionales `limit` (1–50, por defecto 5), `offset`, `sort=top|recent`; la respuesta
  añade `total`, `hasMore` y `profileId` por reseña. Verificado contra datos reales (solo lectura): sin parámetros, mismas claves
  y mismo orden que antes; parámetros inválidos caen a valores seguros.
- `DELETE /api/comments`: borrado lógico solo del autor (`user_id` + `is_deleted=false`); 401 sin sesión, 404 si no es suyo.
- Sin migraciones ni cambios en el modelo de datos.

## 4. Limitaciones conocidas

- **Persistencia real no probada**: no se escribió nada en la base de datos alojada (sería contaminar datos reales). Se probó la
  lógica con APIs simuladas (rutas interceptadas) y sesión simulada; la lectura se contrastó con datos reales.
- Las escrituras reales (guardar valoración, publicar/borrar comentario, «De acuerdo») deben comprobarse una vez en un entorno
  con una cuenta de prueba.
- Distribución de notas (histograma): no existe en los datos; no se inventó.
- La API sigue leyendo todas las valoraciones de la película en cada petición y pagina en memoria (aceptable a esta escala).
- Límite de peticiones por IP (60/min) compartido con la ficha.

## 5. Pruebas

`e2e/unit/review-query.spec.ts`, `score-format.spec.ts` (lógica pura) · `e2e/ratings-comments.spec.ts` (invitado, APIs simuladas) ·
`e2e/ratings-session.spec.ts` (sesión simulada: publicar, fallo sin perder lo escrito, quitar con deshacer, editar/cancelar).
