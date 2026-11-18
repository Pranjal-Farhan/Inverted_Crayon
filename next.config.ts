import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No "X-Powered-By: Next.js" on every response — it only tells a scanner which exploits to try.
  poweredByHeader: false,
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
  // The PDF receipts attached to order emails (src/lib/receipt-pdf.ts): pdfkit/fontkit read their own
  // data files at runtime, so they're loaded from node_modules rather than bundled; and the Noto
  // font files the receipt embeds are read from disk, so they're shipped with every route that can
  // send an order email (checkout, the admin order actions, the payment callbacks).
  serverExternalPackages: ["pdfkit", "fontkit"],
  outputFileTracingIncludes: {
    "/**": ["./src/assets/fonts/**"],
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
          // Deliberately narrow: only directives that can't break the storefront's own scripts,
          // styles, images or the payment/OAuth redirects — no framing by other sites (the modern
          // form of X-Frame-Options), no plugin content, and no <base> tag re-pointing relative URLs.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
