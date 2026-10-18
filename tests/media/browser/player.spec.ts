import { test, expect } from '@playwright/test';
for (const kind of ['hls', 'mp4']) test(`P01/P02 engine ${kind}: real decode, pause and seek`, async ({ page }) => {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['http://127.0.0.1:3219', 'http://127.0.0.1:54341'].includes(url.origin) || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort();
  });
  await page.goto('/creadores/media-player-fixture?engine=1&kind=' + kind);
  const video = page.locator('video');
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(2);
  await video.evaluate((v: HTMLVideoElement) => v.play());
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(.3);
  await video.evaluate((v: HTMLVideoElement) => { v.pause(); v.currentTime = 5; });
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeCloseTo(5, 0);
  expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
});

test('P01 engine destroys its media element and listeners when the component unmounts', async ({ page }) => {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['http://127.0.0.1:3219', 'http://127.0.0.1:54341'].includes(url.origin) || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort();
  });
  await page.goto('/creadores/media-player-fixture?engine=1&kind=hls');
  const video = page.locator('video');
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState)).toBeGreaterThanOrEqual(2);
  const element = await video.elementHandle();
  await page.getByRole('button', { name: 'Unmount engine' }).click();
  await expect(video).toHaveCount(0);
  expect(await element?.evaluate((node: HTMLVideoElement) => node.paused)).toBe(true);
});

for (const kind of ['hls', 'mp4']) test(`P01/P02 GMA ${kind}: intro, real decode and existing controls`, async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.request.get('/api/media/player-test-fixture/control?kind=' + kind);
  await page.goto('/creadores/media-player-fixture');
  await expect(page.locator('video')).toHaveCount(0);
  const video = page.locator('video').first();
  await expect(video).toBeAttached({ timeout: 15000 });
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 15000 }).toBeGreaterThanOrEqual(2);
  await video.evaluate((v: HTMLVideoElement) => { v.muted = true; return v.play(); });
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(.3);
  await page.mouse.move(100, 100);
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  await video.evaluate((v: HTMLVideoElement) => { v.currentTime = 6; });
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThanOrEqual(6);
});

test('P04 initial unavailable source displays an error and never starts a fictitious clock', async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.request.get('/api/media/player-test-fixture/control?scenario=initial404');
  await page.goto('/creadores/media-player-fixture');
  await expect(page.getByText('Este vídeo ya no está disponible.')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('video')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toBeDisabled();
});

test('P03 GMA exposes real subtitle tracks, cues and only available audio options', async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.request.get('/api/media/player-test-fixture/control?kind=hls');
  await page.goto('/creadores/media-player-fixture');
  const source = await (await page.request.get('/api/titles/media-player-fixture/playback')).json() as { subtitles: Array<{ id: string }> };
  expect(source.subtitles.map(track => track.id)).toEqual(['es', 'en']);
  const video = page.locator('video').first();
  await expect(video).toBeAttached({ timeout: 15000 });
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 15000 }).toBeGreaterThanOrEqual(2);
  await page.getByRole('button', { name: 'Ajustes' }).click();
  await page.getByRole('button', { name: /Español \(es\)/ }).click();
  await video.evaluate((v: HTMLVideoElement) => { v.currentTime = 2; });
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => Array.from(v.textTracks).some(track =>
    track.language === 'es' && track.mode === 'showing' && (track.activeCues?.length ?? 0) > 0))).toBe(true);
  const englishTrack = page.getByRole('button', { name: /English \(en\)/ });
  if (!await englishTrack.isVisible()) await page.getByRole('button', { name: 'Ajustes' }).click();
  await expect(englishTrack).toBeVisible();
  await englishTrack.click();
  await video.evaluate((v: HTMLVideoElement) => { v.currentTime = 6; });
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => Array.from(v.textTracks).some(track =>
    track.language === 'en' && track.mode === 'showing' && (track.activeCues?.length ?? 0) > 0)
    && Array.from(v.textTracks).filter(track => track.mode === 'showing').length === 1)).toBe(true);
  await page.getByRole('button', { name: 'Desactivado', exact: true }).click();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => Array.from(v.textTracks).every(track => track.mode === 'hidden'))).toBe(true);
  await expect(page.getByText('ES Original · 5.1', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Español Castellano', { exact: true })).toHaveCount(0);
  await expect(page.getByText('English · 5.1', { exact: true })).toHaveCount(0);
});

test('P04 expiry renewal preserves paused position without reloading the page', async ({ page }) => {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['http://127.0.0.1:3219', 'http://127.0.0.1:54341'].includes(url.origin) || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort();
  });
  await page.request.get('/api/media/player-test-fixture/control?scenario=renew&kind=hls');
  await page.goto('/creadores/media-player-fixture?engine=1&kind=hls');
  const video = page.locator('video');
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(2);
  await video.evaluate((v: HTMLVideoElement) => { v.currentTime = 5; v.pause(); });
  await expect.poll(async () => ((await (await page.request.get('/api/media/player-test-fixture/metrics')).json()) as { sourceReads: number }).sourceReads,
    { timeout: 10000 }).toBeGreaterThan(1);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 10000 }).toBeGreaterThanOrEqual(4.8);
  expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  expect(page.url()).toContain('engine=1');
});

