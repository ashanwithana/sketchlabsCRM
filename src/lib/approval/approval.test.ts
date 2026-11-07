import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { nextNumber } from "@/lib/numbering";
import { createQuotation, setQuotationStatus } from "@/lib/quotations/service";
import { quotationSchema } from "@/lib/validation/quotation";
import { ApprovalError, createApprovalLink, decideByClient, loadPublicQuotation } from "./service";

let clientId = "";
const tokenFrom = (url: string) => url.split("/approve/")[1];

const make = async (validUntil: string) =>
  (
    await createQuotation(
      quotationSchema.parse({
        clientId,
        crId: "",
        issueDate: "2026-06-01",
        validUntil,
        terms: "Terms for the client",
        notes: "INTERNAL NOTE SHOULD NOT LEAK",
        items: [{ description: "Approval test work", quantity: "2", unitPrice: "250", discount: "", taxRate: "10" }],
      }),
      "Tester",
    )
  ).id;

describe("client approval flow", () => {
  beforeAll(async () => {
    await db.document.deleteMany();
    await db.sequence.deleteMany({ where: { key: { startsWith: "QT-" } } });
    await db.client.deleteMany();
    clientId = (
      await db.client.create({
        data: {
          clientCode: await nextNumber("CLIENT"),
          companyName: "Approval Client",
          contactPerson: "Contact",
          email: "approve@client.example",
          phone: "+94 11 000 7777",
          billingAddress: "7 Approval Road",
          registrationNumber: "APP-1",
          category: "CORPORATE",
        },
      })
    ).id;
  });

  beforeEach(async () => {
    await db.document.deleteMany();
    await db.sequence.deleteMany({ where: { key: { startsWith: "QT-" } } });
  });

  it("only offers a link for a quotation the client has been sent", async () => {
    const id = await make("2099-12-31");
    await expect(createApprovalLink(id, "Tester")).rejects.toBeInstanceOf(ApprovalError);
    await setQuotationStatus(id, "SENT", "Tester");
    const { url } = await createApprovalLink(id, "Tester");
    expect(url).toContain("/approve/");
  });

  it("shows the client the printed content and never the internal notes", async () => {
    const id = await make("2099-12-31");
    await setQuotationStatus(id, "SENT", "Tester");
    const { url } = await createApprovalLink(id, "Tester");
    const state = await loadPublicQuotation(tokenFrom(url));
    expect(state.state).toBe("open");
    if (state.state !== "open") throw new Error("expected open");
    expect(state.quotation.items[0].description).toBe("Approval test work");
    expect(state.quotation.terms).toBe("Terms for the client");
    expect(JSON.stringify(state)).not.toContain("INTERNAL NOTE");
  });

  it("records an approval once, and refuses a second decision", async () => {
    const id = await make("2099-12-31");
    await setQuotationStatus(id, "SENT", "Tester");
    const token = tokenFrom((await createApprovalLink(id, "Tester")).url);

    await decideByClient(token, "APPROVED");
    expect((await db.document.findUniqueOrThrow({ where: { id } })).status).toBe("APPROVED");
    expect((await db.quotation.findFirstOrThrow({ where: { documentId: id } })).approvedAt).not.toBeNull();

    await expect(decideByClient(token, "REJECTED")).rejects.toThrow("already been approved");
    expect((await loadPublicQuotation(token)).state).toBe("closed");
  });

  it("records a decline and logs it as a client action", async () => {
    const id = await make("2099-12-31");
    await setQuotationStatus(id, "PENDING", "Tester");
    const token = tokenFrom((await createApprovalLink(id, "Tester")).url);
    await decideByClient(token, "REJECTED");
    expect((await db.document.findUniqueOrThrow({ where: { id } })).status).toBe("REJECTED");
    const log = await db.activityLog.findFirstOrThrow({ where: { entityId: id, summary: { contains: "via the approval link" } } });
    expect(log.summary).toContain("rejected");
  });

  it("will not accept a decision after the quotation has expired", async () => {
    const id = await make("2099-12-31");
    await setQuotationStatus(id, "SENT", "Tester");
    // Move the validity date into the past directly, since the form itself rejects that.
    await db.quotation.updateMany({ where: { documentId: id }, data: { validUntil: new Date("2020-01-01T23:59:59Z") } });
    const { token } = { token: tokenFrom((await createApprovalLink(id, "Tester")).url) };
    expect((await loadPublicQuotation(token)).state).toBe("expired");
    await expect(decideByClient(token, "APPROVED")).rejects.toThrow("expired");
  });

  it("treats an altered link as invalid and refuses to decide", async () => {
    const id = await make("2099-12-31");
    await setQuotationStatus(id, "SENT", "Tester");
    const token = tokenFrom((await createApprovalLink(id, "Tester")).url);
    const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
    expect((await loadPublicQuotation(tampered)).state).toBe("invalid");
    await expect(decideByClient(tampered, "APPROVED")).rejects.toBeInstanceOf(ApprovalError);
    expect((await db.document.findUniqueOrThrow({ where: { id } })).status).toBe("SENT");
  });
});
