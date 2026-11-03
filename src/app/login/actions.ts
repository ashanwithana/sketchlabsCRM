"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { setSessionCookie, clearSessionCookie, getCurrentUser } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import {
  checkLoginAllowed,
  clearLoginAttempts,
  recordFailedLogin,
} from "@/lib/auth/rate-limit";
import { loginSchema } from "@/lib/validation/auth";

export type LoginState = {
  error?: string;
  fieldErrors?: { email?: string; password?: string };
};

// Same message for "no such user" and "wrong password" so the form does not reveal accounts.
const GENERIC_ERROR = "Email or password is incorrect.";

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    return {
      fieldErrors: {
        email: flat.email?.[0],
        password: flat.password?.[0],
      },
    };
  }

  const { email, password, next } = parsed.data;
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const throttleKey = `${ip}:${email}`;

  const gate = checkLoginAllowed(throttleKey);
  if (!gate.allowed) {
    const minutes = Math.ceil(gate.retryAfterSeconds / 60);
    return { error: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` };
  }

  const user = await db.user.findUnique({ where: { email } });
  const valid = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!user || !valid) {
    recordFailedLogin(throttleKey);
    return { error: GENERIC_ERROR };
  }

  clearLoginAttempts(throttleKey);
  await setSessionCookie({ id: user.id, email: user.email, name: user.name, role: user.role });
  await logActivity({ action: "LOGIN", entityType: "User", entityId: user.id, summary: `${user.name} signed in` });
  redirect(next);
}

export async function logoutAction() {
  const user = await getCurrentUser();
  await clearSessionCookie();
  if (user) {
    await logActivity({ action: "LOGOUT", entityType: "User", entityId: user.id, summary: `${user.name} signed out` });
  }
  redirect("/login");
}
