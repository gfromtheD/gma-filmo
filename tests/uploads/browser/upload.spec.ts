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

test('multipart: lost part response, reload, full SHA reselection and expired part URL recover without reuploading received part',async({page})=>{
 const partSize=16*1024**2,file=Buffer.alloc(partSize+100,7),sha=createHash('sha256').update(file).digest('hex');
 const draft={id:draftId,owner_id:owner,purpose:'title',state:'draft',revision:0,metadata:{},title_id:null};
 let session:Record<string,unknown>|null=null,asset:Record<string,unknown>|null=null,reservations=0,phase=0,complete=false,secondAttempts=0,expiredJwt=false,refreshes=0;
 const received=new Set<number>(),puts:number[]=[];
 await page.route('https://gma-filmo-test.supabase.co/**',route=>{
  const user={id:owner,email:'test@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}};
  if(route.request().url().includes('/token?')){refreshes++;const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');const token=encode({alg:'HS256',typ:'JWT'})+'.'+encode({exp:Math.floor(Date.now()/1000)+3600,sub:owner,aud:'authenticated',role:'authenticated'})+'.test';return route.fulfill({json:{access_token:token,refresh_token:'local-fake-token',expires_in:3600,token_type:'bearer',user}});}
  return route.fulfill({json:route.request().url().includes('/auth/')?user:[]});
 });
 await page.route('https://test.r2.cloudflarestorage.com/**',async route=>{
  const number=Number(new URL(route.request().url()).searchParams.get('partNumber'));puts.push(number);
  if(number===1){received.add(1);await route.abort('failed');return;}
  if(phase===0){await route.abort('failed');return;}
  if(secondAttempts++===0){await route.fulfill({status:403});return;}
  expect(route.request().postDataBuffer()).toEqual(file.subarray(partSize));received.add(2);await route.fulfill({status:200});
 });
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname,method=route.request().method();let json:unknown={};
  if(path==='/api/upload-drafts')json={drafts:[draft]};
  else if(path==='/api/upload-drafts/'+draftId){if(method==='PATCH'){draft.metadata=route.request().postDataJSON().metadata;draft.revision++;}json={draft,sessions:session?[session]:[],assets:asset?[asset]:[],media:session?[{asset_id:aid,role:'trailer',slot:'trailer'}]:[]};}
  else if(path==='/api/uploads'&&method==='POST'){
   const body=route.request().postDataJSON();expect(body.sha256).toBe(sha);expect(body.role).toBe('trailer');reservations++;
   session={...body,id:sid,owner_id:owner,draft_id:draftId,asset_id:aid,expected_input_bytes:file.length,source_sha256:sha,state:'uploading',provider:'r2',multipart_upload_id:'r2-upload',part_size:partSize,transfer_generation:1,provider_data:{},expires_at:new Date(Date.now()+86400000).toISOString()};
   asset={id:aid,state:'received',provider:'r2',metadata:{}};json={session};
  }else if(path==='/api/uploads/'+sid+'/resume'){
   const body=route.request().postDataJSON();if(body.sha256!==sha){await route.fulfill({status:400,json:{error:'UPLOAD_SOURCE_MISMATCH'}});return;}json={session};
  }else if(path==='/api/uploads/'+sid+'/parts')json={upload:{parts:Array.from(received,n=>({number:n,size:n===1?partSize:100,etag:'r2-'+n})),complete:false,partSize,generation:1}};
  else if(path==='/api/uploads/'+sid+'/part'){if(phase===1&&!expiredJwt){expiredJwt=true;await route.fulfill({status:401,json:{error:'UPLOAD_UNAUTHORIZED'}});return;}const n=route.request().postDataJSON().number;json={part:{number:n,size:n===1?partSize:100,url:'https://test.r2.cloudflarestorage.com/ingest?partNumber='+n+'&renew='+secondAttempts}};}
  else if(path==='/api/uploads/'+sid+'/complete'){expect(received.size).toBe(2);complete=true;asset={...asset,state:'ready',delivery_path:'/api/media/'+aid+'/hls/master.m3u8',duration_seconds:10};json={asset};}
  else if(path==='/api/uploads/'+sid)json={session,asset};
  await route.fulfill({json});
 });
 await page.goto('/creadores/responsive-fixture?view=studio-upload');await expect(page.locator('[data-ready="studio-upload"]')).toBeVisible();
 await page.locator('input[accept="video/*"]').first().setInputFiles({name:'multipart.mp4',mimeType:'video/mp4',buffer:file});
 await expect.poll(()=>received.has(1),{timeout:30000}).toBe(true);
 await page.reload();phase=1;
 const continueButton=page.getByRole('button',{name:'Continuar multipart.mp4'});await expect(continueButton).toBeVisible();
 const wrongChooser=await Promise.all([page.waitForEvent('filechooser'),continueButton.click()]);await wrongChooser[0].setFiles({name:'different.mp4',mimeType:'video/mp4',buffer:Buffer.from('wrong')});
 await expect(page.getByText('UPLOAD_SOURCE_MISMATCH',{exact:true})).toBeVisible();
 const chooser=await Promise.all([page.waitForEvent('filechooser'),page.getByRole('button',{name:'Continuar different.mp4'}).click()]);await chooser[0].setFiles({name:'multipart.mp4',mimeType:'video/mp4',buffer:file});
 await expect.poll(()=>complete,{timeout:30000}).toBe(true);
 expect(reservations).toBe(1);expect(puts.filter(n=>n===1)).toHaveLength(1);expect(secondAttempts).toBe(2);expect(refreshes).toBe(1);
 await page.setViewportSize({width:320,height:740});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
