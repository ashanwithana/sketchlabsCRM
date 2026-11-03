import type { Metadata } from "next";
import { LayoutDashboard } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

// The redirect target comes from the request URL, so this page renders per request.
export const instant = false;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-sidebar px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgb(79_70_229/0.35),transparent)]"
      />
      <div className="animate-fade-up relative w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3 text-white">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary shadow-lg shadow-indigo-900/40">
            <LayoutDashboard className="size-6" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Client & Document Manager</span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-surface p-8 shadow-pop">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Welcome back</h1>
          <p className="mt-1 text-sm text-muted">Sign in to manage clients and documents.</p>
          <div className="mt-6">
            <LoginForm next={safeNext} />
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">Authorised users only. Activity is logged.</p>
      </div>
    </main>
  );
}
