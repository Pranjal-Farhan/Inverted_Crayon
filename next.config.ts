import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ibb.co" },
      // Google account profile pictures (googleExchangeCode in src/lib/oauth/google.ts) — served
      // from various lh*.googleusercontent.com hosts, hence the wildcard rather than one hostname.
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
    // Next 16 requires this allowlist — any quality prop not in it is silently coerced to the
    // closest allowed value (see next/image's `quality` docs). Every <Image> in this app passes
    // quality={90} (product photography needs the detail; 75 was visibly softening uploads up to
    // 2000x2500px, especially once the PDP gallery's zoom scales the image up 2.2x — see
    // ProductGallery.tsx). 75 stays allowed too in case a future call site wants the lighter
    // weight (e.g. a tiny admin preview).
    qualities: [75, 90],
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
