import {test,expect} from '@playwright/test';
import {createHash} from 'node:crypto';
const owner='11111111-1111-4111-8111-111111111111',draftId='33333333-3333-4333-8333-333333333333',sid='44444444-4444-4444-8444-444444444444',aid='55555555-5555-4555-8555-555555555555';
test('current UI: real hash worker, direct auxiliary PUT, ready gate and recovery after reload',async({page})=>{
 const file=Buffer.from('1\n00:00:01,000 --> 00:00:02,000\nHola\n');
 const draft={id:draftId,owner_id:owner,purpose:'title',state:'draft',revision:0,metadata:{},title_id:null};
 let session:Record<string,unknown>|null=null,asset:Record<string,unknown>|null=null,received=false,complete=false,reservations=0;
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://gma-filmo-test.supabase.co/**',route=>route.fulfill({json:route.request().url().includes('/auth/')?{id:owner,email:'test@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}}:[]}));
 await page.route('https://test.r2.cloudflarestorage.com/**',async route=>{
   expect(route.request().method()).toBe('PUT');expect(route.request().postDataBuffer()).toEqual(file);received=true;await route.fulfill({status:200});
 });
 await page.route('**/api/**',async route=>{
 const path=new URL(route.request().url()).pathname,method=route.request().method();let json:unknown={};
 if(path==='/api/upload-drafts')json={drafts:[draft]};
 else if(path==='/api/upload-drafts/'+draftId){if(method==='PATCH'){const body=route.request().postDataJSON();draft.metadata=body.metadata;draft.revision++;}json={draft,sessions:session?[session]:[],assets:asset?[asset]:[],media:session?[{asset_id:aid,role:'subtitles',slot:'subtitles:und',language:'und'}]:[]};}
 else if(path==='/api/uploads' && method==='POST'){
   const body=route.request().postDataJSON();expect(body.sha256).toBe(createHash('sha256').update(file).digest('hex'));expect(body.bytes).toBe(file.length);reservations++;
   session={...body,expected_input_bytes:body.bytes,source_sha256:body.sha256,id:sid,asset_id:aid,draft_id:draftId,file_name:'test.srt',owner_id:owner,state:'uploading',provider:'r2',provider_data:{uploadUrl:'https://test.r2.cloudflarestorage.com/ingest?temporary=1'},expires_at:new Date(Date.now()+86400000).toISOString()};
   asset={id:aid,state:'received',provider:'r2',metadata:{}};draft.revision++;json={session};
 }
 else if(path==='/api/uploads/'+sid+'/complete'){expect(received).toBe(true);complete=true;asset={...asset,state:'ready',delivery_path:'/api/media/'+aid};json={asset};}
 else if(path==='/api/uploads/'+sid)json={session,asset};
 await route.fulfill({json});
 });
 await page.goto('/creadores/responsive-fixture?view=studio-upload');await expect(page.locator('[data-ready="studio-upload"]')).toBeVisible();
 await page.locator('input[type=file]').first().setInputFiles({name:'test.srt',mimeType:'text/plain',buffer:file});
 await expect.poll(()=>complete,{timeout:30000}).toBe(true);expect(reservations).toBe(1);
 await expect(page.getByText('test.srt',{exact:true}).first()).toBeVisible();
 await page.reload();await expect(page.getByText('test.srt',{exact:true}).first()).toBeVisible();expect(reservations).toBe(1);
 await page.setViewportSize({width:320,height:740});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
 expect(errors).toEqual([]);
});
