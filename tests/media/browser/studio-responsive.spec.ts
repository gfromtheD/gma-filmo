import { expect, test } from '@playwright/test';
import { authenticateLocal } from '../../responsive/local-auth';
test.beforeEach(async ({page,request})=>{await authenticateLocal(page,request);});

const sizes = [
  { width: 320, height: 568 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];
const views = ['studio-home', 'studio-titles', 'studio-profile', 'studio-upload'];

for (const size of sizes) {
  test(`Studio remains within ${size.width}px viewport`, async ({ page }) => {
    await page.setViewportSize(size);
    for (const view of views) {
      await page.goto(`/creadores/responsive-fixture?view=${view}`);
      await expect(page.locator(`[data-ready="${view}"]`)).toBeVisible();
      await expect.poll(() => page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }))).toEqual({ width: size.width, viewport: size.width });
    }
  });
}
