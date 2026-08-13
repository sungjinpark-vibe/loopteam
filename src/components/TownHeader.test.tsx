/**
 * TownHeader — F-BGM speaker toggle (ADDENDUM-05 §5). Plain elements, no TDS
 * component, no ThemeProvider needed (same shape `PlaceholderBuilding.test.tsx`
 * already documents). Covers the button's two states and that a tap calls
 * `onSetBgmMuted` with the flipped value — the rest of the header is
 * unmodified by this task and already exercised indirectly via
 * `TownScreen.test.tsx`.
 */
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { mountComponent, type MountedComponent } from "../testUtils/mount";
import { TownHeader, type TownHeaderProps } from "./TownHeader";

let mounted: MountedComponent | null = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

function baseProps(overrides: Partial<TownHeaderProps> = {}): TownHeaderProps {
  return {
    townName: "우리 동네",
    buildingCount: 3,
    slotsRemaining: 1,
    dailyBuildSlots: 2,
    tier: 0,
    streakDays: 5,
    streakAtRisk: false,
    nextTierLabel: "Tier 2까지 7채분",
    queueLength: 0,
    moodLabel: "이번 달 페이스가 좋아요",
    moodIcon: "☀️",
    budgetUnset: false,
    onOpenSettings: () => {},
    bgmMuted: false,
    onSetBgmMuted: () => {},
    ...overrides,
  };
}

function bgmButton(container: HTMLElement): HTMLButtonElement {
  return container.querySelector<HTMLButtonElement>(".town-header-bgm-toggle")!;
}

describe("TownHeader — F-BGM speaker toggle", () => {
  it("unmuted: shows the speaker-on icon and aria-pressed=true", () => {
    mounted = mountComponent(<TownHeader {...baseProps({ bgmMuted: false })} />);
    const button = bgmButton(mounted.container);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.getAttribute("aria-label")).toBe("배경음악 음소거");
    expect(button.textContent).toBe("🔊");
  });

  it("muted: shows the speaker-off icon and aria-pressed=false", () => {
    mounted = mountComponent(<TownHeader {...baseProps({ bgmMuted: true })} />);
    const button = bgmButton(mounted.container);
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.textContent).toBe("🔇");
  });

  it("tapping the toggle calls onSetBgmMuted with the flipped value", () => {
    const calls: boolean[] = [];
    mounted = mountComponent(<TownHeader {...baseProps({ bgmMuted: false, onSetBgmMuted: (m) => calls.push(m) })} />);
    act(() => {
      bgmButton(mounted!.container).click();
    });
    expect(calls).toEqual([true]);
  });
});

// Gate-3-rerun fix (liveops-pd's TOP FIX): the streak's at-risk signal.
describe("TownHeader — streak at-risk signal", () => {
  it("shows no fire and no risk copy at streak 0", () => {
    mounted = mountComponent(<TownHeader {...baseProps({ streakDays: 0, streakAtRisk: false })} />);
    expect(mounted.container.textContent).not.toContain("🔥");
    expect(mounted.container.textContent).not.toContain("이어져요");
  });

  it("shows the fire icon at streak > 0, no risk copy when not at risk", () => {
    mounted = mountComponent(<TownHeader {...baseProps({ streakDays: 3, streakAtRisk: false })} />);
    expect(mounted.container.textContent).toContain("🔥");
    expect(mounted.container.textContent).not.toContain("이어져요");
    expect(mounted.container.querySelector(".town-header-streak--risk")).toBeNull();
  });

  it("adds the risk class and copy when a streak exists but today hasn't extended it", () => {
    mounted = mountComponent(<TownHeader {...baseProps({ streakDays: 3, streakAtRisk: true })} />);
    expect(mounted.container.textContent).toContain("오늘 기록하면 이어져요");
    expect(mounted.container.querySelector(".town-header-streak--risk")).not.toBeNull();
  });
});

// Gate-3 round-5 (A1): the tier badge said "Tier 1" and nothing said what
// Tier 2 costs or how close the town is.
describe("TownHeader — A1 next-tier progress readout", () => {
  it("renders the caller-supplied goal next to the counts", () => {
    mounted = mountComponent(<TownHeader {...baseProps({ nextTierLabel: "Tier 2까지 7채분" })} />);
    expect(mounted.container.querySelector(".town-header-next-tier")?.textContent).toBe("Tier 2까지 7채분");
  });

  it("renders nothing at the top tier (label null) — no empty separator left behind", () => {
    mounted = mountComponent(<TownHeader {...baseProps({ nextTierLabel: null })} />);
    expect(mounted.container.querySelector(".town-header-next-tier")).toBeNull();
    expect(mounted.container.textContent).not.toContain("까지");
  });
});
