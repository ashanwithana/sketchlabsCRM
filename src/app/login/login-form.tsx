"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />

      {state.error && (
        <div role="alert" className="rounded-lg border px-3 py-2 text-sm" style={{ background: 'rgba(255, 107, 91, 0.1)', borderColor: 'rgba(255, 107, 91, 0.3)', color: 'var(--color-coral)' }}>
          {state.error}
        </div>
      )}

      <Field label="Email" htmlFor="email" required error={state.fieldErrors?.email} className="text-white font-medium">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          aria-invalid={Boolean(state.fieldErrors?.email)}
          placeholder="you@company.com"
          style={{ background: 'rgba(255, 255, 255, 0.15)', borderColor: 'rgba(255, 107, 91, 0.5)', color: 'white', fontSize: '16px' } as React.CSSProperties}
          className="placeholder:text-white/60 font-medium"
        />
      </Field>

      <Field label="Password" htmlFor="password" required error={state.fieldErrors?.password} className="text-white font-medium">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(state.fieldErrors?.password)}
          style={{ background: 'rgba(255, 255, 255, 0.15)', borderColor: 'rgba(255, 107, 91, 0.5)', color: 'white', fontSize: '16px' } as React.CSSProperties}
          className="placeholder:text-white/60 font-medium"
        />
      </Field>

      <Button type="submit" size="lg" className="w-full mt-6" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
