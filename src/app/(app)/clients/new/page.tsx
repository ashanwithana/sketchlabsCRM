import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ClientForm } from "@/components/clients/client-form";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Register client" };

export default async function NewClientPage() {
  await requireUser();
  return (
    <>
      <PageHeader title="Register client" description="The client ID (CL-####) is assigned automatically when you save." />
      <ClientForm
        mode="create"
        defaults={{
          companyName: "",
          contactPerson: "",
          email: "",
          phone: "",
          billingAddress: "",
          registrationNumber: "",
          vatNumber: "",
          category: "CORPORATE",
          notes: "",
        }}
      />
    </>
  );
}
