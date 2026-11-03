import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ClientForm } from "@/components/clients/client-form";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Edit client" };

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const client = await db.client.findUnique({ where: { id } });
  if (!client) notFound();

  return (
    <>
      <PageHeader title={`Edit ${client.companyName}`} description="Changes are recorded in the activity log." />
      <ClientForm
        mode="edit"
        defaults={{
          id: client.id,
          clientCode: client.clientCode,
          companyName: client.companyName,
          contactPerson: client.contactPerson,
          email: client.email,
          phone: client.phone,
          billingAddress: client.billingAddress,
          registrationNumber: client.registrationNumber,
          vatNumber: client.vatNumber ?? "",
          category: client.category as "CORPORATE",
          notes: client.notes ?? "",
        }}
      />
    </>
  );
}
