/**
 * TierCelebration test — the round-1 playtest flagged the ORIGINAL build's
 * blocking `ConfirmDialog` (it swallowed the FAB mid-batch-logging, the app's
 * core "fast entry" promise). The rescued WIP (commit 7ed237d) rebuilt it as a
 * non-blocking auto-dismissing banner but shipped no test. This locks in the
 * three behaviours the rebuild is FOR:
 *   1. renders nothing when `tier` is null (no stray banner);
 *   2. non-blocking + informative — a `role="status"` banner (not a modal
 *      `role="dialog"`) that states how many buildings remain to the next tier;
 *   3. auto-dismisses after the timeout, and can be dismissed early by tap.
 *
 * Plain divs/buttons, no TDS component — no ThemeProvider needed. Fake timers
 * for the auto-dismiss so the test doesn't actually wait 4s.
 */
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountComponent, type MountedComponent } from "../testUtils/mount";
import { TierCelebration } from "./TierCelebration";

const THRESHOLDS = [0, 3, 8, 15, 30] as const;

let mounted: MountedComponent | null = null;
afterEach(() => {
  try {
    mounted?.unmount();
  } finally {
    mounted = null;
  }
  vi.useRealTimers();
});

describe("TierCelebration", () => {
  it("renders nothing when tier is null", () => {
    let dismissed = 0;
    mounted = mountComponent(
      <TierCelebration tier={null} buildingCount={0} tierThresholds={THRESHOLDS} onDismiss={() => dismissed++} />,
    );
    expect(mounted.container.querySelector(".tier-celebration")).toBeNull();
  });

  it("is a non-blocking status banner (not a modal dialog) and shows buildings-to-next-tier", () => {
    let dismissed = 0;
    // Just crossed tier index 1 (threshold 3); next threshold is 8, town has 5.
    mounted = mountComponent(
      <TierCelebration tier={1} buildingCount={5} tierThresholds={THRESHOLDS} onDismiss={() => dismissed++} />,
    );
    const banner = mounted.container.querySelector(".tier-celebration");
    expect(banner).toBeTruthy();
    expect(banner!.getAttribute("role")).toBe("status"); // not "dialog" — nothing is trapped/blocked
    expect(mounted.container.textContent).toContain("Tier 2 달성");
    expect(mounted.container.textContent).toContain("건물 3채를 더"); // 8 - 5
  });

  it("shows the 'highest tier' line when there is no next threshold", () => {
    mounted = mountComponent(
      <TierCelebration tier={4} buildingCount={40} tierThresholds={THRESHOLDS} onDismiss={() => {}} />,
    );
    expect(mounted.container.textContent).toContain("가장 높은 Tier");
  });

  it("auto-dismisses after the timeout", () => {
    vi.useFakeTimers();
    let dismissed = 0;
    mounted = mountComponent(
      <TierCelebration tier={2} buildingCount={10} tierThresholds={THRESHOLDS} onDismiss={() => dismissed++} />,
    );
    expect(dismissed).toBe(0);
    act(() => vi.advanceTimersByTime(4000));
    expect(dismissed).toBe(1);
  });

  it("can be dismissed early by tapping the close button", () => {
    let dismissed = 0;
    mounted = mountComponent(
      <TierCelebration tier={2} buildingCount={10} tierThresholds={THRESHOLDS} onDismiss={() => dismissed++} />,
    );
    act(() => mounted!.container.querySelector<HTMLButtonElement>(".tier-celebration-dismiss")!.click());
    expect(dismissed).toBe(1);
  });
});
