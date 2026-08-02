import { describe, expect, it } from "vitest";
import { daysInMonth, isLeapYear, monthBefore, parseYm, shiftMonth, ymd, ymOnly } from "./calendar";

// ── isLeapYear / daysInMonth — the leap-year branch selectors.ts's budgetPace
// depends on (a wrong February silently skews the pace bar / moodTier). ──
describe("isLeapYear", () => {
  it("divisible by 4, not by 100 -> leap", () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2028)).toBe(true);
  });
  it("divisible by 100, not by 400 -> not leap", () => {
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2100)).toBe(false);
  });
  it("divisible by 400 -> leap", () => {
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(2400)).toBe(true);
  });
  it("not divisible by 4 -> not leap", () => {
    expect(isLeapYear(2025)).toBe(false);
    expect(isLeapYear(2026)).toBe(false);
  });
});

describe("daysInMonth", () => {
  it("February is 29 in a leap year, 28 otherwise", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
  });
  it("every other month is unaffected by leap-year status", () => {
    expect(daysInMonth(2024, 1)).toBe(31);
    expect(daysInMonth(2024, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });
});

// ── shiftMonth's negative-wrap arithmetic ──
describe("shiftMonth", () => {
  it("shifts forward within the same year", () => {
    expect(shiftMonth(2026, 8, 1)).toEqual({ y: 2026, m: 9 });
  });
  it("shifts forward across a year boundary", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ y: 2027, m: 1 });
  });
  it("shifts backward within the same year", () => {
    expect(shiftMonth(2026, 8, -1)).toEqual({ y: 2026, m: 7 });
  });
  it("negative-wraps backward across a year boundary (January - 1 -> prior December)", () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ y: 2025, m: 12 });
  });
  it("negative-wraps by more than 12 months", () => {
    expect(shiftMonth(2026, 3, -15)).toEqual({ y: 2024, m: 12 });
  });
  it("is a no-op for n = 0", () => {
    expect(shiftMonth(2026, 8, 0)).toEqual({ y: 2026, m: 8 });
  });
  it("large positive n crosses multiple years", () => {
    expect(shiftMonth(2026, 8, 25)).toEqual({ y: 2028, m: 9 });
  });
});

describe("monthBefore", () => {
  it("normal case within a year", () => {
    expect(monthBefore("2026-08")).toBe("2026-07");
  });
  it("wraps backward across a year boundary", () => {
    expect(monthBefore("2026-01")).toBe("2025-12");
  });
});

// ── string formatting helpers (pad2 exercised implicitly) ──
describe("ymOnly / ymd / parseYm", () => {
  it("pads single-digit months to two digits", () => {
    expect(ymOnly(2026, 3)).toBe("2026-03");
    expect(ymd(2026, 3, 5)).toBe("2026-03-05");
  });
  it("parseYm round-trips ymOnly", () => {
    expect(parseYm("2026-08")).toEqual({ y: 2026, m: 8 });
    expect(parseYm(ymOnly(2024, 2))).toEqual({ y: 2024, m: 2 });
  });
});
