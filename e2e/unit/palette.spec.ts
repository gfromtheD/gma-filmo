import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

/**
 * Paleta de la interfaz: un negro casi neutro (con un toque mínimo de violeta) sobre el que flota el fondo de aurora, definida
 * UNA vez en `app/globals.css` como variables del tema (`--gma-*`). El resto del código usa esas variables: cambiar de paleta es
 * cambiar estos valores. Este test revisa el código fuente. Quedan fuera las paletas de portadas generadas
 * (`queries.ts`, `studio-data.ts`), que son arte y no interfaz.
 */
const ROOT = path.resolve(__dirname, "..", "..");
const DIRS = ["app", "components", "lib", "hooks"];
const EXTENSIONS = new Set([".ts", ".tsx", ".css"]);
const SKIP_DIRS = new Set(["fonts", "data"]);
const SKIP_FILES = new Set(["queries.ts", "studio-data.ts", "globals.css"]);

const TOKENS = {
  bg: "#070709",
  "surface-2": "#0E0E11",
  panel: "#141417",
  surface: "#1C1C21",
  border: "#26262B",
  "line-strong": "#33333A",
} as const;

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : sourceFiles(full);
    return EXTENSIONS.has(path.extname(entry.name)) && !SKIP_FILES.has(entry.name) ? [full] : [];
  });
}

/** Un gris oscuro sin tinte, o un oscuro azulado: lo que ya no debe aparecer suelto en los componentes. */
const isStrayDark = (r: number, g: number, b: number) =>
  (r === g && g === b && r >= 3 && r <= 0x48) || (Math.max(r, g, b) <= 0x48 && b >= g && b - r >= 4);

function strayDarkColors(source: string): string[] {
  const found: string[] = [];
  for (const m of source.matchAll(/#([0-9a-fA-F]{6})(?![0-9a-fA-F])/g)) {
    const h = m[1]!;
    if (isStrayDark(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16))) found.push(`#${h}`);
  }
  for (const m of source.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) {
    if (isStrayDark(+m[1]!, +m[2]!, +m[3]!)) found.push(m[0]);
  }
  return found;
}

test.describe("paleta negra con aurora", () => {
  const css = fs.readFileSync(path.join(ROOT, "app", "globals.css"), "utf8");
  const files = DIRS.flatMap((dir) => sourceFiles(path.join(ROOT, dir)));

  for (const [name, value] of Object.entries(TOKENS)) {
    test(`el tema define --gma-${name}: ${value}`, () => {
      expect(css).toMatch(new RegExp(`--gma-${name}:\\s*${value}`, "i"));
      expect(css).toMatch(new RegExp(`--color-gma-${name}:\\s*var\\(--gma-${name}\\)`));
    });
  }

  test("el negro de la página sale del tema y la plataforma monta la aurora, sin colores sueltos", () => {
    expect(css).toMatch(/--background:\s*var\(--gma-bg\)/);
    const shell = fs.readFileSync(path.join(ROOT, "components", "layout", "app-shell.tsx"), "utf8");
    expect(shell).toMatch(/<SiteAurora/);
    expect(shell).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  test("ningún componente lleva colores oscuros sueltos (grises sin tinte u oscuros azulados): usan las variables", () => {
    const offenders = files
      .map((file) => ({ file: path.relative(ROOT, file), colors: [...new Set(strayDarkColors(fs.readFileSync(file, "utf8")))] }))
      .filter((o) => o.colors.length > 0)
      .map((o) => `${o.file}: ${o.colors.join(", ")}`);
    expect(offenders).toEqual([]);
  });
});
