import { StatusBadge } from "@/components/ui/status-badge";

/** Plain text for how a message left the system. Dev outbox messages are never delivered. */
export function deliveryLabel(mode: string, outboxPath: string | null) {
  if (mode === "SMTP") return "Sent via SMTP";
  if (mode === "DEV_OUTBOX") return outboxPath ? `Dev outbox (${outboxPath.split("/").pop()})` : "Dev outbox";
  return mode;
}

export function EmailStatus({ status }: { status: string }) {
  return <StatusBadge status={status} />;
}
