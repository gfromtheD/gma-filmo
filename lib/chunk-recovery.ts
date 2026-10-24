/**
 * Pestaña abierta durante un despliegue: el HTML que tiene pide archivos de la versión anterior (`/_next/static/…`), que
 * ya no existen (404), y la página se queda a medias («Cargando tu estudio…»). Vercel solo lo evita con Skew Protection
 * (plan Pro). Este guardián va en línea en el `<head>`, antes que cualquier archivo de la web, y ante el primer fallo de uno
 * de ellos recarga una sola vez con una dirección nueva (`?__v=`), que ninguna copia vieja puede servir.
 *
 * Tiene que ser autocontenido: se inyecta como texto (`CHUNK_RECOVERY_SCRIPT`) y no puede usar nada de fuera.
 */
export function installChunkRecovery(win: Window): void {
  const PARAM = "__v", KEY = "gma-recarga-version", WINDOW_MS = 60000;
  let reloaded = false;
  try {
    const here = new URL(win.location.href);
    reloaded = here.searchParams.has(PARAM);
    if (reloaded) {
      here.searchParams.delete(PARAM);
      win.history.replaceState(win.history.state, "", here.pathname + here.search + here.hash);
    }
  } catch { /* dirección rara: no se toca */ }

  function recover() {
    // Si esta carga ya viene de una recarga del guardián, o hubo una hace poco, no se insiste: nada de bucles.
    if (reloaded) return;
    try {
      if (Date.now() - Number(win.sessionStorage.getItem(KEY) || 0) < WINDOW_MS) return;
      win.sessionStorage.setItem(KEY, String(Date.now()));
    } catch { /* sin almacenamiento: basta con la marca de la dirección */ }
    reloaded = true;
    const next = new URL(win.location.href);
    next.searchParams.set(PARAM, String(Date.now()));
    win.location.replace(next.toString());
  }

  win.addEventListener("error", function (event) {
    const target = event && (event.target as HTMLScriptElement | null);
    if (target && target.tagName === "SCRIPT" && /\/_next\/static\//.test(target.src || "")) recover();
  }, true);
  win.addEventListener("unhandledrejection", function (event) {
    const reason = event && (event as PromiseRejectionEvent).reason;
    if (reason && (reason.name === "ChunkLoadError" || /Loading (CSS )?chunk/.test(String(reason.message)))) recover();
  });
  // Segunda red: Next.js coloca sus scripts antes que este en el <head>, así que un 404 rápido puede llegar antes que el
  // guardián. `load` espera a que todos carguen o fallen; si para entonces la app no arrancó (`window.next` lo crea Next.js
  // al arrancar), algo no llegó.
  win.addEventListener("load", function () {
    setTimeout(function () { if (!(win as Window & { next?: unknown }).next) recover(); }, 0);
  });
}

/** El guardián como texto para `<script>` en línea (la CSP permite `'unsafe-inline'`, ver next.config.mjs). */
export const CHUNK_RECOVERY_SCRIPT = `(${installChunkRecovery.toString()})(window);`;
