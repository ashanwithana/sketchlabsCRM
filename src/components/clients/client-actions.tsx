"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteClientAction, setClientArchivedAction } from "@/app/(app)/clients/actions";

export function ArchiveClientButton({ clientId, archived }: { clientId: string; archived: boolean }) {
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
          const result = await setClientArchivedAction(clientId, !archived);
          setPending(false);
          if (!result.ok) setError(result.error);
          else router.refresh();
        }}
      >
        {pending ? <Loader2 className="animate-spin" /> : archived ? <ArchiveRestore /> : <Archive />}
        {archived ? "Restore" : "Archive"}
      </Button>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function DeleteClientButton({ clientId, companyName }: { clientId: string; companyName: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="danger"
        disabled={pending}
        onClick={async () => {
          const confirmed = window.confirm(
            `Delete ${companyName}? This cannot be undone. Clients with documents cannot be deleted; archive them instead.`,
          );
          if (!confirmed) return;
          setPending(true);
          setError(null);
          const result = await deleteClientAction(clientId);
          if (!result.ok) {
            setPending(false);
            setError(result.error);
            return;
          }
          router.push("/clients");
          router.refresh();
        }}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
        Delete
      </Button>
      {error && <p role="alert" className="max-w-xs text-right text-xs text-danger">{error}</p>}
    </div>
  );
}
