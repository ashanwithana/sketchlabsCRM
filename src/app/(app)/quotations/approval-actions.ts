"use server";

import { requireUser } from "@/lib/auth/session";
import { ApprovalError, createApprovalLink } from "@/lib/approval/service";

export type ApprovalLinkResult =
  | { ok: true; url: string; expiresOn: string }
  | { ok: false; error: string };

export async function createApprovalLinkAction(documentId: string): Promise<ApprovalLinkResult> {
  const user = await requireUser();
  try {
    const { url, expiresAt } = await createApprovalLink(documentId, user.name);
    return { ok: true, url, expiresOn: expiresAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) };
  } catch (err) {
    if (err instanceof ApprovalError) return { ok: false, error: err.message };
    throw err;
  }
}
