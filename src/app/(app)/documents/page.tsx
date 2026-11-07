import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, FolderOpen, Search } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form-controls";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth/session";
import { DOCUMENT_TYPE_LABELS, listDocuments, REPO_PAGE_SIZE } from "@/lib/documents/repository";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Documents" };

type SearchParams = Promise<{ q?: string; type?: string; status?: string; from?: string; to?: string; page?: string }>;

const TYPES = ["QUOTATION", "CR", "MAINTENANCE", "INVOICE"] as const;
const STATUSES = [
  { group: "Quotation", value: "DRAFT", label: "Draft" },
  { group: "Quotation", value: "SENT", label: "Sent" },
  { group: "Quotation", value: "PENDING", label: "Pending" },
  { group: "Quotation", value: "APPROVED", label: "Approved" },
  { group: "Quotation", value: "REJECTED", label: "Rejected" },
  { group: "Quotation", value: "EXPIRED", label: "Expired" },
  { group: "Maintenance", value: "ACTIVE", label: "Active" },
  { group: "Maintenance", value: "CANCELLED", label: "Cancelled" },
  { group: "Invoice", value: "DRAFT", label: "Draft" },
  { group: "Invoice", value: "SENT", label: "Sent" },
  { group: "Invoice", value: "PAID", label: "Paid" },
  { group: "Invoice", value: "VOID", label: "Void" },
] as const;

const isDay = (s: string | undefined) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "");

export default async function DocumentsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  const sp = await searchParams;
  const type = (TYPES as readonly string[]).includes(sp.type ?? "") ? (sp.type as string) : "";
  const status = STATUSES.some((s) => s.value === sp.status) ? (sp.status as string) : "";
  const q = sp.q ?? "";
  const from = isDay(sp.from);
  const to = isDay(sp.to);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const result = await listDocuments({ q, type, status, from, to, page });

  const filterParams = new URLSearchParams();
  if (q) filterParams.set("q", q);
  if (type) filterParams.set("type", type);
  if (status) filterParams.set("status", status);
  if (from) filterParams.set("from", from);
  if (to) filterParams.set("to", to);
  const pageLink = (p: number) => {
    const params = new URLSearchParams(filterParams);
    params.set("page", String(p));
    return `/documents?${params.toString()}`;
  };
  const exportHref = `/api/documents/export?${filterParams.toString()}`;

  return (
    <>
      <PageHeader
        title="Documents"
        description={`${result.total} document${result.total === 1 ? "" : "s"} across quotations, CRs, and maintenance reports`}
        actions={
          <a href={exportHref} className={buttonVariants({ variant: "secondary" })}>
            <Download /> Export CSV
          </a>
        }
      />

      <Card className="mb-5">
        <form method="get" className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto] xl:items-center">
          <label className="relative block">
            <span className="sr-only">Search by client or number</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <Input name="q" defaultValue={q} placeholder="Client name, client ID, or document number" className="pl-9" />
          </label>
          <Select name="type" defaultValue={type} aria-label="Document type">
            <option value="">All types</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>
            ))}
          </Select>
          <Select name="status" defaultValue={status} aria-label="Status">
            <option value="">All statuses</option>
            {["Quotation", "Maintenance", "Invoice"].map((group) => (
              <optgroup key={group} label={group}>
                {STATUSES.filter((s) => s.group === group).map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </optgroup>
            ))}
          </Select>
          <Input name="from" type="date" defaultValue={from} aria-label="Issued from" />
          <Input name="to" type="date" defaultValue={to} aria-label="Issued to" />
          <Button type="submit" variant="secondary">Apply</Button>
        </form>
      </Card>

      <Card className="overflow-hidden">
        {result.rows.length === 0 ? (
          <EmptyState
            icon={<FolderOpen />}
            title="No documents match these filters"
            description="Try a wider date range, or clear the type and status filters."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-surface-muted/60 text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-5 py-3 font-medium">Number</th>
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-5 py-3 font-medium">Client</th>
                    <th className="px-5 py-3 font-medium">Issued</th>
                    <th className="px-5 py-3 text-right font-medium">Amount</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="hidden px-4 py-3 font-medium 2xl:table-cell">Revision</th>
                    <th className="px-5 py-3 text-right font-medium">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result.rows.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-primary-soft/40">
                      <td className="relative whitespace-nowrap px-5 py-3.5">
                        <Link href={`/documents/${r.id}`} className="num font-medium text-foreground after:absolute after:inset-0 hover:text-primary">{r.number}</Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={cn("whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", r.type === "QUOTATION" ? "bg-primary-soft text-primary" : r.type === "CR" ? "bg-info-soft text-info" : r.type === "INVOICE" ? "bg-success-soft text-success" : "bg-warning-soft text-warning")}>
                          {DOCUMENT_TYPE_LABELS[r.type] ?? r.type}
                        </span>
                      </td>
                      <td className="max-w-[170px] px-4 py-3.5">
                        <span className="block truncate text-foreground">{r.client.companyName}</span>
                        <div className="num text-xs text-muted">{r.client.clientCode}</div>
                      </td>
                      <td className="num whitespace-nowrap px-5 py-3.5 text-muted">{r.issueDate.toLocaleDateString("en-GB")}</td>
                      <td className="num whitespace-nowrap px-5 py-3.5 text-right">{r.grandTotal === null || !r.currency ? "—" : formatMoney(r.grandTotal, r.currency)}</td>
                      <td className="px-5 py-3.5"><StatusBadge status={r.status} /></td>
                      <td className="num hidden whitespace-nowrap px-4 py-3.5 text-muted 2xl:table-cell">{r.currentRevision ? `Rev ${r.currentRevision}` : "None yet"}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right">
                        <a href={`/api/documents/${r.id}/pdf?download=1`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                          <Download className="size-3.5" /> PDF
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-sm text-muted">
              <span className="num">Page {result.page} of {result.pageCount} · {REPO_PAGE_SIZE} per page</span>
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
