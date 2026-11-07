"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setMaintenanceStatusAction } from "@/app/(app)/maintenance/actions";

export function MaintenanceStatusControl({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (next: string) => {
    startTransition(async () => {
      const res = await setMaintenanceStatusAction(id, next);
      if (res.ok) router.refresh();
    });
  };

  if (status === "CANCELLED") {
    return (
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => run("ACTIVE")}>
        {pending ? "…" : "Reactivate"}
      </Button>
    );
  }
  return (
    <Button size="sm" variant="danger" disabled={pending} onClick={() => run("CANCELLED")}>
      {pending ? "…" : "Cancel agreement"}
    </Button>
  );
}