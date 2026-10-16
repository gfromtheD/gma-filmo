import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/uploads/browser',workers:1,timeout:90000,globalTeardown:'./tests/responsive/cleanup.cjs',
 outputDir:'./test-results/uploads',use:{baseURL:'http://127.0.0.1:3219',channel:'chrome'},
 webServer:{command:`"${process.execPath}" tests/responsive/start-server.cjs`,url:'http://127.0.0.1:3219/creadores/responsive-fixture',reuseExistingServer:false,timeout:120000,
 env:{NEXT_TELEMETRY_DISABLED:'1',UPLOAD_ENVIRONMENT:'local',UPLOAD_ISOLATION_ACK:'true',MEDIA_LOCAL_PROJECT_ID:'gma-filmo-media-local',MEDIA_LOCAL_ISOLATED:'true',
   NEXT_PUBLIC_UPLOAD_ENGINE_V2:'true',UPLOAD_ENGINE_V2:'true',MEDIA_VIDEO_PROVIDER:'mock',MEDIA_AUXILIARY_PROVIDER:'mock',MEDIA_MOCK_ENABLED:'true',
   PEERTUBE_PROVIDER_ENABLED:'false',STREAM_PROVIDER_ENABLED:'false',SUPABASE_URL:'http://127.0.0.1:54341',
   NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54341',NEXT_PUBLIC_SUPABASE_ANON_KEY:'local-test-public-key',MEDIA_GATEWAY_URL:'http://127.0.0.1:4319'}}});
