import { AGE_RATINGS, CATEGORIES, CREW_ROLES, GENRES, THEMES } from "@/lib/studio/catalogs";
import { listCountries, listLanguages } from "@/lib/studio/geo";
import type { Option } from "./fields";

const same = (items: readonly string[]): Option[] => items.map((v) => ({ value: v, label: v }));

let countries: Option[] | null = null;
let languages: Option[] | null = null;

/** Países y idiomas se calculan una vez, en el navegador (los nombres vienen de `Intl`). */
export const countryOptions = (): Option[] => (countries ??= listCountries().map((c) => ({ value: c.code, label: c.name })));
export const languageOptions = (): Option[] => (languages ??= listLanguages().map((l) => ({ value: l.code, label: l.name })));

export const CATEGORY_OPTIONS = same(CATEGORIES);
export const AGE_OPTIONS = same(AGE_RATINGS);
export const GENRE_OPTIONS = same(GENRES);
export const THEME_OPTIONS = same(THEMES);
export const ROLE_OPTIONS = same(CREW_ROLES);
