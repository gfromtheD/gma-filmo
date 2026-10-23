// Recorrido «espectador que navega»: entra en el Home, mira portadas, va a Películas o Cortos, abre fichas y salta de una a
// otra como haría alguien buscando qué ver. Entra en modo invitado (la cookie que pone el botón «Entrar como invitado»).
//
//   k6 run -e USUARIOS=25 loadtest/navegar.js
import http from "k6/http";
import { check, group, sleep } from "k6";
import { Trend } from "k6/metrics";
import { BASE_URL, SLO, pick, stages } from "./lib/config.js";

const pagina = new Trend("pagina_ms", true);
const imagen = new Trend("imagen_ms", true);

export const options = {
  scenarios: { navegar: { executor: "ramping-vus", startVUs: 0, stages: stages(), gracefulRampDown: "20s" } },
  thresholds: {
    http_req_failed: [`rate<${SLO.erroresMax}`],
    pagina_ms: [`p(95)<${SLO.paginaP95Ms}`],
    imagen_ms: [`p(95)<${SLO.imagenP95Ms}`],
  },
};

const IMAGEN = /(https:\/\/pub-[a-z0-9]+\.r2\.dev\/[^"\\\s]+?\.(?:jpe?g|png|webp)|\/api\/media\/[a-f0-9-]{36})/g;
const FICHA = /\/(peliculas|cortos)\/([a-zA-Z0-9_-]+)(?=["\\])/g;
/** Imágenes que un navegador carga al entrar (lo que se ve sin desplazarse; el resto va con carga perezosa). */
const IMAGENES_VISIBLES = 25;

const params = { headers: { Cookie: "gma_guest=1" }, tags: {} };

function visitar(ruta, nombre) {
  const res = http.get(`${BASE_URL}${ruta}`, { ...params, tags: { nombre } });
  pagina.add(res.timings.duration, { nombre });
  check(res, { [`${nombre}: 200`]: (r) => r.status === 200 });
  return res.status === 200 ? String(res.body) : "";
}

function verPortadas(html) {
  const urls = [...new Set([...html.matchAll(IMAGEN)].map((m) => m[1]))].slice(0, IMAGENES_VISIBLES);
  if (urls.length === 0) return;
  const respuestas = http.batch(urls.map((u) => ["GET", u.startsWith("http") ? u : `${BASE_URL}${u}`, null, { tags: { nombre: "imagen" } }]));
  for (const r of respuestas) {
    imagen.add(r.timings.duration);
    check(r, { "imagen: 200": (x) => x.status === 200 });
  }
}

export default function () {
  let fichas = [];
  group("home", () => {
    const html = visitar("/inicio", "inicio");
    verPortadas(html);
    fichas = [...new Set([...html.matchAll(FICHA)].map((m) => `/${m[1]}/${m[2]}`))];
  });
  sleep(2 + Math.random() * 4);

  group("catalogo", () => {
    const html = visitar(pick(["/peliculas", "/cortos"]), "catalogo");
    verPortadas(html);
    fichas = fichas.concat([...html.matchAll(FICHA)].map((m) => `/${m[1]}/${m[2]}`));
  });
  sleep(2 + Math.random() * 4);

  // Abre 2–4 fichas: a veces se queda leyendo, a veces salta enseguida a la siguiente.
  const vueltas = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < vueltas && fichas.length > 0; i++) {
    group("ficha", () => verPortadas(visitar(pick(fichas), "ficha")));
    sleep(1 + Math.random() * 6);
  }
}
