import { afterEach, describe, expect, it } from "vitest";
import { browserClock, getTimeTravelDate, setTimeTravelDate } from "./clock";

describe("clock port TimeTravel", () => {
  afterEach(() => setTimeTravelDate(null));

  it("returns the real device date when no override is set", () => {
    expect(getTimeTravelDate()).toBeNull();
    expect(browserClock.today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns the overridden date once TimeTravel is set", () => {
    setTimeTravelDate("2026-08-02");
    expect(browserClock.today()).toBe("2026-08-02");
    expect(getTimeTravelDate()).toBe("2026-08-02");
  });

  it("clearing the override (null) restores the real device date", () => {
    setTimeTravelDate("2026-01-01");
    setTimeTravelDate(null);
    expect(browserClock.today()).not.toBe("2026-01-01");
  });

  it("now() still returns a valid epoch ms once TimeTravel is set", () => {
    setTimeTravelDate("2026-08-02");
    const ms = browserClock.now();
    expect(Number.isFinite(ms)).toBe(true);
    expect(ms).toBeGreaterThan(0);
  });
});
