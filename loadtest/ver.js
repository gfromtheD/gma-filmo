// Recorrido «espectador que ve una obra»: pide el origen firmado («dame el vídeo»), lee la lista de calidades como un
// reproductor HLS, elige calidad y va bajando trozos AL RITMO REAL (cada trozo dura 5–10 s): primero llena un pequeño
// colchón y después pide uno por cada trozo que se consume. A veces salta a otro punto de la película o cambia de obra.
//
//   k6 run -e USUARIOS=25 -e TITULOS=gma-xxxx,gma-yyyy loadtest/ver.js
//
//   TITULOS   slugs de obras publicadas con el motor (separados por comas)
//   CALIDAD   max | min (por defecto max: una buena conexión pide la mejor)
//   COLCHON   segundos de vídeo que se descargan sin esperar al empezar (por defecto 30, como hls.js)
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { BASE_URL, SLO, pick, stages } from "./lib/config.js";

const origen = new Trend("origen_ms", true);        // «dame el vídeo» (web, Vercel)
const arranque = new Trend("arranque_ms", true);    // desde pulsar play hasta tener el primer trozo
const trozo = new Trend("trozo_ms", true);          // descarga de cada trozo
const atasco = new Rate("atascos");                 // trozo que llegó más tarde de lo que dura: el vídeo se pararía
const bytes = new Counter("bytes_video");

export const options = {
  scenarios: { ver: { executor: "ramping-vus", startVUs: 0, stages: stages(), gracefulRampDown: "30s" } },
  thresholds: {
    http_req_failed: [`rate<${SLO.erroresMax}`],
    arranque_ms: [`p(95)<${SLO.arranqueP95Ms}`],
    atascos: [`rate<${SLO.atascosMax}`],
  },
};

const TITULOS = (__ENV.TITULOS || "").split(",").map((s) => s.trim()).filter(Boolean);
const CALIDAD = __ENV.CALIDAD || "max";
const COLCHON = Number(__ENV.COLCHON || 30);
/** La capacidad firmada dura 5 min: se renueva antes, como hace el reproductor. */
const RENOVAR_MS = 4 * 60 * 1000;

/** Resuelve una URI de una lista HLS contra la de la lista (k6 no trae `URL` como un navegador). */
function resolver(uri, base) {
  if (/^https?:\/\//.test(uri)) return uri;
  const origin = /^(https?:\/\/[^/]+)/.exec(base)[1];
  if (uri.startsWith("/")) return origin + uri;
  return base.split("?")[0].replace(/[^/]*$/, "") + uri;
}

/** Lista de trozos de una variante HLS con rangos de bytes (fMP4 de PeerTube a través de la pasarela). */
function trozos(texto, base) {
  const lineas = texto.split("\n");
  const lista = [];
  let init = null, dur = 0, rango = null, siguiente = 0;
  for (const l of lineas) {
    if (l.startsWith("#EXT-X-MAP:")) {
      const uri = /URI="([^"]+)"/.exec(l)?.[1];
      const br = /BYTERANGE="(\d+)@(\d+)"/.exec(l);
      init = { url: resolver(uri, base), range: br ? [Number(br[2]), Number(br[2]) + Number(br[1]) - 1] : null };
    } else if (l.startsWith("#EXTINF:")) dur = parseFloat(l.slice(8));
    else if (l.startsWith("#EXT-X-BYTERANGE:")) {
      const [len, off] = l.slice(17).split("@");
      const inicio = off !== undefined ? Number(off) : siguiente;
      rango = [inicio, inicio + Number(len) - 1];
      siguiente = inicio + Number(len);
    } else if (l && !l.startsWith("#")) {
      lista.push({ url: resolver(l, base), dur, range: rango });
      rango = null;
    }
  }
  return { init, lista };
}

function bajar(seg) {
  const headers = seg.range ? { Range: `bytes=${seg.range[0]}-${seg.range[1]}` } : {};
  const r = http.get(seg.url, { headers, tags: { nombre: "trozo" } });
  check(r, { "trozo: 200/206": (x) => x.status === 200 || x.status === 206 });
  bytes.add(Number(r.headers["Content-Length"] || (r.body ? r.body.length : 0)));
  return r;
}

/** Pulsa play: origen + lista de calidades + variante + inicio del fichero + primer trozo. */
function abrir(slug) {
  const t0 = Date.now();
  const src = http.get(`${BASE_URL}/api/titles/${slug}/playback`, { tags: { nombre: "origen" } });
  origen.add(src.timings.duration);
  if (!check(src, { "origen: 200": (r) => r.status === 200 })) return null;
  const url = src.json("url");
  const master = http.get(url, { tags: { nombre: "lista" } });
  if (!check(master, { "lista: 200": (r) => r.status === 200 })) return null;
  const variantes = [];
  const lineas = String(master.body).split("\n");
  for (let i = 0; i < lineas.length; i++) {
    if (lineas[i].startsWith("#EXT-X-STREAM-INF")) variantes.push({ bw: Number(/BANDWIDTH=(\d+)/.exec(lineas[i])?.[1] || 0), uri: lineas[i + 1] });
  }
  variantes.sort((a, b) => a.bw - b.bw);
  const elegida = CALIDAD === "min" ? variantes[0] : variantes[variantes.length - 1];
  const varUrl = resolver(elegida.uri, url);
  const variante = http.get(varUrl, { tags: { nombre: "variante" } });
  if (!check(variante, { "variante: 200": (r) => r.status === 200 })) return null;
  const { init, lista } = trozos(String(variante.body), varUrl);
  if (init) bajar(init);
  return { lista, t0, abiertoEn: Date.now() };
}

export default function () {
  if (TITULOS.length === 0) throw new Error("Falta TITULOS (slugs de obras publicadas con el motor)");
  const slug = pick(TITULOS);
  let sesion = abrir(slug);
  if (!sesion) { sleep(5); return; }

  // La mitad empieza desde el principio; el resto, en un punto cualquiera (gente que salta o que retoma).
  let i = Math.random() < 0.5 ? 0 : Math.floor(Math.random() * Math.max(1, sesion.lista.length - 20));
  const verSegundos = 120 + Math.random() * 360; // ve entre 2 y 8 minutos y luego cambia
  let visto = 0, colchon = 0, primero = true;

  while (visto < verSegundos && i < sesion.lista.length) {
    if (Date.now() - sesion.abiertoEn > RENOVAR_MS) {
      const nueva = abrir(slug);
      if (!nueva) break;
      sesion = { ...nueva, t0: sesion.t0 };
    }
    const seg = sesion.lista[i];
    const r = bajar(seg);
    if (primero) { arranque.add(Date.now() - sesion.t0); primero = false; }
    trozo.add(r.timings.duration);
    // Mientras llena el colchón no espera; después, si un trozo tarda más de lo que dura, el vídeo se para.
    if (colchon >= COLCHON) atasco.add(r.timings.duration / 1000 > seg.dur);
    colchon += seg.dur;
    visto += seg.dur;
    i++;
    if (colchon >= COLCHON) sleep(Math.max(0, seg.dur - r.timings.duration / 1000));
  }
  sleep(1 + Math.random() * 4);
}
