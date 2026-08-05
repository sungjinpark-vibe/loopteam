/**
 * TownScreen (S2) mood wiring — round-2 fix-forward, C1 finding #2: the
 * middle (cloudy) tier had never been asserted anywhere (only observed live
 * for neutral/clear/rain). Drives the REAL `useTownStore` (same harness
 * pattern `useTownStore.settings.test.tsx` already uses) and reads the
 * mounted DOM directly, so `.town-screen--mood-*` — the class the sky
 * gradient (App.css) keys off — is asserted for all four states: neutral (no
 * budget), and the 3 `selectors.moodTier` buckets (clear/cloudy/rain) via the
 * SAME `budgetPace`/`moodTier` chain 기록's pace bar uses (no re-derivation
 * here either).
 *
 * September 2026 (30 days) is used instead of the settings test's August so
 * day 15 / budget 600,000 / spend 300,000 hits the spec's own F6 AC exactly:
 * elapsedFraction = 15/30 = 0.5, expectedSpend = 300,000, pace = 1.0.
 */
import { act } from "react";
import { TDSMobileProvider } from "@toss/tds-mobile";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { EntryDraft } from "../entryActions";
import { setTimeTravelDate } from "../platform/clock";
import { setRandomOverride } from "../platform/random";
import { MOOD_CONTENT, MOOD_NEUTRAL } from "../content.placeholder";
import { useTownStore } from "../useTownStore";
import { TownScreen } from "./TownScreen";

// Same two jsdom-vs-real-browser gaps `EntryDetailSheet.test.tsx` already
// documents and stubs for — TownScreen always mounts `EntrySheet`'s
// `BottomSheet` chrome (closed, but still mounted) even when this test never
// opens it.
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver ??=
  NoopResizeObserver as unknown as typeof ResizeObserver;

// jsdom has no layout engine and does not implement scrollIntoView (§2.9,
// same gap `SavingsRow.test.tsx` already stubs — `TownGrid`'s newest-tile
// effect calls it).
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});

// jsdom has no `matchMedia` (TDSMobileProvider's own color-scheme effect calls it).
window.matchMedia ??=
  ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

const nativeQuerySelectorAll = Document.prototype.querySelectorAll;
Document.prototype.querySelectorAll = function (this: Document, selector: string) {
  try {
    return nativeQuerySelectorAll.call(this, selector);
  } catch {
    return nativeQuerySelectorAll.call(this, "[data-townscreen-test-no-match]");
  }
} as typeof Document.prototype.querySelectorAll;

let container: HTMLDivElement;
let root: Root;
let latest: ReturnType<typeof useTownStore> | null = null;

function Harness() {
  const store = useTownStore();
  latest = store;
  return (
    <TDSMobileProvider userAgent={{ fontA11y: undefined, fontScale: undefined, isAndroid: false, isIOS: false }}>
      <TownScreen store={store} />
    </TDSMobileProvider>
  );
}

async function mountAndWaitForBoot(): Promise<void> {
  root = createRoot(container);
  latest = null;
  await act(async () => {
    root.render(<Harness />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const TODAY = "2026-09-15"; // day 15 of a 30-day month — the spec's own F6 AC

function moodClass(): string | null {
  const el = container.querySelector(".town-screen");
  const match = [...(el?.classList ?? [])].find((c) => c.startsWith("town-screen--mood-"));
  return match ?? null;
}

function moodHeaderText(): string | null {
  return container.querySelector(".town-header-mood")?.textContent ?? null;
}

const cafeExpense = (amountKrw: number): EntryDraft => ({
  type: "expense",
  amountKrw,
  categoryId: "cafe",
  occurredOn: TODAY,
});

beforeEach(() => {
  window.localStorage.clear();
  setTimeTravelDate(TODAY);
  setRandomOverride(() => 0);
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  setTimeTravelDate(null);
  setRandomOverride(null);
});

describe("TownScreen — F6 sky mood, all 4 states verified in the mounted DOM", () => {
  it("renders every mood tier live as spending/budget change, matching selectors.moodTier exactly", async () => {
    await mountAndWaitForBoot();

    // 1. No budget set yet (fresh boot) — pinned neutral, with the nudge copy.
    expect(moodClass()).toBe(`town-screen--mood-${MOOD_NEUTRAL.skyClass}`);
    expect(moodHeaderText()).toBe(MOOD_NEUTRAL.headerLabel);

    // 2. Budget set, nothing spent yet — pace 0, tier 0 (clear).
    act(() => {
      latest!.setBudget(600_000);
    });
    expect(moodClass()).toBe(`town-screen--mood-${MOOD_CONTENT[0].skyClass}`);
    expect(moodHeaderText()).toBe(MOOD_CONTENT[0].headerLabel);

    // 3. 300,000 spent — pace = 300,000 / (600,000 * 15/30) = 1.0 -> tier 1 (cloudy),
    // the exact bucket round-2's own finding said was never observed.
    act(() => {
      latest!.addEntry(cafeExpense(300_000));
    });
    expect(moodClass()).toBe(`town-screen--mood-${MOOD_CONTENT[1].skyClass}`);
    expect(moodHeaderText()).toBe(MOOD_CONTENT[1].headerLabel);

    // 4. 100,000 more (400,000 total) — pace = 400,000 / 300,000 = 1.333 -> tier 2 (rain).
    act(() => {
      latest!.addEntry(cafeExpense(100_000));
    });
    expect(moodClass()).toBe(`town-screen--mood-${MOOD_CONTENT[2].skyClass}`);
    expect(moodHeaderText()).toBe(MOOD_CONTENT[2].headerLabel);

    // F6 AC / design invariant 4 (spec §7): mood swinging from clear to rain
    // across this whole run never removed, greyed, or downgraded a building —
    // both entries above still built normally.
    expect(latest?.buildingCount).toBe(2);
  });
});
