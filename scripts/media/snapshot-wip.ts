/** Private source snapshot outside the repository. Never stages, commits, resets or includes runtime secrets. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { chmod, copyFile, lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const execute=promisify(execFile);
async function main() {
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--output'||!path.isAbsolute(args[1]!))throw new Error('SNAPSHOT_ABSOLUTE_OUTPUT_REQUIRED');
  const repository=await realpath(process.cwd()),target=path.resolve(args[1]!);
  const parent=await realpath(path.dirname(target));
  if(parent===repository||parent.startsWith(repository+path.sep))throw new Error('SNAPSHOT_MUST_BE_OUTSIDE_REPOSITORY');
  await mkdir(target,{mode:0o700});await chmod(target,0o700);
  async function git(args:string[]) {return (await execute('git',args,{cwd:repository,maxBuffer:64*1024**2})).stdout;}
  const head=(await git(['rev-parse','HEAD'])).trim(),branch=(await git(['branch','--show-current'])).trim(),status=await git(['status','--short']);
  const names=(await git(['ls-files','--cached','--others','--exclude-standard','-z'])).split('\0').filter(Boolean);
  const manifest:{file:string;sha256:string;bytes:number}[]=[];
  for(const file of names) {
    if(file.split('/').some(p=>p==='..')||path.isAbsolute(file))throw new Error('SNAPSHOT_PATH_INVALID');
    if(file.startsWith('work/')||file.startsWith('.env')||/\.(?:pem|key|dump)$/.test(file)||file.startsWith('.next'))continue;
    const source=path.join(repository,file),info=await lstat(source);
    if(info.isSymbolicLink()||!info.isFile())continue;
    const body=await readFile(source),destination=path.join(target,'sources',file);
    await mkdir(path.dirname(destination),{recursive:true,mode:0o700});await copyFile(source,destination);await chmod(destination,0o600);
    manifest.push({file,sha256:createHash('sha256').update(body).digest('hex'),bytes:body.length});
  }
  await writeFile(path.join(target,'tracked.patch'),await git(['diff','--binary','HEAD']),{mode:0o600});
  await writeFile(path.join(target,'staged.patch'),await git(['diff','--cached','--binary']),{mode:0o600});
  await writeFile(path.join(target,'manifest.json'),JSON.stringify({head,branch,status,exclusions:['work/','.env*','keys','build caches'],manifest},null,2)+'\n',{mode:0o600});
  if(await git(['status','--short'])!==status||(await git(['rev-parse','HEAD'])).trim()!==head)throw new Error('SNAPSHOT_SOURCE_CHANGED_DURING_CAPTURE');
  for(const item of manifest)if(createHash('sha256').update(await readFile(path.join(target,'sources',item.file))).digest('hex')!==item.sha256)throw new Error('SNAPSHOT_COPY_SHA_MISMATCH');
  console.log(JSON.stringify({head,branch,files:manifest.length,verified:true,stagingChanged:false,runtimeDataExcluded:true}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))void main().catch(()=>{console.error('MEDIA_WIP_SNAPSHOT_FAILED');process.exitCode=1;});
