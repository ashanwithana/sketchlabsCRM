import type { Metadata } from "next";
import { LayoutDashboard } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  return (
    <main className="relative min-h-screen overflow-hidden flex items-center justify-center" style={{ background: '#0a0a0a' }}>
      {/* Vertical grid lines */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px)`,
          backgroundSize: '80px auto'
        }}
      />

      {/* Horizontal grid lines */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(0deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px)`,
          backgroundSize: 'auto 80px'
        }}
      />

      {/* Subtle radial glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 50% 50%, rgba(255, 107, 91, 0.05) 0%, transparent 60%)
          `,
        }}
      />

      <div className="relative w-full max-w-md px-4">
        {/* Decorative corner markers */}
        <div className="absolute -top-6 -left-6 w-6 h-6 border-t-2 border-l-2" style={{ borderColor: 'rgba(255, 255, 255, 0.3)' }}></div>
        <div className="absolute -top-6 -right-6 w-6 h-6 border-t-2 border-r-2" style={{ borderColor: 'rgba(255, 255, 255, 0.3)' }}></div>
        <div className="absolute -bottom-6 -left-6 w-6 h-6 border-b-2 border-l-2" style={{ borderColor: 'rgba(255, 255, 255, 0.3)' }}></div>
        <div className="absolute -bottom-6 -right-6 w-6 h-6 border-b-2 border-r-2" style={{ borderColor: 'rgba(255, 255, 255, 0.3)' }}></div>

        {/* Logo */}
        <div className="mb-12 flex justify-center">
          <div className="flex size-12 items-center justify-center" style={{ background: 'var(--color-cream)' }}>
            <LayoutDashboard className="size-6" style={{ color: 'var(--color-navy)' }} />
          </div>
        </div>

        {/* Main Card */}
        <div
          className="p-8 relative"
          style={{
            background: 'rgba(20, 20, 20, 0.7)',
            border: '2px solid rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(10px)'
          }}
        >
          <h2 className="text-2xl font-light tracking-wide mb-2 text-center" style={{ color: 'white' }}>Sign in with Email</h2>
          <p className="text-sm text-center mb-8 font-light" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Enter your email address to receive a verification code</p>

          <LoginForm next={safeNext} />

          {/* Footer */}
          <p className="mt-8 text-center text-xs font-light" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
            🔒 Protected by encryption
          </p>
        </div>
      </div>
    </main>
  );
}
