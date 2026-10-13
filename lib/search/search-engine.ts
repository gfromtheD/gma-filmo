/**
 * Motor de búsqueda del catálogo: sin tildes ni mayúsculas, varias palabras (todas deben coincidir),
 * ranking por campo y tolerancia a erratas. Lógica pura: no depende de React ni de la red.
 */

export interface SearchableItem {
  readonly id: string;
  readonly title: string;
  readonly categories: readonly string[];
  readonly author?: string;
  readonly artistas?: readonly { readonly name: string; readonly role?: string; readonly slug?: string | null }[];
  readonly tags?: readonly string[];
  readonly synopsis?: string;
  readonly year?: number | string;
}

/** Campo en el que mejor encaja la búsqueda (sirve para explicar el resultado en la interfaz). */
export type MatchField = "title" | "credits" | "category" | "year" | "synopsis";

export interface SearchResult<T extends SearchableItem> {
  readonly item: T;
  readonly score: number;
  readonly matchedIn: MatchField;
}

// ── Normalización ────────────────────────────────────────────────────────────

/** Minúsculas, sin tildes y con cualquier símbolo convertido en espacio. */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  const normalized = normalizeText(text);
  return normalized ? normalized.split(" ") : [];
}

// ── Distancia de edición (Damerau–Levenshtein simplificada) ──────────────────

/** Distancia entre dos palabras; una transposición de letras contiguas cuenta como 1. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const rows: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) rows[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(rows[i - 1]![j]! + 1, rows[i]![j - 1]! + 1, rows[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, rows[i - 2]![j - 2]! + 1);
      }
      rows[i]![j] = best;
    }
  }
  return rows[a.length]![b.length]!;
}

/** Errores permitidos según la longitud de la palabra buscada (palabras cortas: ninguno). */
function allowedTypos(token: string): number {
  if (/^\d+$/.test(token) || token.length < 4) return 0;
  return token.length >= 7 ? 2 : 1;
}

// ── Puntuación por campo ─────────────────────────────────────────────────────

const FIELD_WEIGHT: Record<MatchField, number> = {
  title: 1,
  credits: 0.55,
  category: 0.5,
  year: 0.6,
  synopsis: 0.2,
};

const WORD_EXACT = 100;
const WORD_PREFIX = 70;
const SUBSTRING = 45;
const FUZZY = 25;

interface PreparedField {
  readonly field: MatchField;
  readonly words: readonly string[];
  readonly allowFuzzy: boolean;
  readonly allowSubstring: boolean;
}

/** Puntuación (sin ponderar) de una palabra buscada dentro de las palabras de un campo; 0 = sin coincidencia. */
function scoreToken(token: string, field: PreparedField): number {
  let best = 0;
  const typos = field.allowFuzzy ? allowedTypos(token) : 0;
  for (const word of field.words) {
    if (word === token) return WORD_EXACT;
    if (word.startsWith(token)) best = Math.max(best, WORD_PREFIX);
    else if (field.allowSubstring && token.length >= 3 && word.includes(token)) best = Math.max(best, SUBSTRING);
    else if (typos > 0 && best < FUZZY) {
      const close =
        editDistance(token, word) <= typos ||
        (word.length > token.length && editDistance(token, word.slice(0, token.length)) <= typos);
      if (close) best = FUZZY;
    }
  }
  return best;
}

function prepareFields(item: SearchableItem): PreparedField[] {
  const credits = [
    item.author ?? "",
    ...(item.artistas ?? []).map((a) => a.name),
  ].join(" ");
  const categories = [...item.categories, ...(item.tags ?? [])].join(" ");
  return [
    { field: "title", words: tokenize(item.title), allowFuzzy: true, allowSubstring: true },
    { field: "credits", words: tokenize(credits), allowFuzzy: true, allowSubstring: false },
    { field: "category", words: tokenize(categories), allowFuzzy: true, allowSubstring: false },
    { field: "year", words: item.year === undefined ? [] : [String(item.year)], allowFuzzy: false, allowSubstring: false },
    { field: "synopsis", words: tokenize(item.synopsis ?? ""), allowFuzzy: false, allowSubstring: false },
  ];
}

function scoreItem<T extends SearchableItem>(item: T, tokens: readonly string[], query: string): SearchResult<T> | null {
  const fields = prepareFields(item);
  let total = 0;
  const perField = new Map<MatchField, number>();

  for (const token of tokens) {
    let bestScore = 0;
    let bestField: MatchField | null = null;
    for (const field of fields) {
      const score = scoreToken(token, field) * FIELD_WEIGHT[field.field];
      if (score > bestScore) {
        bestScore = score;
        bestField = field.field;
      }
    }
    if (bestField === null) return null; // cada palabra debe coincidir en algún campo
    total += bestScore;
    perField.set(bestField, (perField.get(bestField) ?? 0) + bestScore);
  }

  const normalizedTitle = normalizeText(item.title);
  if (normalizedTitle === query) total += 200;
  else if (normalizedTitle.startsWith(query)) total += 60;
  if (tokens.every((t) => scoreToken(t, fields[0]!) > 0)) total += 20; // todo el texto cae en el título

  const matchedIn = [...perField.entries()].sort((a, b) => b[1] - a[1])[0]![0];
  return { item, score: total, matchedIn };
}

// ── API pública ──────────────────────────────────────────────────────────────

/** Resultados ordenados de mejor a peor; vacío si la consulta no tiene letras ni números. */
export function searchItems<T extends SearchableItem>(items: readonly T[], query: string): SearchResult<T>[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const normalizedQuery = tokens.join(" ");
  return items
    .map((item) => scoreItem(item, tokens, normalizedQuery))
    .filter((r): r is SearchResult<T> => r !== null)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, "es"));
}

/** Título cercano a lo escrito ("¿Quisiste decir…?"); `null` si nada se parece lo bastante. */
export function suggestCorrection(items: readonly SearchableItem[], query: string): string | null {
  const normalizedQuery = normalizeText(query);
  if (normalizedQuery.length < 3) return null;
  let best: { title: string; ratio: number } | null = null;
  for (const item of items) {
    const title = normalizeText(item.title);
    const distance = editDistance(normalizedQuery, title);
    const ratio = distance / Math.max(normalizedQuery.length, title.length);
    if (ratio <= 0.4 && (best === null || ratio < best.ratio)) best = { title: item.title, ratio };
  }
  return best?.title ?? null;
}

export interface CreatorMatch {
  readonly name: string;
  readonly slug: string;
}

/** Creadores cuyo nombre encaja con lo escrito (todas las palabras como inicio de alguna palabra del nombre). */
export function searchCreators(items: readonly SearchableItem[], query: string, limit = 4): CreatorMatch[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const seen = new Map<string, CreatorMatch>();
  for (const item of items) {
    for (const credit of item.artistas ?? []) {
      if (!credit.slug || seen.has(credit.slug)) continue;
      const words = tokenize(credit.name);
      if (tokens.every((t) => words.some((w) => w.startsWith(t)))) {
        seen.set(credit.slug, { name: credit.name, slug: credit.slug });
      }
    }
  }
  return [...seen.values()].slice(0, limit);
}
