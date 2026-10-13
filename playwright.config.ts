import { defineConfig } from "@playwright/test";

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    channel: "chrome",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
