import { describe, expect, it, beforeEach } from "vitest";
import { hashPassword, verifyPassword } from "./password";
import { createSessionToken } from "./session";
import { checkLoginAllowed, clearLoginAttempts, recordFailedLogin } from "./rate-limit";
import { loginSchema } from "@/lib/validation/auth";
import { jwtVerify } from "jose";

describe("password hashing", () => {
  it("verifies the correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct-horse-battery");
    expect(hash).not.toContain("correct-horse-battery");
    expect(await verifyPassword("correct-horse-battery", hash)).toBe(true);
    expect(await verifyPassword("wrong-password-here", hash)).toBe(false);
  });
});

describe("login throttle", () => {
  beforeEach(() => clearLoginAttempts("ip:user@example.com"));

  it("blocks after five failed attempts and allows again after a reset", () => {
    for (let i = 0; i < 5; i++) recordFailedLogin("ip:user@example.com");
    const gate = checkLoginAllowed("ip:user@example.com");
    expect(gate.allowed).toBe(false);
    expect(gate.retryAfterSeconds).toBeGreaterThan(0);

    clearLoginAttempts("ip:user@example.com");
    expect(checkLoginAllowed("ip:user@example.com").allowed).toBe(true);
  });

  it("keeps other keys unaffected", () => {
    for (let i = 0; i < 5; i++) recordFailedLogin("ip:user@example.com");
    expect(checkLoginAllowed("ip:someone-else@example.com").allowed).toBe(true);
    clearLoginAttempts("ip:user@example.com");
  });
});

describe("session token", () => {
  it("creates a token that verifies with the app secret and carries the user id", async () => {
    const token = await createSessionToken({ id: "user_1", email: "a@b.com", name: "A", role: "ADMIN" });
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    expect(payload.sub).toBe("user_1");
    expect(payload.role).toBe("ADMIN");
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken({ id: "user_1", email: "a@b.com", name: "A", role: "ADMIN" });
    const wrong = new TextEncoder().encode("another-secret-that-is-long-enough-0123456789");
    await expect(jwtVerify(token, wrong)).rejects.toThrow();
  });
});

describe("login validation", () => {
  it("normalises the email and accepts a safe relative redirect", () => {
    const parsed = loginSchema.parse({ email: "  Admin@Example.COM ", password: "x", next: "/clients" });
    expect(parsed.email).toBe("admin@example.com");
    expect(parsed.next).toBe("/clients");
  });

  it("refuses external redirects", () => {
    const parsed = loginSchema.parse({ email: "a@b.com", password: "x", next: "https://evil.example" });
    expect(parsed.next).toBe("/dashboard");
  });

  it("rejects an invalid email and an empty password", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "" });
    expect(result.success).toBe(false);
  });
});
