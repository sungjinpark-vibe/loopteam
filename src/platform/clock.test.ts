import { afterEach, describe, expect, it, vi } from "vitest";
import { browserClock, getTimeTravelDate, setTimeTravelDate, subscribeTimeTravel } from "./clock";

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

  it("now() is anchored to local midnight of the travel date, not UTC time-of-day", () => {
    setTimeTravelDate("2026-08-02");
    const ms = browserClock.now();
    const localMidnight = new Date("2026-08-02T00:00:00").getTime();
    // Must land at/just after local midnight of the travel date (real elapsed
    // time since travel started), never wrapped by a `Date.now() % 86_400_000`
    // UTC-time-of-day calculation.
    expect(ms).toBeGreaterThanOrEqual(localMidnight);
    expect(ms).toBeLessThan(localMidnight + 60_000);
  });

  it("now() never moves backward while the travel date is held", () => {
    setTimeTravelDate("2026-08-02");
    const readings = [browserClock.now(), browserClock.now(), browserClock.now()];
    for (let i = 1; i < readings.length; i++) {
      expect(readings[i]).toBeGreaterThanOrEqual(readings[i - 1]);
    }
  });
});

// §11.B: a `useSyncExternalStore`-style store — a consumer must be able to
// subscribe and re-render, not remount or poll, when the date changes.
describe("subscribeTimeTravel", () => {
  afterEach(() => setTimeTravelDate(null));

  it("notifies a subscribed listener on every setTimeTravelDate call, including clearing", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTimeTravel(listener);

    setTimeTravelDate("2026-08-02");
    expect(listener).toHaveBeenCalledTimes(1);

    setTimeTravelDate("2026-08-03");
    expect(listener).toHaveBeenCalledTimes(2);

    setTimeTravelDate(null);
    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
  });

  it("stops notifying once unsubscribed", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTimeTravel(listener);
    unsubscribe();

    setTimeTravelDate("2026-08-02");
    expect(listener).not.toHaveBeenCalled();
  });

  it("supports multiple independent subscribers", () => {
    const a = vi.fn();
    const b = vi.fn();
    const unsubA = subscribeTimeTravel(a);
    const unsubB = subscribeTimeTravel(b);

    setTimeTravelDate("2026-08-02");
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    unsubA();
    setTimeTravelDate("2026-08-03");
    expect(a).toHaveBeenCalledTimes(1); // unsubscribed, no further calls
    expect(b).toHaveBeenCalledTimes(2);

    unsubB();
  });
});
