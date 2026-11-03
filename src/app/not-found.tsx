import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[var(--radius-card)] border border-border bg-surface p-8 text-center shadow-[var(--shadow-card)]">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <SearchX className="size-6" />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-foreground">We could not find that page</h1>
        <p className="mt-2 text-sm text-muted">The record may have been removed, or the link may be out of date.</p>
        <div className="mt-6">
          <Link href="/dashboard" className={buttonVariants({ variant: "primary" })}>Go to dashboard</Link>
        </div>
      </div>
    </main>
  );
}
