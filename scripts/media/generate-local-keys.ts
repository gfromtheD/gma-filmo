import {generateKeyPairSync} from 'node:crypto';import {mkdir,writeFile} from 'node:fs/promises';import path from 'node:path';
async function main(){const root=path.resolve('work/media-local/keys');await mkdir(root,{recursive:true,mode:0o700});
 const pair=generateKeyPairSync('ed25519');await writeFile(path.join(root,'private.pem'),pair.privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600,flag:'wx'});
 await writeFile(path.join(root,'public.pem'),pair.publicKey.export({type:'spki',format:'pem'}),{mode:0o644,flag:'wx'});
 console.log('Claves locales creadas; privada fuera de Git.');}
void main().catch(()=>{console.error('MEDIA_LOCAL_KEYS_EXIST_OR_UNAVAILABLE');process.exitCode=1;});
