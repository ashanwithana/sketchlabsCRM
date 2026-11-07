import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Search, FileText } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form-controls";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth/session";
import { listMaintenance } from "@/lib/maintenance/queries";
import { MAINTENANCE_STATUSES } from "@/lib/constants";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Maintenance" };

type SearchParams = Promise<{ q?: string; status?: string; page?: string }>;

export default async function MaintenancePage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  const sp = await searchParams;
  const status = sp.status && (MAINTENANCE_STATUSES as readonly string[]).includes(sp.status) ? sp.status : "";
  const q = sp.q ?? "";
  const page = Math.max(1, Number(sp.page) || 1);

  const { rows, pageCount } = await listMaintenance({ q, status, page });

  return (
    <>
      <PageHeader
        title="Maintenance agreements"
        description="Recurring maintenance contracts with clients. An active agreement drives the client's billing."
        actions={
          <Link href="/maintenance/new" className={buttonVariants()}>
            <Plus /> New agreement
          </Link>
        }
      />

      <Card className="mb-6">
        <form className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end" method="get">
          <div className="flex-1">
            <label htmlFor="q" className="mb-1 block text-xs font-medium text-muted">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input id="q" name="q" defaultValue={q} placeholder="Number or client…" className="pl-9" />
            </div>
          </div>
          <div className="sm:w-48">
            <label htmlFor="status" className="mb-1 block text-xs font-medium text-muted">Status</label>
            <Select id="status" name="status" defaultValue={status}>
              <option value="">All</option>
              {MAINTENANCE_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="secondary">Filter</Button>
        </form>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title="No maintenance agreements"
          description="Create an agreement to set up recurring billing for a client."
          action={<Link href="/maintenance/new" className={buttonVariants()}>New agreement</Link>}
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface-muted/60 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Number</th>
                  <th className="px-5 py-3 font-medium">Client</th>
                  <th className="px-5 py-3 font-medium">Period</th>
                  <th className="px-5 py-3 font-medium">Cycle</th>
                  <th className="px-5 py-3 text-right font-medium">Value</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-muted/40">
                    <td className="px-5 py-3">
                      <Link href={`/maintenance/${r.id}`} className="num font-medium text-primary hover:underline">{r.number}</Link>
                    </td>
                    <td className="px-5 py-3">
                      <Link href={`/clients/${r.client.clientCode}`} className="hover:underline">{r.client.companyName}</Link>
                      <p className="num text-xs text-muted">{r.client.clientCode}</p>
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {r.validFrom.toLocaleDateString("en-GB")} – {r.validUntil?.toLocaleDateString("en-GB") ?? "—"}
                    </td>
                    <td className="px-5 py-3">{r.cycle}</td>
                    <td className="num px-5 py-3 text-right">{formatMoney(r.grandTotal, r.currency)}</td>
                    <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <Link href={`/maintenance?${new URLSearchParams({ q, status, page: String(page - 1) })}`} className={buttonVariants({ variant: "secondary", size: "sm" })} aria-disabled={page <= 1}>
                <ChevronLeft /> Prev
              </Link>
              <span className="text-sm text-muted">Page {page} of {pageCount}</span>
              <Link href={`/maintenance?${new URLSearchParams({ q, status, page: String(page + 1) })}`} className={buttonVariants({ variant: "secondary", size: "sm" })} aria-disabled={page >= pageCount}>
                Next <ChevronRight />
              </Link>
            </div>
          )}
        </>
      )}
    </>
  );
}
