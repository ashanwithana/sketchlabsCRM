import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { nextNumber } from "@/lib/numbering";
import { pdfEngineAvailable, getBrowser } from "@/lib/pdf/browser";
import { createQuotation } from "@/lib/quotations/service";
import { quotationSchema } from "@/lib/validation/quotation";
import { parseRecipients } from "./recipients";
import { cleanSubject, renderTemplate } from "./template";
import { deliver, type OutgoingEmail } from "./transport";
import { EmailError, retryEmail, sendDocumentEmail, sendTestEmail } from "./send";
import { storageRoot } from "@/lib/storage";

describe("recipient parsing", () => {
  it("splits on commas, semicolons, and spaces, and removes duplicates", () => {
    expect(parseRecipients("A@x.com, b@y.com; a@x.com  c@z.com")).toEqual({
      ok: true,
      emails: ["a@x.com", "b@y.com", "c@z.com"],
    });
  });

  it("rejects an invalid address and names it", () => {
    const r = parseRecipients("good@x.com, not-an-email");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("not-an-email");
  });

  it("requires an address unless the field is optional", () => {
    expect(parseRecipients("", { required: true }).ok).toBe(false);
    expect(parseRecipients("", { required: false })).toEqual({ ok: true, emails: [] });
  });

  it("limits how many addresses one message can go to", () => {
    const six = "a@x.com b@x.com c@x.com d@x.com e@x.com f@x.com";
    expect(parseRecipients(six).ok).toBe(false);
    expect(parseRecipients(six, { required: true, max: 6 }).ok).toBe(true);
  });
});

describe("email templates", () => {
  it("fills placeholders and blanks unknown ones", () => {
    expect(renderTemplate("Hi {{contact}}, see {{number}} from {{company}}. {{nope}}!", {
      contact: "Nimal",
      number: "QT-2026-0001",
      company: "Northwind",
    })).toBe("Hi Nimal, see QT-2026-0001 from Northwind. !");
  });

  it("keeps subjects on one line, which blocks header injection", () => {
    expect(cleanSubject("Quote\r\nBcc: victim@example.com")).toBe("Quote Bcc: victim@example.com");
  });
});

describe("email validation before any send", () => {
  it("rejects a missing recipient, subject, or message without touching the database", async () => {
    await expect(
      sendDocumentEmail({ documentId: "x", to: "", cc: "", subject: "s", body: "b" }, "Tester"),
    ).rejects.toBeInstanceOf(EmailError);
    await expect(
      sendDocumentEmail({ documentId: "x", to: "a@x.com", cc: "", subject: "   ", body: "b" }, "Tester"),
    ).rejects.toThrow("Enter a subject.");
    await expect(
      sendDocumentEmail({ documentId: "x", to: "a@x.com", cc: "bad", subject: "s", body: "b" }, "Tester"),
    ).rejects.toThrow("not valid");
  });
});

