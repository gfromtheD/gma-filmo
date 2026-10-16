/**
 * Países e idiomas para los selectores de la subida. Se guardan solo los códigos ISO (3166-1 alfa-2 y 639) y los nombres
 * se generan en español con `Intl.DisplayNames`, así no hay que mantener listas de nombres a mano.
 */

const COUNTRY_CODES_A_G =
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY";
const COUNTRY_CODES_H_Z =
  "HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW";

export const COUNTRY_CODES: readonly string[] = `${COUNTRY_CODES_A_G} ${COUNTRY_CODES_H_Z}`.split(" ");

/** Idiomas habituales en el cine independiente. «und» es «Otro». */
export const LANGUAGE_CODES: readonly string[] = (
  "es en ca eu gl ast fr pt it de nl sv da no fi is ga cy gd br oc co sc rm lb mt sq bs hr sr sl mk bg ro hu cs sk pl uk be ru lt lv et " +
  "el tr hy ka az kk ky uz tg tk mn ar he fa ps ku ur hi bn pa gu mr ta te kn ml si ne my km lo th vi id ms tl zh ja ko bo " +
  "sw am so ha yo ig zu xh af mg qu gn nah yua maz eo la ht jv ti rw und"
).split(" ");

function displayNames(type: "region" | "language", locale: string): Intl.DisplayNames | null {
  try {
    return new Intl.DisplayNames([locale], { type });
  } catch {
    return null;
  }
}

export interface GeoOption {
  readonly code: string;
  readonly name: string;
}

function sortedOptions(codes: readonly string[], names: Intl.DisplayNames | null, locale: string, fallback: (c: string) => string): GeoOption[] {
  const collator = new Intl.Collator(locale);
  return codes
    .map((code) => ({ code, name: (names?.of(code) ?? fallback(code)) || code }))
    .sort((a, b) => collator.compare(a.name, b.name));
}

/** Países ordenados por nombre en el idioma dado (por defecto, español). */
export function listCountries(locale = "es"): GeoOption[] {
  return sortedOptions(COUNTRY_CODES, displayNames("region", locale), locale, (c) => c);
}

/** Idiomas ordenados por nombre; «Otro» va siempre al final. */
export function listLanguages(locale = "es"): GeoOption[] {
  const names = displayNames("language", locale);
  const known = LANGUAGE_CODES.filter((c) => c !== "und");
  return [...sortedOptions(known, names, locale, (c) => c), { code: "und", name: "Otro" }];
}

export function countryName(code: string, locale = "es"): string {
  return displayNames("region", locale)?.of(code) ?? code;
}

export function languageName(code: string, locale = "es"): string {
  if (code === "und") return "Otro";
  return displayNames("language", locale)?.of(code) ?? code;
}
