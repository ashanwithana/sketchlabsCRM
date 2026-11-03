import "server-only";
import * as React from "react";
import { getBrowser } from "./browser";

/** Turns a React document element into a complete HTML string. */
export async function renderHtml(element: React.ReactElement): Promise<string> {
  // Loaded on demand: react-dom/server is only needed while printing, not in the app bundle.
  const { renderToStaticMarkup } = await import("react-dom/server");
  return `<!DOCTYPE html>${renderToStaticMarkup(element)}`;
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

/**
 * Prints HTML to A4 PDF with Chrome. Every page gets the document reference and a
 * "Page X of Y" footer. Requests other than inline data are blocked, so a document
 * can never load remote content while it renders.
 */
export async function htmlToPdf(html: string, reference: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = req.url();
      if (url.startsWith("data:") || url === "about:blank") return req.continue();
      return req.abort();
    });

    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });

    const footer = `
      <div style="width:100%;box-sizing:border-box;padding:0 14mm;font-family:Helvetica,Arial,sans-serif;font-size:8px;color:#64748b;display:flex;justify-content:space-between;">
        <span>${escapeHtml(reference)}</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>`;

    const bytes = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: footer,
      margin: { top: "14mm", right: "14mm", bottom: "18mm", left: "14mm" },
      timeout: 30_000,
    });
    return Buffer.from(bytes);
  } finally {
    await page.close().catch(() => undefined);
  }
}
