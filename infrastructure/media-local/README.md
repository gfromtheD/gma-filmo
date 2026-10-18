# Entorno de medios local aislado

Esta configuración es una fixture de desarrollo. No restaura ni migra datos
de producción. El runner genera `work/media-local/supabase/` y copia el
baseline seguido de una lista explícita de migraciones del motor; nunca
reproduce indiscriminadamente el historial de `supabase/migrations`.

El stack real necesita la CLI oficial Supabase fijada con versión exacta en
el lockfile y un manifiesto versionado con las imágenes exactas, cargadas ya
en el runtime Docker local. El runner valida el pin, el daemon Unix local,
cada imagen y los binds publicados antes de continuar. Las imágenes oficiales
se descargan al provisionar Docker local; la aplicación nunca usa un proyecto
Supabase alojado. Si falta algún requisito, prepare y las pruebas SQL/gateway
pueden ejecutarse, pero Auth, PostgREST y la aceptación del stack no se
certifican. No sustituir Auth por JWT fabricados.

| Servicio | Dirección prevista |
| --- | --- |
| GMA local | `http://127.0.0.1:4318` |
| Gateway | `http://127.0.0.1:4319` |
| Supabase API/Auth/PostgREST | `http://127.0.0.1:54341` |
| PostgreSQL | `127.0.0.1:54342` |
| Studio | `http://127.0.0.1:54343` |
| Correo de prueba | `http://127.0.0.1:54344` |

`config.toml` fija puertos y orígenes. El runner comprueba los
bindings reales del runtime: solo acepta `127.0.0.1` y `::1`; API y DB
requieren también binding IPv4. `0.0.0.0` y `::` no cumplen el aislamiento
aunque el cliente utilice `127.0.0.1`.

`media:local:prepare` escribe únicamente la fixture marcada en
`work/media-local/`; conserva archivos ajenos y fija el orden explícito de
baseline+migraciones con timestamps. `start/stop/reset` administran solo ese
`--workdir`. El runner guarda password/clave de executor en un fichero 0600,
privado y estable, y rellena `.env.media.local` solo después de validar el
estado local. También usa el mapping offline de Manrope/Instrument Serif a
partir de CSS y WOFF2 ya presentes en `.next`; si faltan, falla antes de
arrancar Next sin descargar fuentes.

El `project_id` es siempre `gma-filmo-media-local`. El runner rechaza URLs
remotas, archivos de proyecto linked y valores de entorno de producción.
Nunca ejecutar `supabase link`, `db push`, `db pull` ni `db reset --linked`.
Start/stop/reset solo pueden afectar los hijos y volúmenes de esta fixture.
Si el archivo de estado conserva un PID que ya no existe, el runner confirma
`ESRCH`, detiene este proyecto con el `--workdir` exacto de la fixture y luego
quita solo ese archivo obsoleto. Un PID vivo o reutilizado sigue protegido;
una regresión aislada verifica los argumentos exactos de recuperación.

## Baseline y consultas verificables

`baseline.sql` presupone el esquema `auth` y roles instalados por Supabase.
No crea `auth.users`, `auth.uid()`, `anon`, `authenticated` ni `service_role`.
Una fixture Auth mínima existe únicamente dentro del test SQL aislado y
no es evidencia de autenticación real.

Se incluyen las consultas reales de:

- Login/perfiles: `profiles` por UUID, `creator_profiles` por `user_id`,
  `sub_profiles` con IDs textuales `p_<uuid>` y ownership.
- Studio: perfil de creador y películas propias, fechas/status/language,
  relación `peliculas_colecciones(colecciones(name,slug))`.
- Catálogo: campos completos de `peliculas`, relaciones de artistas y
  colecciones, `film_scores` y `creator_public_profiles`.
- Progreso: `view_history` por `user_id,profile_id,pelicula_id` y UPSERT con
  esa clave; `pelicula_id` es numérico, `profile_id` conserva cadena vacía
  para perfil principal y `p_<uuid>` para subperfil.
- Lectores históricos: tablas de ratings/watchlist, comentarios,
  propuestas, progreso anterior, fanzines y mensajes privados.

RLS separa perfiles y progreso por owner. El navegador solo tiene SELECT
en `peliculas`; publicación, retirada y borrado pasan por los comandos GMA
autenticados y sus invariantes. El catálogo publica status
`published`/NULL y permite al owner sus títulos privados; las migraciones
neutrales añaden la frontera restrictiva final. `film_scores` usa
`security_invoker` y no revela historial privado del espectador.

