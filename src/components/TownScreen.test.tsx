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
import { saturatedTown } from "../testUtils/saturatedTown";
import { CELL_COUNT, cellFromIndex, isBuildable, LAYOUT_VERSION } from "../townLayout";
import type { Building } from "../types";
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
    // The ENTRY was committed by 저장 itself (durability fix — it is no longer
    // held hostage by the dialog/pick mode). What a stray tap must not commit
    // is the CHOICE: no building grew, and the decision is still pending.
    expect(monthEntryCount()).toBe(entriesBefore + 1);
    expect(latest!.pendingGrowChoice).not.toBeNull();
    expect(latest!.buildings.every((b) => (b.exp ?? 0) === 0)).toBe(true);
    const cancelStillThere = [...container.querySelectorAll<HTMLButtonElement>(".town-move-bar button")].some(
      (b) => b.textContent === "취소",
    );
    expect(cancelStillThere).toBe(true);
  });

  it("cancelling pick mode (취소) returns to the choice dialog, keeps the saved entry, and leaves no state stuck", async () => {
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
    expect(latest!.buildings.every((b) => (b.exp ?? 0) === 0)).toBe(true); // no CHOICE was committed
    // 취소 used to throw the entry away with the draft it was holding. The
    // entry is saved at 저장 now, so backing out of pick mode only unwinds the
    // pick — it returns to the dialog the pick came from.
    expect(monthEntryCount()).toBe(entriesBefore + 1);
    expect(latest!.pendingGrowChoice).not.toBeNull();
    expect(findButton("키우기")).not.toBeUndefined(); // the choice dialog is back
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

  // FT-1 — the queued-save toast used to promise "내일 아침에 지어드릴게요"
  // (I'll build it tomorrow morning) unconditionally, even though a queued
  // save can be waiting on a full town (not just tomorrow's slot reset:
  // `entryActions.ts`'s `decideBuildOrQueue` queues when `plotIndex === null`
  // too), a promise the app has no way to keep. Fails without the fix — the
  // old copy is a specific, unconditional time promise the code cannot honor.
  it("the queued-save toast promises room, not a specific morning", async () => {
    await mountAndWaitForBoot();
    act(() => {
      for (let i = 0; i < BALANCE.dailyBuildSlots; i++) latest!.addEntry(cafeExpense(1_000));
    });
    openSheet();
    fillAndSave("카페");
    expect(document.body.textContent).toContain("자리가 나면 지어드릴게요");
    expect(document.body.textContent).not.toContain("내일 아침");
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
    // B4: a normal founding save now pays the entry award AND the build bonus.
    const perBuild = BALANCE.seedAwards.entry + BALANCE.seedAwards.build;

    // Building #1 raises A2's celebration banner instead of a toast (A6 — the
    // two are bottom-docked and would otherwise land on the same line), so the
    // toast assertions start from building #2.
    // Gate-3-rerun fix: the FIRST save of the day is also the day's own
    // streak-extending act, a one-time +2 (streakDays 1) that later same-day
    // saves don't repeat (idempotent by date) — added once, flat, below.
    const streakBonus = 2;
    act(() => {
      latest!.addEntry(cafeExpense(1_000));
    });
    act(() => latest!.dismissNotice());
    expect(latest!.economy.seeds).toBe(perBuild + streakBonus);

    openSheet();
    fillAndSave("교통");
    expect(document.body.textContent).toContain(`+씨앗 ${perBuild}개`);
    expect(document.body.textContent).toContain(`모은 ${perBuild * 2 + streakBonus}개`);
    expect(latest!.economy.seeds).toBe(perBuild * 2 + streakBonus);

    openSheet();
    fillAndSave("문화");
    // The running total, not the grant, is what moved.
    expect(document.body.textContent).toContain(`모은 ${perBuild * 3 + streakBonus}개`);
    expect(latest!.economy.seeds).toBe(perBuild * 3 + streakBonus);
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

// ── ADDENDUM-11 — building fusion. §6: fusion reuses grow-pick mode wholesale
// (one `pickPurpose` flag, not a second pick-mode system) — these tests drive
// the REAL DOM (detail sheet CTA -> pick mode -> confirm dialog -> commit),
// same technique the grow-pick suite above already uses.
//
// Two Lv.5 buildings take 24 `addEntry` calls each to raise through the UI —
// these tests seed the pre-fusion state straight into localStorage instead
// (the same technique `useTownStore.fusion.test.tsx` already proved against
// this project's storage schema) and drive ONLY the fusion UI for real.
const GROUND_CELLS: readonly number[] = Array.from({ length: CELL_COUNT }, (_, i) => i).filter((i) => {
  const { row, col } = cellFromIndex(i);
  return isBuildable(row, col);
});
/** `n`-th ground cell — a stable, legal 1x1 anchor. */
const fuseCell = (n: number): number => GROUND_CELLS[n];
const MAXED_EXP = (BALANCE.maxLevel - 1) * BALANCE.expPerLevel; // Lv.5 — derived, never a literal

function fuseBuilding(id: string, plotIndex: number, extra: Partial<Building> = {}): Building {
  return {
    id,
    source: { kind: "entry", entryId: `e-${id}` },
    categoryId: "cafe",
    variantIndex: 0,
    plotIndex,
    builtOn: TODAY,
    createdAt: Number(id.replace(/\D/g, "")) || 1,
    exp: MAXED_EXP,
    ...extra,
  };
}

/** Writes the whole pre-boot state directly, bypassing 24 UI saves per Lv.5 building. */
function seedFuseTown(buildings: readonly Building[]): void {
  window.localStorage.setItem(
    "ait.v1.index",
    JSON.stringify({ schemaVersion: 1, layoutVersion: LAYOUT_VERSION, entryMonths: [], buildingMonths: [TODAY.slice(0, 7)] }),
  );
  window.localStorage.setItem(
    "ait.v1.core",
    JSON.stringify({
      town: {
        townName: "우리 동네",
        streakDays: 0,
        longestStreakDays: 0,
        lastActOn: null,
        slotsUsedOn: "",
        slotsUsedToday: 0,
        highestTierSeen: 0,
        queue: [],
        noSpendDays: [],
        cumulativeSavingsKrw: 0,
        lastSettledPeriod: "2026-08", // the month before TODAY (2026-09-15) — already settled, nothing pending
        moveHintSeen: true,
      },
      budget: { monthlyBudgetKrw: null, updatedAt: 0 },
      onboarded: true,
    }),
  );
  window.localStorage.setItem(`ait.v1.buildings.${TODAY.slice(0, 7)}`, JSON.stringify(buildings));
}

describe("TownScreen — ADDENDUM-11 §6 fusion: CTA visibility (F1/F2 refused)", () => {
  it("no 융합하기 CTA when the only same-level partner is a different category", async () => {
    seedFuseTown([fuseBuilding("cafe1", fuseCell(0)), fuseBuilding("transport1", fuseCell(1), { categoryId: "transport" })]);
    await mountAndWaitForBoot();

    tapTile(fuseCell(0));
    expect(findButton("융합하기")).toBeUndefined();
  });

  it("no 융합하기 CTA when the only same-category partner is below Lv.5", async () => {
    seedFuseTown([fuseBuilding("cafe1", fuseCell(0)), fuseBuilding("cafe2", fuseCell(1), { exp: 0 })]);
    await mountAndWaitForBoot();

    tapTile(fuseCell(0));
    expect(findButton("융합하기")).toBeUndefined();
  });
});

describe("TownScreen — ADDENDUM-11 §6 fusion: the pick-mode / confirm / commit flow", () => {
  it("a legal partner shows the CTA; tapping it closes the sheet and enters fuse pick mode with the same affordances grow-pick has", async () => {
    seedFuseTown([fuseBuilding("cafe1", fuseCell(0)), fuseBuilding("cafe2", fuseCell(1))]);
    await mountAndWaitForBoot();

    tapTile(fuseCell(0));
    expect(findButton("융합하기")).not.toBeUndefined();
    act(() => {
      findButton("융합하기")!.click();
    });

    // The detail sheet closed and pick mode opened, mirroring grow exactly.
    expect(container.querySelector(".town-move-bar")?.textContent).toContain("융합할 건물을 선택하세요");
    expect(container.querySelectorAll(".town-tile--grow-candidate").length).toBe(1); // only the partner, not the initiator
    expect(container.querySelector(".town-fab")).toBeNull(); // A1 parity — FAB hides same as grow
    expect(document.body.textContent).toContain("융합할 건물을 탭하세요"); // A1 parity — entry-hint toast
    const cancelStillThere = [...container.querySelectorAll<HTMLButtonElement>(".town-move-bar button")].some((b) => b.textContent === "취소");
    expect(cancelStillThere).toBe(true); // Gate-3 defect (no cancel affordance) does not reappear for fusion
  });

  it("tapping a non-candidate during fuse pick mode shows the inline reject hint and stays open (A1 parity)", async () => {
    seedFuseTown([fuseBuilding("cafe1", fuseCell(0)), fuseBuilding("cafe2", fuseCell(1))]);
    await mountAndWaitForBoot();
    tapTile(fuseCell(0));
    act(() => {
      findButton("융합하기")!.click();
    });

    const occupied = new Set(latest!.buildings.map((b) => b.plotIndex));
    const emptyPlot = [...container.querySelectorAll<HTMLElement>("[data-plot-index]")]
      .map((el) => Number(el.getAttribute("data-plot-index")))
      .find((i) => !occupied.has(i));
    tapTile(emptyPlot!);

    expect(container.querySelector(".town-move-bar")?.textContent).toContain("표시된 건물 중에서 골라주세요");
    expect(container.querySelectorAll(".town-tile--grow-candidate").length).toBe(1); // still in pick mode
    expect(latest!.buildings.length).toBe(2); // nothing committed by a stray tap
  });

  it("취소 during fuse pick mode leaves both buildings intact and brings the FAB back", async () => {
    seedFuseTown([fuseBuilding("cafe1", fuseCell(0)), fuseBuilding("cafe2", fuseCell(1))]);
    await mountAndWaitForBoot();
    tapTile(fuseCell(0));
    act(() => {
      findButton("융합하기")!.click();
    });

    const cancelButton = [...container.querySelectorAll<HTMLButtonElement>(".town-move-bar button")].find((b) => b.textContent === "취소");
    act(() => {
      cancelButton!.click();
    });

    expect(container.querySelector(".town-move-bar")).toBeNull();
    expect(latest!.buildings.length).toBe(2);
    expect(latest!.buildings.every((b) => (b.fuse ?? 0) === 0)).toBe(true); // nothing fused
    expect(container.querySelector(".town-fab")).not.toBeNull(); // no stuck mode
  });

  it("tapping the highlighted partner does NOT fuse immediately — it opens a confirm dialog naming the resulting level", async () => {
    seedFuseTown([fuseBuilding("cafe1", fuseCell(0)), fuseBuilding("cafe2", fuseCell(1))]);
    await mountAndWaitForBoot();
    tapTile(fuseCell(0));
    act(() => {
      findButton("융합하기")!.click();
    });

    tapTile(fuseCell(1)); // the highlighted candidate

    expect(container.querySelector(".town-move-bar")).toBeNull(); // pick mode exited
    expect(latest!.buildings.length).toBe(2); // §6 confirm step — nothing committed by the tap alone
    expect(latest!.buildings.every((b) => (b.fuse ?? 0) === 0)).toBe(true);
    expect(document.body.textContent).toContain("건물을 융합할까요?");
    expect(document.body.textContent).toContain(`Lv.${BALANCE.maxLevel + 1}`); // names the resulting level
    expect(findButton("합치기")).not.toBeUndefined(); // the dialog's confirm button
  });

  it("cancelling the confirm dialog fuses nothing", async () => {
    seedFuseTown([fuseBuilding("cafe1", fuseCell(0)), fuseBuilding("cafe2", fuseCell(1))]);
    await mountAndWaitForBoot();
    tapTile(fuseCell(0));
    act(() => {
      findButton("융합하기")!.click();
    });
    tapTile(fuseCell(1));
    expect(findButton("합치기")).not.toBeUndefined();

    act(() => {
      findButton("취소")!.click();
    });

    expect(findButton("합치기")).toBeUndefined(); // dialog closed
    expect(latest!.buildings.length).toBe(2);
    expect(latest!.buildings.every((b) => (b.fuse ?? 0) === 0 && b.exp === MAXED_EXP)).toBe(true);
    // Gate-3-rerun fix (panel's mode-ambiguity finding): cancelling fires an
    // explicit toast, replacing whatever pick-instruction toast may still be
    // on screen — a player can no longer be left staring at "반짝이는 건물...
    // 탭하세요" with no way to tell whether picking is still armed.
    expect(document.body.textContent).toContain("취소했어요");
  });

  it("confirming performs the fusion: survivor reaches Lv.6, the consumed building is gone, and its cell frees", async () => {
    seedFuseTown([fuseBuilding("cafe1", fuseCell(0)), fuseBuilding("cafe2", fuseCell(1))]);
    await mountAndWaitForBoot();
    tapTile(fuseCell(0));
    act(() => {
      findButton("융합하기")!.click();
    });
    tapTile(fuseCell(1));

    act(() => {
      findButton("합치기")!.click(); // the confirm dialog's confirm button
    });

    // `buildingCount` is the literal array length (Gate-3-rerun fix — the
    // header's "건물 N채" must fall on fusion), so it drops to 1 along with
    // `buildings.length`. `townScale` (Σ 2**fuse) is the tier-neutral number
    // instead: one Lv.6 building is 2 Lv.5-equivalents by design, so THAT
    // stays 2 across the fusion (AC §7.7, "tier does not regress").
    expect(latest!.buildingCount).toBe(1);
    expect(latest!.buildings.length).toBe(1);
    expect(latest!.townScale).toBe(2);
    const survivor = latest!.buildings.find((b) => b.id === "cafe1");
    expect(survivor).not.toBeUndefined();
    expect(survivor!.plotIndex).toBe(fuseCell(0)); // AC §7.1 — the survivor keeps its position
    expect(latest!.levelOfBuilding(survivor!)).toBe(BALANCE.maxLevel + 1);
    expect(latest!.buildings.find((b) => b.id === "cafe2")).toBeUndefined(); // consumed, gone
    expect(document.body.textContent).toContain(`Lv.${BALANCE.maxLevel + 1} 건물이 됐어요`);
    // AC §7.2 — the vacated cell renders as an empty lot, not a leftover tile.
    expect(container.querySelector(`[data-plot-index="${fuseCell(1)}"] .building-tile`)).toBeNull();
  });
});

// Regression guard for the shared-hook wiring itself: `pickPurpose` lives in
// TownScreen state, not inside `useGrowPickMode` (the hook is reused
// unmodified, §6's own directive). Escape/Android back exit through the
// hook's OWN internal `cancel` (its `useBackGuard`), which never touches
// TownScreen state — without the `candidateIds -> null` reset effect,
// `pickPurpose` would stay stuck on "fuse" and misroute the NEXT grow pick's
// commit into a fuse confirm instead of saving the entry.
describe("TownScreen — ADDENDUM-11: Android back out of fuse pick mode does not strand pickPurpose", () => {
  it("popstate cancels fuse pick mode, and a grow pick right after still commits as a grow, not a fuse", async () => {
    seedFuseTown([
      fuseBuilding("cafe1", fuseCell(0)),
      fuseBuilding("cafe2", fuseCell(1)),
      fuseBuilding("transport1", fuseCell(2), { categoryId: "transport", exp: 0 }),
      fuseBuilding("transport2", fuseCell(3), { categoryId: "transport", exp: 0 }),
    ]);
    await mountAndWaitForBoot();

    tapTile(fuseCell(0));
    act(() => {
      findButton("융합하기")!.click();
    });
    expect(container.querySelector(".town-move-bar")).not.toBeNull();

    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(container.querySelector(".town-move-bar")).toBeNull(); // fuse pick mode exited
    expect(latest!.buildings.length).toBe(4); // nothing committed

    // A grow flow right after: 2 existing 교통 candidates force pick mode.
    openSheet();
    fillAndSave("교통");
    act(() => {
      findButton("키우기")!.click();
    });

    // If `pickPurpose` had stayed "fuse", this banner would read the fuse
    // copy instead — the bug this test exists to catch.
    expect(container.querySelector(".town-move-bar")?.textContent).toContain("키울 건물을 선택하세요");

    const transport2 = latest!.buildings.find((b) => b.id === "transport2")!;
    const entriesBefore = monthEntryCount();
    tapTile(transport2.plotIndex);

    // Committed as a GROW: `entriesBefore` was read AFTER 저장 already wrote the
    // row, so the pick adds no row — it points the existing one at the host.
    expect(monthEntryCount()).toBe(entriesBefore);
    expect(latest!.getMonthEntries(TODAY.slice(0, 7)).at(-1)!.buildingId).toBe("transport2");
    expect(latest!.pendingGrowChoice).toBeNull(); // choice resolved, marker gone
    expect(latest!.buildings.length).toBe(4); // grew in place, no fusion, no new building
    expect(document.body.textContent).not.toContain("건물을 융합할까요?");
  });
});

// Gate-3 round-5 (A1): the header's tier badge is a number that "silently
// changes someday" — nothing stated what Tier 2 costs or how close the town
// is. Driven through the REAL store so the readout is proven to come from
// `BALANCE.tierThresholds` + `store.townScale` (not a hardcoded 10), and to
// move as the town grows.
describe("TownScreen — A1: the header states the distance to the next tier", () => {
  function nextTierText(): string | null {
    return container.querySelector(".town-header-next-tier")?.textContent ?? null;
  }

  it("counts down from tierThresholds[1] as buildings are founded, in townScale units", async () => {
    await mountAndWaitForBoot();
    const toTier2 = BALANCE.tierThresholds[1];
    expect(latest!.townScale).toBe(0);
    expect(nextTierText()).toBe(`Tier 2까지 ${toTier2}채분`);

    act(() => {
      latest!.addEntry(cafeExpense(1_000));
    });
    expect(latest!.townScale).toBe(1);
    expect(nextTierText()).toBe(`Tier 2까지 ${toTier2 - 1}채분`);
  });

  it("says 채분, not 채 — the tier unit is townScale (Σ 2**fuse), not the literal 건물 N채 beside it", async () => {
    await mountAndWaitForBoot();
    // The literal count line and the goal line are different units and must
    // not be phrased as the same one (useTownStore.ts: "never feed
    // `townScale` to anything that displays as a building count").
    expect(nextTierText()).toMatch(/채분$/);
    expect(container.querySelector(".town-header-stats")?.textContent).toContain(`건물 ${latest!.buildingCount}채`);
  });
});

// Gate-3 round-5 (A2): the 새로짓기/키우기 dialog stated only the shared COST
// ("둘 다 건축 슬롯 1개를 써요") and neither button's payoff — "a choice with a
// hidden payoff is not a decision, it is a coin flip." Both outcomes must be
// on screen at the moment of choosing.
describe("TownScreen — A2: the grow dialog states what each choice actually does", () => {
  it("names the fusion payoff of 새로 짓기 and the level payoff of 키우기, without dropping the slot cost", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.addEntry(cafeExpense(1_000));
    });

    openSheet();
    fillAndSave("카페");
    expect(findButton("키우기")).not.toBeUndefined(); // the dialog is up

    const text = document.body.textContent ?? "";
    // 새로 짓기 -> a second building that becomes a fusion partner at maxLevel.
    expect(text).toContain("같은 건물이 한 채 더 생겨요");
    expect(text).toContain(`Lv.${BALANCE.maxLevel}`);
    expect(text).toContain("합쳐서");
    // 키우기 -> the existing building's level moves.
    expect(text).toContain("지금 있는 건물의 레벨이 올라가요");
    // The round-4 disclosure this must not regress.
    expect(text).toContain("둘 다 건축 슬롯 1개를 써요");
  });
});

// Gate-3 round-5 (A4b): the level-up toast read "레벨이 올랐어요! (Lv.N)" —
// ambiguous about whether N was the resulting level or the levels gained, and
// fired on EVERY grow even though a grow only adds exp. A small save into a
// Lv.1 building therefore announced a level-up that had not happened.
describe("TownScreen — A4: the grow toast names the resulting level and never claims a level-up that didn't happen", () => {
  /** Raises the dialog for an existing 카페 and taps 키우기. */
  function growExistingCafe(amountDigits: string): void {
    openSheet();
    for (const d of amountDigits) pressDigit(d);
    const categoryButton = [...document.body.querySelectorAll("button")].find((b) => b.textContent?.includes("카페"));
    act(() => {
      categoryButton!.click();
    });
    act(() => {
      findButton("저장")!.click();
    });
    act(() => {
      findButton("키우기")!.click();
    });
  }

  it("a grow whose exp does NOT cross a level threshold reports exp, not a level-up", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.addEntry(cafeExpense(1_000));
    });
    act(() => latest!.dismissNotice());
    const before = latest!.levelOfBuilding(latest!.buildings[0]);

    // 1원 is below `expAmountTiers`' bottom rung (5,000) — exp gain 0, so the
    // level provably cannot move.
    growExistingCafe("1");

    expect(latest!.levelOfBuilding(latest!.buildings[0])).toBe(before); // level really did not move
    expect(document.body.textContent).not.toContain("레벨이 올랐어요");
    expect(document.body.textContent).toContain(`경험치가 쌓였어요 (지금 Lv.${before})`);
  });

  it("a grow that DOES cross a threshold claims the level-up and names the level it ended at", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.addEntry(cafeExpense(1_000));
    });
    act(() => latest!.dismissNotice());
    const before = latest!.levelOfBuilding(latest!.buildings[0]);

    growExistingCafe("150000"); // top exp rung — comfortably crosses expPerLevel

    const after = latest!.levelOfBuilding(latest!.buildings[0]);
    expect(after).toBeGreaterThan(before);
    // Names the RESULTING level explicitly ("지금"), so it can't be read as
    // "gained N levels".
    expect(document.body.textContent).toContain(`레벨이 올랐어요! (지금 Lv.${after})`);
  });
});

