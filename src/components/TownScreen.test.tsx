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
import { BALANCE } from "../balance.approved";
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
      <TownScreen store={store} onOpenSettings={() => {}} />
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
    // Rendered as a tappable link straight into 설정 (round-1 playtest fix),
    // so the DOM text carries a trailing "›" affordance the raw content
    // string doesn't — `.startsWith` keeps this assertion about the COPY,
    // not this presentational detail.
    expect(moodClass()).toBe(`town-screen--mood-${MOOD_NEUTRAL.skyClass}`);
    // Gate-3-RE-RUN fix (round-5 panel, near-unanimous "weather never
    // observed" finding): the header now also carries `MOOD_NEUTRAL.icon`
    // ahead of the label, so this is `.toContain` rather than `.startsWith`.
    expect(moodHeaderText()).toContain(MOOD_NEUTRAL.headerLabel);
    expect(moodHeaderText()).toContain(MOOD_NEUTRAL.icon);

    // 2. Budget set, nothing spent yet — pace 0, tier 0 (clear).
    act(() => {
      latest!.setBudget(600_000);
    });
    expect(moodClass()).toBe(`town-screen--mood-${MOOD_CONTENT[0].skyClass}`);
    expect(moodHeaderText()).toBe(`${MOOD_CONTENT[0].icon} ${MOOD_CONTENT[0].headerLabel}`);

    // 3. 300,000 spent — pace = 300,000 / (600,000 * 15/30) = 1.0 -> tier 1 (cloudy),
    // the exact bucket round-2's own finding said was never observed.
    act(() => {
      latest!.addEntry(cafeExpense(300_000));
    });
    expect(moodClass()).toBe(`town-screen--mood-${MOOD_CONTENT[1].skyClass}`);
    expect(moodHeaderText()).toBe(`${MOOD_CONTENT[1].icon} ${MOOD_CONTENT[1].headerLabel}`);

    // 4. 100,000 more (400,000 total) — pace = 400,000 / 300,000 = 1.333 -> tier 2 (rain).
    act(() => {
      latest!.addEntry(cafeExpense(100_000));
    });
    expect(moodClass()).toBe(`town-screen--mood-${MOOD_CONTENT[2].skyClass}`);
    expect(moodHeaderText()).toBe(`${MOOD_CONTENT[2].icon} ${MOOD_CONTENT[2].headerLabel}`);

    // F6 AC / design invariant 4 (spec §7): mood swinging from clear to rain
    // across this whole run never removed, greyed, or downgraded a building —
    // both entries above still built normally.
    expect(latest?.buildingCount).toBe(2);
  });
});

// ── ADDENDUM-04 §4 — the choice dialog / grid pick-mode. Unlike the mood
// suite above (which drives `useTownStore.addEntry` directly), these tests
// have to go through the REAL `EntrySheet` UI, because the dialog trigger
// (`TownScreen.handleSave`) lives entirely inside `TownScreen`, with no store
// method to call instead. `findButton`/the jsdom stubs above mirror
// `EntrySheet.test.tsx`'s own proven pattern for driving TDS components.

function findButton(text: string): HTMLButtonElement | undefined {
  return [...document.body.querySelectorAll("button")].find((b) => b.textContent === text);
}

/**
 * `NumberKeypad`'s digit cells fire `onKeyClick` from `onMouseDown` (TDS's
 * own touch-vs-mouse press de-dupe), NOT from a "click" event — a plain
 * `.click()` (which only ever synthesizes a "click" event, same in jsdom as
 * in a real browser) never reaches it. `td[role="button"]`'s `textContent`
 * is the digit itself (verified against the vendor bundle).
 */
function pressDigit(digit: string): void {
  const key = [...document.body.querySelectorAll('td[role="button"]')].find((el) => el.textContent === digit);
  if (!key) throw new Error(`digit key not found: ${digit}`);
  act(() => {
    key.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  });
}

/** `SegmentedControl.Item` renders a plain `<input value="...">` under the hood (TDS .d.ts). */
function selectType(value: "income" | "saving"): void {
  const input = document.body.querySelector<HTMLInputElement>(`input[value="${value}"]`);
  if (!input) throw new Error(`type input not found: ${value}`);
  act(() => {
    input.click();
  });
}

function openSheet(): void {
  const fab = container.querySelector<HTMLElement>(".town-fab");
  if (!fab) throw new Error("FAB not found — already in move/pick mode?");
  act(() => {
    fab.click();
  });
}

/** Fills the minimum viable entry (amount 1) and taps 저장. */
function fillAndSave(categoryLabel: string, type?: "income" | "saving"): void {
  if (type) selectType(type);
  pressDigit("1");
  // ChipItem renders its icon (`left`) and label in the same button, so the
  // rendered text is "☕카페", not "카페" — match by substring, not equality.
  const categoryButton = [...document.body.querySelectorAll("button")].find((b) => b.textContent?.includes(categoryLabel));
  if (!categoryButton) throw new Error(`category not found: ${categoryLabel}`);
  act(() => {
    categoryButton.click();
  });
  act(() => {
    findButton("저장")!.click();
  });
}

