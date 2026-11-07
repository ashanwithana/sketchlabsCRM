import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // External packages for Cloudflare Workers / Node runtime
  serverExternalPackages: [
    "@prisma/client",
    ".prisma/client",
    "pg",
    "puppeteer",
    "puppeteer-core",
    "nodemailer",
  ],
};

export default nextConfig;
