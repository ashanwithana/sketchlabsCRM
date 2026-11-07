import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, ChevronLeft, ChevronRight, Plus, Search, Wrench } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form-controls";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth/session";
import { listMaintenance, UPCOMING_WINDOW_DAYS } from "@/lib/maintenance/queries";
import { MAINTENANCE_STATUSES } from "@/lib/constants";

export const metadata: Metadata = { title: "Maintenance" };

type SearchParams = Promise<{ q?: string; status?: string; page?: string }>;
const FILTERS = ["UPCOMING", "COMPLETED", "CANCELLED", "", ...MAINTENANCE_STATUSES.filter((s) => s !== "SCHEDULED")] as const;

export default async function MaintenancePage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  const sp = await searchParams;
  const status = (FILTERS as readonly string[]).includes(sp.status ?? "") ? (sp.status as string) : "UPCOMING";
  const q = sp.q ?? "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const result = await listMaintenance({ q, status: status === "" ? undefined : status, page });

  const pageLink = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("status", status);
    params.set("page", String(p));
    return `/maintenance?${params.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Maintenance"
        description={status === "UPCOMING" ? `Scheduled services. Overdue ones are marked in red. Dashboard shows the next ${UPCOMING_WINDOW_DAYS} days.` : `${result.total} record${result.total === 1 ? "" : "s"}`}
        actions={
          <Link href="/maintenance/new" className={buttonVariants({ variant: "primary" })}>
            <Plus /> New service record
          </Link>
        }
      />

      <Card className="mb-5">
        <form method="get" className="grid gap-3 p-4 md:grid-cols-[1fr_200px_auto] md:items-center">
          <label className="relative block">
            <span className="sr-only">Search maintenance records</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <Input name="q" defaultValue={q} placeholder="Search by MR number or client" className="pl-9" />
          </label>
          <Select name="status" defaultValue={status} aria-label="Status">
            <option value="UPCOMING">Upcoming and overdue</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="">All records</option>
          </Select>
          <Button type="submit" variant="secondary">Apply</Button>
        </form>
      </Card>

      <Card className="overflow-hidden">
        {result.rows.length === 0 ? (
          <EmptyState
            icon={status === "UPCOMING" ? <CalendarClock /> : <Wrench />}
            title={status === "UPCOMING" && !q ? "Nothing scheduled" : "No maintenance records match"}
            description="Schedule a visit, or record a completed service with its parts and signatures."
            action={<Link href="/maintenance/new" className={buttonVariants({ variant: "primary" })}><Plus /> New service record</Link>}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-border bg-surface-muted/60 text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-5 py-3 font-medium">Number</th>
                    <th className="px-5 py-3 font-medium">Client</th>
                    <th className="px-5 py-3 font-medium">System</th>
                    <th className="px-5 py-3 font-medium">Service date</th>
                    <th className="px-5 py-3 font-medium">Next service</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result.rows.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-primary-soft/40">
                      <td className="relative whitespace-nowrap px-5 py-3.5">
                        <Link href={`/maintenance/${r.id}`} className="num font-medium text-foreground after:absolute after:inset-0 hover:text-primary">{r.number}</Link>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-foreground">{r.client.companyName}</span>
                        <div className="num text-xs text-muted">{r.client.clientCode}</div>
                      </td>
                      <td className="px-5 py-3.5 text-muted">{r.equipment}</td>
                      <td className="num whitespace-nowrap px-5 py-3.5 text-muted">{r.maintenanceDate.toLocaleDateString("en-GB")}</td>
                      <td className="num whitespace-nowrap px-5 py-3.5 text-muted">{r.nextMaintenanceDate ? r.nextMaintenanceDate.toLocaleDateString("en-GB") : "—"}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={r.status} />
                          {r.overdue && <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">Overdue</span>}
                        </div>
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
    </>
  );
}
