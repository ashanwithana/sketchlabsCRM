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
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12" style={{ background: 'var(--color-cream)' }}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{ background: 'radial-gradient(60% 50% at 50% 0%, var(--color-coral), transparent)' }}
      />
      <div className="animate-fade-up relative w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl shadow-lg" style={{ background: 'var(--color-navy)' }}>
            <LayoutDashboard className="size-6 text-white" />
          </span>
          <span className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-navy)' }}>Client & Document Manager</span>
        </div>

        <div className="rounded-2xl border p-8 shadow-pop" style={{ background: 'var(--color-cream-light)', borderColor: 'var(--color-coral)', borderWidth: '1px' }}>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--color-navy)' }}>Welcome back</h1>
          <p className="mt-1 text-sm text-muted">Sign in to manage clients and documents.</p>
          <div className="mt-6">
            <LoginForm next={safeNext} />
          </div>
        </div>

        <p className="mt-6 text-center text-xs" style={{ color: 'var(--color-navy)' }}>Authorised users only. Activity is logged.</p>
      </div>
    </main>
  );
}
