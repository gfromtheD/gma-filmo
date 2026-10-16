import { defineConfig } from '@playwright/test';
import studio from './playwright.studio.config';
export default defineConfig({
  testDir: './tests/media/browser', testMatch: 'player.spec.ts', workers: 1, timeout: 45000,
  outputDir: './test-results/media-player', globalTeardown: './tests/media/browser/cleanup.cjs',
  use: { baseURL: 'http://127.0.0.1:3219' },
  projects: [ { name: 'chromium', use: { browserName: 'chromium', channel: 'chrome' } },
    { name: 'webkit', use: { browserName: 'webkit' } }, { name: 'firefox', use: { browserName: 'firefox' } } ],
  webServer: { command: `"${process.execPath}" --import tsx tests/media/browser/start-server.ts`,
    url: 'http://127.0.0.1:3219/creadores/media-player-fixture', timeout: 120000, reuseExistingServer: false,
    env: { ...(Array.isArray(studio.webServer) ? {} : studio.webServer?.env), NODE_ENV: 'production', NEXT_DIST_DIR: '.next-player', NEXT_FONT_GOOGLE_MOCKED_RESPONSES: process.cwd() + '/work/media-local/fonts/google-font-responses.cjs' } },
});
