import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/responsive",
  workers: 1,
  globalTeardown: "./tests/responsive/cleanup.cjs",
  timeout: 180_000,
  outputDir: "./test-results/responsive",
  use: { baseURL: "http://127.0.0.1:3219", channel: "chrome", hasTouch: true, isMobile: true, actionTimeout: 7_000 },
  webServer: {
    command: `"${process.execPath}" tests/responsive/start-server.cjs`,
    url: "http://127.0.0.1:3219/creadores/responsive-fixture",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { NEXT_TELEMETRY_DISABLED: "1", NEXT_DIST_DIR: ".next-responsive", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54341", NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-test-public-key" },
  },
});
