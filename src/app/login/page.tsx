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
    <main className="relative min-h-screen overflow-hidden flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--color-navy) 0%, #1a2a4a 50%, var(--color-navy) 100%)' }}>
      {/* Vertical striped lines pattern */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(
            90deg,
            transparent,
            transparent 2px,
            rgba(255, 255, 255, 0.05) 2px,
            rgba(255, 255, 255, 0.05) 4px
          )`,
        }}
      />

      {/* Gradient overlay with coral accent */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 60% 40%, var(--color-coral) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(255, 107, 91, 0.1) 0%, transparent 40%)',
        }}
      />

      <div className="relative w-full max-w-md px-4">
        {/* Brand */}
        <div className="mb-12 text-center">
          <div className="mb-6 flex justify-center">
            <span className="flex size-14 items-center justify-center rounded-2xl" style={{ background: 'var(--color-coral)' }}>
              <LayoutDashboard className="size-7 text-white" />
            </span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">SketchLabsCRM</h1>
          <p className="text-base font-medium" style={{ color: 'var(--color-cream)' }}>Manage clients and documents with ease</p>
        </div>

        {/* Login Card - Dark glassmorphic design */}
        <div
          className="rounded-3xl backdrop-blur-md border p-8 shadow-2xl"
          style={{
            background: 'rgba(20, 33, 61, 0.5)',
            borderColor: 'rgba(255, 107, 91, 0.4)',
            borderWidth: '1px'
          }}
        >
          <h2 className="text-2xl font-bold tracking-tight mb-2 text-white">Welcome back</h2>
          <p className="text-sm mb-8 font-medium opacity-90" style={{ color: 'var(--color-cream)' }}>Sign in to your account to continue</p>
          <LoginForm next={safeNext} />
        </div>

        {/* Footer text */}
        <p className="mt-8 text-center text-sm font-medium" style={{ color: 'var(--color-cream)' }}>Authorised users only. Activity is logged.</p>
      </div>
    </main>
  );
}
