// Playwright serializa JSX para sus fixtures. Estas pruebas de renderizado usan
// el runtime real de React y TypeScript, sin alterar el cargador de la aplicación.
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname, "../..");
const dependencyRequire = createRequire(path.join(root, "package.json"));
const cache = new Map();

function loadReactModule(file) {
  if (file.endsWith(".module.css")) return { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
  const absolute = path.resolve(root, file);
  const resolved = [absolute, `${absolute}.ts`, `${absolute}.tsx`, `${absolute}/index.ts`]
    .find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!resolved) throw new Error(`No se encontró ${file}`);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const module = { exports: {} };
  cache.set(resolved, module);
  const source = ts.transpileModule(fs.readFileSync(resolved, "utf8"), {
    fileName: resolved,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const localRequire = id => id.startsWith("@/") ? loadReactModule(id.slice(2))
    : id.startsWith(".") ? loadReactModule(path.resolve(path.dirname(resolved), id)) : dependencyRequire(id);
  new Function("require", "module", "exports", source)(localRequire, module, module.exports);
  return module.exports;
}
module.exports = { loadReactModule };
