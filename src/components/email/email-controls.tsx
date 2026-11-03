"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { retryEmailAction, sendTestEmailAction } from "@/app/(app)/emails/actions";

export function RetryEmailButton({ logId }: { logId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const result = await retryEmailAction(logId);
          setPending(false);
          if (!result.ok) setError(result.error);
          router.refresh();
        }}
      >
        {pending ? <Loader2 className="animate-spin" /> : <RotateCw />}
        Retry
      </Button>
      {error && <p role="alert" className="max-w-xs text-right text-xs text-danger">{error}</p>}
    </div>
  );
}

export function TestEmailForm({ defaultTo }: { defaultTo: string }) {
  const [to, setTo] = React.useState(defaultTo);
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setResult(null);
        const r = await sendTestEmailAction(to);
        setPending(false);
        setResult(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
      }}
    >
      <Field label="Send a test to" htmlFor="test-email" hint="Checks that outgoing email works. Saved to the dev outbox when SMTP is not configured.">
        <Input id="test-email" type="email" value={to} onChange={(e) => setTo(e.target.value)} />
      </Field>
      {result && (
        <p role={result.ok ? "status" : "alert"} className={`text-sm ${result.ok ? "text-success" : "text-danger"}`}>{result.text}</p>
      )}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Send />}
        Send test email
      </Button>
    </form>
  );
}
