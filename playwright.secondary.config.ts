import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/secondary",
  workers: 1,
  outputDir: "./test-results/secondary",
  // Reuse only the already-running loopback GMA fixture, whose Supabase Auth is local.
  use: { baseURL: "http://127.0.0.1:4318", channel: "chrome" },
});
