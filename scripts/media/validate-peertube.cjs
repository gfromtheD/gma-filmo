// Offline-only. Dependencies are already present in the project lockfile; never fetch a schema.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const yaml = require('js-yaml');
const Ajv = require('ajv-formats/node_modules/ajv/dist/2020').default;
const root = path.resolve(__dirname, '../../infrastructure/peertube');
const reference = path.join(root, 'reference/v8.3.1');
function merge(base, override) {
  if (override === null || typeof override !== 'object' || Array.isArray(override)) return override;
  const output = { ...base };
  for (const [key, value] of Object.entries(override)) output[key] = merge(output[key], value);
  return output;
}
function validate() {
  const provenance = JSON.parse(fs.readFileSync(path.join(reference, 'provenance.json'), 'utf8'));
  for (const entry of provenance.files) {
    if (!['config-schema.json','default.yaml','production.yaml.example'].includes(entry.file)) throw new Error('REFERENCE_INVALID');
    if (crypto.createHash('sha256').update(fs.readFileSync(path.join(reference,entry.file))).digest('hex') !== entry.sha256) throw new Error('REFERENCE_SHA_MISMATCH');
  }
  const parse = file => yaml.load(fs.readFileSync(file,'utf8'));
  const config = merge(merge(parse(path.join(reference,'default.yaml')),parse(path.join(reference,'production.yaml.example'))),parse(path.join(root,'policy.yaml.example')));
  const schema = JSON.parse(fs.readFileSync(path.join(reference,'config-schema.json'),'utf8'));
  const check = new Ajv({strict:false,allErrors:true}).compile(schema);
  if (!check(config)) {
    // Paths/keywords only; never emit config values or future secrets.
    throw new Error(JSON.stringify(check.errors.map(e=>({path:e.instancePath,keyword:e.keyword}))));
  }
  if (config.tracker.enabled || config.defaults.p2p.webapp.enabled || config.defaults.p2p.embed.enabled || !config.static_files.private_files_require_auth
    || config.defaults.publish.privacy!==3 || config.signup.enabled || config.federation.enabled || !config.transcoding.hls.enabled || config.transcoding.web_videos.enabled
    || config.listen.hostname!=='127.0.0.1') throw new Error('GMA_PRIVATE_POLICY_REQUIRED');
  return { version:'v8.3.1',schemaValidated:true,p2p:false,deployable:false,placeholdersRequireVps:true };
}
module.exports={validate};
if (require.main===module) {
  try {console.log(JSON.stringify(validate()));} catch(error) {console.error(error.message);process.exitCode=1;}
}
