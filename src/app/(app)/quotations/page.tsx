import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, FileText, Plus, Search } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout/page-header";
import { buttonVariants, Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form-controls";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth/session";
import { getCompanySettings } from "@/lib/settings";
import { listQuotations } from "@/lib/quotations/queries";
import { formatMoney } from "@/lib/money";
import { QUOTATION_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Quotations" };

type SearchParams = Promise<{ q?: string; status?: string; page?: string }>;

export default async function QuotationsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  const sp = await searchParams;
  const status = (QUOTATION_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as string) : "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const q = sp.q ?? "";

  const [result, settings] = await Promise.all([listQuotations({ q, status, page }), getCompanySettings()]);
  const pageLink = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    params.set("page", String(p));
    return `/quotations?${params.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Quotations"
        description={`${result.total} quotation${result.total === 1 ? "" : "s"}`}
        actions={
          <Link href="/quotations/new" className={buttonVariants({ variant: "primary" })}>
            <Plus /> New quotation
          </Link>
        }
      />

      <Card className="mb-5">
        <form method="get" className="grid gap-3 p-4 md:grid-cols-[1fr_200px_auto] md:items-center">
          <label className="relative block">
            <span className="sr-only">Search quotations</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <Input name="q" defaultValue={q} placeholder="Search by quotation number or client" className="pl-9" />
          </label>
          <Select name="status" defaultValue={status} aria-label="Status">
            <option value="">All statuses</option>
            {QUOTATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="secondary">Apply</Button>
        </form>
      </Card>

      <Card className="overflow-hidden">
        {result.rows.length === 0 ? (
          <EmptyState
            icon={<FileText />}
            title={q || status ? "No quotations match these filters" : "No quotations yet"}
            description={q || status ? "Try different filters." : "Create your first quotation for a client."}
            action={
              !q && !status ? (
                <Link href="/quotations/new" className={buttonVariants({ variant: "primary" })}>
                  <Plus /> New quotation
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-border bg-surface-muted/60 text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-5 py-3 font-medium">Number</th>
                    <th className="px-5 py-3 font-medium">Client</th>
                    <th className="px-5 py-3 font-medium">Issued</th>
                    <th className="px-5 py-3 font-medium">Valid until</th>
                    <th className="px-5 py-3 text-right font-medium">Total</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result.rows.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-primary-soft/40">
                      <td className="relative whitespace-nowrap px-5 py-3.5">
                        <Link href={`/quotations/${r.id}`} className="num font-medium text-foreground after:absolute after:inset-0 hover:text-primary">
                          {r.number}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-foreground">{r.client.companyName}</span>
                        <div className="num text-xs text-muted">{r.client.clientCode}</div>
                      </td>
                      <td className="num whitespace-nowrap px-5 py-3.5 text-muted">{r.issueDate.toLocaleDateString("en-GB")}</td>
                      <td className={cn("num whitespace-nowrap px-5 py-3.5", r.status === "EXPIRED" ? "text-danger" : "text-muted")}>
                        {r.validUntil.toLocaleDateString("en-GB")}
                      </td>
                      <td className="num whitespace-nowrap px-5 py-3.5 text-right font-medium">
                        {formatMoney(r.grandTotal, r.currency)}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-sm text-muted">
              <span className="num">Page {result.page} of {result.pageCount}</span>
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
      <p className="mt-3 text-xs text-muted">Default currency: {settings.currency}</p>
    </>
  );
}
