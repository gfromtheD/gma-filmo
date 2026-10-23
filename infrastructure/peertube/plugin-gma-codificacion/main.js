// Perfil de x264 «gma» (paso C): igual que el perfil por defecto de PeerTube 8.3.1, salvo dos cosas medidas con VMAF
// sobre un minuto de 1080p difícil: preset `medium` en vez de `veryfast` y techo de 1080p o más a 0,07 bits por píxel
// (~3,5 Mbps a 24 fps) en vez de 0,10. Resultado: −32 % de Mbps con −1 punto de VMAF (imperceptible; se nota a partir de ~6).
// 720p y 360p conservan su techo: son los escalones del semáforo de calidad y ya son ligeros.
// Fórmulas copiadas de packages/core-utils/src/videos/bitrate.ts y packages/ffmpeg/src/ffmpeg-default-transcoding-profile.ts.

const BITS_POR_PIXEL = [[2160, 0.08], [1440, 0.09], [1080, 0.10], [720, 0.11], [480, 0.12], [360, 0.15], [240, 0.17], [144, 0.19]]
const BITS_POR_PIXEL_MINIMO = 0.02
/** Parte del techo de PeerTube que se conserva desde 1080p: 0,10 → 0,07 bits por píxel. */
const RECORTE_ALTA = 0.7
const PRESET = 'medium'

function bitrate (resolution, ratio, fps, bitsPorPixel) {
  const lado = ratio < 1 && ratio > 0 ? resolution / ratio : resolution * ratio
  return Math.floor(resolution * lado * fps * bitsPorPixel)
}

function bitsPorPixel (resolution) {
  const fila = BITS_POR_PIXEL.find(([altura]) => altura <= resolution)
  return fila ? fila[1] : 0
}

/** Techo de bits del perfil: el de PeerTube, recortado desde 1080p, nunca por encima de 1,3 × el original ni por debajo del mínimo. */
function techo ({ inputBitrate, resolution, ratio, fps }) {
  const recorte = resolution >= 1080 ? RECORTE_ALTA : 1
  const medio = bitrate(resolution, ratio, fps, bitsPorPixel(resolution) * recorte) || 192 * 1000
  const conOriginal = inputBitrate ? Math.min(medio, inputBitrate * 1.3) : medio
  return Math.max(bitrate(resolution, ratio, fps, BITS_POR_PIXEL_MINIMO) || 10 * 1000, conOriginal)
}

function perfilVOD ({ fps, inputRatio, inputBitrate, resolution }) {
  const objetivo = techo({ inputBitrate, resolution, ratio: inputRatio, fps })
  return {
    videoFilters: fps ? [{ name: 'fps', rawOptions: `fps=${fps}` }] : undefined,
    outputOptions: [`-preset ${PRESET}`, `-maxrate:v ${objetivo}`, `-bufsize:v ${objetivo * 2}`, '-b_strategy 1', '-bf 16']
  }
}

async function register ({ transcodingManager }) {
  transcodingManager.addVODProfile('libx264', 'gma', perfilVOD)
}

async function unregister () {}

module.exports = { register, unregister, techo }
