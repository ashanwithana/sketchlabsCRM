import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // For Cloudflare Pages: don't create symlinks for external packages
  // Puppeteer won't work on Pages anyway (no Chromium), so we exclude it
  // This prevents the "contains links to files that can't be accessed" error
  serverExternalPackages: [],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Mark these as external so they're not bundled or symlinked
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals || {}]),
        "puppeteer",
        "puppeteer-core",
        "nodemailer",
        "@prisma/client",
      ].filter(Boolean);
    }
    return config;
  },
};

export default nextConfig;
