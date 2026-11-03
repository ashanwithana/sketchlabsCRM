/* eslint-disable @next/next/no-img-element -- print markup is rendered to PDF, not the Next.js app */
import * as React from "react";
import { DocumentPage, formatDate, type ClientView, type CompanyView } from "./layout";

export type MaintenancePdfData = {
  reference: string;
  status: string;
  maintenanceDate: string; // YYYY-MM-DD
  nextMaintenanceDate: string | null;
  client: ClientView;
  company: CompanyView;
  equipment: { name: string; model: string | null; serialNumber: string | null; location: string | null };
  description: string;
  workPerformed: string | null;
  technicianName: string | null;
  technicianDetails: string | null;
  parts: { name: string; quantity: number; notes: string | null }[];
  customerRemarks: string | null;
  recommendations: string | null;
  customerSignatureSrc: string | null;
  technicianSignatureSrc: string | null;
  logoSrc: string | null;
  signatureSrc: string | null;
  terms: string;
};

const day = (iso: string) => formatDate(new Date(`${iso}T12:00:00Z`));

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="section">
      <div className="section-label">{label}</div>
      <div className="card" style={{ whiteSpace: "pre-line" }}>{children}</div>
    </div>
  );
}

function SignatureBox({ src, caption }: { src: string | null; caption: string }) {
  return (
    <div className="sig">
      <div className="sig-box">{src && <img src={src} alt="" />}</div>
      <div className="sig-caption">{caption}</div>
    </div>
  );
}

export function MaintenanceDocument(data: MaintenancePdfData) {
  const meta = [
    { label: "Service date", value: day(data.maintenanceDate) },
    ...(data.nextMaintenanceDate ? [{ label: "Next service", value: day(data.nextMaintenanceDate) }] : []),
    { label: "Status", value: data.status.charAt(0) + data.status.slice(1).toLowerCase() },
  ];
  const eq = [data.equipment.name, data.equipment.model, data.equipment.serialNumber && `S/N ${data.equipment.serialNumber}`, data.equipment.location]
    .filter(Boolean)
    .join(" · ");

  return (
    <DocumentPage
      title="MAINTENANCE REPORT"
      reference={data.reference}
      meta={meta}
      company={data.company}
      logoSrc={data.logoSrc}
      client={data.client}
    >
      <div className="section">
        <div className="section-label">Equipment serviced</div>
        <div className="card">{eq}</div>
      </div>

      <Section label="Description">{data.description}</Section>
      {data.workPerformed && <Section label="Work performed">{data.workPerformed}</Section>}

      {data.parts.length > 0 && (
        <div className="section">
          <div className="section-label">Parts replaced</div>
          <table className="items">
            <thead>
              <tr>
                <th>Part</th>
                <th className="r" style={{ width: 60 }}>Qty</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {data.parts.map((p, i) => (
                <tr key={i}>
                  <td>{p.name}</td>
                  <td className="r num">{p.quantity}</td>
                  <td className="muted">{p.notes ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.recommendations && <Section label="Recommendations">{data.recommendations}</Section>}
      {data.customerRemarks && <Section label="Customer remarks">{data.customerRemarks}</Section>}

      <div className="section">
        <div className="section-label">Technician and customer</div>
        <div className="signatures" style={{ marginTop: 0 }}>
          <SignatureBox src={data.technicianSignatureSrc} caption={`Technician${data.technicianName ? `: ${data.technicianName}` : ""}${data.technicianDetails ? ` (${data.technicianDetails})` : ""}`} />
          <SignatureBox src={data.customerSignatureSrc} caption={`Customer: ${data.client.companyName}`} />
        </div>
      </div>

      <div className="signatures">
        <div className="sig">
          <div className="sig-box">{data.signatureSrc && <img src={data.signatureSrc} alt="" />}</div>
          <div className="sig-caption">Prepared by, for {data.company.companyName}</div>
        </div>
      </div>
      <p className="muted" style={{ marginTop: 12, fontSize: 9 }}>{data.terms}</p>
    </DocumentPage>
  );
}
