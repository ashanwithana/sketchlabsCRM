import type { Metadata } from "next";
import { LayoutDashboard } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export const instant = false;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  return (
    <main className="relative min-h-dvh overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--color-navy) 0%, #1a2a4a 50%, var(--color-navy) 100%)' }}>
      {/* Gradient overlay with coral accent */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 60% 40%, var(--color-coral) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(255, 107, 91, 0.1) 0%, transparent 40%)',
        }}
      />

      <div className="relative flex min-h-dvh items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Brand */}
          <div className="mb-12 text-center">
            <div className="mb-6 flex justify-center">
              <span className="flex size-14 items-center justify-center rounded-2xl" style={{ background: 'var(--color-coral)' }}>
                <LayoutDashboard className="size-7 text-white" />
              </span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Client Manager</h1>
            <p className="text-base" style={{ color: 'var(--color-cream)' }}>Manage clients and documents with ease</p>
          </div>

          {/* Login Card */}
          <div
            className="rounded-3xl backdrop-blur-xl border p-8 shadow-2xl"
            style={{
              background: 'rgba(244, 237, 224, 0.95)',
              borderColor: 'var(--color-coral)',
              borderWidth: '2px'
            }}
          >
            <h2 className="text-2xl font-semibold tracking-tight mb-2" style={{ color: 'var(--color-navy)' }}>Welcome back</h2>
            <p className="text-sm mb-8" style={{ color: 'var(--color-navy)' }}>Sign in to your account to continue</p>
            <LoginForm next={safeNext} />
          </div>

          {/* Footer text */}
          <p className="mt-8 text-center text-sm" style={{ color: 'var(--color-cream)' }}>Authorised users only. Activity is logged.</p>
        </div>
      </div>
    </main>
  );
}
