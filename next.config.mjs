/** @type {import("next").NextConfig} */

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "pub-580903d2b97f4b4e8810af8c9432d80a.r2.dev";

// Extract bare hostname from a full URL ("https://pub-xxx.r2.dev" → "pub-xxx.r2.dev")
const r2Hostname = R2_PUBLIC_URL.replace(/^https?:\/\//, "").split("/")[0];

// ── Content Security Policy ────────────────────────────────────────────────────
// `unsafe-inline` in script-src is required by Next.js App Router (inline
// hydration scripts). `unsafe-eval` is needed by some Next.js internals.
// To remove both, a nonce-based approach is needed — future hardening pass.
const ContentSecurityPolicy = [
  "default-src 'self'",
  // Allow inline scripts only from this origin (Next.js hydration requirement)
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  // Tailwind generates inline styles at runtime
  "style-src 'self' 'unsafe-inline'",
  // Images: local + R2 bucket + Cloudflare + legacy thumbnails from generacionmaldita.com
  `img-src 'self' data: blob: *.r2.dev ${r2Hostname} *.cloudflarestream.com videodelivery.net imagedelivery.net generacionmaldita.com images.unsplash.com`,
  // Video: R2 MP4s + Cloudflare Stream HLS
  `media-src 'self' blob: *.r2.dev ${r2Hostname} *.cloudflarestream.com videodelivery.net`,
  // YouTube embeds in the player
  "frame-src www.youtube.com www.youtube-nocookie.com",
  // Prevents embedding this app in any external iframe (modern browsers)
  "frame-ancestors 'none'",
  // API + Supabase Realtime WebSocket + subida directa a R2 (URL prefirmada, PUT desde el navegador)
  "connect-src 'self' *.supabase.co *.supabase.in wss://*.supabase.co *.r2.cloudflarestorage.com",
  "font-src 'self'",
  // Service worker and blob workers
  "worker-src 'self' blob:",
  // Block Flash, Java, and other legacy plugins
  "object-src 'none'",
  // Prevent <base> tag injection (a common XSS pivot)
  "base-uri 'self'",
].join("; ");

const securityHeaders = [
  // Prevents MIME-type sniffing — browsers must honour the declared Content-Type
  { key: "X-Content-Type-Options",    value: "nosniff" },
  // Clickjacking protection: prevents this page from being framed (legacy browsers)
  { key: "X-Frame-Options",           value: "DENY" },
  // Sends the full URL only to same-origin requests; strips path/query for cross-origin
  { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
  // Explicitly disables browser features the app does not use
  { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=()" },
  // Forces HTTPS for 2 years on all subdomains; eligible for browser preload lists
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Primary content-origin policy — see ContentSecurityPolicy above
  { key: "Content-Security-Policy",   value: ContentSecurityPolicy },
];

const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.cloudflarestream.com" },
      { protocol: "https", hostname: "videodelivery.net" },
      { protocol: "https", hostname: "imagedelivery.net" },
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: r2Hostname },
      { protocol: "https", hostname: "generacionmaldita.com" },
    ],
  },

  // En dev en Windows, el caché persistente de webpack (.next/cache/webpack/*.pack)
  // se corrompe con frecuencia si un antivirus con protección en tiempo real
  // escanea esos archivos grandes a mitad de escritura — deja referencias a chunks
  // que ya no existen y el servidor cae con "Cannot find module './XXXX.js'".
  // Desactivar el caché en disco solo en dev evita la corrupción (el rebuild
  // incremental sigue funcionando en memoria durante la sesión del servidor).
  webpack(config, { dev }) {
    if (dev) config.cache = false;
    return config;
  },
};

export default nextConfig;
