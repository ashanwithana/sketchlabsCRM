/* eslint-disable @next/next/no-img-element -- stored signatures are data URLs, not remote images */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Eye, Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { MaintenanceStatusControl } from "@/components/maintenance/maintenance-status";
import { SendEmailDialog } from "@/components/email/send-email-dialog";
import { RetryEmailButton } from "@/components/email/email-controls";
import { deliveryLabel } from "@/components/email/email-status";
import { requireUser } from "@/lib/auth/session";
import { equipmentServiceHistory, getMaintenanceDetail } from "@/lib/maintenance/queries";
import { buildEmailDefaults } from "@/lib/email/send";
import { listEmailLogsForDocument } from "@/lib/email/queries";

export const metadata: Metadata = { title: "Maintenance record" };

const fmt = (d: Date | null | undefined) => (d ? d.toLocaleDateString("en-GB") : "—");

export default async function MaintenanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const doc = await getMaintenanceDetail(id);
  if (!doc?.maintenance) notFound();
  const m = doc.maintenance;
  const [emailDefaults, emailLogs, history] = await Promise.all([
    buildEmailDefaults(id),
    listEmailLogsForDocument(id),
    m.equipmentId ? equipmentServiceHistory(m.equipmentId, id) : Promise.resolve([]),
  ]);

  return (
    <>
      <div className="mb-6">
        <Link href="/maintenance" className="text-sm text-muted hover:text-foreground">← All maintenance</Link>
      </div>

      <PageHeader
        title={doc.number}
        description={`${doc.client.companyName} · ${m.equipment?.name ?? "System"}`}
        actions={
          <Link href={`/maintenance/${id}/edit`} className={buttonVariants({ variant: "secondary" })}>
            <Pencil /> Edit
          </Link>
        }
      />

      <div className="mb-6 flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">Current status</span>
          <StatusBadge status={doc.status} />
        </div>
        <MaintenanceStatusControl id={id} status={doc.status} />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <a href="#pdf-preview" className={buttonVariants({ variant: "secondary" })}>
          <Eye /> Preview PDF
        </a>
        <a href={`/api/documents/${id}/pdf?download=1`} className={buttonVariants({ variant: "secondary" })}>
          <Download /> Download PDF
        </a>
        <SendEmailDialog documentId={id} documentNumber={doc.number} clientName={doc.client.companyName} defaults={emailDefaults} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Service</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <Block label="Description" text={m.description} />
              {m.workPerformed && <Block label="Work performed" text={m.workPerformed} />}
              {m.recommendations && <Block label="Recommendations" text={m.recommendations} />}
              {m.customerRemarks && <Block label="Customer remarks" text={m.customerRemarks} />}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Parts replaced</CardTitle>
            </CardHeader>
            {m.parts.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">No parts were replaced.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-surface-muted/60 text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-5 py-3 font-medium">Part</th>
                    <th className="px-5 py-3 text-right font-medium">Qty</th>
                    <th className="px-5 py-3 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {m.parts.map((p) => (
                    <tr key={p.id}>
                      <td className="px-5 py-3">{p.name}</td>
                      <td className="num px-5 py-3 text-right">{p.quantity}</td>
                      <td className="px-5 py-3 text-muted">{p.notes ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Technician and customer</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <SigBox title={`Technician${m.technicianName ? `: ${m.technicianName}` : ""}`} src={m.technicianSignature} />
              <SigBox title={`Customer: ${doc.client.contactPerson}`} src={m.customerSignature} />
            </CardContent>
          </Card>

          <Card id="pdf-preview" className="overflow-hidden scroll-mt-6">
            <CardHeader>
              <CardTitle>PDF preview</CardTitle>
              <span className="text-xs text-muted">Revision {doc.currentRevision || "—"}</span>
            </CardHeader>
            <iframe title={`PDF preview of ${doc.number}`} src={`/api/documents/${id}/pdf`} loading="lazy" className="block h-[720px] w-full bg-surface-muted" />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Dates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Service date" value={fmt(m.maintenanceDate)} />
              <Row label="Next service" value={fmt(m.nextMaintenanceDate)} />
              <Row label="Technician" value={m.technicianName ?? "—"} />
              {m.technicianDetails && <Row label="Details" value={m.technicianDetails} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium">{m.equipment?.name}</p>
              {m.equipment?.model && <p className="text-muted">Platform {m.equipment.model}</p>}
              {m.equipment?.serialNumber && <p className="num text-muted">{m.equipment.serialNumber}</p>}
              {m.equipment?.location && <p className="text-muted">{m.equipment.location}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Service history for this system</CardTitle>
            </CardHeader>
            {history.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">No other service records for this system.</p>
            ) : (
              <ul className="divide-y divide-border">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <Link href={`/maintenance/${h.id}`} className="num font-medium text-primary hover:underline">{h.number}</Link>
                      <p className="text-xs text-muted">{h.maintenance?.maintenanceDate.toLocaleDateString("en-GB")}</p>
                    </div>
                    <StatusBadge status={h.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Email history</CardTitle>
            </CardHeader>
            {emailLogs.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">Not emailed yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {emailLogs.map((log) => (
                  <li key={log.id} className="space-y-1 px-5 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">{log.subject}</p>
                      <StatusBadge status={log.status} />
                    </div>
                    <p className="text-xs text-muted">To {log.toAddress} · {deliveryLabel(log.mode, log.outboxPath)}</p>
                    {log.error && <p className="text-xs text-danger">{log.error}</p>}
                    {log.status === "FAILED" && <RetryEmailButton logId={log.id} />}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Block({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted">{label}</h3>
      <p className="mt-2 whitespace-pre-line text-sm text-foreground">{text}</p>
    </div>
  );
}

function SigBox({ title, src }: { title: string; src: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{title}</p>
      {src ? (
        <img src={src} alt={title} className="mt-2 h-24 w-full rounded-lg border border-border bg-surface object-contain" />
      ) : (
        <p className="mt-2 text-sm text-muted">Not signed.</p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="num text-foreground">{value}</span>
    </div>
  );
}
