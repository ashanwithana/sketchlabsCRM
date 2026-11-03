"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form-controls";
import { CR_STATUSES } from "@/lib/constants";
import { duplicateCrAction, setCrStatusAction } from "@/app/(app)/cr/actions";

const LABELS: Record<string, string> = { DRAFT: "Draft", SENT: "Sent", APPROVED: "Approved" };

export function CrStatusControl({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [value, setValue] = React.useState(status);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <label htmlFor="cr-status" className="text-sm text-muted">Status</label>
        <Select
          id="cr-status"
          className="h-9 w-40"
          value={value}
          disabled={pending}
          onChange={async (e) => {
            const next = e.target.value;
            setValue(next);
            setPending(true);
            setError(null);
            const result = await setCrStatusAction(id, next);
            setPending(false);
            if (!result.ok) {
              setError(result.error);
              setValue(status);
              return;
            }
            router.refresh();
          }}
        >
          {CR_STATUSES.map((s) => (
            <option key={s} value={s}>{LABELS[s] ?? s}</option>
          ))}
        </Select>
        {pending && <Loader2 className="size-4 animate-spin text-muted" />}
      </div>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function DuplicateCrButton({ id }: { id: string }) {
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
          const result = await duplicateCrAction(id);
          setPending(false);
          if (!result.ok) setError(result.error);
          else if (result.id) router.push(`/cr/${result.id}`);
        }}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Copy />}
        Duplicate
      </Button>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}
