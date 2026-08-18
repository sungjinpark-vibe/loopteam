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
import { advanceStreak } from "../selectors";
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
    onOpenShop: () => {},
    shopHasNews: false,
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

// Header-honesty fix: the header used to show "이어져요" (continues) for ANY
// day the streak hadn't been recorded on yet, including days AFTER the
// streak had already died — recording "today" in that state actually RESETS
// it to 1 (`selectors.advanceStreak`'s own reset branch), not extends it.
// `lastActOn`/`today` (optional props) switch the header onto
// `selectors.streakDisplay`, which derives from the exact same predicate
// `advanceStreak` uses, so these can never say different things.
describe("TownHeader — F7 header-honesty (streak alive vs. broken)", () => {
  it("recorded today: shows the stored count, no continuation copy", () => {
    mounted = mountComponent(
      <TownHeader {...baseProps({ streakDays: 5, lastActOn: "2026-08-10", today: "2026-08-10" })} />,
    );
    expect(mounted.container.textContent).toContain("연속 5일");
    expect(mounted.container.textContent).not.toContain("이어져요");
    expect(mounted.container.textContent).not.toContain("새로 시작해요");
    expect(mounted.container.querySelector(".town-header-streak--risk")).toBeNull();
    // A same-day save is a documented no-op (advanceStreak.test's own reference-identity case) — nothing to reconcile.
    expect(advanceStreak({ lastActOn: "2026-08-10", streakDays: 5, longestStreakDays: 5 }, "2026-08-10").streakDays).toBe(5);
  });

  it("last acted yesterday: ALIVE — keeps the stored count and the existing 이어져요 wording", () => {
    mounted = mountComponent(
      <TownHeader {...baseProps({ streakDays: 7, lastActOn: "2026-08-09", today: "2026-08-10" })} />,
    );
    expect(mounted.container.textContent).toContain("연속 7일");
    expect(mounted.container.textContent).toContain("오늘 기록하면 이어져요");
    expect(mounted.container.querySelector(".town-header-streak--risk")).not.toBeNull();
    // A save today genuinely extends it — the copy's promise is real.
    expect(advanceStreak({ lastActOn: "2026-08-09", streakDays: 7, longestStreakDays: 7 }, "2026-08-10")).toEqual({
      lastActOn: "2026-08-10",
      streakDays: 8,
      longestStreakDays: 8,
    });
  });

  it("last acted well in the past (the panel's exact repro: 31 days, 2026-07-31, today 2026-08-10): BROKEN — 0, not 31, and 새로 시작해요, not 이어져요", () => {
    mounted = mountComponent(
      <TownHeader {...baseProps({ streakDays: 31, lastActOn: "2026-07-31", today: "2026-08-10" })} />,
    );
    expect(mounted.container.textContent).toContain("연속 0일");
    expect(mounted.container.textContent).not.toContain("연속 31일");
    expect(mounted.container.textContent).toContain("오늘 기록하면 새로 시작해요");
    expect(mounted.container.textContent).not.toContain("이어져요");
    expect(mounted.container.textContent).not.toContain("🔥"); // no fire on a dead streak
    // The save path RESETS here, never extends — the stale 31 was never honest to show.
    expect(advanceStreak({ lastActOn: "2026-07-31", streakDays: 31, longestStreakDays: 31 }, "2026-08-10")).toEqual({
      lastActOn: "2026-08-10",
      streakDays: 1,
      longestStreakDays: 31,
    });
  });

  it("no streak yet (lastActOn null, streakDays 0): shows 0 with no fire and the fresh-start copy, not 이어져요", () => {
    mounted = mountComponent(<TownHeader {...baseProps({ streakDays: 0, lastActOn: null, today: "2026-08-10" })} />);
    expect(mounted.container.textContent).toContain("연속 0일");
    expect(mounted.container.textContent).not.toContain("🔥");
    expect(mounted.container.textContent).toContain("오늘 기록하면 새로 시작해요");
    expect(mounted.container.textContent).not.toContain("이어져요");
    expect(advanceStreak({ lastActOn: null, streakDays: 0, longestStreakDays: 0 }, "2026-08-10").streakDays).toBe(1);
  });
});

// User feedback fix (2026-08-19): "상점 버튼은 상단에 버튼으로 존재해야 한다" — the shop
// entry point moved from a floating FAB into this header row.
describe("TownHeader — header shop button", () => {
  it("is a real button with a Korean aria-label", () => {
    mounted = mountComponent(<TownHeader {...baseProps()} />);
    const button = mounted.container.querySelector<HTMLButtonElement>(".town-header-shop-btn")!;
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("aria-label")).toBe("상점");
  });

  it("tapping it opens the shop", () => {
    let opened = 0;
    mounted = mountComponent(<TownHeader {...baseProps({ onOpenShop: () => opened++ })} />);
    act(() => {
      mounted!.container.querySelector<HTMLButtonElement>(".town-header-shop-btn")!.click();
    });
    expect(opened).toBe(1);
  });

  it("shows the affordability dot only when shopHasNews is true — no seed count ever rendered here (ADDENDUM-03 §5.2 rule 6)", () => {
    mounted = mountComponent(<TownHeader {...baseProps({ shopHasNews: false })} />);
    expect(mounted.container.querySelector(".town-header-shop-dot")).toBeNull();

    mounted.unmount();
    mounted = mountComponent(<TownHeader {...baseProps({ shopHasNews: true })} />);
    const dot = mounted.container.querySelector(".town-header-shop-dot");
    expect(dot).not.toBeNull();
    expect(dot!.textContent).toBe("");
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

// FT-1 (commit e5da901, "fix the promise the app cannot keep"): every other
// queue-deferral copy site was moved off the unconditional "내일" promise
// onto "자리가 나면" for a full town, but the header line was missed. A queue
// that's non-empty despite slots remaining today can only mean the town has
// no room (`decideBuildOrQueue` always builds instead of queuing whenever a
// slot AND a plot both exist) — that's the ONLY case that should get the new
// copy; a queue caused by today's cap alone (no slots left) keeps "내일"
// because it may genuinely drain tomorrow.
describe("TownHeader — FT-1 queue promise (내일 vs 자리가 나면)", () => {
  it("no queue: renders no promise line at all", () => {
    mounted = mountComponent(<TownHeader {...baseProps({ queueLength: 0, slotsRemaining: 2 })} />);
    expect(mounted.container.querySelector(".town-header-queue-promise")).toBeNull();
  });

  it("queued with slots still remaining today: the town must be full — 자리가 나면, not 내일", () => {
    mounted = mountComponent(<TownHeader {...baseProps({ queueLength: 1, slotsRemaining: 2, dailyBuildSlots: 2 })} />);
    const promise = mounted.container.querySelector(".town-header-queue-promise")?.textContent;
    expect(promise).toContain("자리가 나면");
    expect(promise).not.toContain("내일");
    expect(promise).toContain("1개 대기 중");
  });

  it("queued because today's cap is spent, slots at 0: room may still exist tomorrow — 내일 stays honest", () => {
    mounted = mountComponent(<TownHeader {...baseProps({ queueLength: 3, slotsRemaining: 0, dailyBuildSlots: 2 })} />);
    const promise = mounted.container.querySelector(".town-header-queue-promise")?.textContent;
    expect(promise).toContain("내일");
    expect(promise).not.toContain("자리가 나면");
    expect(promise).toContain("3개 대기 중");
  });
});
