import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Pencil, Eye } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DuplicateQuotationButton, QuotationStatusControl } from "@/components/quotations/quotation-actions";
import { requireUser } from "@/lib/auth/session";
import { getQuotationDetail } from "@/lib/quotations/queries";
import { formatMoney } from "@/lib/money";
import { buildEmailDefaults } from "@/lib/email/send";

import { listEmailLogsForDocument } from "@/lib/email/queries";
import { SendEmailDialog } from "@/components/email/send-email-dialog";
import { RetryEmailButton } from "@/components/email/email-controls";
import { ApprovalLink } from "@/components/quotations/approval-link";
import { deliveryLabel } from "@/components/email/email-status";

export const metadata: Metadata = { title: "Quotation" };

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const doc = await getQuotationDetail(id);
  if (!doc?.quotation) notFound();

  const q = doc.quotation;
  const [emailDefaults, emailLogs] = await Promise.all([
    buildEmailDefaults(id),
    listEmailLogsForDocument(id),
  ]);
  const linkedCr = q.cr ?? null;
  const money = (minor: number) => formatMoney(minor, q.currency);

  return (
    <>
      <div className="mb-6">
        <Link href="/quotations" className="text-sm text-muted hover:text-foreground">← All quotations</Link>
      </div>

      <PageHeader
        title={doc.number}
        description={`${doc.client.companyName} · issued ${doc.issueDate.toLocaleDateString("en-GB")}`}
        actions={
          <>
            <Link href={`/quotations/${id}/edit`} className={buttonVariants({ variant: "secondary" })}>
              <Pencil /> Edit
            </Link>
            <DuplicateQuotationButton id={id} />
            <Link href={`/cr/new?quotation=${id}`} className={buttonVariants({ variant: "secondary" })}>
              Create CR
            </Link>
          </>
        }
      />

      <div className="mb-6 flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">Current status</span>
          <StatusBadge status={doc.effectiveStatus} />
        </div>
        <QuotationStatusControl id={id} status={doc.status} />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <a href={`#pdf-preview`} className={buttonVariants({ variant: "secondary" })}>
          <Eye /> Preview PDF
        </a>
        <a href={`/api/documents/${id}/pdf?download=1`} className={buttonVariants({ variant: "secondary" })}>
          <Download /> Download PDF
        </a>
        <SendEmailDialog
          documentId={id}
          documentNumber={doc.number}
          clientName={doc.client.companyName}
          defaults={emailDefaults}
        />
      </div>

      <div className="space-y-6">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border bg-surface-muted/60 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">#</th>
                  <th className="px-5 py-3 font-medium">Description</th>
                  <th className="px-5 py-3 text-right font-medium">Qty</th>
                  <th className="px-5 py-3 text-right font-medium">Unit price</th>
                  <th className="px-5 py-3 text-right font-medium">Discount</th>
                  <th className="px-5 py-3 text-right font-medium">Tax</th>
                  <th className="px-5 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {q.items.map((item) => (
                  <tr key={item.id}>
                    <td className="num px-5 py-3 text-muted">{item.position}</td>
                    <td className="max-w-md whitespace-pre-line px-5 py-3 text-foreground">{item.description}</td>
                    <td className="num px-5 py-3 text-right">{item.quantity}</td>
                    <td className="num whitespace-nowrap px-5 py-3 text-right">{money(item.unitPrice)}</td>
                    <td className="num whitespace-nowrap px-5 py-3 text-right text-muted">{item.discount ? `− ${money(item.discount)}` : "—"}</td>
                    <td className="num px-5 py-3 text-right text-muted">{item.taxRateBp ? `${item.taxRateBp / 100}%` : "—"}</td>
                    <td className="num whitespace-nowrap px-5 py-3 text-right font-medium">{money(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          {(q.terms || q.notes) && (
            <Card className="lg:col-span-2">
              <CardContent className="grid gap-6 sm:grid-cols-2">
                {q.terms && (
                  <div>
                    <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Terms and conditions</h3>
                    <p className="mt-2 whitespace-pre-line text-sm text-foreground">{q.terms}</p>
                  </div>
                )}
                {q.notes && (
                  <div>
                    <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Internal notes</h3>
                    <p className="mt-2 whitespace-pre-line text-sm text-foreground">{q.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card className={q.terms || q.notes ? undefined : "lg:col-span-3"}>
            <CardHeader>
              <CardTitle>Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Line label="Subtotal" value={money(q.subtotal)} />
              <Line label="Discount" value={q.discountTotal ? `− ${money(q.discountTotal)}` : money(0)} />
              <Line label="Tax" value={money(q.taxTotal)} />
              <div className="border-t border-border pt-3">
                <Line label="Grand total" value={money(q.grandTotal)} strong />
              </div>
              <div className="border-t border-border pt-4 text-xs text-muted">
                <p>Valid until <span className="num font-medium text-foreground">{q.validUntil.toLocaleDateString("en-GB")}</span></p>
                <p className="mt-1">Client: {doc.client.contactPerson}, {doc.client.email}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Email history</CardTitle>
          </CardHeader>
          {emailLogs.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">Not emailed yet. Use “Email to client” to send this quotation with its PDF.</p>
          ) : (
            <ul className="divide-y divide-border">
              {emailLogs.map((log) => (
                <li key={log.id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{log.subject}</p>
                    <p className="text-xs text-muted">
                      To {log.toAddress} · {log.createdAt.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · {deliveryLabel(log.mode, log.outboxPath)}
                    </p>
                    {log.error && <p className="mt-1 text-xs text-danger">{log.error}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={log.status} />
                    {log.status === "FAILED" && <RetryEmailButton logId={log.id} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Client approval</CardTitle>
          </CardHeader>
          <CardContent>
            <ApprovalLink documentId={id} canCreate={doc.status === "SENT" || doc.status === "PENDING"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Linked CR documents</CardTitle>
          </CardHeader>
          {!linkedCr ? (
            <p className="px-5 py-6 text-sm text-muted">No customer request has been linked to this quotation.</p>
          ) : (
            <ul className="divide-y divide-border">
              <li className="flex items-center justify-between px-5 py-3">
                <Link href={`/cr/${linkedCr.document.id}`} className="num font-medium text-primary hover:underline">{linkedCr.document.number}</Link>
                <StatusBadge status={linkedCr.document.status} />
              </li>
            </ul>
          )}
        </Card>

        <Card id="pdf-preview" className="overflow-hidden scroll-mt-6">
          <CardHeader>
            <CardTitle>PDF preview</CardTitle>
            <span className="text-xs text-muted">
              Revision {doc.currentRevision || "—"} · changes create a new revision when the PDF is next generated
            </span>
          </CardHeader>
          <iframe
            title={`PDF preview of ${doc.number}`}
            src={`/api/documents/${id}/pdf`}
            loading="lazy"
            className="block h-[720px] w-full bg-surface-muted"
          />
        </Card>
      </div>
    </>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={strong ? "font-semibold text-foreground" : "text-muted"}>{label}</span>
      <span className={`num ${strong ? "text-lg font-semibold text-foreground" : "text-foreground"}`}>{value}</span>
    </div>
  );
}
