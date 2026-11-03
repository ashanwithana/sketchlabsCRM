import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Puppeteer runs Chrome as a child process and must not be bundled.
  serverExternalPackages: ["puppeteer", "puppeteer-core", "nodemailer"],
};

export default nextConfig;
