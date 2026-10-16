import type { APIRequestContext, Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/** Session issuance is always real local GoTrue; no invented JWT or remote endpoint. */
export async function authenticateLocal(page:Page,request:APIRequestContext) {
  const env:Record<string,string>={};
  for(const line of (await readFile(path.resolve('.env.media.local'),'utf8')).split(/\r?\n/)) {
    if(!line||line.startsWith('#'))continue;const at=line.indexOf('=');const value:unknown=JSON.parse(line.slice(at+1));
    if(typeof value!=='string')throw new Error('LOCAL_AUTH_ENV_INVALID');env[line.slice(0,at)]=value;
  }
  if(env.NEXT_PUBLIC_SUPABASE_URL!=='http://127.0.0.1:54341'||env.MEDIA_LOCAL_PROJECT_ID!=='gma-filmo-media-local')throw new Error('LOCAL_AUTH_REQUIRED');
  const response=await request.post('http://127.0.0.1:54341/auth/v1/token?grant_type=password',{
    headers:{apikey:env.NEXT_PUBLIC_SUPABASE_ANON_KEY!},data:{email:'gma.creator-a@example.invalid',password:env.MEDIA_LOCAL_TEST_PASSWORD},
  });
  if(response.status()!==200)throw new Error(`LOCAL_AUTH_HTTP_${response.status()}`);
  const session=await response.json() as {access_token:string;refresh_token:string;user:{id:string}};
  if(!/^[a-f0-9-]{36}$/.test(session.user.id))throw new Error('LOCAL_AUTH_USER_REQUIRED');
  const serialized=JSON.stringify({access_token:session.access_token,refresh_token:session.refresh_token});
  await page.addInitScript({content:`sessionStorage.setItem('gma-responsive-local-session',${JSON.stringify(serialized)});`});
  return session.user.id;
}
