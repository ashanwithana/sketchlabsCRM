"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2, UserRound } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { SignaturePad } from "@/components/cr/signature-pad";
import { maintenanceSchema, type MaintenanceInput, type MaintenanceValues } from "@/lib/validation/maintenance";
import { saveMaintenanceAction } from "@/app/(app)/maintenance/actions";

export type MaintenanceClientOption = {
  id: string;
  clientCode: string;
  companyName: string;
  contactPerson: string;
  email: string;
};

export type MaintenanceEquipmentOption = { id: string; label: string; clientId: string };

export function MaintenanceForm({
  mode,
  id,
  clients,
  equipment,
  defaults,
  documentNumber,
}: {
  mode: "create" | "edit";
  id?: string;
  clients: MaintenanceClientOption[];
  equipment: MaintenanceEquipmentOption[];
  defaults: MaintenanceInput;
  documentNumber?: string;
}) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    getValues,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<MaintenanceInput, unknown, MaintenanceValues>({
    resolver: zodResolver(maintenanceSchema),
    defaultValues: defaults,
    mode: "onTouched",
  });
  const parts = useFieldArray({ control, name: "parts" });

  const clientId = useWatch({ control, name: "clientId" });
  const selectedClient = clients.find((c) => c.id === clientId);
  const clientEquipment = equipment.filter((e) => e.clientId === clientId);

  const onSubmit = handleSubmit(async () => {
    setServerError(null);
    const result = await saveMaintenanceAction(getValues(), mode === "edit" ? id : undefined);
    if (!result.ok) {
      setServerError(result.error);
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        setError(field as keyof MaintenanceInput, { type: "server", message });
      }
      return;
    }
    router.push(`/maintenance/${result.id}`);
    router.refresh();
  });

  const err = (name: keyof MaintenanceInput) => errors[name]?.message as string | undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {serverError && <div role="alert" className="rounded-lg border border-danger-soft bg-danger-soft px-4 py-3 text-sm text-danger">{serverError}</div>}

        <Card>
          <CardHeader>
            <CardTitle>Client and equipment</CardTitle>
            {documentNumber && <span className="num text-xs font-medium text-muted">{documentNumber}</span>}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Client" htmlFor="clientId" required error={err("clientId")}>
                <Select id="clientId" {...register("clientId", { onChange: () => setValue("equipmentId", "") })}>
                  <option value="">Choose a client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.companyName} ({c.clientCode})</option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Equipment or service"
                htmlFor="equipmentId"
                required
                error={err("equipmentId")}
                hint={clientId && clientEquipment.length === 0 ? "This client has no equipment yet." : undefined}
              >
                <Select id="equipmentId" disabled={!clientId} {...register("equipmentId")}>
                  <option value="">{clientId ? "Choose equipment…" : "Choose a client first"}</option>
                  {clientEquipment.map((e) => (
                    <option key={e.id} value={e.id}>{e.label}</option>
                  ))}
                </Select>
              </Field>
            </div>
            {clientId && clientEquipment.length === 0 && (
              <p className="text-sm text-muted">
                Add the equipment on the{" "}
                <Link href={`/clients/${clientId}?tab=equipment`} className="font-medium text-primary hover:underline">client’s equipment tab</Link>{" "}
                first, then come back.
              </p>
            )}
            {selectedClient && (
              <div className="grid gap-1 rounded-lg bg-surface-muted p-4 text-sm">
                <p className="flex items-center gap-2 font-medium"><UserRound className="size-4 text-primary" /> {selectedClient.companyName}</p>
                <p className="text-muted">{selectedClient.contactPerson} · {selectedClient.email}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Service</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Status" htmlFor="status" required error={err("status")} hint="Scheduled = planned visit. Completed = work done.">
                <Select id="status" {...register("status")}>
                  <option value="SCHEDULED">Scheduled</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </Select>
              </Field>
              <Field label="Service date" htmlFor="maintenanceDate" required error={err("maintenanceDate")}>
                <Input id="maintenanceDate" type="date" {...register("maintenanceDate")} />
              </Field>
              <Field label="Next service date" htmlFor="nextMaintenanceDate" error={err("nextMaintenanceDate")} hint="A follow-up is scheduled automatically when completed.">
                <Input id="nextMaintenanceDate" type="date" {...register("nextMaintenanceDate")} />
              </Field>
            </div>
            <Field label="Description" htmlFor="description" required error={err("description")}>
              <Textarea id="description" rows={3} {...register("description")} />
            </Field>
            <Field label="Work performed" htmlFor="workPerformed" error={err("workPerformed")} hint="Required when marking complete.">
              <Textarea id="workPerformed" rows={4} {...register("workPerformed")} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Parts replaced</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {parts.fields.length === 0 && <p className="text-sm text-muted">No parts recorded.</p>}
            {parts.fields.map((field, index) => (
              <div key={field.id} className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-12">
                <div className="md:col-span-5">
                  <Field label="Part" htmlFor={`parts.${index}.name`} error={errors.parts?.[index]?.name?.message}>
                    <Input id={`parts.${index}.name`} {...register(`parts.${index}.name`)} />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field label="Qty" htmlFor={`parts.${index}.quantity`} error={errors.parts?.[index]?.quantity?.message}>
                    <Input id={`parts.${index}.quantity`} inputMode="numeric" className="num" {...register(`parts.${index}.quantity`)} />
                  </Field>
                </div>
                <div className="md:col-span-4">
                  <Field label="Notes" htmlFor={`parts.${index}.notes`}>
                    <Input id={`parts.${index}.notes`} {...register(`parts.${index}.notes`)} />
                  </Field>
                </div>
                <div className="flex items-end md:col-span-1">
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove part ${index + 1}`} onClick={() => parts.remove(index)}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={() => parts.append({ name: "", quantity: "1", notes: "" })}>
              <Plus /> Add part
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Technician and customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Technician name" htmlFor="technicianName" error={err("technicianName")}>
                <Input id="technicianName" {...register("technicianName")} />
              </Field>
              <Field label="Technician details" htmlFor="technicianDetails" error={err("technicianDetails")} hint="Licence, phone, or employee number.">
                <Input id="technicianDetails" {...register("technicianDetails")} />
              </Field>
            </div>
            <Field label="Recommendations" htmlFor="recommendations" error={err("recommendations")}>
              <Textarea id="recommendations" rows={3} {...register("recommendations")} />
            </Field>
            <Field label="Customer remarks" htmlFor="customerRemarks" error={err("customerRemarks")}>
              <Textarea id="customerRemarks" rows={2} {...register("customerRemarks")} />
            </Field>
            <div className="grid gap-6 md:grid-cols-2">
              <Controller
                control={control}
                name="technicianSignature"
                render={({ field }) => (
                  <SignaturePad id="technicianSignature" label="Technician signature" value={field.value || null} onChange={(v) => field.onChange(v ?? "")} />
                )}
              />
              <Controller
                control={control}
                name="customerSignature"
                render={({ field }) => (
                  <SignaturePad id="customerSignature" label="Customer signature" value={field.value || null} onChange={(v) => field.onChange(v ?? "")} />
                )}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <aside className="lg:col-span-1">
        <div className="flex flex-col gap-2 lg:sticky lg:top-6">
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            {mode === "create" ? "Save maintenance record" : "Save changes"}
          </Button>
          <Link href={mode === "edit" && id ? `/maintenance/${id}` : "/maintenance"} className={buttonVariants({ variant: "secondary", size: "lg" })}>
            Cancel
          </Link>
          <p className="pt-2 text-xs text-muted">The MR number is assigned when you save. Completing a service requires the work performed and the technician’s name.</p>
        </div>
      </aside>
    </form>
  );
}
