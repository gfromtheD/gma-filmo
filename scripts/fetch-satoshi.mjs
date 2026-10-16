/**
 * Descarga la tipografía Satoshi antes de compilar (`prebuild`).
 *
 * Satoshi (Indian Type Foundry, licencia ITF FFL) no se puede redistribuir en repositorios públicos, así que los `.woff2`
 * no están en git. Este script los baja de Fontshare, su fuente oficial, tal cual y sin modificarlos. Si ya están en
 * `app/fonts/satoshi/` (por ejemplo, en el equipo de desarrollo) no hace nada.
 *
 * `SATOSHI_OUT_DIR` cambia la carpeta de destino (solo para pruebas).
 */
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const CSS_URL = "https://api.fontshare.com/v2/css?f[]=satoshi@1,2&display=swap";
const OUT_DIR = process.env.SATOSHI_OUT_DIR ?? path.join(process.cwd(), "app", "fonts", "satoshi");
const FILES = { normal: "Satoshi-Variable.woff2", italic: "Satoshi-VariableItalic.woff2" };
const MIN_BYTES = 10_000;

const exists = (file) => stat(file).then((s) => s.size > 0, () => false);

/** Extrae, de la hoja de estilos de Fontshare, la URL del .woff2 de cada estilo (normal y cursiva). */
function parseSatoshiCss(css) {
  const urls = {};
  for (const block of css.match(/@font-face\s*\{[^}]*\}/g) ?? []) {
    const style = /font-style:\s*(normal|italic)/.exec(block)?.[1];
    const woff2 = /url\(['"]?([^'")]+\.woff2)['"]?\)/.exec(block)?.[1];
    if (style && woff2 && !urls[style]) urls[style] = woff2.startsWith("//") ? `https:${woff2}` : woff2;
  }
  return urls;
}

async function main() {
  const missing = [];
  for (const [style, name] of Object.entries(FILES)) {
    if (!(await exists(path.join(OUT_DIR, name)))) missing.push(style);
  }
  if (missing.length === 0) {
    console.log("[satoshi] Ya están los archivos de la fuente; no se descarga nada.");
    return;
  }

  console.log(`[satoshi] Descargando la fuente (${missing.join(", ")}) desde Fontshare…`);
  const cssResponse = await fetch(CSS_URL);
  if (!cssResponse.ok) throw new Error(`Fontshare respondió ${cssResponse.status} al pedir la hoja de estilos.`);
  const urls = parseSatoshiCss(await cssResponse.text());

  await mkdir(OUT_DIR, { recursive: true });
  for (const style of missing) {
    const url = urls[style];
    if (!url) throw new Error(`No se encontró la URL de Satoshi (${style}) en la hoja de estilos de Fontshare.`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`No se pudo descargar Satoshi (${style}): ${response.status}.`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < MIN_BYTES) throw new Error(`El archivo de Satoshi (${style}) llegó incompleto (${bytes.length} bytes).`);
    await writeFile(path.join(OUT_DIR, FILES[style]), bytes);
    console.log(`[satoshi] ${FILES[style]}: ${(bytes.length / 1024).toFixed(0)} KB`);
  }
}

main().catch((error) => {
  console.error(`[satoshi] ${error.message}`);
  process.exit(1);
});
