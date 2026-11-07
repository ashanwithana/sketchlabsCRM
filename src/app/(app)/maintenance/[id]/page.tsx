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
import { getMaintenanceDetail } from "@/lib/maintenance/queries";
import { buildEmailDefaults } from "@/lib/email/send";
import { listEmailLogsForDocument } from "@/lib/email/queries";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Maintenance agreement" };

const fmt = (d: Date | null | undefined) => (d ? d.toLocaleDateString("en-GB") : "—");

export default async function MaintenanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const doc = await getMaintenanceDetail(id);
  if (!doc?.maintenance) notFound();
  const m = doc.maintenance;
  const [emailDefaults, emailLogs] = await Promise.all([
    buildEmailDefaults(id),
    listEmailLogsForDocument(id),
  ]);

  return (
    <>
      <div className="mb-6">
        <Link href="/maintenance" className="text-sm text-muted hover:text-foreground">← All agreements</Link>
      </div>

      <PageHeader
        title={doc.number}
        description={`${doc.client.companyName} · maintenance agreement`}
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
              <CardTitle>Scope</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-sm text-foreground">{m.description}</p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Services</CardTitle>
            </CardHeader>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface-muted/60 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Service</th>
                  <th className="px-5 py-3 text-right font-medium">Qty</th>
                  <th className="px-5 py-3 text-right font-medium">Unit price</th>
                  <th className="px-5 py-3 text-right font-medium">Tax</th>
                  <th className="px-5 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {m.items.map((i) => (
                  <tr key={i.id}>
                    <td className="px-5 py-3">{i.description}</td>
                    <td className="num px-5 py-3 text-right">{i.quantity}</td>
                    <td className="num px-5 py-3 text-right">{formatMoney(i.unitPrice, m.currency)}</td>
                    <td className="num px-5 py-3 text-right">{(i.taxRateBp / 100).toFixed(2)}%</td>
                    <td className="num px-5 py-3 text-right font-medium">{formatMoney(i.lineTotal, m.currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-border bg-surface-muted/40 text-sm">
                <tr>
                  <td colSpan={4} className="px-5 py-2 text-right text-muted">Subtotal</td>
                  <td className="num px-5 py-2 text-right">{formatMoney(m.subtotal, m.currency)}</td>
                </tr>
                <tr>
                  <td colSpan={4} className="px-5 py-2 text-right text-muted">Tax</td>
                  <td className="num px-5 py-2 text-right">{formatMoney(m.taxTotal, m.currency)}</td>
                </tr>
                <tr>
                  <td colSpan={4} className="px-5 py-2 text-right font-semibold">Grand total</td>
                  <td className="num px-5 py-2 text-right font-semibold">{formatMoney(m.grandTotal, m.currency)}</td>
                </tr>
              </tfoot>
            </table>
          </Card>

          {m.terms && (
            <Card>
              <CardHeader><CardTitle>Terms and conditions</CardTitle></CardHeader>
              <CardContent><p className="whitespace-pre-line text-sm text-foreground">{m.terms}</p></CardContent>
            </Card>
          )}

          {m.notes && (
            <Card>
              <CardHeader><CardTitle>Internal notes</CardTitle></CardHeader>
              <CardContent><p className="whitespace-pre-line text-sm text-muted">{m.notes}</p></CardContent>
            </Card>
          )}

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
            <CardHeader><CardTitle>Agreement</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Valid from" value={fmt(m.validFrom)} />
              <Row label="Valid until" value={fmt(m.validUntil)} />
              <Row label="Billing cycle" value={m.cycle} />
              <Row label="Billing day" value={String(m.billingDay)} />
              <Row label="Currency" value={m.currency} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Client</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium">{doc.client.companyName}</p>
              <p className="num text-muted">{doc.client.clientCode}</p>
              <p className="text-muted">{doc.client.contactPerson}</p>
              <p className="text-muted">{doc.client.email}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Email history</CardTitle></CardHeader>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="num text-foreground">{value}</span>
    </div>
  );
}