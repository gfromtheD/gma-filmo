import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/secondary",
  workers: 1,
  outputDir: "./test-results/secondary",
  use: { baseURL: "http://127.0.0.1:3217", channel: "chrome" },
  webServer: {
    command: `"${process.execPath}" node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3217`,
    url: "http://127.0.0.1:3217",
    reuseExistingServer: false,
    timeout: 120_000,
    // Datos ficticios solo para el servidor de pruebas, sin cuentas o escrituras reales.
    env: {
      NEXT_TELEMETRY_DISABLED: "1",
      NEXT_PUBLIC_SUPABASE_URL: "https://gma-filmo-test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-test-public-key",
    },
  },
});