## Seed

`scripts/media/local-seed.ts` exige el origen exacto local, un marcador
`gma_media_local_fixture` y el project_id esperado antes de mutar datos.
Crea por Auth admin dos creadores y un espectador con emails `.invalid`;
solo modifica usuarios que ya tengan metadata de esta fixture. Después
comprueba login con el endpoint real Auth, perfiles y consultas PostgREST.
Las contraseñas/keys se suministran por entorno local ignorado, sin logs.

Cada usuario tiene perfil principal y subperfil estable derivado de su
UUID. El perfil activo principal corresponde a `profile_id=''`;
`sub_profiles` permite después elegir `p_<uuid>` en la interfaz existente.
El seed no toca Zustand ni añade bypasses en la UI.

El catálogo contiene un MP4 sintético histórico local con poster/VTT.
Las rutas de fixture son allowlists fijas, no parámetros URL arbitrarios.
El seed no solicita contenido ni servicios externos.

`gma_media_local_inventory()` contabiliza una sola vez bytes de
fixture legacy en global/owner y habilita `legacy_inventory_verified`
solo aquí. Reseed conserva reservas/uso del motor neutral; si cambian
los bytes del inventario fixture falla en vez de reemplazar contadores.
Este helper es local, privado y no se instala en producción.

## Docker Desktop y ejecución

En este Mac, `default-network-opts` de Docker Engine no bastó para limitar
los puertos que publica Docker Desktop. La opción separada de Desktop
**Port binding behavior → localhost** (`portBindingBehavior` =
`default-local-port-binding`) sí produce bindings reales `127.0.0.1`/`::1`.
Se verificó mediante inspect de contenedores y listeners, no solo el JSON
de configuración. Si se configura por fichero, Docker Desktop debe estar
completamente parado antes de editar `settings-store.json`, conservando
copia privada del ajuste anterior, y reiniciarse después. El runner nunca
modifica ajustes de Docker ni acepta wildcard como excepción.

La CLI fijada es Supabase **2.120.0**, instalada en `node_modules/.bin/`.
El runner no necesita instalación global, login ni link. Las imágenes del
manifiesto están disponibles localmente; `start` comprueba su existencia.
El proveedor de email Auth está habilitado para login por contraseña;
el registro público sigue desactivado y solo el seed admin crea fixtures.

```sh
npm run media:local:prepare
npm run media:local:start
npm run media:preflight
npm run test:media:local-live
# Solo fixture propia: elimina su DB/almacenamiento de pruebas, no el WIP.
npm run test:media:local-runner-live
npm run media:local:stop
```

`test:media:local-live` exige stack ya operativo y comprueba Auth/PostgREST,
subida HTTP, procesamiento, ownership, publicación, HLS/VTT, Range/HEAD/CORS,
retirada, borrado y MP4 histórico desde Chromium bajo la CSP real.
`test:media:local-runner-live` comprueba reset/start, persistencia de una
subida parcial tras stop/start, SHA, fallo/reintento, cancelación y cuota,
y otro reset/start limpio. Ambos requieren flags explícitos que los scripts
añaden; ejecutarlos sin esas flags falla, no se omite. No incluirlos en la
batería offline: el segundo controla el stack y no puede correr en paralelo
con el primero.

Solo en el modo local aislado se usa un loader de imágenes de fixture:
mantiene las rutas relativas y convierte las portadas decorativas externas
en el poster sintético del gateway. Next desactiva entonces su endpoint
optimizador (404), evitando solicitudes remotas incluso desde el servidor.
Fuera de ese modo conserva su loader y hosts históricos. La prueba usa un
proxy HTTP que solo permite los tres orígenes loopback de la fixture,
incluyendo bloqueo del optimizador remoto, sin fabricar respuestas de API.
Las portadas decorativas remotas de la landing no forman parte de esta
aceptación backend; no se modifica la UI en Fase 5.

Los resultados finales y las correcciones de integración constan en
`docs/media/EVIDENCIAS-IMPLEMENTACION.md`. PeerTube/Stream y las altas
legacy permanecen desactivados en la fixture; sus adaptadores históricos
se verifican por regresión independiente sin servicios externos.
