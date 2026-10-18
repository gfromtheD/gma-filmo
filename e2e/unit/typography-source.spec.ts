import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

/**
 * Una sola familia tipográfica en toda la web: Satoshi (y sus variantes de peso y cursiva). Este test revisa el código
 * fuente: no debe quedar ninguna otra fuente (Manrope, serif, monoespaciadas, pilas del sistema ni next/font/google).
 */
const ROOT = path.resolve(__dirname, "..", "..");
// `lib/data` es contenido (sinopsis, títulos), no estilos: allí «Georgia» puede ser el estado de EE. UU.
const DIRS = ["app", "components", "lib", "hooks"];
const SKIP_DIRS = new Set(["fonts", "data"]);
// El HTML de «Descargar mis datos» se abre fuera de la web: usa la fuente del sistema a propósito, porque la licencia
// de Satoshi (ITF FFL) prohíbe entregar la fuente a terceros, y un archivo descargado no puede cargarla.
const SKIP_FILES = new Set([path.join("lib", "export", "user-data.ts")]);
const EXTENSIONS = new Set([".ts", ".tsx", ".css"]);

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : sourceFiles(full);
    if (SKIP_FILES.has(path.relative(ROOT, full))) return [];
    return EXTENSIONS.has(path.extname(entry.name)) ? [full] : [];
  });
}

const FORBIDDEN: ReadonlyArray<readonly [string, RegExp]> = [
  ["Manrope", /Manrope/i],
  ["Instrument Serif", /Instrument[ _]?Serif/i],
  ["Georgia / Times", /Georgia|Times New Roman/i],
  // Se permiten `sans-serif` y los nombres de variable `--font-serif` / `--font-mono` (que apuntan a Satoshi).
  ["serif (distinta de sans-serif)", /(?<!sans-|--font-)serif/i],
  ["monoespaciada", /ui-monospace|Cascadia|monospace|(?<!--)font-mono|Courier|Consolas|Menlo/i],
  ["pila del sistema", /BlinkMacSystemFont|Segoe UI|-apple-system|Helvetica|Arial|Roboto|\bInter\b/],
  ["fuentes de Google", /next\/font\/google/],
];

test.describe("tipografía única: Satoshi", () => {
  const files = DIRS.flatMap((dir) => sourceFiles(path.join(ROOT, dir)));

  for (const [label, pattern] of FORBIDDEN) {
    test(`el código no usa: ${label}`, () => {
      const offenders = files.filter((file) => pattern.test(fs.readFileSync(file, "utf8"))).map((f) => path.relative(ROOT, f));
      expect(offenders, `aparece en: ${offenders.join(", ")}`).toEqual([]);
    });
  }

  test("el layout carga Satoshi en local (next/font/local) con peso variable y cursiva", () => {
    const layout = fs.readFileSync(path.join(ROOT, "app", "layout.tsx"), "utf8");
    expect(layout).toMatch(/next\/font\/local/);
    expect(layout).toMatch(/Satoshi-Variable\.woff2/);
    expect(layout).toMatch(/Satoshi-VariableItalic\.woff2/);
    expect(layout).toMatch(/--font-satoshi/);
  });

  test("las variables de fuente de Tailwind apuntan todas a Satoshi", () => {
    const css = fs.readFileSync(path.join(ROOT, "app", "globals.css"), "utf8");
    for (const name of ["--font-sans", "--font-heading", "--font-mono", "--font-serif"]) {
      const line = css.split("\n").find((l) => l.trim().startsWith(`${name}:`));
      expect(line, `falta ${name}`).toBeTruthy();
      expect(line).toContain("var(--font-satoshi)");
    }
  });

  test("la licencia FFL viaja con los archivos de la fuente y estos no se suben al repositorio público", () => {
    expect(fs.existsSync(path.join(ROOT, "app", "fonts", "satoshi", "FFL.txt"))).toBe(true);
    const ignore = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
    expect(ignore).toMatch(/app\/fonts\/satoshi\/\*\.woff2/);
  });
});
