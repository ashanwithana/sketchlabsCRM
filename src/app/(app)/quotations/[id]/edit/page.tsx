import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { QuotationForm } from "@/components/quotations/quotation-form";
import { requireUser } from "@/lib/auth/session";
import { getCompanySettings } from "@/lib/settings";
import { getQuotationDetail, listClientsForQuotation } from "@/lib/quotations/queries";
import { listCrOptions } from "@/lib/cr/queries";
import { toDecimalString } from "@/lib/money";

export const metadata: Metadata = { title: "Edit quotation" };

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const dec = (minor: number) => (minor === 0 ? "" : toDecimalString(minor));
const pct = (bp: number) => (bp === 0 ? "" : toDecimalString(bp).replace(/\.00$/, ""));

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const [doc, clients, crs, settings] = await Promise.all([getQuotationDetail(id), listClientsForQuotation(), listCrOptions(), getCompanySettings()]);
  if (!doc?.quotation) notFound();

  return (
    <>
      <PageHeader title={`Edit ${doc.number}`} description="Totals are recalculated when you save." />
      <QuotationForm
        mode="edit"
        id={id}
        documentNumber={doc.number}
        clients={clients}
        crs={crs}
        currency={doc.quotation.currency}
        defaultTaxRate={pct(settings.defaultTaxRateBp)}
        defaults={{
          clientId: doc.clientId,
          crId: doc.quotation.crId ?? "",
          issueDate: isoDay(doc.issueDate),
          validUntil: isoDay(doc.quotation.validUntil),
          terms: doc.quotation.terms ?? "",
          notes: doc.quotation.notes ?? "",
          items: doc.quotation.items.map((i) => ({
            description: i.description,
            quantity: String(i.quantity),
            unitPrice: dec(i.unitPrice),
            discount: dec(i.discount),
            taxRate: pct(i.taxRateBp),
          })),
        }}
      />
    </>
  );
}
