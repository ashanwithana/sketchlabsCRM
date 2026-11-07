import { cn } from "@/lib/utils";

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "primary";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-muted text-muted ring-border-strong",
  info: "bg-info-soft text-info ring-sky-200",
  success: "bg-success-soft text-success ring-green-200",
  warning: "bg-warning-soft text-warning ring-amber-200",
  danger: "bg-danger-soft text-danger ring-red-200",
  primary: "bg-primary-soft text-primary ring-indigo-200",
};

/** Maps document and email statuses to a consistent color. */
const statusTone: Record<string, Tone> = {
  DRAFT: "neutral",
  SENT: "info",
  PENDING: "warning",
  SCHEDULED: "info",
  APPROVED: "success",
  COMPLETED: "success",
  SENT_OK: "success",
  REJECTED: "danger",
  CANCELLED: "danger",
  FAILED: "danger",
  EXPIRED: "neutral",
  QUEUED: "warning",
  PAID: "success",
  VOID: "neutral",
};

const labels: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  FAILED: "Failed",
  QUEUED: "Queued",
  PAID: "Paid",
  VOID: "Void",
};

export function StatusBadge({ status, tone, className }: { status: string; tone?: Tone; className?: string }) {
  const resolved = tone ?? statusTone[status] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        tones[resolved],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {labels[status] ?? status}
    </span>
  );
}
