import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ibb.co" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "60mb",
    },
  },
  // Moved from src/proxy.ts (perf/reduce-invocations): these were the only thing proxy.ts did,
  // and it ran as a Node-runtime function on every single request (including bot probes) just to
  // set static headers. next.config.ts headers() applies them at the edge/build level with no
  // per-request function invocation. The original only sent HSTS when request.nextUrl.protocol
  // was "https:" (useless locally over http); on Vercel every request is HTTPS, so sending it
  // unconditionally here is equivalent in production and merely redundant (harmless) in local http dev.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
