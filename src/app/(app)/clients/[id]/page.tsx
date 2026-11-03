import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, MapPin, Pencil, Phone, Building2, UserRound, ClipboardCheck, FileText, Wrench, Settings2, History } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ArchiveClientButton, DeleteClientButton } from "@/components/clients/client-actions";
import { EquipmentPanel } from "@/components/clients/equipment-panel";
import { CLIENT_CATEGORIES } from "@/lib/constants";
import { requireUser } from "@/lib/auth/session";
import { getClientWithHistory } from "@/lib/clients/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Client" };

const TABS = [
  { key: "overview", label: "Overview", icon: Building2 },
  { key: "quotations", label: "Quotations", icon: FileText },
  { key: "cr", label: "CR documents", icon: ClipboardCheck },
  { key: "maintenance", label: "Maintenance", icon: Wrench },
  { key: "equipment", label: "Equipment", icon: Settings2 },
  { key: "activity", label: "Activity", icon: History },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const data = await getClientWithHistory(id);
  if (!data) notFound();

  const { client, activity } = data;
  const tab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : "overview";
  const categoryLabel = CLIENT_CATEGORIES.find((c) => c.value === client.category)?.label ?? client.category;

  const docsOf = (type: string) => client.documents.filter((d) => d.type === type);
  const quotations = docsOf("QUOTATION");
  const crs = docsOf("CR");
  const maintenance = docsOf("MAINTENANCE");

  return (
    <>
      <div className="mb-6">
        <Link href="/clients" className="text-sm text-muted hover:text-foreground">
          ← All clients
        </Link>
      </div>

      <PageHeader
        title={client.companyName}
        description={`${client.clientCode} · ${categoryLabel}${client.archivedAt ? " · Archived" : ""}`}
        actions={
          <>
            <Link href={`/clients/${client.id}/edit`} className={buttonVariants({ variant: "secondary" })}>
              <Pencil /> Edit
            </Link>
            <ArchiveClientButton clientId={client.id} archived={Boolean(client.archivedAt)} />
            <DeleteClientButton clientId={client.id} companyName={client.companyName} />
          </>
        }
      />

      {/* Tab bar. Horizontal scroll on small screens. */}
      <nav aria-label="Client sections" className="mb-6 -mx-4 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1">
          {TABS.map((t) => {
            const active = t.key === tab;
            const count =
              t.key === "quotations" ? quotations.length : t.key === "cr" ? crs.length : t.key === "maintenance" ? maintenance.length : t.key === "equipment" ? client.equipment.length : null;
            const Icon = t.icon;
            return (
              <li key={t.key}>
                <Link
                  href={`/clients/${client.id}?tab=${t.key}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                    active ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {t.label}
                  {count !== null && (
                    <span className="num rounded-full bg-surface-muted px-1.5 text-xs text-muted">{count}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Client details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <Detail icon={<UserRound />} label="Contact person" value={client.contactPerson} />
              <Detail icon={<Mail />} label="Email" value={<a className="text-primary hover:underline" href={`mailto:${client.email}`}>{client.email}</a>} />
              <Detail icon={<Phone />} label="Phone" value={client.phone} />
              <Detail icon={<MapPin />} label="Billing address" value={client.billingAddress} />
              <Detail label="Company registration no." value={client.registrationNumber} />
              <Detail label="VAT number" value={client.vatNumber ?? "—"} />
              <Detail label="Category" value={categoryLabel} />
              <Detail label="Registered" value={client.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} />
              {client.notes && <Detail label="Notes" value={client.notes} className="sm:col-span-2" />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Records</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Stat label="Quotations" value={quotations.length} href={`/clients/${client.id}?tab=quotations`} />
              <Stat label="CR documents" value={crs.length} href={`/clients/${client.id}?tab=cr`} />
              <Stat label="Maintenance reports" value={maintenance.length} href={`/clients/${client.id}?tab=maintenance`} />
              <Stat label="Equipment" value={client.equipment.length} href={`/clients/${client.id}?tab=equipment`} />
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "quotations" && (
        <DocumentTable
          title="Quotations"
          empty="No quotations for this client yet."
          hint="Quotations are created in the Quotations module (Task 5)."
          rows={quotations.map((d) => ({ id: d.id, number: d.number, status: d.status, date: d.issueDate, amount: d.quotation?.grandTotal ?? null }))}
        />
      )}
      {tab === "cr" && (
        <DocumentTable
          title="CR documents"
          empty="No CR documents for this client yet."
          hint="CR documents are created in the CR module (Task 8)."
          rows={crs.map((d) => ({ id: d.id, number: d.number, status: d.status, date: d.issueDate, amount: null }))}
        />
      )}
      {tab === "maintenance" && (
        <DocumentTable
          title="Maintenance records"
          empty="No maintenance records for this client yet."
          hint="Maintenance records are created in the Maintenance module (Task 9)."
          rows={maintenance.map((d) => ({ id: d.id, number: d.number, status: d.status, date: d.maintenance?.maintenanceDate ?? d.issueDate, amount: null }))}
        />
      )}

      {tab === "equipment" && (
        <EquipmentPanel
          clientId={client.id}
          items={client.equipment.map((e) => ({
            id: e.id,
            name: e.name,
            model: e.model,
            serialNumber: e.serialNumber,
            location: e.location,
            installedOn: e.installedOn,
            notes: e.notes,
            _count: e._count,
          }))}
        />
      )}

      {tab === "activity" && (
        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
          </CardHeader>
          {activity.length === 0 ? (
            <EmptyState icon={<History />} title="No activity yet" />
          ) : (
            <ol className="divide-y divide-border">
              {activity.map((a) => (
                <li key={a.id} className="flex gap-4 px-5 py-3.5">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">{a.summary}</p>
                    <p className="num text-xs text-muted">
                      {a.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      )}
    </>
  );
}

function Detail({
  label,
  value,
  icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted [&_svg]:size-3.5">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 whitespace-pre-line break-words text-sm text-foreground">{value}</dd>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-muted">
      <span className="text-sm text-muted">{label}</span>
      <span className="num text-base font-semibold text-foreground">{value}</span>
    </Link>
  );
}

function DocumentTable({
  title,
  empty,
  hint,
  rows,
}: {
  title: string;
  empty: string;
  hint: string;
  rows: { id: string; number: string; status: string; date: Date; amount: number | null }[];
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      {rows.length === 0 ? (
        <EmptyState icon={<FileText />} title={empty} description={hint} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-border bg-surface-muted/60 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Number</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="num px-5 py-3 font-medium"><Link href={`/documents/${r.id}`} className="hover:text-primary hover:underline">{r.number}</Link></td>
                  <td className="px-5 py-3 text-muted">{r.date.toLocaleDateString("en-GB")}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="num px-5 py-3 text-right">{r.amount === null ? "—" : (r.amount / 100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
