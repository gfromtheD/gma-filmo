import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/support", workers: 1, globalTeardown: "./tests/support/cleanup.cjs",
  use: { baseURL: "http://127.0.0.1:3218", channel: "chrome" },
  webServer: {
    command: `"${process.execPath}" tests/support/start-server.cjs`, url: "http://127.0.0.1:3218", timeout: 120000,
    env: { NEXT_PUBLIC_SUPABASE_URL: "https://gma-filmo-test.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-test-public-key", NEXT_TELEMETRY_DISABLED: "1" },
  },
});
