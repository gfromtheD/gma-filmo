// Offline validation only. Never contacts or provisions a server; never prints secret values.
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const Ajv = require('ajv-formats/node_modules/ajv/dist/2020').default;
const { validate } = require('./validate-peertube.cjs');
function merge(base, override) {
  if (override === null || typeof override !== 'object' || Array.isArray(override)) return override;
  const value = { ...base };
  for (const [key, item] of Object.entries(override)) value[key] = merge(value[key], item);
  return value;
}
try {
  if (process.argv.length !== 2) throw new Error('PRIVATE_LAB_ARGUMENTS_FORBIDDEN');
  validate(); // Verify pinned cached references and the original private GMA policy first.
  const root = path.resolve(__dirname, '../../infrastructure/peertube');
  const load = file => yaml.load(fs.readFileSync(path.join(root, file), 'utf8'));
  const config = ['reference/v8.3.1/default.yaml', 'reference/v8.3.1/production.yaml.example', 'policy.yaml.example', 'private-lab.yaml.example']
    .map(load).reduce(merge, {});
  const schema = JSON.parse(fs.readFileSync(path.join(root, 'reference/v8.3.1/config-schema.json'), 'utf8'));
  const check = new Ajv({ strict: false, allErrors: true }).compile(schema);
  if (!check(config)) throw new Error('PRIVATE_LAB_SCHEMA_INVALID');
  if (config.listen.hostname !== '127.0.0.1' || config.listen.port !== 9000
    || config.webserver.hostname !== '127.0.0.1' || config.webserver.https !== false || config.webserver.port !== 9000
    || config.database.hostname !== '127.0.0.1' || config.database.suffix !== '_gma_lab' || config.database.username !== 'peertube_lab'
    || config.redis.hostname !== '127.0.0.1' || config.tracker.enabled || config.signup.enabled || config.federation.enabled
    || config.defaults.p2p.webapp.enabled || config.defaults.p2p.embed.enabled || !config.static_files.private_files_require_auth
    || !config.transcoding.hls.enabled || config.defaults.publish.privacy !== 3) throw new Error('PRIVATE_LAB_POLICY_INVALID');
  if (config.database.password !== 'REPLACE_OUTSIDE_GIT_BEFORE_START' || config.redis.auth !== 'REPLACE_OUTSIDE_GIT_BEFORE_START') throw new Error('PRIVATE_LAB_TEMPLATE_HAS_RUNTIME_VALUES');
  console.log(JSON.stringify({ version: 'v8.3.1', schemaValidated: true, loopbackOnly: true, disposable: true, p2p: false, deployable: false, provisioned: false }));
} catch (error) {
  console.error(error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : 'PRIVATE_LAB_VALIDATION_FAILED');
  process.exitCode = 1;
}
