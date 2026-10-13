// This public fixture is generated only for local tests and removed on server exit.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const directory = path.join(root, 'app/creadores/responsive-fixture');
if (fs.existsSync(directory)) throw new Error('Responsive fixture already exists; inspect before replacing.');
fs.mkdirSync(directory, { recursive: true });
fs.copyFileSync(path.join(__dirname, 'fixture.tsx'), path.join(directory, 'page.tsx'));
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3219'], { cwd: root, stdio: 'inherit' });
function cleanup() { fs.rmSync(directory, { recursive: true, force: true }); }
process.on('SIGTERM', () => { cleanup(); server.kill('SIGTERM'); });
process.on('SIGINT', () => { cleanup(); server.kill('SIGINT'); });
server.on('exit', code => { cleanup(); process.exit(code ?? 0); });
