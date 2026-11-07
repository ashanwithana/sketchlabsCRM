"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2, UserRound } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { calcTotals } from "@/lib/quotation-calc";
import { formatMoney, parseMoney, parsePercentToBp } from "@/lib/money";
import { BILLING_CYCLES } from "@/lib/constants";
import { maintenanceSchema, type MaintenanceInput, type MaintenanceLineInput, type MaintenanceValues } from "@/lib/validation/maintenance";
import { saveMaintenanceAction } from "@/app/(app)/maintenance/actions";

export type MaintenanceClientOption = {
  id: string;
  clientCode: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  billingAddress: string;
};

type Props = {
  mode: "create" | "edit";
  id?: string;
  clients: MaintenanceClientOption[];
  currency: string;
  defaultTaxRate: string;
  defaults: MaintenanceInput;
  documentNumber?: string;
};

const EMPTY_LINE: MaintenanceLineInput = { description: "", quantity: "1", unitPrice: "", taxRate: "" };

function lenientQty(v: string) {
  return /^\d{1,6}$/.test(v.trim()) ? Number(v.trim()) : 0;
}

export function MaintenanceForm({ mode, id, clients, currency, defaultTaxRate, defaults, documentNumber }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<MaintenanceInput, unknown, MaintenanceValues>({
    resolver: zodResolver(maintenanceSchema),
    defaultValues: defaults,
    mode: "onTouched",
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const clientId = useWatch({ control, name: "clientId" });
  const items = useWatch({ control, name: "items" });
  const selectedClient = clients.find((c) => c.id === clientId);

  const totals = React.useMemo(
    () =>
      calcTotals(
        (items ?? []).map((i) => ({
          quantity: lenientQty(i.quantity ?? ""),
          unitPrice: parseMoney(i.unitPrice ?? "") ?? 0,
          discount: 0,
          taxRateBp: parsePercentToBp(i.taxRate ?? "") ?? 0,
        })),
      ),
    [items],
  );

  const money = (minor: number) => formatMoney(minor, currency);

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

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {serverError && (
          <div role="alert" className="rounded-lg border border-danger-soft bg-danger-soft px-4 py-3 text-sm text-danger">
            {serverError}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Client</CardTitle>
            {documentNumber && <span className="num text-xs font-medium text-muted">{documentNumber}</span>}
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Client" htmlFor="clientId" required error={errors.clientId?.message as string | undefined}>
              <Select id="clientId" {...register("clientId")}>
                <option value="">Choose a client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName} ({c.clientCode})
                  </option>
                ))}
              </Select>
            </Field>

            {selectedClient ? (
              <div className="animate-fade-up grid gap-3 rounded-lg bg-surface-muted p-4 text-sm sm:grid-cols-2">
                <div className="flex items-start gap-2 sm:col-span-2">
                  <UserRound className="mt-0.5 size-4 text-primary" />
                  <div>
                    <p className="font-medium">{selectedClient.companyName}</p>
                    <p className="num text-xs text-muted">{selectedClient.clientCode}</p>
                  </div>
                </div>
                <p><span className="text-muted">Contact:</span> {selectedClient.contactPerson}</p>
                <p><span className="text-muted">Email:</span> {selectedClient.email}</p>
                <p><span className="text-muted">Phone:</span> {selectedClient.phone}</p>
                <p className="whitespace-pre-line"><span className="text-muted">Billing:</span> {selectedClient.billingAddress}</p>
              </div>
            ) : (
              <p className="text-sm text-muted">
                Choose a client. Need someone new?{" "}
                <Link href="/clients/new" className="font-medium text-primary hover:underline">Register a client</Link>.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Agreement period and billing</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Valid from" htmlFor="validFrom" required error={errors.validFrom?.message as string | undefined}>
              <Input id="validFrom" type="date" {...register("validFrom")} />
            </Field>
            <Field label="Valid until" htmlFor="validUntil" required error={errors.validUntil?.message as string | undefined} hint="Agreement ends after this date.">
              <Input id="validUntil" type="date" {...register("validUntil")} />
            </Field>
            <Field label="Billing cycle" htmlFor="cycle" required error={errors.cycle?.message as string | undefined}>
              <Select id="cycle" {...register("cycle")}>
                {BILLING_CYCLES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Billing day of month" htmlFor="billingDay" required error={errors.billingDay?.message as string | undefined} hint="Day 1–28 the invoice is generated.">
              <Input id="billingDay" inputMode="numeric" className="num" {...register("billingDay")} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Scope of agreement" htmlFor="description" required error={errors.description?.message as string | undefined} hint="What the studio keeps running for the client.">
                <Textarea id="description" rows={3} {...register("description")} />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Services</CardTitle>
            <span className="text-xs text-muted">{fields.length} line{fields.length === 1 ? "" : "s"}</span>
          </CardHeader>
          <CardContent className="space-y-4">
            {typeof errors.items?.message === "string" && (
              <p role="alert" className="text-sm text-danger">{errors.items.message}</p>
            )}
            {fields.map((field, index) => {
              const lineErr = errors.items?.[index];
              return (
                <div key={field.id} className="rounded-xl border border-border p-4">
                  <div className="grid gap-3 md:grid-cols-12">
                    <div className="md:col-span-12">
                      <Field label={`Service ${index + 1} description`} htmlFor={`items.${index}.description`} error={lineErr?.description?.message}>
                        <Textarea id={`items.${index}.description`} rows={2} placeholder="What is being maintained?" {...register(`items.${index}.description`)} />
                      </Field>
                    </div>
                    <div className="md:col-span-2">
                      <Field label="Qty" htmlFor={`items.${index}.quantity`} error={lineErr?.quantity?.message}>
                        <Input id={`items.${index}.quantity`} inputMode="numeric" className="num" {...register(`items.${index}.quantity`)} />
                      </Field>
                    </div>
                    <div className="md:col-span-3">
                      <Field label="Unit price" htmlFor={`items.${index}.unitPrice`} error={lineErr?.unitPrice?.message}>
                        <Input id={`items.${index}.unitPrice`} inputMode="decimal" className="num" {...register(`items.${index}.unitPrice`)} />
                      </Field>
                    </div>
                    <div className="md:col-span-2">
                      <Field label="Tax %" htmlFor={`items.${index}.taxRate`} error={lineErr?.taxRate?.message}>
                        <Input id={`items.${index}.taxRate`} inputMode="decimal" className="num" placeholder="0" {...register(`items.${index}.taxRate`)} />
                      </Field>
                    </div>
                    <div className="flex items-end justify-between gap-2 md:col-span-5">
                      <div className="min-w-0">
                        <p className="text-xs text-muted">Line total</p>
                        <p className="num truncate text-sm font-semibold">{money(totals.lines[index]?.total ?? 0)}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove service ${index + 1}`}
                        disabled={fields.length === 1}
                        onClick={() => remove(index)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            <Button type="button" variant="secondary" onClick={() => append({ ...EMPTY_LINE, taxRate: defaultTaxRate })}>
              <Plus /> Add service
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Terms and notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Terms and conditions" htmlFor="terms" error={errors.terms?.message as string | undefined}>
              <Textarea id="terms" rows={4} {...register("terms")} />
            </Field>
            <Field label="Internal notes" htmlFor="notes" error={errors.notes?.message as string | undefined} hint="Not printed on the PDF.">
              <Textarea id="notes" rows={2} {...register("notes")} />
            </Field>
          </CardContent>
        </Card>
      </div>

      <aside className="lg:col-span-1">
        <div className="space-y-4 lg:sticky lg:top-6">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Subtotal" value={money(totals.subtotal)} />
              <Row label="Tax" value={money(totals.taxTotal)} />
              <div className="border-t border-border pt-3">
                <Row label="Grand total" value={money(totals.grandTotal)} strong />
              </div>
              <p className="text-xs text-muted">Totals are recalculated on the server when you save. Activating sets up recurring billing.</p>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {mode === "create" ? "Create agreement" : "Save changes"}
            </Button>
            <Link href={mode === "edit" && id ? `/maintenance/${id}` : "/maintenance"} className={buttonVariants({ variant: "secondary", size: "lg" })}>
              Cancel
            </Link>
          </div>
        </div>
      </aside>
    </form>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={strong ? "font-semibold text-foreground" : "text-muted"}>{label}</span>
      <span className={`num ${strong ? "text-lg font-semibold text-foreground" : "text-foreground"}`}>{value}</span>
    </div>
  );
}