// FT-1 — the no-spend park's deferral toast (`handleClaimNoSpend`'s queued
// branch, TownScreen.tsx) borrows the exact same "내일 아침에" wording the
// entry-queue toast above used to, and the park path is the ONE that always
// defers from a genuinely full town (`noSpendActions.ts`'s `plotIndex ===
// null` branch) — "내일 아침" is not a guarantee there either: the SCENARIOS.md
// `full-town` doc itself records the promise repeating every day the town
// stays full. Seeds a saturated town (through the real placer, same fixture
// `useTownStore.noSpendDefer.test.tsx` uses) so `claimNoSpend` genuinely
// queues rather than builds.
describe("TownScreen — FT-1: the no-spend park deferral toast", () => {
  const SEEDED_MONTH = "2026-09"; // TODAY's month, above
  const CHUNK_KEY = `ait.v1.buildings.${SEEDED_MONTH}`;

  function seedFullTown(buildings: readonly Building[]): void {
    window.localStorage.setItem(
      "ait.v1.index",
      JSON.stringify({ schemaVersion: 1, layoutVersion: LAYOUT_VERSION, entryMonths: [], buildingMonths: [SEEDED_MONTH] }),
    );
    window.localStorage.setItem(
      "ait.v1.core",
      JSON.stringify({
        town: {
          townName: "우리 동네",
          streakDays: 0,
          longestStreakDays: 0,
          lastActOn: null,
          slotsUsedOn: "",
          slotsUsedToday: 0,
          highestTierSeen: BALANCE.tierThresholds.length,
          queue: [],
          noSpendDays: [],
          cumulativeSavingsKrw: 0,
          lastSettledPeriod: "2026-08", // nothing to settle — keeps this test about the park alone
          moveHintSeen: true,
        },
        budget: { monthlyBudgetKrw: null, updatedAt: 0 },
        onboarded: true,
      }),
    );
    window.localStorage.setItem(CHUNK_KEY, JSON.stringify(buildings));
  }

  it("promises room, not a specific morning, when a full town defers the park", async () => {
    seedFullTown(saturatedTown());
    await mountAndWaitForBoot();
    expect(latest?.canClaimNoSpend).toBe(true);

    act(() => {
      findButton("오늘 무지출!")!.click();
    });

    expect(latest?.queueLength).toBe(1); // deferred, not built — proves this exercised the full-town branch
    expect(document.body.textContent).toContain("자리가 나면 지어드릴게요");
    expect(document.body.textContent).not.toContain("내일 아침");
  });
});

