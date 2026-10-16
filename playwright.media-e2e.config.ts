import { defineConfig } from '@playwright/test';

/** Uses the already running, owned local fixture. This config never starts/resets services. */
export default defineConfig({
  testDir: './tests/media/e2e',
  testMatch: '**/*.spec.ts',
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  outputDir: './test-results/media-e2e',
  use: { baseURL: 'http://127.0.0.1:4318', channel: 'chrome', headless: true },
});
