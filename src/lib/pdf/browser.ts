import "server-only";
import fs from "node:fs";
import puppeteer, { type Browser } from "puppeteer";
import { getEnv } from "@/lib/env";

// One headless Chrome is shared by all PDF requests. Each render gets its own page.
// Launching Chrome costs about a second, so it is started on first use and reused.
// On hosts without Chrome (serverless, containers without a browser package) the
// app connects to a remote headless Chrome through PUPPETEER_WS_ENDPOINT instead.

const MAC_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/** Finds a Chrome binary: PDF_CHROME_PATH first, then the standard macOS install location. */
export function resolveChromePath(): string | null {
  const configured = getEnv().PDF_CHROME_PATH;
  if (configured) return fs.existsSync(configured) ? configured : null;
  if (process.platform === "darwin" && fs.existsSync(MAC_CHROME)) return MAC_CHROME;
  return null;
}

/** True when a PDF can be rendered: a remote endpoint is configured or a local Chrome exists. */
export function pdfEngineAvailable(): boolean {
  return getEnv().PUPPETEER_WS_ENDPOINT !== "" || resolveChromePath() !== null;
}

/** Connects to the configured browser: a remote endpoint when set, otherwise a local Chrome. */
async function openBrowser(): Promise<Browser> {
  const endpoint = getEnv().PUPPETEER_WS_ENDPOINT;
  if (endpoint) return puppeteer.connect({ browserWSEndpoint: endpoint });

  const executablePath = resolveChromePath();
  if (!executablePath) {
    throw new Error(
      "No Chrome found for PDF generation. Install Google Chrome, set PDF_CHROME_PATH in .env to a Chrome or Chromium binary, or set PUPPETEER_WS_ENDPOINT to a remote Chrome.",
    );
  }
  return puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
}

let browserPromise: Promise<Browser> | null = null;

export async function getBrowser(): Promise<Browser> {
  // Reuse the open browser unless it has gone away. A remote endpoint can drop
  // without the disconnect event firing, so the connection state is checked too.
  if (browserPromise) {
    const open = await browserPromise.catch(() => null);
    if (open?.connected) return open;
    browserPromise = null;
  }

  const pending = openBrowser().catch((err: unknown) => {
    if (browserPromise === pending) browserPromise = null;
    throw err;
  });
  browserPromise = pending;

  const browser = await pending;
  browser.on("disconnected", () => {
    if (browserPromise === pending) browserPromise = null;
  });
  return browser;
}

/**
 * Tears down the shared browser: closes one we launched locally, but only
 * disconnects from a remote endpoint, whose browser is shared and stays running.
 */
export async function closeBrowser(): Promise<void> {
  const pending = browserPromise;
  browserPromise = null;
  if (!pending) return;
  const browser = await pending.catch(() => null);
  if (!browser) return;
  if (getEnv().PUPPETEER_WS_ENDPOINT) browser.disconnect();
  else await browser.close().catch(() => undefined);
}