// ── Durability of a save whose 새로짓기/키우기 choice is still open ──────────
//
// The defect (evaluation panel, 2026-08-15): 저장 with the ConfirmDialog — or
// grid pick mode — showing parked the entry in TownScreen's React state
// (`growDraft`) and wrote NOTHING. A reload at that moment destroyed the
// record outright: not in `entries`, not in `economy`, not in 기록. Total loss
// of the user's input.
//
// Every test here reloads by unmounting (which flushes storage.ts's ~300ms
// write buffer through the store's own pagehide/cleanup path) and mounting a
// fresh root over the SAME localStorage — the same "simulate a reload" the
// store's own tests use.
describe("TownScreen — a save with an unresolved grow choice survives a reload (data-loss regression)", () => {
  async function reload(): Promise<void> {
    act(() => root.unmount());
    await mountAndWaitForBoot();
  }

  /** The three places the panel demanded the record be found after a reload. */
  function assertRecordSurvived(entryId: string): void {
    const ym = TODAY.slice(0, 7);
    // 1. `entries` — the store's current-month slice.
    expect(latest!.getMonthEntries(ym).map((e) => e.id)).toContain(entryId);
    // 2. `economy` — the entry award is idempotent by `seed:entry:<id>`, so
    //    finding the key proves it was paid ONCE and persisted, not re-paid.
    expect(latest!.economy.grantedEventKeys).toContain(`seed:entry:${entryId}`);
    expect(latest!.economy.seeds).toBeGreaterThan(0);
    // 3. 기록 — the S3 screen's own read path (a lazily loaded month chunk),
    //    not the in-memory array above.
    expect(latest!.getMonthEntries(ym).find((e) => e.id === entryId)).not.toBeUndefined();
  }

  it("dialog showing at reload: the record is in entries + economy + 기록, and the choice is re-presented", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.addEntry(cafeExpense(1_000));
    });
    const buildingsBefore = latest!.buildingCount;
    const slotsBefore = latest!.slotsRemaining;

    openSheet();
    fillAndSave("카페");
    expect(findButton("키우기")).not.toBeUndefined(); // the dialog is up
    const pending = latest!.pendingGrowChoice;
    expect(pending).not.toBeNull();
    // Committed BEFORE the choice: the slot is spent, so nothing about the
    // decision can be double-charged when it lands.
    expect(latest!.slotsRemaining).toBe(slotsBefore - 1);
    assertRecordSurvived(pending!.entryId);

    await reload();

    assertRecordSurvived(pending!.entryId);
    expect(latest!.pendingGrowChoice?.entryId).toBe(pending!.entryId);
    expect(findButton("키우기")).not.toBeUndefined(); // re-presented, not silently dropped
    expect(latest!.buildingCount).toBe(buildingsBefore); // building effect still deferred
    expect(latest!.slotsRemaining).toBe(slotsBefore - 1); // slot stayed spent across the reload

    // …and answering it after the reload still works, exactly once.
    act(() => {
      findButton("새로 짓기")!.click();
    });
    expect(latest!.buildingCount).toBe(buildingsBefore + 1);
    expect(latest!.pendingGrowChoice).toBeNull();
    expect(latest!.getMonthEntries(TODAY.slice(0, 7)).find((e) => e.id === pending!.entryId)!.buildingId).not.toBeNull();
  });

  it("pick mode (2+ candidates) showing at reload: same three surfaces, and the choice comes back", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.addEntry(cafeExpense(1_000));
    });
    act(() => {
      latest!.addEntry(cafeExpense(2_000));
    });
    const buildingsBefore = latest!.buildingCount;

    openSheet();
    fillAndSave("카페");
    act(() => {
      findButton("키우기")!.click();
    });
    // 2+ candidates — the dialog handed off to grid pick mode, the state the
    // panel's second repro reloads in.
    expect(container.querySelector(".town-move-bar")?.textContent).toContain("키울 건물을 선택하세요");
    const pending = latest!.pendingGrowChoice;
    expect(pending).not.toBeNull();
    assertRecordSurvived(pending!.entryId);

    await reload();

    assertRecordSurvived(pending!.entryId);
    expect(latest!.pendingGrowChoice?.entryId).toBe(pending!.entryId);
    // Pick mode itself is session state; the DECISION is what has to come
    // back, and it comes back as the dialog it started from.
    expect(findButton("키우기")).not.toBeUndefined();
    expect(latest!.buildingCount).toBe(buildingsBefore);

    // Resolving as 키우기 after the reload grows a host instead of building.
    act(() => {
      findButton("키우기")!.click();
    });
    const host = latest!.buildings.find((b) => b.categoryId === "cafe")!;
    tapTile(host.plotIndex);
    expect(latest!.buildingCount).toBe(buildingsBefore); // grew in place
    expect(latest!.pendingGrowChoice).toBeNull();
    expect(latest!.getMonthEntries(TODAY.slice(0, 7)).find((e) => e.id === pending!.entryId)!.buildingId).toBe(host.id);
  });

  it("an unresolved choice is never double-counted: the entry award is paid once across the reload", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.addEntry(cafeExpense(1_000));
    });

    openSheet();
    fillAndSave("카페");
    const pending = latest!.pendingGrowChoice!;
    const seedsAtSave = latest!.economy.seeds;

    await reload();
    expect(latest!.economy.seeds).toBe(seedsAtSave); // a reload pays nothing

    act(() => {
      findButton("새로 짓기")!.click();
    });
    // Resolving adds the BUILD award on top; the entry award's key was already
    // recorded, so `applyAward` no-ops it rather than paying twice.
    expect(latest!.economy.grantedEventKeys.filter((k) => k === `seed:entry:${pending.entryId}`).length).toBe(1);
    expect(latest!.economy.seeds).toBeGreaterThan(seedsAtSave);
  });

  it("a town persisted before this shipped has no marker and loads with no pending choice", async () => {
    // The absent-marker case: seed storage the way every pre-existing save
    // looks (no `pendingGrowChoice` key anywhere) and boot over it.
    seedFuseTown([fuseBuilding("cafe1", fuseCell(0))]);
    await mountAndWaitForBoot();

    expect(latest!.loading).toBe(false);
    expect(latest!.pendingGrowChoice).toBeNull();
    expect(findButton("키우기")).toBeUndefined(); // no phantom dialog
    expect(latest!.buildingCount).toBe(1);
  });
});
