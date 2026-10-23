// Recorrido «espectador que ve una obra»: pide el origen firmado («dame el vídeo»), lee la lista de calidades como un
// reproductor HLS, elige calidad y va bajando trozos AL RITMO REAL (cada trozo dura 5–10 s): primero llena un pequeño
// colchón y después pide uno por cada trozo que se consume. A veces salta a otro punto de la película o cambia de obra.
//
//   k6 run -e USUARIOS=25 -e TITULOS=gma-xxxx,gma-yyyy loadtest/ver.js
//
//   TITULOS     slugs de obras publicadas con el motor (separados por comas)
//   CALIDAD     max | min (por defecto max: una buena conexión pide la mejor)
//   COLCHON     segundos de vídeo que se descargan sin esperar al empezar (por defecto 30, como hls.js)
//   GOBERNADOR  1 = obedece el semáforo de calidad de la pasarela (/playback/carga) con las mismas reglas que el reproductor real
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { BASE_URL, SLO, esperarInicio, pick, stages } from "./lib/config.js";

const origen = new Trend("origen_ms", true);        // «dame el vídeo» (web, Vercel)
const arranque = new Trend("arranque_ms", true);    // desde pulsar play hasta tener el primer trozo
const trozo = new Trend("trozo_ms", true);          // descarga de cada trozo
const atasco = new Rate("atascos");                 // trozo que llegó más tarde de lo que dura: el vídeo se pararía
const bytes = new Counter("bytes_video");
// Segundos de vídeo servidos en cada calidad: dicen cuánta gente vio en 1080p de verdad.
const segundosPorAltura = { 1080: new Counter("visto_1080_s"), 720: new Counter("visto_720_s"), 360: new Counter("visto_360_s") };

export const options = {
  setupTimeout: "6m",
  scenarios: { ver: { executor: "ramping-vus", startVUs: 0, stages: stages(), gracefulRampDown: "30s" } },
  thresholds: {
    http_req_failed: [`rate<${SLO.erroresMax}`],
    arranque_ms: [`p(95)<${SLO.arranqueP95Ms}`],
    atascos: [`rate<${SLO.atascosMax}`],
  },
};

export function setup() { esperarInicio(); }

const TITULOS = (__ENV.TITULOS || "").split(",").map((s) => s.trim()).filter(Boolean);
const CALIDAD = __ENV.CALIDAD || "max";
const COLCHON = Number(__ENV.COLCHON || 30);
const GOBERNADOR = __ENV.GOBERNADOR === "1";
/** La capacidad firmada dura 5 min: se renueva antes, como hace el reproductor. */
const RENOVAR_MS = 4 * 60 * 1000;
const CONSULTA_CARGA_MS = 20_000;

