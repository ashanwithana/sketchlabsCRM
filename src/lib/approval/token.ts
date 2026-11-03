import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";

// Approval links let a client accept or reject a quotation without signing in.
// A link is a signed, expiring token: "<base64url payload>.<HMAC-SHA256 signature>".
// The payload holds only the document id and the expiry time, so nothing else can be read from it.

const DEFAULT_DAYS = 30;
const MAX_DAYS = 90;

type Payload = { d: string; e: number; v: 1 };

function key(purpose: string) {
  // Derive a separate key so an approval token can never be used as a session token.
  return createHmac("sha256", getEnv().SESSION_SECRET).update(`approval:${purpose}`).digest();
}

function sign(body: string) {
  return createHmac("sha256", key("link")).update(body).digest("base64url");
}

export function createApprovalToken(documentId: string, validUntil: Date, now: Date = new Date()): { token: string; expiresAt: Date } {
  // Valid until the quotation's own expiry, capped to a sensible window.
  const cap = now.getTime() + MAX_DAYS * 86_400_000;
  const requested = now.getTime() + DEFAULT_DAYS * 86_400_000;
  const expiresAt = new Date(Math.min(Math.max(validUntil.getTime(), requested), cap));
  const payload: Payload = { d: documentId, e: expiresAt.getTime(), v: 1 };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { token: `${body}.${sign(body)}`, expiresAt };
}

export type VerifiedToken = { documentId: string; expiresAt: Date };

/** Returns the document id when the token is genuine and not expired, otherwise null. */
export function verifyApprovalToken(token: string, now: Date = new Date()): VerifiedToken | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;

  const expected = Buffer.from(sign(body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  let payload: Payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (payload.v !== 1 || typeof payload.d !== "string" || typeof payload.e !== "number") return null;
  if (payload.e < now.getTime()) return null;
  return { documentId: payload.d, expiresAt: new Date(payload.e) };
}