describe("delivery and logging (no PDF needed)", () => {
  beforeEach(async () => {
    await db.emailLog.deleteMany();
  });

  it("logs a successful send with the delivery mode", async () => {
    const result = await sendTestEmail("tester@example.com", "Tester", async () => ({ mode: "DEV_OUTBOX", outboxPath: "outbox/x.eml" }));
    expect(result.ok).toBe(true);
    const log = await db.emailLog.findFirstOrThrow();
    expect(log.status).toBe("SENT");
    expect(log.mode).toBe("DEV_OUTBOX");
    expect(log.outboxPath).toBe("outbox/x.eml");
    expect(log.toAddress).toBe("tester@example.com");
  });

  it("records a failure with a readable reason and does not throw", async () => {
    const result = await sendTestEmail("tester@example.com", "Tester", async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:2525");
    });
    expect(result.ok).toBe(false);
    const log = await db.emailLog.findFirstOrThrow();
    expect(log.status).toBe("FAILED");
    expect(log.error).toContain("could not be reached");
  });

  it("retries a failed email as a new attempt and keeps the original failure", async () => {
    const failed = await sendTestEmail("tester@example.com", "Tester", async () => {
      throw new Error("ETIMEDOUT");
    });
    if (failed.ok) throw new Error("expected failure");

    const retry = await retryEmail(failed.logId as string, "Tester", async () => ({ mode: "SMTP", outboxPath: null }));
    expect(retry.ok).toBe(true);
    expect(await db.emailLog.count()).toBe(2);
    expect((await db.emailLog.findUniqueOrThrow({ where: { id: failed.logId as string } })).status).toBe("FAILED");
  });

  it("refuses to retry an email that was already sent", async () => {
    const sent = await sendTestEmail("tester@example.com", "Tester", async () => ({ mode: "SMTP", outboxPath: null }));
    if (!sent.ok) throw new Error("expected success");
    await expect(retryEmail(sent.logId, "Tester", async () => ({ mode: "SMTP", outboxPath: null }))).rejects.toThrow("Only failed emails");
  });

  it("writes a real .eml file to the dev outbox when SMTP is not configured", async () => {
    const delivery = await deliver({
      from: "Test <sender@example.com>",
      to: ["recipient@example.com"],
      cc: [],
      subject: "Outbox check",
      text: "Hello from the outbox test.",
      attachment: { filename: "QT-TEST.pdf", content: Buffer.from("%PDF-1.4 test"), contentType: "application/pdf" },
    });
    expect(delivery.mode).toBe("DEV_OUTBOX");
    expect(delivery.outboxPath).toMatch(/^outbox\/.+\.eml$/);
    const raw = fs.readFileSync(path.join(storageRoot(), delivery.outboxPath as string), "utf8");
    expect(raw).toContain("Subject: Outbox check");
    expect(raw).toContain("To: recipient@example.com");
    expect(raw).toMatch(/filename="?QT-TEST\.pdf"?/);
    expect(raw).toContain("Content-Type: application/pdf");
  });
});

const describeIfChrome = pdfEngineAvailable() ? describe : describe.skip;

describeIfChrome("document email with PDF attachment (requires Chrome)", () => {
  let documentId = "";

  beforeAll(async () => {
    await db.emailLog.deleteMany();
    await db.document.deleteMany({ where: { type: "QUOTATION" } });
    await db.sequence.deleteMany({ where: { key: { startsWith: "QT-" } } });
    const client = await db.client.create({
      data: {
        clientCode: await nextNumber("CLIENT"),
        companyName: "Email Test Client",
        contactPerson: "Contact Person",
        email: "contact@client.example",
        phone: "+94 11 000 2222",
        billingAddress: "3 Mail Road",
        registrationNumber: "MAIL-1",
        category: "CORPORATE",
      },
    });
    const created = await createQuotation(
      quotationSchema.parse({
        clientId: client.id,
        issueDate: "2026-05-01",
        validUntil: "2026-05-31",
        terms: "",
        notes: "",
        items: [{ description: "Email test item", quantity: "1", unitPrice: "500", discount: "", taxRate: "0" }],
      }),
      "Tester",
    );
    documentId = created.id;
  });

  afterAll(async () => {
    const browser = await getBrowser().catch(() => null);
    await browser?.close();
  });

  it("sends the PDF as an attachment, logs it, and moves a draft to Sent", async () => {
    const captured: OutgoingEmail[] = [];
    const result = await sendDocumentEmail(
      { documentId, to: "contact@client.example", cc: "accounts@client.example", subject: "Quotation", body: "Please see attached." },
      "Tester",
      async (email) => {
        captured.push(email);
        return { mode: "DEV_OUTBOX", outboxPath: "outbox/captured.eml" };
      },
    );
    expect(result.ok).toBe(true);
    expect(captured[0].attachment?.filename).toMatch(/^QT-\d{4}-\d{4}-rev1\.pdf$/);
    expect(captured[0].attachment?.content.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(captured[0].cc).toEqual(["accounts@client.example"]);

    const doc = await db.document.findUniqueOrThrow({ where: { id: documentId } });
    expect(doc.status).toBe("SENT");
    const log = await db.emailLog.findFirstOrThrow({ where: { documentId } });
    expect(log.status).toBe("SENT");
    expect(log.attachment).toMatch(/rev1\.pdf$/);
    expect(log.revisionId).not.toBeNull();
  }, 60_000);
});
