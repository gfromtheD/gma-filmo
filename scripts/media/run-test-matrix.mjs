// Ejecuta una lista de archivos de prueba node:test (vía tsx) de uno en uno, con tiempo límite por archivo,
// y deja un resumen JSON + el log de cada archivo. Pensado para Windows, donde algunas baterías del Mac
// dependen de PostgreSQL, Docker o rutas POSIX y pueden colgarse.
// Uso: node scripts/media/run-test-matrix.mjs <lista.txt> <carpeta-salida> [segundos-por-archivo]
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [listFile, outDir, perFile = '300'] = process.argv.slice(2);
const files = readFileSync(listFile, 'utf8').split(/\r?\n/).filter(Boolean);
mkdirSync(outDir, { recursive: true });
const tsx = path.resolve('node_modules/tsx/dist/cli.mjs');
const summary = [];

function run(file) {
  return new Promise(resolve => {
    const started = Date.now();
    const child = spawn(process.execPath, [tsx, '--test', '--test-concurrency=1', '--test-reporter=tap', file], { env: process.env });
    let out = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { out += d; });
    const timer = setTimeout(() => { out += `\n# TIEMPO AGOTADO tras ${perFile}s\n`; child.kill('SIGKILL'); }, Number(perFile) * 1000);
    child.on('close', code => {
      clearTimeout(timer);
      const num = key => Number((out.match(new RegExp(`^# ${key} (\\d+)`, 'm')) ?? [])[1] ?? 0);
      const failedNames = [...out.matchAll(/^\s*not ok \d+ - (.+)$/gm)].map(m => m[1]).filter(n => !/^tests?\//.test(n));
      resolve({ file, code, seconds: Math.round((Date.now() - started) / 1000), timeout: out.includes('TIEMPO AGOTADO'),
        tests: num('tests'), pass: num('pass'), fail: num('fail'), skipped: num('skipped'), cancelled: num('cancelled'), todo: num('todo'), failedNames, out });
    });
  });
}

for (const file of files) {
  const r = await run(file);
  writeFileSync(path.join(outDir, file.replace(/[\\/]/g, '__') + '.log'), r.out);
  delete r.out;
  summary.push(r);
  console.log(`${r.timeout ? 'TIEMPO' : r.fail || r.cancelled ? 'FALLA ' : 'OK    '} ${file}  pass=${r.pass} fail=${r.fail} skip=${r.skipped} cancel=${r.cancelled} (${r.seconds}s)`);
  writeFileSync(path.join(outDir, 'resumen.json'), JSON.stringify(summary, null, 2));
}
const total = k => summary.reduce((a, r) => a + r[k], 0);
console.log(`\nTOTAL archivos=${summary.length} tests=${total('tests')} pass=${total('pass')} fail=${total('fail')} skip=${total('skipped')} cancel=${total('cancelled')} tiempo_agotado=${summary.filter(r => r.timeout).length}`);
