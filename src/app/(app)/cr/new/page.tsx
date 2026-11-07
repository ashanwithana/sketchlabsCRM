import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { CrForm } from "@/components/cr/cr-form";
import { requireUser } from "@/lib/auth/session";
import { listClientsForQuotation } from "@/lib/quotations/queries";
import { getQuotationDetail } from "@/lib/quotations/queries";
import { listQuotationOptions } from "@/lib/cr/queries";
import { getCompanySettings } from "@/lib/settings";

export const metadata: Metadata = { title: "New CR document" };

type SearchParams = Promise<{ quotation?: string; client?: string }>;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export default async function NewCrPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  const sp = await searchParams;
  const [clients, quotations, settings] = await Promise.all([listClientsForQuotation(), listQuotationOptions(), getCompanySettings()]);

  // Opening from a quotation pre-selects its client and fills the request from it.
  const source = sp.quotation ? await getQuotationDetail(sp.quotation) : null;
  const clientId = source?.clientId ?? (clients.some((c) => c.id === sp.client) ? (sp.client as string) : "");
  const scopeHint = source?.quotation
    ? source.quotation.items.map((i) => `- ${i.description}`).join("\n")
    : "";

  return (
    <>
      <PageHeader
        title="New CR document"
        description="A customer request or confirmation. The CR number is assigned when you save."
      />
      <CrForm
        mode="create"
        clients={clients}
        quotations={quotations}
        currency={settings.currency}
        defaults={{
          clientId,
          quotationId: source ? source.id : "",
          issueDate: isoDay(new Date()),
          requestDetails: source
            ? `Customer confirms the work described in ${source.number} and asks us to proceed.`
            : "",
          scopeOfWork: scopeHint ? `Work as quoted in ${source!.number}:\n${scopeHint}` : "",
          deliveryDate: "",
          customerRequirements: "",
          remarks: "",
          cost: "",
          approvalName: "",
          approvalDate: "",
          customerSignature: "",
        }}
      />
    </>
  );
}