function tapTile(plotIndex: number): void {
  const tile = container.querySelector(`[data-plot-index="${plotIndex}"]`) as HTMLElement;
  act(() => {
    tile.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function monthEntryCount(): number {
  return latest!.getMonthEntries(TODAY.slice(0, 7)).length;
}

describe("TownScreen — ADDENDUM-04 §4 grow dialog / pick mode", () => {
  it("saving into a category with NO existing building shows no dialog and saves directly", async () => {
    await mountAndWaitForBoot();

    openSheet();
    fillAndSave("카페");

    expect(findButton("키우기")).toBeUndefined();
    expect(latest!.buildingCount).toBe(1);
  });

  it("saving into a category WITH one shows the dialog; 새로 짓기 builds a new building", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.addEntry(cafeExpense(1_000));
    });
    expect(latest!.buildingCount).toBe(1);

    openSheet();
    fillAndSave("카페");
    expect(findButton("키우기")).not.toBeUndefined(); // the dialog is up

    act(() => {
      findButton("새로 짓기")!.click();
    });

    expect(latest!.buildingCount).toBe(2);
    expect(latest!.buildings.every((b) => (b.exp ?? 0) === 0)).toBe(true); // nothing grew
  });

  it("키우기 with exactly one candidate grows it immediately, no second step", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.addEntry(cafeExpense(1_000));
    });
    const hostId = latest!.buildings[0].id;

    openSheet();
    fillAndSave("카페");
    act(() => {
      findButton("키우기")!.click();
    });

    // No pick-mode bar — a single candidate grows straight away.
    expect(container.querySelector(".town-move-bar")).toBeNull();
    expect(latest!.buildingCount).toBe(1); // still one building — grown, not built
    // Gate-3-rerun retune: `fillAndSave`'s amount (1원) is under
    // `BALANCE.expAmountTiers`' bottom tier (5,000) — gain 0, so exp stays 0
    // through the grow. The mechanic under test here is "grows, doesn't
    // build a second lot", not the exp curve itself.
    expect(latest!.buildings.find((b) => b.id === hostId)!.exp ?? 0).toBe(0);
  });

  it("2+ candidates enters pick mode; tapping a candidate grows exactly that building", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.addEntry(cafeExpense(1_000));
    });
    act(() => {
      latest!.addEntry(cafeExpense(2_000));
    });
    const [first, second] = latest!.buildings;
    const entriesBefore = monthEntryCount();

    openSheet();
    fillAndSave("카페");
    act(() => {
      findButton("키우기")!.click();
    });

    expect(container.querySelector(".town-move-bar")?.textContent).toContain("키울 건물을 선택하세요");
    expect(container.querySelectorAll(".town-tile--grow-candidate").length).toBe(2);
    expect(container.querySelector(".town-fab")).toBeNull(); // FAB hides during pick mode too
    // Gate-3 follow-up (A1) — the entry hint toast, move mode's third
    // affordance (it teaches long-press the same way): the FAB disappearing
    // now comes with an instruction, not just a highlight.
    expect(document.body.textContent).toContain("키울 건물을 탭하세요");

    tapTile(second.plotIndex);

    expect(container.querySelector(".town-move-bar")).toBeNull(); // pick mode exited
    expect(container.querySelectorAll(".town-tile--grow-candidate").length).toBe(0);
    expect(latest!.buildingCount).toBe(2); // no new building — grew in place
    // Gate-3-rerun retune: all amounts here (1,000/2,000/1원) are under
    // `BALANCE.expAmountTiers`' bottom tier (5,000) — gain 0 throughout.
    expect(latest!.buildings.find((b) => b.id === second.id)!.exp ?? 0).toBe(0);
    expect(latest!.buildings.find((b) => b.id === first.id)!.exp ?? 0).toBe(0);
    expect(monthEntryCount()).toBe(entriesBefore + 1);
  });

  // Gate-3 follow-up (A1): pick mode hides the FAB, so a tap that lands
  // outside the highlighted candidates has to answer — silently doing nothing
  // there is what the panel read as "the primary button is gone and there's no
  // way out". Mirrors `useMoveMode`'s occupied-lot reject: inline hint in the
  // same banner, mode stays open, 취소 still there.
  it("tapping a NON-candidate in pick mode shows an inline hint instead of doing nothing, and stays in pick mode", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.addEntry(cafeExpense(1_000));
    });
    act(() => {
      latest!.addEntry(cafeExpense(2_000));
    });
    const occupied = new Set(latest!.buildings.map((b) => b.plotIndex));
    const entriesBefore = monthEntryCount();

    openSheet();
    fillAndSave("카페");
    act(() => {
      findButton("키우기")!.click();
    });
    expect(container.querySelector(".town-move-bar")?.textContent).toContain("키울 건물을 선택하세요");

    const emptyPlot = [...container.querySelectorAll<HTMLElement>("[data-plot-index]")]
      .map((el) => Number(el.getAttribute("data-plot-index")))
      .find((i) => !occupied.has(i));
    expect(emptyPlot).not.toBeUndefined();
    tapTile(emptyPlot!);

    expect(container.querySelector(".town-move-bar")?.textContent).toContain("표시된 건물 중에서 골라주세요");
    expect(container.querySelectorAll(".town-tile--grow-candidate").length).toBe(2); // still in pick mode
    expect(monthEntryCount()).toBe(entriesBefore); // nothing committed by a stray tap
    const cancelStillThere = [...container.querySelectorAll<HTMLButtonElement>(".town-move-bar button")].some(
      (b) => b.textContent === "취소",
    );
    expect(cancelStillThere).toBe(true);
  });

  it("cancelling pick mode (취소) saves nothing and leaves no state stuck", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.addEntry(cafeExpense(1_000));
    });
    act(() => {
      latest!.addEntry(cafeExpense(2_000));
    });
    const entriesBefore = monthEntryCount();

    openSheet();
    fillAndSave("카페");
    act(() => {
      findButton("키우기")!.click();
    });
    expect(container.querySelector(".town-move-bar")).not.toBeNull();

    const cancelButton = [...container.querySelectorAll<HTMLButtonElement>(".town-move-bar button")].find(
      (b) => b.textContent === "취소",
    );
    act(() => {
      cancelButton!.click();
    });

    expect(container.querySelector(".town-move-bar")).toBeNull();
    expect(latest!.buildingCount).toBe(2);
    expect(latest!.buildings.every((b) => (b.exp ?? 0) === 0)).toBe(true); // nothing was saved
    expect(monthEntryCount()).toBe(entriesBefore); // the entry itself was never saved
    expect(container.querySelector(".town-fab")).not.toBeNull(); // FAB is back — no stuck mode
  });

  it("no dialog once today's build slots are exhausted — queues exactly as today (F14)", async () => {
    await mountAndWaitForBoot();
    act(() => {
      for (let i = 0; i < BALANCE.dailyBuildSlots; i++) latest!.addEntry(cafeExpense(1_000));
    });
    expect(latest!.slotsRemaining).toBe(0);

    openSheet();
    fillAndSave("카페");

    expect(findButton("키우기")).toBeUndefined();
    expect(latest!.queueLength).toBe(1);
  });

  it("no dialog for a 저축 entry, even into a category that already has ledger entries", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.addEntry({ type: "saving", amountKrw: 10_000, categoryId: "deposit", occurredOn: TODAY });
    });
    expect(latest!.buildingCount).toBe(0); // 저축 never builds (F13) — nothing to grow either

    openSheet();
    fillAndSave("예적금", "saving");

    expect(findButton("키우기")).toBeUndefined();
    expect(latest!.buildingCount).toBe(0);
  });
});

