import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/uploads/browser',workers:1,timeout:90000,globalTeardown:'./tests/responsive/cleanup.cjs',
 outputDir:'./test-results/uploads',use:{baseURL:'http://127.0.0.1:3219',channel:'chrome'},
 webServer:{command:`"${process.execPath}" tests/responsive/start-server.cjs`,url:'http://127.0.0.1:3219/creadores/responsive-fixture',reuseExistingServer:false,timeout:120000,
 env:{NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_UPLOAD_ENGINE_V2:'true',UPLOAD_ENGINE_V2:'true',NEXT_PUBLIC_SUPABASE_URL:'https://gma-filmo-test.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'local-test-public-key'}}});
