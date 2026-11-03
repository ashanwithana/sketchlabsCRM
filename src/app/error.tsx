"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

// Catches unexpected errors in any page. The real error is logged on the server; the user sees a plain message.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Unhandled page error", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[var(--radius-card)] border border-border bg-surface p-8 text-center shadow-[var(--shadow-card)]">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-danger-soft text-danger">
          <AlertTriangle className="size-6" />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted">
          The page could not be loaded. Your data has not been changed. Try again, or go back to the dashboard.
        </p>
        {error.digest && <p className="num mt-3 text-xs text-subtle">Reference: {error.digest}</p>}
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button onClick={() => reset()}>Try again</Button>
          <Link href="/dashboard" className={buttonVariants({ variant: "secondary" })}>Go to dashboard</Link>
        </div>
      </div>
    </main>
  );
}
