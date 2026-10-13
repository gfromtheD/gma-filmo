import { test, expect } from "@playwright/test";

test.beforeEach(async ({ context, page }) => {
  await context.addCookies([{ name: "gma_guest", value: "1", domain: "127.0.0.1", path: "/" }]);
  await page.route("https://gma-filmo-test.supabase.co/**", route => route.abort());
  await page.route("**/__support-video.mp4", route => route.fulfill({ status: 204 }));
});
for (const width of [1440, 390]) {
  test(`al terminar hay apoyo sin salto automático, con acceso directo (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/support-flow-test');
    const video = page.locator('video:not([aria-hidden])'); await video.waitFor({ timeout: 20000 });
    await video.evaluate(element => element.dispatchEvent(new Event('ended')));
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Abrir página de apoyo' })).toHaveAttribute('href', /\/creadores\/test-director\/apoyar$/);
    const qr = page.locator('svg').filter({ has: page.locator('title', { hasText: 'Apoyar a Directora de prueba' }) });
    if (width === 1440) await expect(qr).toBeVisible(); else await expect(qr).toBeHidden();
    await expect(page.getByRole('button', { name: 'Siguiente corto' })).toBeVisible();
    await page.waitForTimeout(1100); expect(page.url()).toContain('/support-flow-test');
    await page.getByRole('button', { name: 'Cerrar panel de apoyo' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}
test('sin métodos reales no se abre el panel de apoyo', async ({ page }) => {
  await page.goto('/support-flow-test?empty=1');
  const video = page.locator('video:not([aria-hidden])'); await video.waitFor({ timeout: 20000 });
  await video.evaluate(element => element.dispatchEvent(new Event('ended')));
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('la página móvil muestra destinos externos y copia la dirección sin login', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/support-flow-test?mobile=1');
  await expect(page.getByRole('heading', { name: 'Directora de prueba' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Donar por PayPal' })).toHaveAttribute('href', 'https://paypal.me/testdirector');
  await expect(page.getByRole('link', { name: 'Apoyar en Patreon' })).toHaveAttribute('href', 'https://patreon.com/testdirector');
  await page.getByRole('button', { name: 'Copiar dirección' }).click();
  await expect(page.getByText('Dirección copiada')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
});


test("YouTube abre el apoyo por su evento real de finalización", async ({ page }) => {
  await page.route("https://www.youtube.com/embed/**", route => route.fulfill({ contentType: "text/html", body: "<p>Vídeo de prueba</p>" }));
  await page.route("https://www.youtube.com/iframe_api", route => route.fulfill({ contentType: "application/javascript", body: `window.YT = { Player: class { constructor(iframe, options) { window.finishYouTube = () => options.events.onStateChange({data: 0}); } destroy() {} } }; window.onYouTubeIframeAPIReady();` }));
  await page.goto("/support-flow-test?youtube=1");
  await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { finishYouTube?: () => void }).finishYouTube)), { timeout: 20000 }).toBe(true);
  await page.evaluate(() => (window as unknown as { finishYouTube: () => void }).finishYouTube());
  await expect(page.getByRole("dialog")).toBeVisible();
});


test('la ficha sin métodos no presenta botones de pago', async ({ page }) => {
  await page.goto('/support-flow-test?mobile=1&empty=1');
  await expect(page.getByText('Este creador todavía no tiene métodos de apoyo disponibles.')).toBeVisible();
  await expect(page.locator('a[href*="paypal"], a[href*="patreon"], a[href^="bitcoin:"]')).toHaveCount(0);
});
test('el muro oculta el QR cuando no hay métodos reales', async ({ page }) => {
  await page.goto('/support-flow-test?profile=1&empty=1');
  await expect(page.getByRole('region', { name: 'Apoyar al creador' })).toHaveCount(0);
});
