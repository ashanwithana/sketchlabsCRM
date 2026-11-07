"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserRound } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { SignaturePad } from "@/components/cr/signature-pad";
import { crSchema, type CrInput, type CrValues } from "@/lib/validation/cr";
import { saveCrAction } from "@/app/(app)/cr/actions";

export type CrClientOption = {
  id: string;
  clientCode: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  billingAddress: string;
};

export type CrQuotationOption = {
  id: string;
  number: string;
  clientId: string;
  status: string;
  scopeHint: string;
};

export function CrForm({
  mode,
  id,
  clients,
  quotations,
  defaults,
  documentNumber,
  currency = "USD",
}: {
  mode: "create" | "edit";
  id?: string;
  clients: CrClientOption[];
  quotations: CrQuotationOption[];
  defaults: CrInput;
  documentNumber?: string;
  currency?: string;
}) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CrInput, unknown, CrValues>({
    resolver: zodResolver(crSchema),
    defaultValues: defaults,
    mode: "onTouched",
  });

  const clientId = useWatch({ control, name: "clientId" });
  const selectedClient = clients.find((c) => c.id === clientId);
  const clientQuotations = quotations.filter((q) => q.clientId === clientId);

  const onQuotationChange = (docId: string) => {
    setValue("quotationId", docId, { shouldDirty: true });
    const picked = quotations.find((q) => q.id === docId);
    // Fill the scope from the quotation only when the user has not written one yet.
    if (picked && getValues("scopeOfWork").trim() === "") {
      setValue("scopeOfWork", `Work as quoted in ${picked.number}:\n${picked.scopeHint}`);
    }
  };

  const onSubmit = handleSubmit(async () => {
    setServerError(null);
    const result = await saveCrAction(getValues(), mode === "edit" ? id : undefined);
    if (!result.ok) {
      setServerError(result.error);
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        setError(field as keyof CrInput, { type: "server", message });
      }
      return;
    }
    router.push(`/cr/${result.id}`);
    router.refresh();
  });

  const err = (name: keyof CrInput) => errors[name]?.message as string | undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {serverError && (
          <div role="alert" className="rounded-lg border border-danger-soft bg-danger-soft px-4 py-3 text-sm text-danger">{serverError}</div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Client and quotation</CardTitle>
            {documentNumber && <span className="num text-xs font-medium text-muted">{documentNumber}</span>}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Client" htmlFor="clientId" required error={err("clientId")}>
                <Select id="clientId" {...register("clientId", { onChange: () => setValue("quotationId", "") })}>
                  <option value="">Choose a client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.companyName} ({c.clientCode})</option>
                  ))}
                </Select>
              </Field>
              <Field label="Linked quotation" htmlFor="quotationId" error={err("quotationId")} hint={clientId ? "Only this client's quotations are listed." : "Choose a client first."}>
                <Select
                  id="quotationId"
                  disabled={!clientId}
                  {...register("quotationId", { onChange: (e) => onQuotationChange(e.target.value) })}
                >
                  <option value="">No linked quotation</option>
                  {clientQuotations.map((q) => (
                    <option key={q.id} value={q.id}>{q.number} · {q.status.toLowerCase()}</option>
                  ))}
                </Select>
              </Field>
            </div>

            {selectedClient ? (
              <div className="animate-fade-up grid gap-2 rounded-lg bg-surface-muted p-4 text-sm sm:grid-cols-2">
                <div className="flex items-start gap-2 sm:col-span-2">
                  <UserRound className="mt-0.5 size-4 text-primary" />
                  <div>
                    <p className="font-medium">{selectedClient.companyName}</p>
                    <p className="num text-xs text-muted">{selectedClient.clientCode}</p>
                  </div>
                </div>
                <p><span className="text-muted">Contact:</span> {selectedClient.contactPerson}</p>
                <p><span className="text-muted">Email:</span> {selectedClient.email}</p>
              </div>
            ) : (
              <p className="text-sm text-muted">
                Choose a client to fill in their details. Need someone new?{" "}
                <Link href="/clients/new" className="font-medium text-primary hover:underline">Register a client</Link>.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Issue date" htmlFor="issueDate" required error={err("issueDate")}>
                <Input id="issueDate" type="date" {...register("issueDate")} />
              </Field>
              <Field label="Delivery or completion date" htmlFor="deliveryDate" error={err("deliveryDate")}>
                <Input id="deliveryDate" type="date" {...register("deliveryDate")} />
              </Field>
            </div>
            <Field label="Request details" htmlFor="requestDetails" required error={err("requestDetails")} hint="What the customer asked for, in their words where possible.">
              <Textarea id="requestDetails" rows={4} {...register("requestDetails")} />
            </Field>
            <Field label="Scope of work" htmlFor="scopeOfWork" required error={err("scopeOfWork")} hint="Pre-filled from the linked quotation when left blank.">
              <Textarea id="scopeOfWork" rows={6} {...register("scopeOfWork")} />
            </Field>
            <Field label="Customer requirements" htmlFor="customerRequirements" error={err("customerRequirements")}>
              <Textarea id="customerRequirements" rows={3} {...register("customerRequirements")} />
            </Field>
            <Field label="Remarks" htmlFor="remarks" error={err("remarks")}>
              <Textarea id="remarks" rows={2} {...register("remarks")} />
            </Field>
            <Field label="Cost (total development cost)" htmlFor="cost" error={err("cost")} hint={`Amount in ${currency}. Shown on the CR PDF.`}>
              <Input id="cost" inputMode="decimal" className="num" {...register("cost")} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer approval</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Approved by (name)" htmlFor="approvalName" error={err("approvalName")}>
                <Input id="approvalName" {...register("approvalName")} />
              </Field>
              <Field label="Approval date" htmlFor="approvalDate" error={err("approvalDate")}>
                <Input id="approvalDate" type="date" {...register("approvalDate")} />
              </Field>
            </div>
            <Controller
              control={control}
              name="customerSignature"
              render={({ field }) => (
                <div>
                  <SignaturePad
                    id="customerSignature"
                    label="Customer signature"
                    value={field.value || null}
                    onChange={(v) => field.onChange(v ?? "")}
                  />
                  {err("customerSignature") && <p role="alert" className="mt-2 text-xs text-danger">{err("customerSignature")}</p>}
                </div>
              )}
            />
          </CardContent>
        </Card>
      </div>

      <aside className="lg:col-span-1">
        <div className="flex flex-col gap-2 lg:sticky lg:top-6">
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            {mode === "create" ? "Save CR document" : "Save changes"}
          </Button>
          <Link href={mode === "edit" && id ? `/cr/${id}` : "/cr"} className={buttonVariants({ variant: "secondary", size: "lg" })}>
            Cancel
          </Link>
          <p className="pt-2 text-xs text-muted">The CR number is assigned when you save. Signing here records the customer’s approval on the PDF.</p>
        </div>
      </aside>

    </form>
  );
}
