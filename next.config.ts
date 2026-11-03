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
  // For Cloudflare Pages compatibility, we need to handle external packages carefully.
  // Puppeteer won't work on Cloudflare Pages anyway (no Chromium), so we exclude it here
  // to avoid symlink errors during deployment.
  serverExternalPackages: ["nodemailer"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), "puppeteer", "puppeteer-core"];
    }
    return config;
  },
};

export default nextConfig;
