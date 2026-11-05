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
      {/* Vertical striped lines pattern - BIGGER with cream color */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(
            90deg,
            transparent,
            transparent 8px,
            rgba(244, 237, 224, 0.08) 8px,
            rgba(244, 237, 224, 0.08) 16px
          )`,
        }}
      />

      {/* Wave SVG Pattern */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 w-full h-full"
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="waveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255, 107, 91, 0.15)" />
            <stop offset="100%" stopColor="rgba(255, 107, 91, 0)" />
          </linearGradient>
        </defs>
        <path
          fill="url(#waveGradient)"
          d="M0,96L60,112C120,128,240,160,360,160C480,160,600,128,720,128C840,128,960,160,1080,165.3C1200,171,1320,149,1380,138.7L1440,128L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z"
        />
        <path
          fill="rgba(244, 237, 224, 0.05)"
          d="M0,160L60,170.7C120,181,240,203,360,197.3C480,192,600,160,720,149.3C840,139,960,149,1080,154.7C1200,160,1320,160,1380,160L1440,160L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z"
        />
      </svg>

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
          <h1 className="text-5xl font-black tracking-tight text-white mb-3" style={{ letterSpacing: '-0.5px' }}>SketchLabsCRM</h1>
          <p className="text-base font-semibold" style={{ color: 'var(--color-cream)' }}>Client & Document Management</p>
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
          <h2 className="text-3xl font-black tracking-tight mb-2 text-white" style={{ letterSpacing: '-0.5px' }}>Welcome back</h2>
          <p className="text-sm mb-8 font-semibold opacity-90" style={{ color: 'var(--color-cream)' }}>Sign in to your account to continue</p>
          <LoginForm next={safeNext} />
        </div>

        {/* Footer text */}
        <p className="mt-8 text-center text-sm font-medium" style={{ color: 'var(--color-cream)' }}>Authorised users only. Activity is logged.</p>
      </div>
    </main>
  );
}
