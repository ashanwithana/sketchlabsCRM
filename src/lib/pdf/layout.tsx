/* eslint-disable @next/next/no-img-element, @next/next/no-head-element -- print markup is rendered to PDF, not the Next.js app */
import * as React from "react";

// Shared layout for every generated document (quotation, CR, maintenance report).
// Rendered to static HTML and printed by Chrome. Styles are inline so the PDF needs no network access.

export type CompanyView = {
  companyName: string;
  tagline: string | null;
  addressLine: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  registrationNumber: string | null;
  vatNumber: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankBranch: string | null;
};

export type ClientView = {
  companyName: string;
  clientCode: string;
  contactPerson: string;
  email: string;
  phone: string;
  billingAddress: string;
  registrationNumber: string;
  vatNumber: string | null;
};

export type MetaItem = { label: string; value: string };

// Bump when the printed layout changes, so stored PDFs are regenerated instead of reused.
export const PDF_TEMPLATE_VERSION = 2;

export const PDF_STYLES = `
  @page { size: A4; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Helvetica, Arial, sans-serif; color: #0f172a; font-size: 10.5px; line-height: 1.45; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .doc { padding: 0; }
  .muted { color: #64748b; }
  .num { font-variant-numeric: tabular-nums; }
  .row { display: flex; justify-content: space-between; gap: 24px; }
  .brand { display: flex; gap: 14px; align-items: flex-start; }
  .logo { max-height: 56px; max-width: 150px; object-fit: contain; }
  .company-name { font-size: 16px; font-weight: 700; color: #0f172a; }
  .tagline { color: #4f46e5; font-size: 10px; margin-top: 2px; }
  .title { font-size: 20px; font-weight: 700; letter-spacing: 0.08em; color: #4f46e5; text-align: right; }
  .meta { margin-top: 8px; border-collapse: collapse; margin-left: auto; }
  .meta td { padding: 2px 0 2px 14px; font-size: 10px; }
  .meta td.label { color: #64748b; text-align: right; }
  .meta td.value { font-weight: 600; text-align: right; }
  .rule { height: 3px; background: #4f46e5; margin: 16px 0 14px; border-radius: 2px; }
  .section-label { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; margin-bottom: 4px; }
  .card { border: 1px solid #e3e8f0; border-radius: 6px; padding: 10px 12px; }
  .client-name { font-size: 12px; font-weight: 700; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 14px; }
  table.items th { background: #f1f4f9; color: #475569; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.06em; text-align: left; padding: 7px 8px; border-bottom: 1px solid #cbd3df; }
  table.items th.r, table.items td.r { text-align: right; }
  table.items td { padding: 7px 8px; border-bottom: 1px solid #e3e8f0; vertical-align: top; }
  table.items tr { page-break-inside: avoid; }
  .totals { width: 260px; margin-left: auto; margin-top: 12px; border-collapse: collapse; }
  .totals td { padding: 4px 8px; }
  .totals td.r { text-align: right; }
  .totals tr.grand td { border-top: 1.5px solid #0f172a; font-size: 13px; font-weight: 700; padding-top: 7px; }
  .terms { white-space: pre-line; font-size: 9.5px; color: #334155; }
  .section { margin-top: 18px; page-break-inside: avoid; }
  .signatures { display: flex; gap: 32px; margin-top: 26px; page-break-inside: avoid; }
  .sig { flex: 1; }
  .sig-box { height: 62px; border-bottom: 1px solid #0f172a; display: flex; align-items: flex-end; justify-content: flex-start; }
  .sig-box img { max-height: 56px; max-width: 180px; }
  .sig-caption { margin-top: 5px; font-size: 9px; color: #475569; }
  .bank { font-size: 9.5px; color: #334155; }
  .bank strong { color: #0f172a; }
`;

export function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export function DocumentPage({
  title,
  reference,
  meta,
  company,
  logoSrc,
  client,
  clientHeading = "Bill to",
  children,
}: {
  title: string;
  reference: string;
  meta: MetaItem[];
  company: CompanyView;
  logoSrc: string | null;
  client: ClientView;
  clientHeading?: string;
  children: React.ReactNode;
}) {
  const addressLines = [company.addressLine, company.phone, company.email, company.website].filter(Boolean);
  const regLine = [
    company.registrationNumber && `Reg. ${company.registrationNumber}`,
    company.vatNumber && `VAT ${company.vatNumber}`,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>{reference}</title>
        <style dangerouslySetInnerHTML={{ __html: PDF_STYLES }} />
      </head>
      <body>
        <div className="doc">
          <div className="row">
            <div className="brand">
              {logoSrc && <img className="logo" src={logoSrc} alt="" />}
              <div>
                <div className="company-name">{company.companyName}</div>
                {company.tagline && <div className="tagline">{company.tagline}</div>}
                {addressLines.map((line, i) => (
                  <div key={i} className="muted">{line}</div>
                ))}
                {regLine && <div className="muted">{regLine}</div>}
              </div>
            </div>
            <div>
              <div className="title">{title}</div>
              <table className="meta">
                <tbody>
                  <tr>
                    <td className="label">Reference</td>
                    <td className="value num">{reference}</td>
                  </tr>
                  {meta.map((m) => (
                    <tr key={m.label}>
                      <td className="label">{m.label}</td>
                      <td className="value num">{m.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rule" />

          <div className="row" style={{ alignItems: "flex-start" }}>
            <div className="card" style={{ flex: 1 }}>
              <div className="section-label">{clientHeading}</div>
              <div className="client-name">{client.companyName}</div>
              <div>{client.contactPerson}</div>
              <div className="muted" style={{ whiteSpace: "pre-line" }}>{client.billingAddress}</div>
              <div className="muted">{client.email} · {client.phone}</div>
              <div className="muted">
                Reg. {client.registrationNumber}
                {client.vatNumber ? `  ·  VAT ${client.vatNumber}` : ""}
              </div>
            </div>
          </div>

          {children}
        </div>
      </body>
    </html>
  );
}
