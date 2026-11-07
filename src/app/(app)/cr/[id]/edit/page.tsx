import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { CrForm } from "@/components/cr/cr-form";
import { requireUser } from "@/lib/auth/session";
import { getCrDetail, listQuotationOptions } from "@/lib/cr/queries";
import { listClientsForQuotation } from "@/lib/quotations/queries";
import { getCompanySettings } from "@/lib/settings";
import { toDecimalString } from "@/lib/money";

export const metadata: Metadata = { title: "Edit CR document" };

const isoDay = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

export default async function EditCrPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const [doc, clients, quotations, settings] = await Promise.all([getCrDetail(id), listClientsForQuotation(), listQuotationOptions(), getCompanySettings()]);
  if (!doc?.cr) notFound();
  const cr = doc.cr;
  const dec = (minor: number) => (minor === 0 ? "" : toDecimalString(minor));

  return (
    <>
      <PageHeader title={`Edit ${doc.number}`} description="Changes are recorded in the activity log." />
      <CrForm
        mode="edit"
        id={id}
        documentNumber={doc.number}
        clients={clients}
        quotations={quotations}
        currency={settings.currency}
        defaults={{
          clientId: doc.clientId,
          quotationId: cr.quotation?.document.id ?? "",
          issueDate: isoDay(doc.issueDate),
          requestDetails: cr.requestDetails,
          scopeOfWork: cr.scopeOfWork,
          deliveryDate: isoDay(cr.deliveryDate),
          customerRequirements: cr.customerRequirements ?? "",
          remarks: cr.remarks ?? "",
          cost: dec(cr.cost),
          approvalName: cr.approvalName ?? "",
          approvalDate: isoDay(cr.approvalDate),
          customerSignature: cr.customerSignature ?? "",
        }}
      />
    </>
  );
}
