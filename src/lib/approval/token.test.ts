import { describe, expect, it } from "vitest";
import { createApprovalToken, verifyApprovalToken } from "./token";

const now = new Date("2026-06-01T00:00:00Z");

describe("approval link tokens", () => {
  it("verifies a fresh token and returns the document it was issued for", () => {
    const { token } = createApprovalToken("doc_123", new Date("2026-06-20T23:59:59Z"), now);
    expect(verifyApprovalToken(token, now)?.documentId).toBe("doc_123");
  });

  it("rejects a token whose payload was changed", () => {
    const { token } = createApprovalToken("doc_123", new Date("2026-06-20T23:59:59Z"), now);
    const [, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ d: "doc_999", e: now.getTime() + 1e9, v: 1 })).toString("base64url");
    expect(verifyApprovalToken(`${forged}.${sig}`, now)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifyApprovalToken("not-a-token", now)).toBeNull();
    expect(verifyApprovalToken("a.b.c", now)).toBeNull();
    expect(verifyApprovalToken("", now)).toBeNull();
  });

  it("stops working after it expires", () => {
    const { token, expiresAt } = createApprovalToken("doc_123", new Date("2026-06-10T23:59:59Z"), now);
    expect(verifyApprovalToken(token, new Date(expiresAt.getTime() - 1000))).not.toBeNull();
    expect(verifyApprovalToken(token, new Date(expiresAt.getTime() + 1000))).toBeNull();
  });

  it("never lasts longer than 90 days, even for a far-future quotation expiry", () => {
    const { expiresAt } = createApprovalToken("doc_123", new Date("2030-01-01T00:00:00Z"), now);
    expect(expiresAt.getTime() - now.getTime()).toBeLessThanOrEqual(90 * 86_400_000);
  });
});
