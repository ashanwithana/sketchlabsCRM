"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, Loader2, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/layout/page-header";
import { BILLING_CYCLES, type BillingCycle } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import {
  billingScheduleSchema,
  billingServiceSchema,
  type BillingScheduleInput,
  type BillingScheduleValues,
  type BillingServiceInput,
  type BillingServiceValues,
} from "@/lib/validation/billing";
import {
  deleteServiceAction,
  saveBillingScheduleAction,
  saveServiceAction,
  sendInvoiceNowAction,
} from "@/app/(app)/clients/actions";

export type ServiceRow = { id: string; description: string; amount: number; taxRateBp: number };

export type InvoiceRow = {
  id: string;
  number: string;
  status: string;
  issueDate: Date;
  grandTotal: number;
  currency: string;
  dueDate: Date;
};

type EditingService = ServiceRow | "new" | null;

type Props = {
  clientId: string;
  currency: string;
  billing: {
    cycle: string | null;
    day: number | null;
    active: boolean;
    nextDue: Date | null;
  };
  services: ServiceRow[];
  invoices: InvoiceRow[];
};

export function BillingPanel({ clientId, currency, billing, services, invoices }: Props) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<EditingService>(null);
  const [message, setMessage] = React.useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [sending, setSending] = React.useState(false);

  async function remove(service: ServiceRow) {
    if (!window.confirm(`Remove “${service.description}” from the recurring services?`)) return;
    const result = await deleteServiceAction(clientId, service.id);
    setMessage(result.ok ? { type: "ok", text: result.message ?? "Removed." } : { type: "error", text: result.error });
    if (result.ok) router.refresh();
  }

  async function sendNow() {
    if (!window.confirm("Generate an invoice from the current services and email it to the client now?")) return;
    setSending(true);
    setMessage(null);
    const result = await sendInvoiceNowAction(clientId);
    setSending(false);
    setMessage(result.ok ? { type: "ok", text: result.message ?? "Sent." } : { type: "error", text: result.error });
    if (result.ok) router.refresh();
  }

  const cycleLabel = billing.cycle ? BILLING_CYCLES.find((c) => c.value === billing.cycle)?.label ?? billing.cycle : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Billing schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && (
            <div role={message.type === "error" ? "alert" : "status"} className={`rounded-lg px-4 py-2.5 text-sm ${message.type === "error" ? "bg-danger-soft text-danger" : "bg-success-soft text-success"}`}>
              {message.text}
            </div>
          )}

          <ScheduleForm
            clientId={clientId}
            defaultValues={{
              billingCycle: (billing.cycle as BillingCycle) || "MONTHLY",
              billingDay: String(billing.day ?? 1),
              billingActive: billing.active,
            }}
            onDone={(text) => {
              setMessage({ type: "ok", text });
              router.refresh();
            }}
          />

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-surface-muted px-4 py-3 text-sm">
            <span className="flex items-center gap-2">
              <CalendarClock className="size-4 text-primary" aria-hidden />
              {billing.active && cycleLabel ? (
                <span>
                  {cycleLabel}, sent on day <span className="num font-medium">{billing.day}</span> of the month
                </span>
              ) : (
                <span className="text-muted">Automatic sending is off</span>
              )}
            </span>
            {billing.active && billing.nextDue && (
              <span className="text-muted">
                Next invoice: <span className="num font-medium text-foreground">{billing.nextDue.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
              </span>
            )}
            <span className="ml-auto">
              <Button size="sm" variant="secondary" onClick={sendNow} disabled={sending || services.length === 0}>
                {sending ? <Loader2 className="animate-spin" /> : <Send />}
                Send invoice now
              </Button>
            </span>
          </div>
          {services.length === 0 && <p className="text-sm text-muted">Add at least one recurring service below to enable invoicing.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recurring services</CardTitle>
          {editing === null && (
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus /> Add service
            </Button>
          )}
        </CardHeader>

        {editing !== null && (
          <CardContent className="border-b border-border bg-surface-muted/50">
            <ServiceForm
              key={editing === "new" ? "new" : editing.id}
              clientId={clientId}
              item={editing === "new" ? null : editing}
              onDone={(text) => {
                setEditing(null);
                setMessage({ type: "ok", text });
                router.refresh();
              }}
              onCancel={() => setEditing(null)}
            />
          </CardContent>
        )}

        {services.length === 0 ? (
          <EmptyState
            icon={<Plus />}
            title="No recurring services yet"
            description="Add every service you offer this client with its amount. Each invoice snapshots this list."
          />
        ) : (
          <ul className="divide-y divide-border">
            {services.map((service) => (
              <li key={service.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{service.description}</p>
                  <p className="text-xs text-muted">
                    {service.taxRateBp > 0 ? `Tax ${(service.taxRateBp / 100).toFixed(service.taxRateBp % 100 === 0 ? 0 : 2)}% · ` : "No tax · "}charged each billing period
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="num text-sm font-semibold text-foreground">{formatMoney(service.amount, currency)}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(service)} aria-label={`Edit ${service.description}`}>
                      <Pencil /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(service)} aria-label={`Remove ${service.description}`}>
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        {invoices.length === 0 ? (
          <EmptyState icon={<Send />} title="No invoices yet" description="Invoices are generated by the schedule or with “Send invoice now”." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-border bg-surface-muted/60 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Number</th>
                  <th className="px-5 py-3 font-medium">Issued</th>
                  <th className="px-5 py-3 font-medium">Due</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="num px-5 py-3 font-medium">
                      <a href={`/documents/${inv.id}`} className="hover:text-primary hover:underline">{inv.number}</a>
                    </td>
                    <td className="px-5 py-3 text-muted">{inv.issueDate.toLocaleDateString("en-GB")}</td>
                    <td className="px-5 py-3 text-muted">{inv.dueDate.toLocaleDateString("en-GB")}</td>
                    <td className="px-5 py-3"><StatusBadge status={inv.status} /></td>
                    <td className="num px-5 py-3 text-right">{formatMoney(inv.grandTotal, inv.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function ScheduleForm({
  clientId,
  defaultValues,
  onDone,
}: {
  clientId: string;
  defaultValues: BillingScheduleInput;
  onDone: (text: string) => void;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<BillingScheduleInput, unknown, BillingScheduleValues>({
    resolver: zodResolver(billingScheduleSchema),
    mode: "onTouched",
    defaultValues: {
      billingCycle: defaultValues.billingCycle ?? "MONTHLY",
      billingDay: defaultValues.billingDay ?? "1",
      billingActive: defaultValues.billingActive ?? false,
    },
  });

  const onSubmit = handleSubmit(async () => {
    const values = getValues();
    setServerError(null);
    const result = await saveBillingScheduleAction(clientId, values);
    if (!result.ok) {
      setServerError(result.error);
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        setError(field as keyof BillingScheduleInput, { type: "server", message });
      }
      return;
    }
    onDone(result.message ?? "Saved.");
  });

  const err = (name: keyof BillingScheduleInput) => errors[name]?.message as string | undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {serverError && <p role="alert" className="text-sm text-danger">{serverError}</p>}
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Billing cycle" htmlFor="billing-cycle" error={err("billingCycle")}>
          <Select id="billing-cycle" {...register("billingCycle")}>
            {BILLING_CYCLES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Send day of month" htmlFor="billing-day" error={err("billingDay")} hint="1–28, so every month is supported.">
          <Input id="billing-day" type="number" min={1} max={28} {...register("billingDay")} />
        </Field>
        <Field label="Automatic sending" htmlFor="billing-active" error={err("billingActive")}>
          <label className="flex h-10 cursor-pointer items-center gap-2 text-sm">
            <input id="billing-active" type="checkbox" className="size-4 accent-primary" {...register("billingActive")} />
            Email the invoice on the due date
          </label>
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          Save schedule
        </Button>
      </div>
    </form>
  );
}

function ServiceForm({
  clientId,
  item,
  onDone,
  onCancel,
}: {
  clientId: string;
  item: ServiceRow | null;
  onDone: (text: string) => void;
  onCancel: () => void;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<BillingServiceInput, unknown, BillingServiceValues>({
    resolver: zodResolver(billingServiceSchema),
    mode: "onTouched",
    defaultValues: {
      description: item?.description ?? "",
      amount: item ? (item.amount / 100).toFixed(2) : "",
      taxRateBp: item?.taxRateBp ? String(item.taxRateBp / 100) : "",
    },
  });

  const onSubmit = handleSubmit(async () => {
    const values = getValues();
    setServerError(null);
    const result = await saveServiceAction(clientId, values, item?.id);
    if (!result.ok) {
      setServerError(result.error);
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        setError(field as keyof BillingServiceInput, { type: "server", message });
      }
      return;
    }
    onDone(result.message ?? "Saved.");
  });

  const err = (name: keyof BillingServiceInput) => errors[name]?.message as string | undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{item ? "Edit service" : "New recurring service"}</h3>
        <button type="button" onClick={onCancel} className="rounded-md p-1 text-muted hover:bg-surface hover:text-foreground" aria-label="Cancel">
          <X className="size-4" />
        </button>
      </div>
      {serverError && <p role="alert" className="text-sm text-danger">{serverError}</p>}
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Service" htmlFor="svc-desc" required error={err("description")} className="md:col-span-1">
          <Input id="svc-desc" placeholder="e.g. Website maintenance" {...register("description")} />
        </Field>
        <Field label="Amount per period" htmlFor="svc-amount" required error={err("amount")}>
          <Input id="svc-amount" inputMode="decimal" placeholder="e.g. 15000" {...register("amount")} />
        </Field>
        <Field label="Tax %" htmlFor="svc-tax" error={err("taxRateBp")}>
          <Input id="svc-tax" inputMode="decimal" placeholder="0" {...register("taxRateBp")} />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          {item ? "Save service" : "Add service"}
        </Button>
      </div>
    </form>
  );
}
