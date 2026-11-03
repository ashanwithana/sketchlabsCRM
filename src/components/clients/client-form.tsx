"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { CLIENT_CATEGORIES } from "@/lib/constants";
import { clientSchema, type ClientInput, type ClientValues } from "@/lib/validation/client";
import { createClientAction, updateClientAction } from "@/app/(app)/clients/actions";

export type ClientFormDefaults = ClientInput & { id?: string; clientCode?: string };

export function ClientForm({ defaults, mode }: { defaults: ClientFormDefaults; mode: "create" | "edit" }) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ClientInput, unknown, ClientValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: defaults,
    mode: "onTouched",
  });

  // Submit the raw input values. The resolver output has transformed types (null, Date) that
  // the server schema does not accept.
  const onSubmit = handleSubmit(async () => {
    const values = getValues();
    setServerError(null);
    setNotice(null);

    const result =
      mode === "create"
        ? await createClientAction(values)
        : await updateClientAction(defaults.id as string, values);

    if (!result.ok) {
      setServerError(result.error);
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        setError(field as keyof ClientInput, { type: "server", message });
      }
      return;
    }

    if (mode === "create" && "data" in result && result.data) {
      router.push(`/clients/${result.data.id}`);
      router.refresh();
      return;
    }
    setNotice(result.message ?? "Saved.");
    router.refresh();
  });

  const err = (name: keyof ClientInput) => errors[name]?.message as string | undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {serverError && (
        <div role="alert" className="rounded-lg border border-danger-soft bg-danger-soft px-4 py-3 text-sm text-danger">
          {serverError}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-lg border border-success-soft bg-success-soft px-4 py-3 text-sm text-success">
          {notice}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Company</CardTitle>
          {defaults.clientCode && (
            <span className="num rounded-md bg-surface-muted px-2 py-1 text-xs font-medium text-muted" title="Generated automatically">
              {defaults.clientCode}
            </span>
          )}
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field label="Company name" htmlFor="companyName" required error={err("companyName")} className="md:col-span-2">
            <Input id="companyName" autoComplete="organization" aria-invalid={Boolean(err("companyName"))} {...register("companyName")} />
          </Field>
          <Field label="Company registration number" htmlFor="registrationNumber" required error={err("registrationNumber")}>
            <Input id="registrationNumber" aria-invalid={Boolean(err("registrationNumber"))} {...register("registrationNumber")} />
          </Field>
          <Field label="VAT number" htmlFor="vatNumber" error={err("vatNumber")} hint="Optional.">
            <Input id="vatNumber" aria-invalid={Boolean(err("vatNumber"))} {...register("vatNumber")} />
          </Field>
          <Field label="Category" htmlFor="category" required error={err("category")}>
            <Select id="category" aria-invalid={Boolean(err("category"))} {...register("category")}>
              {CLIENT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field label="Contact person" htmlFor="contactPerson" required error={err("contactPerson")}>
            <Input id="contactPerson" autoComplete="name" aria-invalid={Boolean(err("contactPerson"))} {...register("contactPerson")} />
          </Field>
          <Field label="Email address" htmlFor="email" required error={err("email")} hint="Quotations and documents are sent here.">
            <Input id="email" type="email" autoComplete="email" aria-invalid={Boolean(err("email"))} {...register("email")} />
          </Field>
          <Field label="Phone number" htmlFor="phone" required error={err("phone")}>
            <Input id="phone" type="tel" autoComplete="tel" aria-invalid={Boolean(err("phone"))} {...register("phone")} />
          </Field>
          <Field label="Billing address" htmlFor="billingAddress" required error={err("billingAddress")} className="md:col-span-2">
            <Textarea id="billingAddress" rows={3} aria-invalid={Boolean(err("billingAddress"))} {...register("billingAddress")} />
          </Field>
          <Field label="Additional notes" htmlFor="notes" error={err("notes")} className="md:col-span-2">
            <Textarea id="notes" rows={3} {...register("notes")} />
          </Field>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:flex-row sm:justify-end sm:px-6 lg:-mx-8 lg:px-8">
        <Button type="button" variant="secondary" size="lg" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={isSubmitting || (mode === "edit" && !isDirty)}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
          {mode === "create" ? "Register client" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
