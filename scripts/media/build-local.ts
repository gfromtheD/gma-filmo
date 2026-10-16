/** Build the real Next application with the owned local environment, never hosted credentials. */
import { spawn } from 'node:child_process';
import { readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { localEnvironment } from './local-tools';
import { isolatedEnvironment } from './local-stack';

async function main() {
  const environment = await localEnvironment(), keys = new Set<string>();
  try {
    const state:unknown=JSON.parse(await readFile('work/media-local/process-state.json','utf8'));
    if(state && typeof state==='object' && 'ready'in state && state.ready===true)throw new Error('MEDIA_LOCAL_BUILD_STOP_STACK_FIRST');
  } catch(error:unknown) {if(!error||typeof error!=='object'||!('code'in error)||error.code!=='ENOENT')throw error;}
  for (const name of ['.env', '.env.local', '.env.production', '.env.production.local', '.env.development', '.env.development.local']) {
    try { for (const match of (await readFile(name, 'utf8')).matchAll(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/gm)) keys.add(match[1]!); }
    catch (error: unknown) { if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') throw error; }
  }
  for (const directory of ['app/creadores/responsive-fixture', 'app/creadores/media-player-fixture', 'app/support-flow-test', 'app/api/media/player-test-fixture', 'app/api/titles/media-player-fixture']) {
    try { await lstat(directory); throw new Error('MEDIA_LOCAL_BUILD_TEMPORARY_ROUTE_PRESENT'); }
    catch (error: unknown) { if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') throw error; }
  }
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'build'], {
    stdio: 'inherit', env: { ...isolatedEnvironment(process.env, environment, [...keys]), NODE_ENV: 'production', NEXT_DIST_DIR: '.next',
      NEXT_FONT_GOOGLE_MOCKED_RESPONSES: path.resolve('work/media-local/fonts/google-font-responses.cjs') },
  });
  for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => child.kill(signal));
  child.on('error', () => { console.error('MEDIA_LOCAL_BUILD_PROCESS_FAILED'); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
}
void main().catch((error:unknown) => { console.error(error instanceof Error && error.message.startsWith('MEDIA_') ? error.message : 'MEDIA_LOCAL_BUILD_FAILED'); process.exitCode = 1; });
