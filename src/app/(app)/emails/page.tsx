import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Mail, Search } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form-controls";
import { StatusBadge } from "@/components/ui/status-badge";
import { RetryEmailButton, TestEmailForm } from "@/components/email/email-controls";
import { deliveryLabel } from "@/components/email/email-status";
import { requireUser } from "@/lib/auth/session";
import { listEmailLogs } from "@/lib/email/queries";
import { EMAIL_STATUSES } from "@/lib/constants";
import { getCompanySettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Email log" };

type SearchParams = Promise<{ status?: string; q?: string; page?: string }>;

export default async function EmailLogPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const status = (EMAIL_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as string) : "";
  const q = sp.q ?? "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [result, settings] = await Promise.all([listEmailLogs({ status, q, page }), getCompanySettings()]);
  const pageLink = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    params.set("page", String(p));
    return `/emails?${params.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Email log"
        description="Every email sent from the app, with its delivery status. Failed emails can be retried."
      />

      <div className="space-y-6">
        <Card className="overflow-hidden">
          <form method="get" className="grid gap-3 border-b border-border p-4 md:grid-cols-[1fr_180px_auto] md:items-center">
            <label className="relative block">
              <span className="sr-only">Search emails</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
              <Input name="q" defaultValue={q} placeholder="Search by recipient, subject, or document number" className="pl-9" />
            </label>
            <Select name="status" defaultValue={status} aria-label="Status">
              <option value="">All statuses</option>
              <option value="SENT">Sent</option>
              <option value="FAILED">Failed</option>
              <option value="QUEUED">Queued</option>
            </Select>
            <Button type="submit" variant="secondary">Apply</Button>
          </form>

          {result.rows.length === 0 ? (
            <EmptyState icon={<Mail />} title="No emails yet" description="Emails you send from a quotation, CR, or report appear here." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead className="border-b border-border bg-surface-muted/60 text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-5 py-3 font-medium">Sent</th>
                      <th className="px-5 py-3 font-medium">Document</th>
                      <th className="px-5 py-3 font-medium">To</th>
                      <th className="px-5 py-3 font-medium">Subject</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Delivery</th>
                      <th className="px-5 py-3 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {result.rows.map((r) => (
                      <tr key={r.id} className="align-top">
                        <td className="num whitespace-nowrap px-5 py-3.5 text-muted">
                          {r.createdAt.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-5 py-3.5">
                          {r.document ? (
                            <Link href={`/quotations/${r.document.id}`} className="num font-medium text-primary hover:underline">{r.document.number}</Link>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                          {r.attachment && <div className="text-xs text-muted">PDF: {r.attachment}</div>}
                        </td>
                        <td className="max-w-[200px] break-all px-5 py-3.5 text-foreground">{r.toAddress}{r.ccAddress ? <div className="text-xs text-muted">Cc {r.ccAddress}</div> : null}</td>
                        <td className="max-w-[240px] px-5 py-3.5 text-foreground">{r.subject}</td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={r.status} />
                          {r.error && <p className="mt-1 max-w-[220px] text-xs text-danger">{r.error}</p>}
                        </td>
                        <td className="max-w-[200px] px-5 py-3.5 text-xs text-muted">{deliveryLabel(r.mode, r.outboxPath)}</td>
                        <td className="px-5 py-3.5 text-right">
                          {r.status === "FAILED" ? <RetryEmailButton logId={r.id} /> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-sm text-muted">
                <span className="num">Page {result.page} of {result.pageCount} · {result.total} total</span>
                <div className="flex gap-2">
                  <Link href={pageLink(result.page - 1)} aria-disabled={result.page <= 1} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                    <ChevronLeft className="size-4" /> Previous
                  </Link>
                  <Link href={pageLink(result.page + 1)} aria-disabled={result.page >= result.pageCount} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                    Next <ChevronRight className="size-4" />
                  </Link>
                </div>
              </div>
            </>
          )}
        </Card>

        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Test outgoing email</CardTitle>
          </CardHeader>
          <div className="space-y-4 p-5">
            <p className="text-sm text-muted">
              {settings.companyName ? `Sending from ${settings.companyName}.` : ""}{" "}
              {process.env.SMTP_HOST
                ? "SMTP is configured, so messages are delivered."
                : "SMTP is not configured. Messages are saved to storage/outbox as .eml files so you can open and check them."}
            </p>
            <TestEmailForm defaultTo={user.email} />
          </div>
        </Card>
      </div>
    </>
  );
}
