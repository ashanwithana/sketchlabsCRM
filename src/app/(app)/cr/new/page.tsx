import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { CrForm } from "@/components/cr/cr-form";
import { requireUser } from "@/lib/auth/session";
import { listClientsForQuotation } from "@/lib/quotations/queries";
import { getCompanySettings } from "@/lib/settings";

export const metadata: Metadata = { title: "New CR document" };

type SearchParams = Promise<{ quotation?: string; client?: string }>;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export default async function NewCrPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  const sp = await searchParams;
  const [clients, settings] = await Promise.all([listClientsForQuotation(), getCompanySettings()]);

  const clientId = clients.some((c) => c.id === sp.client) ? (sp.client as string) : "";

  return (
    <>
      <PageHeader
        title="New CR document"
        description="A customer request or confirmation. The CR number is assigned when you save."
      />
      <CrForm
        mode="create"
        clients={clients}
        currency={settings.currency}
        defaults={{
          clientId,
          issueDate: isoDay(new Date()),
          requestDetails: "",
          scopeOfWork: "",
          deliveryDate: "",
          customerRequirements: "",
          remarks: "",
          cost: "",
        }}
      />
    </>
  );
}
