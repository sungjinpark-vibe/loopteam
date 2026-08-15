/**
 * S1 onboarding flow test — the round-1 5-expert playtest's single most common
 * finding (a cold start showing game-economy jargon with zero explanation) was
 * addressed by `Onboarding.tsx`, but it shipped in the rescued WIP (commit
 * 7ed237d) with no test at all. This covers the three behaviours that actually
 * matter and are easy to get wrong:
 *   1. the 3-beat "다음" navigation reaches the final "시작하기" CTA;
 *   2. a budget typed on the last beat is committed via `onSetBudget` AND the
 *      overlay completes (`onComplete`) — the one money-adjacent path here;
 *   3. skipping (or finishing with an empty budget) completes WITHOUT calling
 *      `onSetBudget` — never writing a bogus 0/null budget the player never set.
 *
 * Same bare createRoot+act harness (`testUtils/mount`) + ThemeProvider wrap the
 * other TDS component tests use (`SettingsSheet.test.tsx`); Onboarding renders a
 * plain in-shell overlay (not a portal), so its nodes live in the mounted
 * container, not `document.body`.
 */
import { ThemeProvider } from "@toss/tds-mobile";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { mountComponent, type MountedComponent } from "../testUtils/mount";
import { Onboarding, type OnboardingProps } from "./Onboarding";

class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver ??=
  NoopResizeObserver as unknown as typeof ResizeObserver;

let mounted: MountedComponent | null = null;
afterEach(() => {
  try {
    mounted?.unmount();
  } finally {
    mounted = null;
  }
});

function makeProps(): {
  props: OnboardingProps;
  budgets: (number | null)[];
  completeCount: () => number;
} {
  const budgets: (number | null)[] = [];
  let completed = 0;
  return {
    props: {
      onSetBudget: (b) => budgets.push(b),
      onComplete: () => completed++,
    },
    budgets,
    completeCount: () => completed,
  };
}

function render(props: OnboardingProps): void {
  const el = (
    <ThemeProvider>
      <Onboarding {...props} />
    </ThemeProvider>
  );
  if (mounted === null) mounted = mountComponent(el);
  else act(() => mounted!.root.render(el));
}

function button(text: string): HTMLButtonElement {
  const el = [...mounted!.container.querySelectorAll("button")].find((b) => b.textContent === text);
  if (!el) throw new Error(`button not found: ${text}`);
  return el;
}

function click(text: string): void {
  act(() => button(text).click());
}

/** React-controlled-input-safe typing (plain `.value =` doesn't notify React). */
function typeInto(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("Onboarding (S1)", () => {
  it("navigates the 3 beats via 다음 and reaches the 시작하기 CTA", () => {
    const { props } = makeProps();
    render(props);

    // Beat 1: names the loop.
    expect(mounted!.container.textContent).toContain("건물이 하나 생겨요");
    // `aria-modal` is only honest if focus actually starts inside the overlay.
    expect(document.activeElement).toBe(mounted!.container.querySelector(".onboarding-card"));
    click("다음");
    // Beat 2 (Gate-3-rerun fix, ux-researcher TOP FIX): teaches the
    // amount-scales-building rule and the seed/shop pointer, not the daily
    // build cap (moved to the queue toast, taught at the point it matters).
    expect(mounted!.container.textContent).toContain("금액이 클수록 건물이 커져요");
    click("다음");
    // Beat 3: budget field + final CTA relabels to 시작하기.
    expect(mounted!.container.textContent).toContain("이번 달 예산");
    expect(button("시작하기")).toBeTruthy();
  });

  it("commits a budget typed on the last beat and completes", () => {
    const { props, budgets, completeCount } = makeProps();
    render(props);
    click("다음");
    click("다음");

    typeInto(mounted!.container.querySelector<HTMLInputElement>("input")!, "800000");
    click("시작하기");

    expect(budgets).toEqual([800_000]);
    expect(completeCount()).toBe(1);
  });

  it("건너뛰기 completes immediately without setting a budget", () => {
    const { props, budgets, completeCount } = makeProps();
    render(props);

    click("건너뛰기");

    expect(budgets).toEqual([]); // never writes a budget the player didn't set
    expect(completeCount()).toBe(1);
  });

  // Gate-3 follow-up (A4) — replaces "finishing with an empty budget completes
  // without calling onSetBudget". That test asserted the exact behaviour this
  // fix removes (an empty/0 budget must no longer be a valid 시작하기), so it
  // could not be kept as-is; its real subject — "never write a budget the
  // player didn't set" — is still covered, by 건너뛰기 above and by the
  // disabled-state assertions here.
  it("시작하기 is disabled for an empty budget and for 0, and saves nothing while disabled", () => {
    const { props, budgets, completeCount } = makeProps();
    render(props);
    click("다음");
    click("다음");

    expect(button("시작하기").disabled).toBe(true); // empty
    // Gate-3-rerun fix (near-unanimous finding): a disabled CTA alone gave
    // zero signal (no toast, no error, only a pale fill) — this inline help
    // line is the always-visible explanation.
    expect(mounted!.container.textContent).toContain("금액을 입력하면 시작할 수 있어요");
    // A live Chromium playtest found the vendor Button's `disabled` prop
    // doesn't reach the real DOM attribute; the imperative patch guards it
    // explicitly. `.disabled` above only proves jsdom's reflection, not this.
    expect(button("시작하기").getAttribute("aria-disabled")).toBe("true");
    click("시작하기");
    expect(completeCount()).toBe(0);
    expect(budgets).toEqual([]);

    typeInto(mounted!.container.querySelector<HTMLInputElement>("input")!, "0");
    expect(button("시작하기").disabled).toBe(true); // a literal 0 is not a budget
    expect(mounted!.container.textContent).toContain("금액을 입력하면 시작할 수 있어요");
    expect(button("시작하기").getAttribute("aria-disabled")).toBe("true");
    click("시작하기");
    expect(completeCount()).toBe(0);
    expect(budgets).toEqual([]);

    typeInto(mounted!.container.querySelector<HTMLInputElement>("input")!, "300000");
    expect(button("시작하기").disabled).toBe(false);
    expect(mounted!.container.textContent).not.toContain("금액을 입력하면 시작할 수 있어요");
    expect(button("시작하기").getAttribute("aria-disabled")).toBe("false");
    click("시작하기");
    expect(budgets).toEqual([300_000]);
    expect(completeCount()).toBe(1);
  });

  it("다음 is never gated — only the final beat validates", () => {
    const { props } = makeProps();
    render(props);
    expect(button("다음").disabled).toBe(false);
    click("다음");
    expect(button("다음").disabled).toBe(false);
  });
});
