import "server-only";
import fs from "node:fs";
import puppeteer, { type Browser } from "puppeteer";
import { getEnv } from "@/lib/env";

// One headless Chrome is shared by all PDF requests. Each render gets its own page.
// Launching Chrome costs about a second, so it is started on first use and reused.

const MAC_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/** Finds a Chrome binary: PDF_CHROME_PATH first, then the standard macOS install location. */
export function resolveChromePath(): string | null {
  const configured = getEnv().PDF_CHROME_PATH;
  if (configured) return fs.existsSync(configured) ? configured : null;
  if (process.platform === "darwin" && fs.existsSync(MAC_CHROME)) return MAC_CHROME;
  return null;
}

export function pdfEngineAvailable(): boolean {
  return resolveChromePath() !== null;
}

let browserPromise: Promise<Browser> | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    const executablePath = resolveChromePath();
    if (!executablePath) {
      throw new Error(
        "No Chrome found for PDF generation. Install Google Chrome or set PDF_CHROME_PATH in .env to a Chrome or Chromium binary.",
      );
    }
    browserPromise = puppeteer
      .launch({
        executablePath,
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
      })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
    const browser = await browserPromise;
    browser.on("disconnected", () => {
      browserPromise = null;
    });
  }
  return browserPromise;
}
