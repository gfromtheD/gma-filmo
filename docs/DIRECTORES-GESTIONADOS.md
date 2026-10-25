# Directores gestionados

El equipo de GMA puede publicar la obra de un director sin que él se haya dado de alta: crea una **cuenta gestionada** a
su nombre, la lleva por él y, cuando el director quiera, se la **traspasa entera** cambiando el email. No se mueve ni un
archivo: títulos, fichas, archivos en PeerTube y R2, cuota y configuración ya son de esa cuenta.

Primer caso: **Pablo Parés** (`/creadores/pablo-pares`).

## Cómo encaja

- Al publicar, el crédito de cada obra (`peliculas.author`) es el **nombre de creador de la cuenta**. Si en `artistas` hay
  una fila con ese mismo nombre, el crédito enlaza con su página `/creadores/<slug>`.
- La página pública toma de la **ficha de Mi Estudio** de esa cuenta el banner, la foto, la bio, la ubicación y las redes
  (lo que esté vacío se queda como en `artistas`). Lo que el equipo edite en Mi Estudio se ve en la página.
- `creator_profiles.gestionado = true` hace que la página muestre «Perfil gestionado por el equipo de GMA Filmo · Reclamar
  mi perfil». Desde la web nadie puede activarlo ni quitarlo (migración `20261109_directores_gestionados.sql`); solo el
  servidor o el editor SQL del equipo.
- «Reclamar mi perfil» abre un correo a `NEXT_PUBLIC_GMA_CONTACT_EMAIL` (variable de Vercel); si no está configurada,
  lleva al Instagram de GMA.

## Dar de alta a un director

1. **Cuenta** (Supabase → Authentication → Users → Add user → Create new user):
   email `<nombre-apellido>@gestionado.gma-filmo.invalid` (`.invalid` nunca recibe correo, nadie puede registrarlo),
   contraseña del equipo y **Auto Confirm User**. Guardar la contraseña en el gestor de contraseñas del equipo.
2. **Ficha de creador**: entrar con esa cuenta en GMA (un perfil de Chrome por director), completar el alta de creador
   con el **nombre artístico exacto** del director y rellenar Mi Estudio → Ficha (foto, bio, ubicación, redes, banner).
3. **Artista del catálogo**: si no existe, crear su fila en `artistas` con el mismo nombre
   (`INSERT INTO artistas (slug, name, bio) VALUES ('nombre-apellido', 'Nombre Apellido', '…')`).
4. **Marcarla como gestionada** (editor SQL de Supabase):
   `UPDATE creator_profiles SET gestionado = true WHERE user_id = (SELECT id FROM auth.users WHERE email = '<email>');`
5. **Subir sus obras** desde Mi Estudio con esa cuenta, como cualquier creador.

## Espacio

- Los creadores normales tienen **5 GB gratis** (`gma_upload_policy.user_bytes`) y gastan del tope de creadores (`global_bytes`).
- Las cuentas gestionadas tienen **su propio cupo** en `gma_upload_quota_overrides` y gastan de la **bolsa del equipo**
  (`staff_bytes`, 60 GB), separada de la de los creadores. Nadie puede leer ni cambiar esa tabla desde la web.
- Al dar de alta a un director, asignarle cupo (lo que suman sus obras, con margen):
  `INSERT INTO gma_upload_quota_overrides (owner_id, user_bytes, nota) VALUES ('<id>', <bytes>, '<quién y por qué>');`
- El panel de Mi Estudio enseña ese cupo («N GB del cupo del equipo»), leído con `gma_my_storage_limit()`.
- Al traspasar, el director conserva su cupo (sus obras no dejan de caber). Para subir más, ampliación.
- La cuota mide lo **subido**; lo que ocupa de verdad en el VPS son las tres calidades HLS: entre 1,2× y 2,6× el máster
  (medido el 2026-10-23/24). Vigilar el disco del VPS (`df -h`), no solo la cuota.

## Traspasar el perfil al director

1. Comprobar que quien lo pide es el director (por un canal suyo conocido: web oficial, redes verificadas, productora).
2. Supabase → Authentication → Users → la cuenta gestionada → cambiar el **email** por el del director.
3. Enviarle desde ahí el enlace de **recuperación de contraseña**: pone la suya y entra con todo lo que había.
4. Quitar la marca: `UPDATE creator_profiles SET gestionado = false WHERE user_id = '<id>';`
5. Borrar la contraseña del gestor del equipo: la cuenta ya es suya.

## Pendiente

Cuando haya varios directores gestionados, un panel interno para llevarlos todos sin cambiar de sesión. Este modelo
(una cuenta por director) es la base: el panel solo tendría que actuar sobre esas cuentas.
