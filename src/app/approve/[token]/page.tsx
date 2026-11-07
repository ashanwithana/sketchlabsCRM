import type { Metadata } from "next";
import { CalendarClock, ShieldAlert } from "lucide-react";
import { loadPublicQuotation, type PublicQuotation } from "@/lib/approval/service";
import { formatMoney } from "@/lib/money";
import { DecisionButtons } from "./decision-buttons";

export const metadata: Metadata = {
  title: "Review quotation",
  robots: { index: false, follow: false },
};

const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

export default async function ApprovePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await loadPublicQuotation(token);

  return (
    <main className="min-h-dvh bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <p className="mb-6 text-center text-sm font-medium text-muted">
          {result.state === "invalid" ? "Client Manager" : result.quotation.companyName || "Quotation"}
        </p>

        {result.state === "invalid" && (
          <Notice
            icon={<ShieldAlert className="size-6" />}
            title="This link is not valid"
            text="The link may have been copied incorrectly or has expired. Ask the sender for a new one."
          />
        )}

        {result.state === "expired" && (
          <>
            <Notice icon={<CalendarClock className="size-6" />} title="This quotation has expired" text={`It was valid until ${day(result.quotation.validUntil)}. Ask the sender for an updated quotation.`} />
            <Quote quotation={result.quotation} />
          </>
        )}

        {result.state === "closed" && (
          <>
            <Notice
              title={`Already ${result.decision === "APPROVED" ? "approved" : result.decision === "REJECTED" ? "declined" : "answered"}`}
              text="A decision for this quotation has already been recorded. Contact the sender if you need to change it."
            />
            <Quote quotation={result.quotation} />
          </>
        )}

        {result.state === "open" && (
          <>
            <Quote quotation={result.quotation} />
            <div className="mt-6 rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
              <p className="mb-4 text-sm text-muted">
                Please review the quotation above. Approving it tells the sender to go ahead. Declining tells them you will not proceed.
              </p>
              <DecisionButtons token={result.token} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Notice({ icon, title, text }: { icon?: React.ReactNode; title: string; text: string }) {
  return (
    <div className="mb-6 flex gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
      {icon && <span className="text-primary">{icon}</span>}
      <div>
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted">{text}</p>
      </div>
    </div>
  );
}

function Quote({ quotation: q }: { quotation: PublicQuotation }) {
  const money = (minor: number) => formatMoney(minor, q.currency);
  return (
    <article className="rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-[var(--shadow-card)]">
      <header className="flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Quotation</p>
          <h2 className="num text-xl font-semibold">{q.reference}</h2>
          <p className="text-sm text-muted">For {q.clientName}</p>
        </div>
        <div className="text-sm text-muted sm:text-right">
          <p>Issued {day(q.issueDate)}</p>
          <p>Valid until {day(q.validUntil)}</p>
        </div>
      </header>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Unit price</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {q.items.map((i) => (
              <tr key={i.position}>
                <td className="whitespace-pre-line py-3 pr-4">{i.description}</td>
                <td className="num py-3 text-right">{i.quantity}</td>
                <td className="num py-3 text-right">{money(i.unitPrice)}</td>
                <td className="num py-3 text-right">{money(i.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="ml-auto mt-4 w-full max-w-xs space-y-1 text-sm">
        <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="num">{money(q.subtotal)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">Discount</dt><dd className="num">{q.discountTotal ? `− ${money(q.discountTotal)}` : money(0)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">Tax</dt><dd className="num">{money(q.taxTotal)}</dd></div>
        <div className="flex justify-between border-t border-border pt-2 text-base font-semibold"><dt>Grand total</dt><dd className="num">{money(q.grandTotal)}</dd></div>
      </dl>

      {q.terms && (
        <div className="mt-6">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Terms and conditions</h3>
          <p className="mt-2 whitespace-pre-line text-sm text-foreground">{q.terms}</p>
        </div>
      )}
    </article>
  );
}
