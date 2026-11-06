import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ExternalLink } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth/session";
import { DOCUMENT_TYPE_LABELS, getDocumentForRepository } from "@/lib/documents/repository";
import { effectiveQuotationStatus } from "@/lib/quotation-status";
import { formatMoney } from "@/lib/money";
import { deliveryLabel } from "@/components/email/email-status";
import { RetryEmailButton } from "@/components/email/email-controls";

export const metadata: Metadata = { title: "Document" };

const TYPE_ROUTE: Record<string, string> = { QUOTATION: "quotations", CR: "cr", MAINTENANCE: "maintenance" };

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const doc = await getDocumentForRepository(id);
  if (!doc) notFound();

  const status =
    doc.type === "QUOTATION" && doc.quotation
      ? effectiveQuotationStatus(doc.status, doc.quotation.validUntil, new Date())
      : doc.status;
  const typeRoute = TYPE_ROUTE[doc.type];

  return (
    <>
      <div className="mb-6">
        <Link href="/documents" className="text-sm text-muted hover:text-foreground">← All documents</Link>
      </div>

      <PageHeader
        title={doc.number}
        description={`${DOCUMENT_TYPE_LABELS[doc.type] ?? doc.type} · ${doc.client.companyName} · issued ${doc.issueDate.toLocaleDateString("en-GB")}`}
        actions={
          <>
            <a href={`/api/documents/${id}/pdf?download=1`} className={buttonVariants({ variant: "primary" })}>
              <Download /> Download current PDF
            </a>
            <Link href={`/${typeRoute}/${id}`} className={buttonVariants({ variant: "secondary" })}>
              <ExternalLink /> Open record
            </Link>
          </>
        }
      />

      <div className="mb-6 grid gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:grid-cols-4">
        <Fact label="Status"><StatusBadge status={status} /></Fact>
        <Fact label="Client"><span>{doc.client.companyName}</span><span className="num block text-xs text-muted">{doc.client.clientCode}</span></Fact>
        <Fact label="Current revision"><span className="num">{doc.currentRevision || "None yet"}</span></Fact>
        <Fact label="Amount">
          <span className="num">{doc.quotation ? formatMoney(doc.quotation.grandTotal, doc.quotation.currency) : "—"}</span>
        </Fact>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader>
            <CardTitle>Revision history</CardTitle>
            <span className="text-xs text-muted">A new revision is created each time the printed content changes.</span>
          </CardHeader>
          {doc.revisions.length === 0 ? (
            <EmptyState icon={<Download />} title="No PDF generated yet" description="Open the record and preview or download its PDF to create revision 1." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="border-b border-border bg-surface-muted/60 text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-5 py-3 font-medium">Revision</th>
                    <th className="px-5 py-3 font-medium">Created</th>
                    <th className="px-5 py-3 font-medium">Content fingerprint</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {doc.revisions.map((r) => (
                    <tr key={r.id}>
                      <td className="px-5 py-3 font-medium">
                        <span className="num">Rev {r.revision}</span>
                        {r.revision === doc.currentRevision && (
                          <span className="ml-2 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">Current</span>
                        )}
                      </td>
                      <td className="num whitespace-nowrap px-5 py-3 text-muted">
                        {r.createdAt.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="num px-5 py-3 text-xs text-subtle" title={r.contentHash}>{r.contentHash.slice(0, 12)}…</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email history</CardTitle>
          </CardHeader>
          {doc.emailLogs.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">Not emailed yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {doc.emailLogs.map((log) => (
                <li key={log.id} className="space-y-1 px-5 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">{log.subject}</p>
                    <StatusBadge status={log.status} />
                  </div>
                  <p className="text-xs text-muted">
                    To {log.toAddress} · {log.createdAt.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p className="text-xs text-muted">{deliveryLabel(log.mode, log.outboxPath)}</p>
                  {log.attachment && <p className="text-xs text-muted">Attached: {log.attachment}</p>}
                  {log.error && <p className="text-xs text-danger">{log.error}</p>}
                  {log.status === "FAILED" && <RetryEmailButton logId={log.id} />}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-1 text-sm text-foreground">{children}</div>
    </div>
  );
}
