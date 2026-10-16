// This public fixture is generated only for local tests and removed on server exit.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const directory = path.join(root, 'app/creadores/responsive-fixture');
// Dedicated test cache only; avoid stale development chunks after changing local public env.
fs.rmSync(path.join(root, '.next-responsive'), { recursive: true, force: true });
if (fs.existsSync(directory)) throw new Error('Responsive fixture already exists; inspect before replacing.');
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(path.join(directory,'page.tsx'), `// Temporary local fixture: gma-responsive-local-session
import { Suspense } from 'react';
import ResponsiveFixture from '@/tests/responsive/fixture';
export default function Fixture() { return <Suspense fallback={<p>Preparando prueba local…</p>}><ResponsiveFixture /></Suspense>; }
`);
const environment = {};
for (const line of fs.readFileSync(path.join(root, '.env.media.local'), 'utf8').split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue;
  const at = line.indexOf('='); environment[line.slice(0, at)] = JSON.parse(line.slice(at + 1));
}
if (environment.NEXT_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:54341' || environment.MEDIA_LOCAL_PROJECT_ID !== 'gma-filmo-media-local') throw new Error('Local Auth fixture required');
const runtime = { ...process.env, ...environment,
  NODE_ENV: 'production', NEXT_DIST_DIR: '.next-responsive', NEXT_TELEMETRY_DISABLED: '1',
  NEXT_FONT_GOOGLE_MOCKED_RESPONSES: path.join(root, 'work/media-local/fonts/google-font-responses.cjs'),
};
// Production chunks remove development eval/HMR variability while preserving the actual components.
let closing = false;
let server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'build'], { cwd: root, stdio: 'inherit', env: runtime });
function cleanup() {
  const page = path.join(directory, 'page.tsx');
  if (fs.existsSync(page) && !fs.readFileSync(page,'utf8').includes('gma-responsive-local-session')) throw new Error('Unexpected fixture contents');
  fs.rmSync(directory, { recursive: true, force: true });
}
function stop() { closing = true; server.kill('SIGTERM'); cleanup(); }
process.on('SIGTERM', stop); process.on('SIGINT', stop);
server.once('exit', code => {
  if (closing || code !== 0) { cleanup(); process.exit(code ?? 0); }
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3219'], { cwd: root, stdio: 'inherit', env: runtime });
  server.on('exit', code => { cleanup(); process.exit(code ?? 0); });
});
