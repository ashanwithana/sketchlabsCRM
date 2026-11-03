"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { sendDocumentEmailAction } from "@/app/(app)/emails/actions";

export type EmailDefaults = { to: string; cc: string; subject: string; body: string };

export function SendEmailDialog({
  documentId,
  documentNumber,
  clientName,
  defaults,
}: {
  documentId: string;
  documentNumber: string;
  clientName: string;
  defaults: EmailDefaults;
}) {
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState(defaults);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await sendDocumentEmailAction({ documentId, ...values });
    setPending(false);
    if (result.ok) setSent(result.message);
    else setError(result.error);
  }

  function close() {
    setOpen(false);
    setSent(null);
    setError(null);
  }

  return (
    <>
      <Button variant="secondary" onClick={() => { setValues(defaults); setOpen(true); }}>
        <Mail /> Email to client
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="email-dialog-title">
          <button type="button" aria-label="Close" onClick={close} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
          <div className="animate-fade-up relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface shadow-pop sm:max-w-xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 id="email-dialog-title" className="text-base font-semibold">Email {documentNumber}</h2>
                <p className="text-xs text-muted">to {clientName}, with the latest PDF attached</p>
              </div>
              <button type="button" onClick={close} aria-label="Close" className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            {sent ? (
              <div className="space-y-4 overflow-y-auto px-5 py-8 text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
                  <CheckCircle2 className="size-6" />
                </span>
                <p className="text-sm font-medium text-foreground">{sent}</p>
                <p className="text-xs text-muted">The delivery is recorded in the email log.</p>
                <div className="flex justify-center gap-2">
                  <Link href="/emails" className="text-sm font-medium text-primary hover:underline">View email log</Link>
                </div>
                <Button variant="secondary" onClick={close}>Done</Button>
              </div>
            ) : (
              <form onSubmit={send} noValidate className="flex min-h-0 flex-col">
                <div className="space-y-4 overflow-y-auto px-5 py-5">
                  {error && (
                    <div role="alert" className="rounded-lg border border-danger-soft bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>
                  )}
                  <Field label="To" htmlFor="email-to" required hint="Separate several addresses with commas.">
                    <Input id="email-to" value={values.to} onChange={(e) => setValues({ ...values, to: e.target.value })} type="email" autoComplete="off" />
                  </Field>
                  <Field label="Cc" htmlFor="email-cc" hint="Optional.">
                    <Input id="email-cc" value={values.cc} onChange={(e) => setValues({ ...values, cc: e.target.value })} autoComplete="off" />
                  </Field>
                  <Field label="Subject" htmlFor="email-subject" required>
                    <Input id="email-subject" value={values.subject} onChange={(e) => setValues({ ...values, subject: e.target.value })} />
                  </Field>
                  <Field label="Message" htmlFor="email-body" required>
                    <Textarea id="email-body" rows={8} value={values.body} onChange={(e) => setValues({ ...values, body: e.target.value })} />
                  </Field>
                  <p className="text-xs text-muted">
                    The PDF is attached automatically. If the document has changed since its last PDF, a new revision is created first.
                  </p>
                </div>
                <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
                  <Button type="button" variant="secondary" onClick={close}>Cancel</Button>
                  <Button type="submit" disabled={pending}>
                    {pending && <Loader2 className="animate-spin" />}
                    {pending ? "Sending…" : "Send email"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
