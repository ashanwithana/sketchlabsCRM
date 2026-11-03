import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Plus, Search, Users } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form-controls";
import { CLIENT_CATEGORIES } from "@/lib/constants";
import { requireUser } from "@/lib/auth/session";
import { listClients } from "@/lib/clients/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Clients" };

type SearchParams = Promise<{ q?: string; category?: string; status?: string; sort?: string; page?: string }>;

const categoryLabel = Object.fromEntries(CLIENT_CATEGORIES.map((c) => [c.value, c.label]));

export default async function ClientsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  const sp = await searchParams;

  const status = sp.status === "archived" || sp.status === "all" ? sp.status : "active";
  const sort = sp.sort === "name" ? "name" : "newest";
  const category = CLIENT_CATEGORIES.some((c) => c.value === sp.category) ? sp.category : undefined;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const result = await listClients({ q: sp.q, category, status, sort, page });

  const exportParams = new URLSearchParams();
  if (sp.q) exportParams.set("q", sp.q);
  if (category) exportParams.set("category", category);
  exportParams.set("status", status);

  const pageLink = (p: number) => {
    const params = new URLSearchParams(exportParams);
    params.set("sort", sort);
    params.set("page", String(p));
    return `/clients?${params.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Clients"
        description={`${result.total} ${status === "archived" ? "archived" : "registered"} client${result.total === 1 ? "" : "s"}`}
        actions={
          <>
            <Link href={`/api/clients/export?${exportParams.toString()}`} className={buttonVariants({ variant: "secondary" })}>
              <Download /> Export CSV
            </Link>
            <Link href="/clients/new" className={buttonVariants({ variant: "primary" })}>
              <Plus /> Register client
            </Link>
          </>
        }
      />

      <Card className="mb-5">
        <form method="get" className="grid gap-3 p-4 md:grid-cols-[1fr_200px_180px_160px_auto] md:items-center">
          <label className="relative block">
            <span className="sr-only">Search clients</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <Input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Search name, contact, email, phone, or CL-0001"
              className="pl-9"
            />
          </label>
          <Select name="category" defaultValue={category ?? ""} aria-label="Category">
            <option value="">All categories</option>
            {CLIENT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
          <Select name="status" defaultValue={status} aria-label="Status">
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </Select>
          <Select name="sort" defaultValue={sort} aria-label="Sort">
            <option value="newest">Newest first</option>
            <option value="name">Name A–Z</option>
          </Select>
          <Button type="submit" variant="secondary">
            Apply
          </Button>
        </form>
      </Card>

      <Card className="overflow-hidden">
        {result.rows.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title={sp.q || category ? "No clients match these filters" : "No clients yet"}
            description={sp.q || category ? "Try a different search or clear the filters." : "Register your first client to start creating documents."}
            action={
              !sp.q && !category && status === "active" ? (
                <Link href="/clients/new" className={buttonVariants({ variant: "primary" })}>
                  <Plus /> Register client
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
                    <th className="px-5 py-3 font-medium">Client ID</th>
                    <th className="px-5 py-3 font-medium">Company</th>
                    <th className="px-5 py-3 font-medium">Contact</th>
                    <th className="px-5 py-3 font-medium">Phone</th>
                    <th className="px-5 py-3 font-medium">Category</th>
                    <th className="px-5 py-3 text-right font-medium">Documents</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result.rows.map((c) => (
                    <tr key={c.id} className="transition-colors hover:bg-primary-soft/40">
                      <td className="num whitespace-nowrap px-5 py-3.5 font-medium text-muted">{c.clientCode}</td>
                      <td className="relative px-5 py-3.5">
                        <Link href={`/clients/${c.id}`} className="font-medium text-foreground after:absolute after:inset-0 hover:text-primary">
                          {c.companyName}
                        </Link>
                        <div className="text-xs text-muted">{c.email}</div>
                        {c.archivedAt && <span className="mt-1 inline-block rounded bg-surface-muted px-1.5 py-0.5 text-[11px] font-medium text-muted">Archived</span>}
                      </td>
                      <td className="px-5 py-3.5 text-foreground">{c.contactPerson}</td>
                      <td className="num whitespace-nowrap px-5 py-3.5 text-muted">{c.phone}</td>
                      <td className="px-5 py-3.5">
                        <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-muted">
                          {categoryLabel[c.category] ?? c.category}
                        </span>
                      </td>
                      <td className="num px-5 py-3.5 text-right text-muted">{c._count.documents}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-sm text-muted">
              <span className="num">
                Page {result.page} of {result.pageCount}
              </span>
              <div className="flex gap-2">
                <PagerLink href={pageLink(result.page - 1)} disabled={result.page <= 1} label="Previous page">
                  <ChevronLeft className="size-4" /> Previous
                </PagerLink>
                <PagerLink href={pageLink(result.page + 1)} disabled={result.page >= result.pageCount} label="Next page">
                  Next <ChevronRight className="size-4" />
                </PagerLink>
              </div>
            </div>
          </>
        )}
      </Card>
    </>
  );
}

function PagerLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const className = cn(
    buttonVariants({ variant: "secondary", size: "sm" }),
    disabled && "pointer-events-none opacity-50",
  );
  return (
    <Link href={href} aria-label={label} aria-disabled={disabled} tabIndex={disabled ? -1 : undefined} className={className}>
      {children}
    </Link>
  );
}
