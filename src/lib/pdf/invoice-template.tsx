/* eslint-disable @next/next/no-img-element -- print markup is rendered to PDF, not the Next.js app */
import * as React from "react";
import { DocumentPage, formatDate, type ClientView, type CompanyView } from "./layout";
import { formatMoney } from "@/lib/money";

export type InvoicePdfData = {
  reference: string;
  issueDate: string; // ISO date, YYYY-MM-DD
  dueDate: string; // ISO date, YYYY-MM-DD
  currency: string;
  terms: string | null;
  client: ClientView;
  company: CompanyView;
  lines: {
    position: number;
    description: string;
    unitPrice: number;
    taxRateBp: number;
    lineTotal: number;
  }[];
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  logoSrc: string | null;
  signatureSrc: string | null;
};

const money = (minor: number, currency: string) => formatMoney(minor, currency);
const pct = (bp: number) => `${(bp / 100).toFixed(bp % 100 === 0 ? 0 : 2)}%`;
const day = (iso: string) => formatDate(new Date(`${iso}T12:00:00Z`));

export function InvoiceDocument(data: InvoicePdfData) {
  const hasBank = Boolean(data.company.bankName || data.company.bankAccountNumber);
  return (
    <DocumentPage
      title="INVOICE"
      reference={data.reference}
      meta={[
        { label: "Date", value: day(data.issueDate) },
        { label: "Due date", value: day(data.dueDate) },
        { label: "Currency", value: data.currency },
      ]}
      company={data.company}
      logoSrc={data.logoSrc}
      client={data.client}
    >
      <table className="items">
        <thead>
          <tr>
            <th style={{ width: 28 }}>#</th>
            <th>Description</th>
            <th className="r" style={{ width: 50 }}>Tax</th>
            <th className="r" style={{ width: 104 }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((line) => (
            <tr key={line.position}>
              <td className="num muted">{line.position}</td>
              <td style={{ whiteSpace: "pre-line" }}>{line.description}</td>
              <td className="r num">{line.taxRateBp ? pct(line.taxRateBp) : "—"}</td>
              <td className="r num">{money(line.lineTotal, data.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="totals">
        <tbody>
          <tr>
            <td className="muted">Subtotal</td>
            <td className="r num">{money(data.subtotal, data.currency)}</td>
          </tr>
          <tr>
            <td className="muted">Tax</td>
            <td className="r num">{money(data.taxTotal, data.currency)}</td>
          </tr>
          <tr className="grand">
            <td>Total due</td>
            <td className="r num">{money(data.grandTotal, data.currency)}</td>
          </tr>
        </tbody>
      </table>

      {hasBank && (
        <div className="section">
          <div className="section-label">Payment details</div>
          <div className="card bank">
            {data.company.bankName && <div><strong>Bank:</strong> {data.company.bankName}</div>}
            {data.company.bankAccountName && <div><strong>Account name:</strong> {data.company.bankAccountName}</div>}
            {data.company.bankAccountNumber && <div><strong>Account no.:</strong> <span className="num">{data.company.bankAccountNumber}</span></div>}
            {data.company.bankBranch && <div><strong>Branch:</strong> {data.company.bankBranch}</div>}
          </div>
        </div>
      )}

      {data.terms && (
        <div className="section">
          <div className="section-label">Terms and conditions</div>
          <div className="terms">{data.terms}</div>
        </div>
      )}

      <div className="signatures">
        <div className="sig">
          <div className="sig-box">{data.signatureSrc && <img src={data.signatureSrc} alt="" />}</div>
          <div className="sig-caption">Prepared by, for {data.company.companyName}</div>
        </div>
        <div className="sig">
          <div className="sig-box" />
          <div className="sig-caption">Received by, for {data.client.companyName} (name, signature and date)</div>
        </div>
      </div>
    </DocumentPage>
  );
}