// Gate-3 follow-up (A5): the reward toast — one of exactly two surfaces
// ADDENDUM-03 §5.2 rule 6 allows the seed BALANCE on — showed a bare "(+3개)":
// no unit name, no running total.
describe("TownScreen — Gate-3 follow-up: the reward toast names the currency and its balance", () => {
  it("shows the grant with its unit AND the balance after it, growing across saves", async () => {
    await mountAndWaitForBoot();
    const perBuild = BALANCE.seedAwards.build;

    // Building #1 raises A2's celebration banner instead of a toast (A6 — the
    // two are bottom-docked and would otherwise land on the same line), so the
    // toast assertions start from building #2.
    act(() => {
      latest!.addEntry(cafeExpense(1_000));
    });
    act(() => latest!.dismissNotice());
    expect(latest!.economy.seeds).toBe(perBuild);

    openSheet();
    fillAndSave("교통");
    expect(document.body.textContent).toContain(`+씨앗 ${perBuild}개`);
    expect(document.body.textContent).toContain(`모은 ${perBuild * 2}개`);
    expect(latest!.economy.seeds).toBe(perBuild * 2);

    openSheet();
    fillAndSave("문화");
    // The running total, not the grant, is what moved.
    expect(document.body.textContent).toContain(`모은 ${perBuild * 3}개`);
    expect(latest!.economy.seeds).toBe(perBuild * 3);
  });

  it("the shop header — the surface the same currency is SPENT on — names the unit too", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.addEntry(cafeExpense(1_000));
    });
    const seedsNow = latest!.economy.seeds;
    expect(seedsNow).toBeGreaterThan(0);

    act(() => {
      container.querySelector<HTMLElement>(".shop-fab")!.click();
    });
    expect(document.body.querySelector(".shop-balance")?.textContent).toBe(`씨앗 ${seedsNow}개`);
  });
});

