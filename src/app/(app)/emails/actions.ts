"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { EmailError, retryEmail, sendDocumentEmail, sendTestEmail, type SendInput } from "@/lib/email/send";

export type EmailActionResult =
  | { ok: true; message: string; logId?: string }
  | { ok: false; error: string; logId?: string };

function revalidateEmailViews(documentId?: string | null) {
  revalidatePath("/emails");
  if (documentId) revalidatePath(`/quotations/${documentId}`);
}

export async function sendDocumentEmailAction(input: SendInput): Promise<EmailActionResult> {
  const user = await requireUser();
  try {
    const result = await sendDocumentEmail(input, user.name);
    revalidateEmailViews(input.documentId);
    revalidatePath("/quotations");
    if (result.ok) return { ok: true, message: result.message, logId: result.logId };
    return { ok: false, error: `Email failed: ${result.error}`, logId: result.logId ?? undefined };
  } catch (err) {
    if (err instanceof EmailError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function retryEmailAction(logId: string): Promise<EmailActionResult> {
  const user = await requireUser();
  try {
    const result = await retryEmail(logId, user.name);
    revalidateEmailViews();
    if (result.ok) return { ok: true, message: result.message, logId: result.logId };
    return { ok: false, error: `Retry failed: ${result.error}`, logId: result.logId ?? undefined };
  } catch (err) {
    if (err instanceof EmailError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function sendTestEmailAction(to: string): Promise<EmailActionResult> {
  const user = await requireUser();
  try {
    const result = await sendTestEmail(to, user.name);
    revalidateEmailViews();
    if (result.ok) return { ok: true, message: result.message, logId: result.logId };
    return { ok: false, error: `Test email failed: ${result.error}`, logId: result.logId ?? undefined };
  } catch (err) {
    if (err instanceof EmailError) return { ok: false, error: err.message };
    throw err;
  }
}
