import { S3Client } from "@aws-sdk/client-s3";

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const R2_BUCKET     = process.env.CLOUDFLARE_R2_BUCKET ?? "gma-media";
export const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev";

// Per-asset upload caps (bytes)
export const UPLOAD_CAPS: Record<string, number> = {
  main:      4  * 1024 ** 3,      // 4 GB
  trailer:   1  * 1024 ** 3,      // 1 GB
  extras:    1  * 1024 ** 3,      // 1 GB
  intro:     500 * 1024 * 1024,   // 500 MB
  poster:    10  * 1024 * 1024,   // 10 MB
  poster_h:  10  * 1024 * 1024,   // 10 MB
  poster_v:  10  * 1024 * 1024,   // 10 MB
  subtitles: 5   * 1024 * 1024,   // 5 MB
};

export const SESSION_CAP = 6  * 1024 ** 3;  // 6 GB per upload session
export const FREE_QUOTA  = 10 * 1024 ** 3;  // 10 GB total free tier