// Gate-3 follow-up (A6): the first founding's celebration banner and the
// routine build toast are both bottom-docked and measured to the same line in
// a real browser — the toast covered the banner's copy. The banner is the
// feedback for that one save; every later build still toasts.
describe("TownScreen — Gate-3 follow-up: the first founding does not stack a toast on its banner", () => {
  it("suppresses the build toast for building #1 only", async () => {
    await mountAndWaitForBoot();

    openSheet();
    fillAndSave("카페");
    expect(latest!.buildingCount).toBe(1);
    expect(latest!.notice).toEqual({ kind: "firstBuilding" }); // the banner is what fires
    expect(document.body.textContent).not.toContain("건물이 생겼어요");

    act(() => latest!.dismissNotice());
    openSheet();
    fillAndSave("교통");
    expect(latest!.buildingCount).toBe(2);
    expect(document.body.textContent).toContain("건물이 생겼어요"); // building #2 toasts as before
  });
});

// Gate-3-rerun fix — every expert's top/near-top finding: a plain tap on an
// ordinary (non-monument) building was a silent no-op. `tapTile` (defined
// above) is the SAME helper the grow-dialog suite already drives real taps
// through `TownGrid`'s delegated click listener with.
describe("TownScreen — Gate-3-rerun: tap an ordinary building opens its detail sheet", () => {
  it("tapping a building's tile opens BuildingDetailSheet showing its amount and level, not a silent no-op", async () => {
    await mountAndWaitForBoot();
    // Gate-3-rerun retune: 30,000원 sits in the 20,000-50,000 tier (gain 6)
    // -> Lv.3 — a mid-range amount that actually demonstrates the
    // amount->level curve differentiating (the panel's own repro amounts,
    // 1,500/150,000/2,000,000, are covered directly in selectors.test.ts).
    //
    // Restored alongside commit bed6cca (user re-confirmed the director's EXP
    // table on 2026-08-12): the round-5 per-entry cap this test was rewritten
    // for was NOT adopted, so one 30,000원 entry reaches Lv.3 again.
    act(() => {
      latest!.addEntry(cafeExpense(30_000));
    });
    expect(latest!.buildingCount).toBe(1);
    const plotIndex = latest!.buildings[0].plotIndex;

    tapTile(plotIndex);
    // Flush the `ensureMonthLoaded` effect the sheet's amount lookup depends on.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const title = document.body.querySelector(".entry-sheet-title")?.textContent;
    expect(title).toBe("카페");
    const values = [...document.body.querySelectorAll(".history-total-value")].map((el) => el.textContent);
    expect(values).toContain("Lv.3");
    expect(document.body.querySelector(".history-pace-label")?.textContent).toContain("Lv.3");
  });

  it("tapping empty ground still does nothing (not every tap opens a sheet)", async () => {
    await mountAndWaitForBoot();
    const emptyLot = container.querySelector<HTMLElement>(".town-tile:not(.town-tile--droppable)");
    expect(emptyLot).not.toBeNull();
    act(() => {
      emptyLot!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.body.querySelector(".entry-sheet-title")).toBeNull();
  });
});

// Gate-3-rerun fix — E5, every expert on the panel: 5 concurrent (non-forced,
// actionability-checked) `.click()`s on one filled entry sheet's 저장 button
// each independently ran `handleSave` -> `onSave` before React re-rendered
// `open=false`, producing 5 distinct LedgerEntry/Building ids from one
// intended save (confirmed in raw localStorage by the panel). Reproduces the
// same shape here: fire 저장 5 times in a row with NO `act()`/render boundary
// between clicks (mirrors the un-awaited concurrent taps), then assert
// exactly one building/entry landed.
describe("TownScreen — Gate-3-rerun: entry-sheet Save multi-submit guard", () => {
  it("firing 저장 5 times back-to-back on one filled sheet only ever saves once", async () => {
    await mountAndWaitForBoot();

    openSheet();
    pressDigit("1");
    const categoryButton = [...document.body.querySelectorAll("button")].find((b) => b.textContent?.includes("카페"));
    act(() => {
      categoryButton!.click();
    });

    const saveButton = findButton("저장")!;
    act(() => {
      // No render/`act` boundary between these — the exact gap that let 5
      // independent click events each reach `onSave` before this component
      // ever re-rendered with the sheet closed.
      saveButton.click();
      saveButton.click();
      saveButton.click();
      saveButton.click();
      saveButton.click();
    });

    expect(latest!.buildingCount).toBe(1);
    expect(monthEntryCount()).toBe(1);
  });
});
