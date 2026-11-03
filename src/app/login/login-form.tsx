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
        <div role="alert" className="rounded-lg border border-danger-soft bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </div>
      )}

      <Field label="Email" htmlFor="email" required error={state.fieldErrors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          aria-invalid={Boolean(state.fieldErrors?.email)}
          placeholder="you@company.com"
        />
      </Field>

      <Field label="Password" htmlFor="password" required error={state.fieldErrors?.password}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(state.fieldErrors?.password)}
        />
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
