import { describe, expect, it } from "vitest";
import { addMonths, cycleMonths, firstDue, nextDue, normaliseDay, todayIn } from "./schedule";

const d = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("cycleMonths", () => {
  it("maps cycles to calendar months", () => {
    expect(cycleMonths("MONTHLY")).toBe(1);
    expect(cycleMonths("QUARTERLY")).toBe(3);
    expect(cycleMonths("ANNUAL")).toBe(12);
  });
});

describe("normaliseDay", () => {
  it("keeps days in the 1-28 range every month supports", () => {
    expect(normaliseDay(5)).toBe(5);
    expect(normaliseDay(0)).toBe(1);
    expect(normaliseDay(31)).toBe(28);
  });
});

describe("firstDue", () => {
  it("is due on the anchor itself when the anchor day matches", () => {
    expect(firstDue(d("2026-11-05"), 5).toISOString().slice(0, 10)).toBe("2026-11-05");
  });

  it("moves later in the same month when the day is ahead of the anchor", () => {
    expect(firstDue(d("2026-11-02"), 20).toISOString().slice(0, 10)).toBe("2026-11-20");
  });

  it("rolls to the next month when the day has passed the anchor", () => {
    expect(firstDue(d("2026-11-25"), 5).toISOString().slice(0, 10)).toBe("2026-12-05");
  });
});

describe("addMonths", () => {
  it("adds calendar months", () => {
    expect(addMonths(d("2026-01-05"), 1).toISOString().slice(0, 10)).toBe("2026-02-05");
    expect(addMonths(d("2026-01-05"), 12).toISOString().slice(0, 10)).toBe("2027-01-05");
    expect(addMonths(d("2026-11-20"), 3).toISOString().slice(0, 10)).toBe("2027-02-20");
  });
});

describe("nextDue", () => {
  it("follows the previous period by the cycle", () => {
    expect(nextDue(d("2026-11-05"), 1, 5).toISOString().slice(0, 10)).toBe("2026-12-05");
  });

  it("applies a changed send day to the next invoice", () => {
    expect(nextDue(d("2026-11-05"), 1, 20).toISOString().slice(0, 10)).toBe("2026-12-20");
  });
});

describe("todayIn", () => {
  it("resolves the calendar day in the billing timezone", () => {
    // 2026-11-07 20:00 UTC is already 2026-11-08 in Colombo (UTC+5:30).
    expect(todayIn("Asia/Colombo", new Date("2026-11-07T20:00:00Z")).toISOString().slice(0, 10)).toBe("2026-11-08");
    expect(todayIn("Asia/Colombo", new Date("2026-11-07T04:00:00Z")).toISOString().slice(0, 10)).toBe("2026-11-07");
  });
});
