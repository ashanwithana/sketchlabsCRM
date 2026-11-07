/* eslint-disable @next/next/no-img-element -- print markup is rendered to PDF, not the Next.js app */
import * as React from "react";
import { DocumentPage, formatDate, type ClientView, type CompanyView } from "./layout";
import { formatMoney } from "@/lib/money";

export type CrPdfData = {
  reference: string;
  issueDate: string; // YYYY-MM-DD
  deliveryDate: string | null;
  cost: number; // minor units
  currency: string;
  client: ClientView;
  company: CompanyView;
  requestDetails: string;
  scopeOfWork: string;
  customerRequirements: string | null;
  remarks: string | null;
  logoSrc: string | null;
  signatureSrc: string | null;
  terms: string;
};

const day = (iso: string) => formatDate(new Date(`${iso}T12:00:00Z`));

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="section">
      <div className="section-label">{label}</div>
      <div className="card" style={{ whiteSpace: "pre-line" }}>
        {children}
      </div>
    </div>
  );
}

export function CrDocument(data: CrPdfData) {
  const meta = [
    { label: "Date", value: day(data.issueDate) },
    ...(data.deliveryDate ? [{ label: "Delivery / completion", value: day(data.deliveryDate) }] : []),
    ...(data.cost > 0 ? [{ label: "Cost", value: formatMoney(data.cost, data.currency) }] : []),
  ];

  return (
    <DocumentPage
      title="CUSTOMER REQUEST"
      reference={data.reference}
      meta={meta}
      company={data.company}
      logoSrc={data.logoSrc}
      client={data.client}
      clientHeading="Customer"
    >
      <Section label="Request details">{data.requestDetails}</Section>
      <Section label="Scope of work">{data.scopeOfWork}</Section>
      {data.customerRequirements && <Section label="Customer requirements">{data.customerRequirements}</Section>}
      {data.remarks && <Section label="Remarks">{data.remarks}</Section>}

      <div className="signatures">
        <div className="sig">
          <div className="sig-box">{data.signatureSrc && <img src={data.signatureSrc} alt="" />}</div>
          <div className="sig-caption">Issued by, for {data.company.companyName}</div>
        </div>
      </div>
      <p className="muted" style={{ marginTop: 10, fontSize: 9 }}>{data.terms}</p>
    </DocumentPage>
  );
}
