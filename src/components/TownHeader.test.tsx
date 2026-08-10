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
    queueLength: 0,
    moodLabel: "이번 달 페이스가 좋아요",
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
