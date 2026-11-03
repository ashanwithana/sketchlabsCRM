import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { MaintenanceForm } from "@/components/maintenance/maintenance-form";
import { requireUser } from "@/lib/auth/session";
import { getMaintenanceDetail, listEquipmentOptions } from "@/lib/maintenance/queries";
import { listClientsForQuotation } from "@/lib/quotations/queries";

export const metadata: Metadata = { title: "Edit maintenance record" };

const isoDay = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

export default async function EditMaintenancePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const [doc, clients, equipment] = await Promise.all([getMaintenanceDetail(id), listClientsForQuotation(), listEquipmentOptions()]);
  if (!doc?.maintenance) notFound();
  const m = doc.maintenance;

  return (
    <>
      <PageHeader title={`Edit ${doc.number}`} description="Changes are recorded in the activity log." />
      <MaintenanceForm
        mode="edit"
        id={id}
        documentNumber={doc.number}
        clients={clients}
        equipment={equipment}
        defaults={{
          clientId: doc.clientId,
          equipmentId: m.equipmentId ?? "",
          status: (["SCHEDULED", "COMPLETED", "CANCELLED"] as const).find((s) => s === doc.status) ?? "SCHEDULED",
          maintenanceDate: isoDay(m.maintenanceDate),
          nextMaintenanceDate: isoDay(m.nextMaintenanceDate),
          description: m.description,
          workPerformed: m.workPerformed ?? "",
          technicianName: m.technicianName ?? "",
          technicianDetails: m.technicianDetails ?? "",
          parts: m.parts.map((p) => ({ name: p.name, quantity: String(p.quantity), notes: p.notes ?? "" })),
          customerRemarks: m.customerRemarks ?? "",
          recommendations: m.recommendations ?? "",
          customerSignature: m.customerSignature ?? "",
          technicianSignature: m.technicianSignature ?? "",
        }}
      />
    </>
  );
}
