// Optional macOS test runner: PG_BIN_DIR points to independently installed PostgreSQL binaries.
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import path from 'node:path';
const bin=process.env.PG_BIN_DIR,root=process.env.UPLOAD_TEST_TEMP;
if(!bin||!root)throw new Error('Set PG_BIN_DIR and UPLOAD_TEST_TEMP inside the isolated workspace');
const data=mkdtempSync(path.join(root,'pg-upload-'));
function run(executable,args){const result=spawnSync(executable,args,{stdio:'inherit',env:process.env});if(result.status!==0)throw new Error(executable+' failed');}
try {
 run(path.join(bin,'initdb'),['-D',data,'-U','gma_test','--auth=trust','--no-locale','-E','UTF8']);
 run(path.join(bin,'pg_ctl'),['-D',data,'-l',path.join(data,'server.log'),'-o','-h 127.0.0.1 -p 55439 -k '+data,'-w','start']);
 const result=spawnSync(process.execPath,['--import','tsx','--test','tests/uploads/concurrency.test.ts'],{stdio:'inherit',env:{...process.env,UPLOAD_TEST_DATABASE_URL:'postgresql://gma_test@127.0.0.1:55439/postgres',UPLOAD_TEST_DATABASE_ISOLATED:'true'}});
 if(result.status!==0)process.exitCode=1;
}finally {
 spawnSync(path.join(bin,'pg_ctl'),['-D',data,'-m','immediate','-w','stop'],{stdio:'inherit'});
 rmSync(data,{recursive:true,force:true});
}
