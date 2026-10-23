// Configuración común de las pruebas de carga (k6). Todo se ajusta con variables de entorno al lanzar:
//   BASE_URL   web pública                         (por defecto, producción)
//   USUARIOS   usuarios simultáneos en la meseta   (por defecto 5)
//   RAMPA      segundos para llegar a USUARIOS     (por defecto 60)
//   MESETA     segundos manteniendo USUARIOS       (por defecto 180)
//   FORMA      carga | estres | pico               (por defecto carga)

import { sleep } from "k6";

export const BASE_URL = __ENV.BASE_URL || "https://gma-filmo.vercel.app";

const usuarios = Number(__ENV.USUARIOS || 5);
const rampa = Number(__ENV.RAMPA || 60);
const meseta = Number(__ENV.MESETA || 180);

/**
 * Forma de la prueba:
 *  - carga:  sube a USUARIOS, se mantiene y baja (un día de mucho público).
 *  - estres: escalones de USUARIOS/4 en USUARIOS/4 hasta USUARIOS, para ver en qué escalón se rompe algo.
 *  - pico:   de muy pocos a USUARIOS en 10 s (un estreno), se mantiene y baja.
 */
export function stages() {
  const forma = __ENV.FORMA || "carga";
  if (forma === "pico") {
    return [
      { duration: "30s", target: Math.max(1, Math.round(usuarios / 10)) },
      { duration: "10s", target: usuarios },
      { duration: `${meseta}s`, target: usuarios },
      { duration: "30s", target: 0 },
    ];
  }
  if (forma === "estres") {
    const paso = Math.max(1, Math.round(usuarios / 4));
    const escalones = [];
    for (let n = paso; n <= usuarios; n += paso) {
      escalones.push({ duration: `${Math.round(rampa / 2)}s`, target: n }, { duration: `${Math.round(meseta / 4)}s`, target: n });
    }
    return [...escalones, { duration: "30s", target: 0 }];
  }
  return [
    { duration: `${rampa}s`, target: usuarios },
    { duration: `${meseta}s`, target: usuarios },
    { duration: "30s", target: 0 },
  ];
}

/**
 * Lo que consideramos «ir bien» (SLO). Si una prueba los rompe, k6 la marca como fallida: el límite útil es el número de
 * usuarios simultáneos más alto que los cumple todos.
 */
export const SLO = {
  paginaP95Ms: 2000,     // una página del catálogo carga en menos de 2 s
  imagenP95Ms: 1000,     // una portada llega en menos de 1 s
  arranqueP95Ms: 5000,   // el vídeo empieza (origen + listas + primer trozo) en menos de 5 s
  erroresMax: 0.01,      // menos del 1 % de peticiones fallidas
  atascosMax: 0.02,      // menos del 2 % de trozos de vídeo que llegan más tarde de lo que duran (el vídeo se pararía)
};

/** Espera a la hora de salida común (INICIO, segundos epoch) para que todas las máquinas carguen a la vez. */
export function esperarInicio() {
  const inicio = Number(__ENV.INICIO || 0) * 1000;
  const falta = inicio - Date.now();
  if (falta > 0) sleep(falta / 1000);
}

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}
