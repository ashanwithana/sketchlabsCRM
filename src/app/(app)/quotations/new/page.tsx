import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { QuotationForm } from "@/components/quotations/quotation-form";
import { requireUser } from "@/lib/auth/session";
import { getCompanySettings } from "@/lib/settings";
import { listClientsForQuotation } from "@/lib/quotations/queries";
import { listCrOptions } from "@/lib/cr/queries";
import { addDays, issueDateFrom } from "@/lib/quotations/service";
import { toDecimalString } from "@/lib/money";

export const metadata: Metadata = { title: "New quotation" };

type SearchParams = Promise<{ client?: string }>;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export default async function NewQuotationPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  const { client } = await searchParams;
  const [clients, crs, settings] = await Promise.all([listClientsForQuotation(), listCrOptions(), getCompanySettings()]);

  const issue = issueDateFrom(isoDay(new Date()));
  const defaultTaxRate = toDecimalString(settings.defaultTaxRateBp).replace(/\.00$/, "");

  return (
    <>
      <PageHeader title="New quotation" description="The quotation number is assigned automatically when you save." />
      <QuotationForm
        mode="create"
        clients={clients}
        crs={crs}
        currency={settings.currency}
        defaultTaxRate={defaultTaxRate === "0" ? "" : defaultTaxRate}
        defaults={{
          clientId: clients.some((c) => c.id === client) ? (client as string) : "",
          crId: "",
          issueDate: isoDay(issue),
          validUntil: isoDay(addDays(issue, settings.defaultValidDays)),
          terms: settings.quotationTerms,
          notes: "",
          items: [{ description: "", quantity: "1", unitPrice: "", discount: "", taxRate: defaultTaxRate === "0" ? "" : defaultTaxRate }],
        }}
      />
    </>
  );
}
