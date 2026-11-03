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
  // For Cloudflare Workers/Pages: use standalone output to bundle all dependencies
  output: "standalone",
  // Puppeteer and other external packages need to be bundled for Workers
  serverExternalPackages: ["puppeteer", "puppeteer-core", "nodemailer"],
};

export default nextConfig;
