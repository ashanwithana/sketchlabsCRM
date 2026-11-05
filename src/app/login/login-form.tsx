"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />

      {state.error && (
        <div role="alert" className="text-sm text-center font-light p-2" style={{ color: 'var(--color-coral)' }}>
          {state.error}
        </div>
      )}

      <div>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          aria-invalid={Boolean(state.fieldErrors?.email)}
          placeholder="Your email address"
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: 'white',
            fontSize: '14px',
            fontWeight: '300',
            padding: '12px 16px'
          } as React.CSSProperties}
          className="placeholder:text-white/40 w-full"
        />
        {state.fieldErrors?.email && (
          <p className="text-xs mt-1 font-light" style={{ color: 'var(--color-coral)' }}>{state.fieldErrors.email}</p>
        )}
      </div>

      <div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(state.fieldErrors?.password)}
          placeholder="Password"
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: 'white',
            fontSize: '14px',
            fontWeight: '300',
            padding: '12px 16px'
          } as React.CSSProperties}
          className="placeholder:text-white/40 w-full"
        />
        {state.fieldErrors?.password && (
          <p className="text-xs mt-1 font-light" style={{ color: 'var(--color-coral)' }}>{state.fieldErrors.password}</p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full mt-6 font-light text-base py-3"
        style={{ background: 'white', color: 'black' }}
        disabled={pending}
      >
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {pending ? "Verifying" : "Initiate Authentication"}
      </Button>
    </form>
  );
}
