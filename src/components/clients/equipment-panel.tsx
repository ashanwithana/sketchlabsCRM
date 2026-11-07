"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus, Trash2, Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { EmptyState } from "@/components/layout/page-header";
import { equipmentSchema, type EquipmentInput, type EquipmentValues } from "@/lib/validation/client";
import { deleteEquipmentAction, saveEquipmentAction } from "@/app/(app)/clients/actions";

export type EquipmentRow = {
  id: string;
  name: string;
  model: string | null;
  serialNumber: string | null;
  location: string | null;
  installedOn: Date | null;
  notes: string | null;
  _count: { maintenanceRecords: number };
};

type Editing = EquipmentRow | "new" | null;

export function EquipmentPanel({ clientId, items }: { clientId: string; items: EquipmentRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<Editing>(null);
  const [message, setMessage] = React.useState<{ type: "ok" | "error"; text: string } | null>(null);

  async function remove(item: EquipmentRow) {
    if (!window.confirm(`Remove ${item.name} from this client?`)) return;
    const result = await deleteEquipmentAction(clientId, item.id);
    setMessage(result.ok ? { type: "ok", text: result.message ?? "Removed." } : { type: "error", text: result.error });
    if (result.ok) router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>System register</CardTitle>
        {editing === null && (
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus /> Add system
          </Button>
        )}
      </CardHeader>

      {message && (
        <div role={message.type === "error" ? "alert" : "status"} className={`mx-5 mt-4 rounded-lg px-4 py-2.5 text-sm ${message.type === "error" ? "bg-danger-soft text-danger" : "bg-success-soft text-success"}`}>
          {message.text}
        </div>
      )}

      {editing !== null && (
        <CardContent className="border-b border-border bg-surface-muted/50">
          <EquipmentForm
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

      {items.length === 0 ? (
        <EmptyState
          icon={<Wrench />}
          title="No systems recorded"
          description="Add the software, websites, and applications you maintain. Maintenance reports are linked to systems."
        />
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{item.name}</p>
                <p className="text-xs text-muted">
                  {[item.model, item.serialNumber, item.location].filter(Boolean).join(" · ") || "No details"}
                </p>
                <p className="mt-1 text-xs text-subtle">
                  {item._count.maintenanceRecords} service record{item._count.maintenanceRecords === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditing(item)} aria-label={`Edit ${item.name}`}>
                  <Pencil /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => remove(item)}
                  aria-label={`Remove ${item.name}`}
                  disabled={item._count.maintenanceRecords > 0}
                  title={item._count.maintenanceRecords > 0 ? "System with service history is kept" : "Remove"}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function EquipmentForm({
  clientId,
  item,
  onDone,
  onCancel,
}: {
  clientId: string;
  item: EquipmentRow | null;
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
  } = useForm<EquipmentInput, unknown, EquipmentValues>({
    resolver: zodResolver(equipmentSchema),
    mode: "onTouched",
    defaultValues: {
      name: item?.name ?? "",
      model: item?.model ?? "",
      serialNumber: item?.serialNumber ?? "",
      location: item?.location ?? "",
      installedOn: item?.installedOn ? item.installedOn.toISOString().slice(0, 10) : "",
      notes: item?.notes ?? "",
    },
  });

  // Submit raw input values; the server re-validates them with the same schema.
  const onSubmit = handleSubmit(async () => {
    const values = getValues();
    setServerError(null);
    const result = await saveEquipmentAction(clientId, values, item?.id);
    if (!result.ok) {
      setServerError(result.error);
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        setError(field as keyof EquipmentInput, { type: "server", message });
      }
      return;
    }
    onDone(result.message ?? "Saved.");
  });

  const err = (name: keyof EquipmentInput) => errors[name]?.message as string | undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{item ? `Edit ${item.name}` : "New system"}</h3>
        <button type="button" onClick={onCancel} className="rounded-md p-1 text-muted hover:bg-surface hover:text-foreground" aria-label="Cancel">
          <X className="size-4" />
        </button>
      </div>
      {serverError && <p role="alert" className="text-sm text-danger">{serverError}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" htmlFor="eq-name" required error={err("name")}>
          <Input id="eq-name" placeholder="e.g. thesketchlabs.com website" {...register("name")} />
        </Field>
        <Field label="Platform" htmlFor="eq-model" error={err("model")}>
          <Input id="eq-model" placeholder="e.g. Next.js, WordPress" {...register("model")} />
        </Field>
        <Field label="URL" htmlFor="eq-serial" error={err("serialNumber")}>
          <Input id="eq-serial" placeholder="e.g. https://example.com" {...register("serialNumber")} />
        </Field>
        <Field label="Hosting / server" htmlFor="eq-location" error={err("location")}>
          <Input id="eq-location" placeholder="e.g. Vercel" {...register("location")} />
        </Field>
        <Field label="Go-live date" htmlFor="eq-installed" error={err("installedOn")}>
          <Input id="eq-installed" type="date" {...register("installedOn")} />
        </Field>
        <Field label="Notes" htmlFor="eq-notes" error={err("notes")} className="md:col-span-2">
          <Textarea id="eq-notes" rows={2} {...register("notes")} />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          {item ? "Save system" : "Add system"}
        </Button>
      </div>
    </form>
  );
}