test('P04 hls.js refreshes exactly once on an expired 401 playback capability', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Native HLS does not expose HTTP status; its denied capability and manual renewal have a separate test.');
  const playbackStatuses: number[] = [];
  page.on('response', response => { if (new URL(response.url()).pathname.endsWith('master.m3u8')) playbackStatuses.push(response.status()); });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['http://127.0.0.1:3219', 'http://127.0.0.1:54341'].includes(url.origin) || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort();
  });
  await page.addInitScript(() => {
    const canPlayType = HTMLMediaElement.prototype.canPlayType;
    HTMLMediaElement.prototype.canPlayType = function (type: string) {
      return type === 'application/vnd.apple.mpegurl' ? '' : canPlayType.call(this, type);
    };
  });
  await page.request.get('/api/media/player-test-fixture/control?scenario=media401&kind=hls');
  await page.goto('/creadores/media-player-fixture?engine=1&kind=hls');
  const video = page.locator('video');
  await page.waitForTimeout(2500);
  const metrics = await (await page.request.get('/api/media/player-test-fixture/metrics')).json() as { sourceReads: number; mediaReads: number };
  expect(metrics, `manifest response statuses: ${playbackStatuses.join(',')}`).toMatchObject({ sourceReads: 2 });
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 15000 }).toBeGreaterThanOrEqual(2);
});

test('P04 denied HLS capability and explicit renewal preserve authorization and restore real decode',async({page,browserName})=>{
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    return ['http://127.0.0.1:3219','http://127.0.0.1:54341'].includes(url.origin)||['data:','blob:'].includes(url.protocol)?route.continue():route.abort();
  });
  await page.request.get('/api/media/player-test-fixture/control?scenario=media401&kind=hls');
  await page.goto('/creadores/media-player-fixture?engine=1&kind=hls');
  const video=page.locator('video');
  await expect.poll(async()=>((await(await page.request.get('/api/media/player-test-fixture/metrics')).json()) as {mediaReads:number}).mediaReads).toBeGreaterThan(0);
  if(browserName==='webkit') {
    // Native media errors have no HTTP status. Observe denial without asserting an unavailable status classification.
    expect(await video.evaluate((v:HTMLVideoElement)=>v.readyState)).toBe(0);
    const before=await(await page.request.get('/api/media/player-test-fixture/metrics')).json() as {sourceReads:number};
    expect(before.sourceReads).toBe(1);
  }
  await page.getByRole('button',{name:'Renew',exact:true}).click();
  await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.readyState),{timeout:15000}).toBeGreaterThanOrEqual(2);
  await video.evaluate(async(v:HTMLVideoElement)=>{v.muted=true;await v.play();});
  await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.currentTime),{timeout:10000}).toBeGreaterThan(0.2);
});

test('P01/P03 HLS gateway accepts CORS and byte Range for a real segment', async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.request.get('/api/media/player-test-fixture/control?kind=hls');
  await page.goto('/creadores/media-player-fixture?engine=1&kind=hls');
  const source = await (await page.request.get('/api/media/player-test-fixture/source?kind=hls')).json() as { url: string };
  const metrics = await (await page.request.get('/api/media/player-test-fixture/metrics')).json() as { gatewayOrigin: string };
  const sourceUrl = new URL(source.url, 'http://127.0.0.1:3219');
  const masterUrl = new URL(sourceUrl.pathname.replace('/api/media/player-test-fixture', '') + sourceUrl.search, metrics.gatewayOrigin).href;
  const origin = 'http://127.0.0.1:3219';
  const masterResponse = await page.request.get(masterUrl, { headers: { Origin: origin } });
  const master = await masterResponse.text();
  const variant = new URL(master.split('\n').find(line => line && !line.startsWith('#'))!, masterUrl).href;
  const playlistResponse = await page.request.get(variant, { headers: { Origin: origin } });
  const playlist = await playlistResponse.text();
  const segment = new URL(playlist.split('\n').find(line => line && !line.startsWith('#'))!, variant).href;
  const response = await page.request.get(segment, { headers: { Origin: origin, Range: 'bytes=0-31' } });
  const result = { status: response.status(), contentRange: response.headers()['content-range'],
    allowOrigin: response.headers()['access-control-allow-origin'], size: (await response.body()).byteLength };
  expect(result.status).toBe(206);
  expect(result.contentRange).toMatch(/^bytes 0-31\//);
  expect(result.allowOrigin).toBe(origin);
  expect(result.size).toBe(32);
});

test('Player keeps its controls and layout within 320, 768 and 1440 px', async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.request.get('/api/media/player-test-fixture/control?kind=mp4');
  await page.goto('/creadores/media-player-fixture');
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: width === 320 ? 640 : 900 });
    const video = page.locator('video').first();
    await expect(video).toBeAttached({ timeout: 15000 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'Ajustes' })).toBeAttached();
  }
});
