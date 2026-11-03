import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { MaintenanceForm } from "@/components/maintenance/maintenance-form";
import { requireUser } from "@/lib/auth/session";
import { listClientsForQuotation } from "@/lib/quotations/queries";
import { listEquipmentOptions } from "@/lib/maintenance/queries";

export const metadata: Metadata = { title: "New maintenance record" };

type SearchParams = Promise<{ client?: string; equipment?: string }>;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export default async function NewMaintenancePage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  const sp = await searchParams;
  const [clients, equipment] = await Promise.all([listClientsForQuotation(), listEquipmentOptions()]);
  const picked = equipment.find((e) => e.id === sp.equipment);
  const clientId = picked?.clientId ?? (clients.some((c) => c.id === sp.client) ? (sp.client as string) : "");

  return (
    <>
      <PageHeader title="New maintenance record" description="Schedule a visit, or record a completed service. The MR number is assigned on save." />
      <MaintenanceForm
        mode="create"
        clients={clients}
        equipment={equipment}
        defaults={{
          clientId,
          equipmentId: picked?.id ?? "",
          status: "SCHEDULED",
          maintenanceDate: isoDay(new Date()),
          nextMaintenanceDate: "",
          description: "",
          workPerformed: "",
          technicianName: "",
          technicianDetails: "",
          parts: [],
          customerRemarks: "",
          recommendations: "",
          customerSignature: "",
          technicianSignature: "",
        }}
      />
    </>
  );
}
