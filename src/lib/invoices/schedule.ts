import { BILLING_CYCLES, type BillingCycle } from "@/lib/constants";

// Due-date arithmetic for the billing cron. All values are calendar days held at UTC
// midday so comparisons never drift across timezones; "today" is resolved separately
// in the billing timezone (Asia/Colombo) before being compared here.

export const BILLING_TIMEZONE = "Asia/Colombo";

/** The cycle length in calendar months. */
export function cycleMonths(cycle: BillingCycle): number {
  const found = BILLING_CYCLES.find((c) => c.value === cycle);
  if (!found) throw new Error(`Unknown billing cycle: ${cycle}`);
  return found.months;
}

/** Billing days run 1-28, which every month supports, so dates never need clamping. */
export function normaliseDay(day: number): number {
  if (!Number.isFinite(day)) return 1;
  return Math.min(28, Math.max(1, Math.round(day)));
}

/** A calendar date at UTC midday. */
export function calendarDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day, 12));
}

/** The same date with a different day of the month (1-28). */
export function withDay(date: Date, day: number): Date {
  return calendarDate(date.getUTCFullYear(), date.getUTCMonth(), normaliseDay(day));
}

/** Today's calendar date in the billing timezone, as a midday-UTC Date. */
export function todayIn(timezone: string, now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return calendarDate(get("year"), get("month") - 1, get("day"));
}

/**
 * The first billing date on or after the anchor. If the anchor already falls in the
 * billing day, the invoice is due on the anchor day itself.
 */
export function firstDue(anchor: Date, day: number): Date {
  const candidate = withDay(anchor, day);
  const anchorDay = calendarDate(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate());
  return candidate.getTime() >= anchorDay.getTime() ? candidate : addMonths(candidate, 1);
}

/** Adds calendar months, keeping the (1-28) day of the month. */
export function addMonths(date: Date, months: number): Date {
  return calendarDate(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate());
}

/**
 * The next due date after the last invoiced period, honouring the currently
 * configured day so changing the send day takes effect on the next invoice.
 */
export function nextDue(lastPeriodStart: Date, months: number, day: number): Date {
  return withDay(addMonths(lastPeriodStart, months), day);
}
