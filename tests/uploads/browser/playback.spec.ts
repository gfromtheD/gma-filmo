import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
for(const kind of ['hls','legacy'])test('real '+kind+' playback: decode, seek and mobile layout',async({page})=>{
 const root=process.env.VIDEO_BROWSER_FIXTURE;test.skip(!root,'Generate fixture with real FFmpeg before media playback tests');
 await page.route('https://gma-filmo-test.supabase.co/**',r=>r.fulfill({json:r.request().url().includes('/auth/')?{id:'11111111-1111-4111-8111-111111111111',email:'test@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}}:[]}));
 await page.route('**/api/**',r=>r.fulfill({json:new URL(r.request().url()).pathname.endsWith('/playback')?{kind:'hls',url:'/__test_hls/master.m3u8',expiresAt:Date.now()+7200000}:{entries:[],ratings:[],comments:[],reviews:[],count:0,average:null}}));
 await page.route('**/__test_hls/**',async r=>{const relative=new URL(r.request().url()).pathname.replace('/__test_hls/','');if(!/^[\w./-]+$/.test(relative)||relative.includes('..'))throw new Error('Invalid fixture path');await r.fulfill({body:await readFile(path.join(root!,'output',relative)),contentType:relative.endsWith('.m3u8')?'application/vnd.apple.mpegurl':'video/mp2t'});});
 await page.route('**/__responsive-video.mp4',async r=>{const buffer=await readFile(path.join(root!,'source')),match=r.request().headers().range?.match(/^bytes=(\d+)-(\d*)$/);if(match){const from=Number(match[1]),to=match[2]?Number(match[2]):buffer.length-1;await r.fulfill({status:206,body:buffer.subarray(from,to+1),contentType:'video/mp4',headers:{'Content-Range':`bytes ${from}-${to}/${buffer.length}`,'Accept-Ranges':'bytes'}});}else await r.fulfill({body:buffer,contentType:'video/mp4',headers:{'Accept-Ranges':'bytes'}});});
 await page.goto('/creadores/responsive-fixture?view='+ (kind==='hls'?'player-hls':'player'));
 const video=page.locator('video').first();await expect(video).toBeAttached();
 await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.readyState),{timeout:30000}).toBeGreaterThanOrEqual(2);
 await video.evaluate((v:HTMLVideoElement)=>v.play());await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeGreaterThan(0.1);
 await page.mouse.move(150,180);await page.getByRole('button',{name:'Pausar',exact:true}).click();
 await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.paused)).toBe(true);
 await video.evaluate((v:HTMLVideoElement)=>{v.currentTime=3;});await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeGreaterThanOrEqual(3);
 expect(await video.evaluate((v:HTMLVideoElement)=>v.paused)).toBe(true);
 await page.setViewportSize({width:320,height:740});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
