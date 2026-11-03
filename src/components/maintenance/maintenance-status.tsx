"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Select } from "@/components/ui/form-controls";
import { MAINTENANCE_STATUSES } from "@/lib/constants";
import { setMaintenanceStatusAction } from "@/app/(app)/maintenance/actions";

const LABELS: Record<string, string> = { SCHEDULED: "Scheduled", COMPLETED: "Completed", CANCELLED: "Cancelled" };

export function MaintenanceStatusControl({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [value, setValue] = React.useState(status);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <label htmlFor="mr-status" className="text-sm text-muted">Status</label>
        <Select
          id="mr-status"
          className="h-9 w-40"
          value={value}
          disabled={pending}
          onChange={async (e) => {
            const next = e.target.value;
            setValue(next);
            setPending(true);
            setError(null);
            setNotice(null);
            const result = await setMaintenanceStatusAction(id, next);
            setPending(false);
            if (!result.ok) {
              setError(result.error);
              setValue(status);
              return;
            }
            setNotice(result.message ?? null);
            router.refresh();
          }}
        >
          {MAINTENANCE_STATUSES.map((s) => (
            <option key={s} value={s}>{LABELS[s] ?? s}</option>
          ))}
        </Select>
        {pending && <Loader2 className="size-4 animate-spin text-muted" />}
      </div>
      {error && <p role="alert" className="max-w-sm text-xs text-danger">{error}</p>}
      {notice && <p role="status" className="max-w-sm text-xs text-success">{notice}</p>}
    </div>
  );
}