/** Resuelve una URI de una lista HLS contra la de la lista (k6 no trae `URL` como un navegador). */
function resolver(uri, base) {
  if (/^https?:\/\//.test(uri)) return uri;
  const origin = /^(https?:\/\/[^/]+)/.exec(base)[1];
  if (uri.startsWith("/")) return origin + uri;
  return base.split("?")[0].replace(/[^/]*$/, "") + uri;
}

/** Lista de trozos de una variante HLS con rangos de bytes (fMP4 de PeerTube a través de la pasarela). */
function trozos(texto, base) {
  const lista = [];
  let init = null, dur = 0, rango = null, siguiente = 0;
  for (const l of texto.split("\n")) {
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

/** Mismas reglas que lib/media/quality-governor.ts (techoPara). */
function techoPara(nivel, nuevo, alturaActual) {
  if (nivel === "alta") return Infinity;
  if (nuevo || alturaActual === null) return nivel === "media" ? 720 : 360;
  if (nivel === "media") return Math.max(alturaActual, 720);
  return Math.min(Math.max(alturaActual, 360), 720);
}

function consultarNivel(origin) {
  const r = http.get(`${origin}/playback/carga`, { tags: { nombre: "carga" } });
  try { const n = r.json("nivel"); return n === "media" || n === "baja" ? n : "alta"; } catch (e) { return "alta"; }
}

/** Pulsa play: origen + lista de calidades. Devuelve las variantes (por altura) y el origen de la pasarela. */
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
    if (!lineas[i].startsWith("#EXT-X-STREAM-INF")) continue;
    const altura = Number(/RESOLUTION=\d+x(\d+)/.exec(lineas[i])?.[1] || 0);
    variantes.push({ altura, bw: Number(/BANDWIDTH=(\d+)/.exec(lineas[i])?.[1] || 0), url: resolver(lineas[i + 1], url) });
  }
  variantes.sort((a, b) => a.altura - b.altura);
  return { variantes, origin: /^(https?:\/\/[^/]+)/.exec(url)[1], t0, abiertoEn: Date.now() };
}

/** Carga la lista de trozos de una variante (y su cabecera de fichero, como hace hls.js al cambiar de calidad). */
function cargarVariante(v) {
  const r = http.get(v.url, { tags: { nombre: "variante" } });
  if (!check(r, { "variante: 200": (x) => x.status === 200 })) return null;
  const { init, lista } = trozos(String(r.body), v.url);
  if (init) bajar(init);
  return { ...v, lista };
}

function elegir(variantes, techo) {
  if (CALIDAD === "min") return variantes[0];
  const permitidas = variantes.filter((v) => v.altura <= techo);
  return permitidas.length ? permitidas[permitidas.length - 1] : variantes[0];
}

/** Índice del trozo que contiene el segundo `t` de la película. */
function indiceEn(lista, t) {
  let acumulado = 0;
  for (let i = 0; i < lista.length; i++) { acumulado += lista[i].dur; if (acumulado > t) return i; }
  return lista.length;
}

export default function () {
  if (TITULOS.length === 0) throw new Error("Falta TITULOS (slugs de obras publicadas con el motor)");
  const slug = pick(TITULOS);
  let sesion = abrir(slug);
  if (!sesion) { sleep(5); return; }

  let techo = GOBERNADOR ? techoPara(consultarNivel(sesion.origin), true, null) : Infinity;
  let actual = cargarVariante(elegir(sesion.variantes, techo));
  if (!actual) { sleep(5); return; }
  let ultimaConsulta = Date.now();

  // La mitad empieza desde el principio; el resto, en un punto cualquiera (gente que salta o que retoma).
  const total = actual.lista.reduce((s, x) => s + x.dur, 0);
  let posicion = Math.random() < 0.5 ? 0 : Math.random() * Math.max(0, total - 200);
  const verSegundos = 120 + Math.random() * 360; // ve entre 2 y 8 minutos y luego cambia
  let visto = 0, colchon = 0, primero = true;

  while (visto < verSegundos && posicion < total) {
    if (Date.now() - sesion.abiertoEn > RENOVAR_MS) {
      const nueva = abrir(slug);
      if (!nueva) break;
      sesion = { ...nueva, t0: sesion.t0 };
      const misma = sesion.variantes.find((v) => v.altura === actual.altura) || sesion.variantes[sesion.variantes.length - 1];
      actual = cargarVariante(misma);
      if (!actual) break;
    }
    if (GOBERNADOR && Date.now() - ultimaConsulta > CONSULTA_CARGA_MS) {
      ultimaConsulta = Date.now();
      techo = techoPara(consultarNivel(sesion.origin), false, actual.altura);
      const objetivo = elegir(sesion.variantes, techo);
      if (objetivo.altura !== actual.altura) {
        const cambiada = cargarVariante(objetivo);
        if (cambiada) actual = cambiada;
      }
    }
    const i = indiceEn(actual.lista, posicion);
    if (i >= actual.lista.length) break;
    const seg = actual.lista[i];
    const r = bajar(seg);
    if (primero) { arranque.add(Date.now() - sesion.t0); primero = false; }
    trozo.add(r.timings.duration);
    segundosPorAltura[actual.altura]?.add(seg.dur);
    // Mientras llena el colchón no espera; después, si un trozo tarda más de lo que dura, el vídeo se para.
    if (colchon >= COLCHON) atasco.add(r.timings.duration / 1000 > seg.dur);
    colchon += seg.dur;
    visto += seg.dur;
    posicion += seg.dur;
    if (colchon >= COLCHON) sleep(Math.max(0, seg.dur - r.timings.duration / 1000));
  }
  sleep(1 + Math.random() * 4);
}
