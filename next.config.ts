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
};

export default nextConfig;
