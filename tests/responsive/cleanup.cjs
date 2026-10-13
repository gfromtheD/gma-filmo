const fs = require('node:fs');
const path = require('node:path');
module.exports = () => {
  const directory = path.resolve(__dirname, '../../app/creadores/responsive-fixture');
  const page = path.join(directory, 'page.tsx');
  if (fs.existsSync(page)) {
    const source = fs.readFileSync(page, 'utf8');
    if (!source.includes('local-fake-token') || !source.includes('export default function Fixture()')) throw new Error('Fixture changed unexpectedly; inspect before deleting.');
    fs.rmSync(directory, { recursive: true });
  }
  // Remove only the types generated for the temporary route.
  fs.rmSync(path.resolve(__dirname, '../../.next/types/app/creadores/responsive-fixture'), { recursive: true, force: true });
};
