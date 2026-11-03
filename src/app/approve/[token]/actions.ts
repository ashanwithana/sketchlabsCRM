"use server";

import { revalidatePath } from "next/cache";
import { ApprovalError, decideByClient } from "@/lib/approval/service";

export type DecisionResult = { ok: true } | { ok: false; error: string };

// Public: the token is the only credential. Replies are limited to the decision and a message.
async function decide(token: string, decision: "APPROVED" | "REJECTED"): Promise<DecisionResult> {
  try {
    await decideByClient(token, decision);
    revalidatePath("/approve/[token]", "page");
    return { ok: true };
  } catch (err) {
    if (err instanceof ApprovalError) return { ok: false, error: err.message };
    console.error("Approval decision failed", err instanceof Error ? err.message : err);
    return { ok: false, error: "The decision could not be recorded. Please try again." };
  }
}

export async function approveQuotationAction(token: string): Promise<DecisionResult> {
  return decide(token, "APPROVED");
}

export async function rejectQuotationAction(token: string): Promise<DecisionResult> {
  return decide(token, "REJECTED");
}
