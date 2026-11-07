import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Eye, Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { CrStatusControl, DuplicateCrButton } from "@/components/cr/cr-actions";
import { SendEmailDialog } from "@/components/email/send-email-dialog";
import { RetryEmailButton } from "@/components/email/email-controls";
import { deliveryLabel } from "@/components/email/email-status";
import { requireUser } from "@/lib/auth/session";
import { getCrDetail } from "@/lib/cr/queries";
import { formatMoney } from "@/lib/money";
import { getCompanySettings } from "@/lib/settings";
import { buildEmailDefaults } from "@/lib/email/send";
import { listEmailLogsForDocument } from "@/lib/email/queries";

export const metadata: Metadata = { title: "CR document" };

const fmtDate = (d: Date | null | undefined) => (d ? d.toLocaleDateString("en-GB") : "—");

export default async function CrDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const doc = await getCrDetail(id);
  if (!doc?.cr) notFound();
  const cr = doc.cr;
  const [emailDefaults, emailLogs, settings] = await Promise.all([buildEmailDefaults(id), listEmailLogsForDocument(id), getCompanySettings()]);

  const linked = cr.quotation?.document;

  return (
    <>
      <div className="mb-6">
        <Link href="/cr" className="text-sm text-muted hover:text-foreground">← All CR documents</Link>
      </div>

      <PageHeader
        title={doc.number}
        description={`${doc.client.companyName} · issued ${fmtDate(doc.issueDate)}`}
        actions={
          <>
            <Link href={`/cr/${id}/edit`} className={buttonVariants({ variant: "secondary" })}>
              <Pencil /> Edit
            </Link>
            <DuplicateCrButton id={id} />
          </>
        }
      />

      <div className="mb-6 flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">Current status</span>
          <StatusBadge status={doc.status} />
        </div>
        <CrStatusControl id={id} status={doc.status} />
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
              <CardTitle>Request</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <Block label="Request details" text={cr.requestDetails} />
              <Block label="Scope of work" text={cr.scopeOfWork} />
              {cr.customerRequirements && <Block label="Customer requirements" text={cr.customerRequirements} />}
              {cr.remarks && <Block label="Remarks" text={cr.remarks} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customer approval</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Approved by</p>
                <p className="mt-1 text-sm text-foreground">{cr.approvalName ?? "Not yet approved"}</p>
                <p className="mt-1 text-xs text-muted">Date: {fmtDate(cr.approvalDate)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Customer signature</p>
                {cr.customerSignature ? (
                  // The signature is a data URL stored with the record. It is not a remote resource.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cr.customerSignature} alt="Customer signature" className="mt-2 h-24 rounded-lg border border-border bg-surface object-contain" />
                ) : (
                  <p className="mt-1 text-sm text-muted">No signature recorded.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card id="pdf-preview" className="overflow-hidden scroll-mt-6">
            <CardHeader>
              <CardTitle>PDF preview</CardTitle>
              <span className="text-xs text-muted">Revision {doc.currentRevision || "—"}</span>
            </CardHeader>
            <iframe
              title={`PDF preview of ${doc.number}`}
              src={`/api/documents/${id}/pdf`}
              loading="lazy"
              className="block h-[720px] w-full bg-surface-muted"
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Issue date" value={fmtDate(doc.issueDate)} />
              <Row label="Delivery / completion" value={fmtDate(cr.deliveryDate)} />
              {cr.cost > 0 && <Row label="Cost" value={formatMoney(cr.cost, settings.currency)} />}
              <Row label="Client" value={doc.client.companyName} />
              <div className="border-t border-border pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Linked quotation</p>
                {linked ? (
                  <Link href={`/quotations/${linked.id}`} className="mt-1 inline-block num font-medium text-primary hover:underline">
                    {linked.number}
                  </Link>
                ) : (
                  <p className="mt-1 text-muted">None</p>
                )}
              </div>
            </CardContent>
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
                    <p className="text-xs text-muted">
                      To {log.toAddress} · {log.createdAt.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · {deliveryLabel(log.mode, log.outboxPath)}
                    </p>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="num text-foreground">{value}</span>
    </div>
  );
}
