import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { MaintenanceForm } from "@/components/maintenance/maintenance-form";
import { requireUser } from "@/lib/auth/session";
import { getMaintenanceDetail } from "@/lib/maintenance/queries";
import { listClientsForQuotation } from "@/lib/quotations/queries";
import { getCompanySettings } from "@/lib/settings";
import { toDecimalString } from "@/lib/money";

export const metadata: Metadata = { title: "Edit maintenance agreement" };

const isoDay = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
const dec = (minor: number) => (minor === 0 ? "" : toDecimalString(minor));
const pct = (bp: number) => (bp === 0 ? "" : toDecimalString(bp).replace(/\.00$/, ""));

export default async function EditMaintenancePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const [doc, clients, settings] = await Promise.all([getMaintenanceDetail(id), listClientsForQuotation(), getCompanySettings()]);
  if (!doc?.maintenance) notFound();
  const m = doc.maintenance;

  const defaultTaxRate = toDecimalString(settings.defaultTaxRateBp).replace(/\.00$/, "");

  return (
    <>
      <PageHeader title={`Edit ${doc.number}`} description="Changes are recorded in the activity log." />
      <MaintenanceForm
        mode="edit"
        id={id}
        documentNumber={doc.number}
        clients={clients}
        currency={m.currency ?? settings.currency}
        defaultTaxRate={defaultTaxRate === "0" ? "" : defaultTaxRate}
        defaults={{
          clientId: doc.clientId,
          validFrom: isoDay(m.validFrom),
          validUntil: isoDay(m.validUntil),
          cycle: m.cycle as "MONTHLY" | "QUARTERLY" | "ANNUAL",
          billingDay: String(m.billingDay),
          description: m.description,
          terms: m.terms ?? "",
          notes: m.notes ?? "",
          items: m.items.map((i) => ({
            description: i.description,
            quantity: String(i.quantity),
            unitPrice: dec(i.unitPrice),
            taxRate: pct(i.taxRateBp),
          })),
        }}
      />
    </>
  );
}