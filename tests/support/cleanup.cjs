const fs = require('node:fs');
const path = require('node:path');
module.exports = async function cleanup() {
  for (const name of ['support-flow-test', '__support-test']) {
    const dir = path.resolve(__dirname, '../../app', name);
    const file = path.join(dir, 'page.tsx');
    if (fs.existsSync(file)) { if (!fs.readFileSync(file, 'utf8').includes('Directora de prueba')) throw new Error('Unexpected support fixture'); fs.rmSync(dir, { recursive: true }); }
    fs.rmSync(path.resolve(__dirname, '../../.next-support/types/app', name), { recursive: true, force: true });
  }
};
