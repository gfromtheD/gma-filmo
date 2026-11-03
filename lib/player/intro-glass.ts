/**
 * Intro del reproductor: «gma Filmo» sobre negro, revelada por un cristal líquido que cubre toda la pantalla (no se ve ningún
 * recuadro, solo cómo dobla la palabra). Aprobada en el laboratorio de la intro. Dura 5 s, igual que `public/audio/intro-gma.mp3`:
 *  0,0 – 2,2 s  la palabra entra enorme y borrosa dentro de una gota que crece, y se encoge hasta su sitio (verde saturado)
 *  2,2 – 3,3 s  el cristal la suelta y el verde pasa a blanco (justo cuando la música empieza a apagarse)
 *  3,3 – 4,5 s  la palabra se mantiene sola
 *  4,5 – 5,0 s  el reproductor la funde y deja ver la película
 */
export const INTRO_TEXT = "text:gma Filmo|800||";
export const INTRO_AUDIO = "/audio/intro-gma.mp3";

/** Segundos hasta que el cristal suelta la palabra. */
export const INTRO_RELEASE_S = 2.2;
/** La animación se queda quieta aquí; los 0,5 s que faltan hasta los 5 s los pone el fundido del reproductor. */
export const INTRO_FREEZE_S = 4.5;
/** Cuándo termina la fase de intro (el fundido de salida añade 0,5 s). */
export const INTRO_MS = 4500;

export const INTRO_GREEN = "#22B16B";
export const INTRO_WHITE = "#FFFFFF";

/** Entrada «desde detrás»: gota inicial con la palabra enorme y desenfocada, que avanza hacia el centro y se enfoca. */
const FROM_BEHIND = { startZoom: 3.6, glide: 1.9, entryX: -0.22, entryY: 0.08, bounce: 0, drift: 0 } as const;

/** Cristal invisible: se conserva lo que el cristal hace a la palabra y se apaga todo lo que dibuja la pieza en sí. */
const INVISIBLE_GLASS = { sheen: 0, specular: 0, halo: 0, shadow: 0, ripple: 0, doubleBevel: 0, frost: 0, ghost: 0 } as const;

export const INTRO_TUNING = { present: INTRO_RELEASE_S, ...FROM_BEHIND, ...INVISIBLE_GLASS } as const;
