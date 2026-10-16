/**
 * Cuadrícula de portadas horizontales (16:9) del catálogo, con los mismos cambios de columnas que el catálogo de
 * películas de Filmin (medido): 1 columna hasta ~700 px, 2 hasta ~1000, 3 hasta ~1150, 4 hasta ~1500 y 5 a partir
 * de ahí (Filmin no pasa de 5; aquí se añade una 6.ª desde 2300 px para que no crezcan demasiado). Con los
 * márgenes laterales de la página (16 px por debajo de 640, 32 px hasta 1024 y 64 px a partir de ahí) y 16 px de
 * separación, las portadas quedan entre ~240 y ~470 px de ancho (Filmin: 252–415 de imagen).
 *
 *   < 720 → 1   720–999 → 2   1000–1149 → 3   1150–1499 → 4   1500–2299 → 5   ≥ 2300 → 6
 */
export const CATALOG_GRID_CLASS =
  "grid grid-cols-1 gap-3 min-[720px]:grid-cols-2 min-[720px]:gap-4 min-[1000px]:grid-cols-3 min-[1150px]:grid-cols-4 min-[1500px]:grid-cols-5 min-[2300px]:grid-cols-6";

/**
 * «También te puede gustar» en la ficha: ocupa todo el ancho (mismos márgenes que el catálogo) y las columnas bajan al
 * estrechar la ventana: 2 (< 640 px), 3 (640–1023), 4 (1024–1499), 5 (1500–2299) y 6 (≥ 2300). Se piden 15 títulos y
 * se ven 12 (o 15 con 5 columnas) para que la última fila nunca quede coja.
 */
export const RELATED_GRID_CLASS =
  "grid grid-cols-2 gap-3 min-[640px]:grid-cols-3 min-[640px]:gap-4 min-[1024px]:grid-cols-4 min-[1500px]:grid-cols-5 min-[2300px]:grid-cols-6 [&>*:nth-child(n+13)]:max-[1499px]:hidden [&>*:nth-child(n+13)]:min-[2300px]:hidden";

/** Márgenes laterales de la página del catálogo (los que usa el cálculo de arriba). */
export const CATALOG_PAGE_PADDING_CLASS = "px-4 sm:px-8 lg:px-16";
