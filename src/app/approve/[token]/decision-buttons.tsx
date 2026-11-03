"use client";

import * as React from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { approveQuotationAction, rejectQuotationAction } from "./actions";

export function DecisionButtons({ token }: { token: string }) {
  const [pending, setPending] = React.useState<"approve" | "reject" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<"APPROVED" | "REJECTED" | null>(null);

  if (done) {
    return (
      <div role="status" className="flex items-center gap-3 rounded-lg bg-success-soft px-4 py-3 text-sm text-success">
        <CheckCircle2 className="size-5" />
        {done === "APPROVED" ? "Thank you. The quotation is approved." : "Your response has been recorded as declined."}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="rounded-lg bg-danger-soft px-4 py-2 text-sm text-danger">{error}</p>}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          size="lg"
          className="flex-1"
          disabled={pending !== null}
          onClick={async () => {
            setPending("approve");
            setError(null);
            const r = await approveQuotationAction(token);
            setPending(null);
            if (r.ok) setDone("APPROVED");
            else setError(r.error);
          }}
        >
          {pending === "approve" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
          Approve quotation
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="flex-1"
          disabled={pending !== null}
          onClick={async () => {
            if (!window.confirm("Decline this quotation? The sender will be told it was not accepted.")) return;
            setPending("reject");
            setError(null);
            const r = await rejectQuotationAction(token);
            setPending(null);
            if (r.ok) setDone("REJECTED");
            else setError(r.error);
          }}
        >
          {pending === "reject" ? <Loader2 className="animate-spin" /> : <XCircle />}
          Decline
        </Button>
      </div>
    </div>
  );
}
