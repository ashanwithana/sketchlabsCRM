import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { MaintenanceForm } from "@/components/maintenance/maintenance-form";
import { requireUser } from "@/lib/auth/session";
import { getCompanySettings } from "@/lib/settings";
import { listClientsForQuotation } from "@/lib/quotations/queries";
import { toDecimalString } from "@/lib/money";

export const metadata: Metadata = { title: "New maintenance agreement" };

type SearchParams = Promise<{ client?: string }>;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export default async function NewMaintenancePage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  const { client } = await searchParams;
  const [clients, settings] = await Promise.all([listClientsForQuotation(), getCompanySettings()]);

  const today = isoDay(new Date());
  const defaultTaxRate = toDecimalString(settings.defaultTaxRateBp).replace(/\.00$/, "");

  return (
    <>
      <PageHeader title="New maintenance agreement" description="The MR number is assigned on save. Activating sets up recurring billing for the client." />
      <MaintenanceForm
        mode="create"
        clients={clients}
        currency={settings.currency}
        defaultTaxRate={defaultTaxRate === "0" ? "" : defaultTaxRate}
        defaults={{
          clientId: clients.some((c) => c.id === client) ? (client as string) : "",
          validFrom: today,
          validUntil: today,
          cycle: "MONTHLY",
          billingDay: "1",
          description: "",
          terms: settings.quotationTerms ?? "",
          notes: "",
          items: [{ description: "", quantity: "1", unitPrice: "", taxRate: defaultTaxRate === "0" ? "" : defaultTaxRate }],
        }}
      />
    </>
  );
}