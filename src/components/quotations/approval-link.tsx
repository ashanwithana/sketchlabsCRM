"use client";

import * as React from "react";
import { Check, Copy, Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { createApprovalLinkAction } from "@/app/(app)/quotations/approval-actions";

export function ApprovalLink({ documentId, canCreate }: { documentId: string; canCreate: boolean }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [link, setLink] = React.useState<{ url: string; expiresOn: string } | null>(null);
  const [copied, setCopied] = React.useState(false);

  if (!canCreate) {
    return (
      <p className="text-sm text-muted">
        Mark the quotation as Sent to create a link the client can use to approve or decline it online.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {!link && (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            setError(null);
            const r = await createApprovalLinkAction(documentId);
            setPending(false);
            if (r.ok) setLink({ url: r.url, expiresOn: r.expiresOn });
            else setError(r.error);
          }}
        >
          {pending ? <Loader2 className="animate-spin" /> : <Link2 />}
          Create client approval link
        </Button>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {link && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input readOnly value={link.url} aria-label="Approval link" className="num text-xs" onFocus={(e) => e.currentTarget.select()} />
            <Button
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(link.url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="text-xs text-muted">
            Send this link only to the client. It works until {link.expiresOn} and stops working as soon as the client responds.
          </p>
        </div>
      )}
    </div>
  );
}
