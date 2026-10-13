const fs = require('node:fs');
const path = require('node:path');
module.exports = async function cleanup() {
  for (const name of ['support-flow-test', '__support-test']) {
    const dir = path.resolve(__dirname, '../../app', name);
    const file = path.join(dir, 'page.tsx');
    if (fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes('Directora de prueba')) fs.rmSync(dir, { recursive: true, force: true });
  }
};
