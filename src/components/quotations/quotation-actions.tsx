"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form-controls";
import { QUOTATION_STATUS_CHOICES } from "@/lib/validation/quotation";
import { duplicateQuotationAction, setQuotationStatusAction } from "@/app/(app)/quotations/actions";

const LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export function QuotationStatusControl({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [value, setValue] = React.useState(status);

  // Expired quotations are not manually selectable, so show their stored value as an option.
  const options = QUOTATION_STATUS_CHOICES.includes(status as never) ? QUOTATION_STATUS_CHOICES : [...QUOTATION_STATUS_CHOICES, status as never];

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <label htmlFor="status" className="text-sm text-muted">Status</label>
        <Select
          id="status"
          className="h-9 w-40"
          value={value}
          disabled={pending}
          onChange={async (e) => {
            const next = e.target.value;
            setValue(next);
            setPending(true);
            setError(null);
            const result = await setQuotationStatusAction(id, next);
            setPending(false);
            if (!result.ok) {
              setError(result.error);
              setValue(status);
              return;
            }
            router.refresh();
          }}
        >
          {options.map((s) => (
            <option key={s} value={s}>
              {LABELS[s] ?? s}
            </option>
          ))}
        </Select>
        {pending && <Loader2 className="size-4 animate-spin text-muted" />}
      </div>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function DuplicateQuotationButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const result = await duplicateQuotationAction(id);
          setPending(false);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          if (result.id) router.push(`/quotations/${result.id}`);
        }}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Copy />}
        Duplicate
      </Button>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}
