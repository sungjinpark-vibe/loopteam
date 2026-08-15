/**
 * EntryDetailSheet (S5) component test — fix-forward round for T013's 85/100
 * finding: the date field had never been driven through the real, mounted
 * component at any level (no test file existed here at all).
 *
 * `WheelDatePicker`'s own spinner is a `@toss/tds-mobile` black box whose
 * drag-to-select relies on real element geometry (`getBoundingClientRect`,
 * transform-based scroll) — jsdom has no layout engine (same limitation
 * `TownGrid.test.tsx`/`SavingsRow.test.tsx` already document), so a value
 * change via drag cannot be reproduced here. That interaction WAS verified
 * live in a real Chromium tab for this fix-forward round (a real pointer
 * drag on the month/day wheel columns moves the date and the edit persists
 * across a month boundary and a reload — see the client-dev report); a plain
 * `mouse.wheel` or a single click/CDP-touch tap, which is what the prior QA
 * pass tried, does NOT drive this widget — that's a QA-methodology gap, not
 * a code bug.
 *
 * What jsdom CAN drive for real, and what this file tests, is everything
 * this component itself owns around the date field: the trigger button's
 * OWN Button/BottomSheet chrome (real clicks, no geometry needed) and the
 * exact regression this file's own header doc describes (round-1 finding
 * C1) — an entry switch, on the SAME mounted instance, must reset the date
 * field synchronously (no stale-date flash, no silently-wrong patch from
 * tapping 적용 without ever touching the wheel).
 */
import { act } from "react";
import { ThemeProvider } from "@toss/tds-mobile";
import { afterEach, describe, expect, it } from "vitest";
import { mountComponent, type MountedComponent } from "../testUtils/mount";
import type { EntryEditPatch, EntryMutability } from "../useTownStore";
import type { LedgerEntry } from "../types";
import { EntryDetailSheet, type EntryDetailSheetProps } from "./EntryDetailSheet";

// jsdom implements neither (§2.9, same gap `SavingsRow.test.tsx` already
// stubs `scrollIntoView` for) — `WheelDatePicker`'s `BottomSheet` chrome
// measures itself with a `ResizeObserver` on mount.
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver ??=
  NoopResizeObserver as unknown as typeof ResizeObserver;

// `BottomSheet`'s Radix-based focus-guard cleanup queries the DOM with a
// selector string this bundle decodes at runtime (an unrelated packaging
// concern of the vendored library); jsdom's selector engine is stricter
// about it than a real browser and throws instead of finding zero matches.
// No test in this repo mounted a real `BottomSheet` before this file — same
// "jsdom is pickier than a real browser" class of gap as the `ResizeObserver`
// stub above, scoped to this file only.
const nativeQuerySelectorAll = Document.prototype.querySelectorAll;
Document.prototype.querySelectorAll = function (this: Document, selector: string) {
  try {
    return nativeQuerySelectorAll.call(this, selector);
  } catch {
    return nativeQuerySelectorAll.call(this, "[data-entry-detail-sheet-test-no-match]");
  }
} as typeof Document.prototype.querySelectorAll;

let mounted: MountedComponent | null = null;
afterEach(() => {
  try {
    mounted?.unmount();
  } finally {
    mounted = null;
  }
});

const TODAY = "2026-08-15";

const ENTRY_A: LedgerEntry = {
  id: "e-a",
  type: "expense",
  amountKrw: 4_500,
  categoryId: "cafe",
  // ADDENDUM-12 §4/§9: kept within TODAY's month (2026-08) — the date field
  // now carries a `min` of the current month's first day (real usage: only a
  // current-month entry is ever editable at all, so its own `occurredOn`
  // can never legitimately sit below that floor). A previous-month value
  // here would conflict with that floor and make WheelDatePicker clamp the
  // untouched-apply repro this file exists to guard (round-1 finding C1).
  occurredOn: "2026-08-05",
  memo: "americano",
  createdAt: 1,
  updatedAt: 1,
  buildingId: "b-a",
  queued: false,
};

const ENTRY_B: LedgerEntry = {
  id: "e-b",
  type: "expense",
  amountKrw: 9_900,
  categoryId: "food",
  occurredOn: "2026-08-02",
  memo: undefined,
  createdAt: 2,
  updatedAt: 2,
  buildingId: "b-b",
  queued: false,
};

const NOOP_PROPS: Pick<
  EntryDetailSheetProps,
  "open" | "today" | "mutability" | "clawbackPreview" | "onClose" | "onSave" | "onDelete"
> = {
  open: true,
  today: TODAY,
  mutability: null,
  clawbackPreview: null,
  onClose: () => {},
  onSave: () => {},
  onDelete: () => {},
};

/** `WheelDatePicker` needs a real `ThemeProvider` ancestor (`main.tsx`'s `TDSMobileAITProvider` supplies one in the app; bare component mounts here need it too, or TDS throws). */
function renderSheet(props: Partial<EntryDetailSheetProps>): void {
  const element = (
    <ThemeProvider>
      <EntryDetailSheet {...NOOP_PROPS} {...props} entry={props.entry ?? null} />
    </ThemeProvider>
  );
  if (mounted === null) mounted = mountComponent(element);
  else act(() => mounted!.root.render(element));
}

/** The date trigger button's own displayed text — `WheelDatePicker`'s default `format: "yyyy.MM.dd"`. */
function dateLabelFor(occurredOn: string): string {
  return occurredOn.replace(/-/g, ".");
}

function findByText(root: HTMLElement, text: string): HTMLElement | null {
  const all = root.querySelectorAll<HTMLElement>("button, span, div");
  for (const el of all) {
    if (el.textContent === text && el.children.length === 0) return el;
  }
  return null;
}

function findButton(text: string): HTMLButtonElement | undefined {
  return [...document.body.querySelectorAll("button")].find((b) => b.textContent === text);
}

describe("EntryDetailSheet — date field (T013 fix-forward, round-1 finding C1's own regression)", () => {
  it("the date trigger shows the OPEN entry's occurredOn on first paint", () => {
    renderSheet({ entry: ENTRY_A });
    expect(findByText(document.body, dateLabelFor(ENTRY_A.occurredOn))).not.toBeNull();
  });

  it("switching entries on the SAME mounted instance (open the whole time) resets the date field synchronously — no stale flash, no remount", () => {
    renderSheet({ entry: ENTRY_A });
    expect(findByText(document.body, dateLabelFor(ENTRY_A.occurredOn))).not.toBeNull();

    renderSheet({ entry: ENTRY_B });

    // The OLD entry's date must be gone — a stale flash (round-1's actual bug:
    // `initialDate` captured at mount, never updated) would leave this behind.
    expect(findByText(document.body, dateLabelFor(ENTRY_A.occurredOn))).toBeNull();
    expect(findByText(document.body, dateLabelFor(ENTRY_B.occurredOn))).not.toBeNull();
  });

  it("saving with NO edits at all emits an empty patch — the date field never rewrites itself from a no-op open", () => {
    let saved: EntryEditPatch | undefined;
    renderSheet({ entry: ENTRY_A, onSave: (patch) => (saved = patch) });
    act(() => findButton("저장")!.click());
    expect(saved).toEqual({});
  });

  it("opening the real date picker and tapping 적용 WITHOUT touching the wheel never rewrites occurredOn (round-1 C1's exact repro, driven through the real WheelDatePicker)", () => {
    let saved: EntryEditPatch | undefined;
    renderSheet({ entry: ENTRY_A, onSave: (patch) => (saved = patch) });

    act(() => findByText(document.body, dateLabelFor(ENTRY_A.occurredOn))!.click()); // opens the real WheelDateSheet — a plain internal `open` boolean, no geometry needed
    const applyBtn = findButton("적용");
    expect(applyBtn).not.toBeUndefined(); // the real picker sheet did open
    act(() => applyBtn!.click()); // confirm with the wheel untouched — `initialDate`/`value` must still be entry A's own date

    // The trigger must still read the ORIGINAL date (not blank, not today, not shifted).
    expect(findByText(document.body, dateLabelFor(ENTRY_A.occurredOn))).not.toBeNull();

    act(() => findButton("저장")!.click());
    expect(saved).toEqual({}); // no field actually changed — occurredOn must NOT appear in the patch
  });

  it("editing a different field (memo) while leaving the date untouched keeps occurredOn out of the patch", () => {
    let saved: EntryEditPatch | undefined;
    renderSheet({ entry: ENTRY_A, onSave: (patch) => (saved = patch) });

    const memoInput = document.body.querySelector<HTMLInputElement>('input[placeholder="메모 (선택)"]')!;
    const nativeValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
      // React tracks a controlled input's value via the NATIVE setter; a
      // plain `input.value = ...` bypasses that tracking and React never
      // sees the change (a standard React-testing gotcha, not TDS-specific).
      nativeValueSetter.call(memoInput, "iced americano");
      memoInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => findButton("저장")!.click());

    expect(saved).toEqual({ memo: "iced americano" });
    expect(saved).not.toHaveProperty("occurredOn");
  });
});

describe("EntryDetailSheet — ADDENDUM-12 §7 mutability + clawback UI", () => {
  const PAST_MONTH: EntryMutability = { canEdit: false, canEditAmount: false, canDelete: false, reason: "past-month" };
  const FUSED: EntryMutability = { canEdit: true, canEditAmount: false, canDelete: false, reason: "fused" };
  const OPEN: EntryMutability = { canEdit: true, canEditAmount: true, canDelete: true, reason: null };

  it("past-month: save and delete are both disabled, and the reason is shown", () => {
    renderSheet({ entry: ENTRY_A, mutability: PAST_MONTH, clawbackPreview: { seeds: 0, shortfall: 0 } });

    expect(findByText(document.body, "지난달 기록은 정산이 끝나 수정할 수 없어요.")).not.toBeNull();
    expect(findButton("저장")!.disabled).toBe(true);
    expect(findButton("삭제")!.disabled).toBe(true);
  });

  it("fused: delete and the amount/type fields are locked, but memo stays editable and its own edit still saves", () => {
    let saved: EntryEditPatch | undefined;
    renderSheet({
      entry: ENTRY_B,
      mutability: FUSED,
      clawbackPreview: { seeds: 0, shortfall: 0 },
      onSave: (patch) => (saved = patch),
    });

    expect(
      findByText(
        document.body,
        "이 기록은 합쳐진 건물에 들어가 있어 금액 수정·삭제를 할 수 없어요. 메모와 분류는 바꿀 수 있어요."
      )
    ).not.toBeNull();
    expect(findButton("삭제")!.disabled).toBe(true);
    expect(document.body.querySelector(".entry-sheet-body--amount-locked")).not.toBeNull();

    const memoInput = document.body.querySelector<HTMLInputElement>('input[placeholder="메모 (선택)"]')!;
    const nativeValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
      nativeValueSetter.call(memoInput, "note");
      memoInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => findButton("저장")!.click());

    expect(saved).toEqual({ memo: "note" });
  });

  it("delete confirm description states the seed clawback, and adds the shortfall sentence when the balance is short", () => {
    renderSheet({ entry: ENTRY_B, mutability: OPEN, clawbackPreview: { seeds: 8, shortfall: 3 } });

    act(() => findButton("삭제")!.click()); // opens the destructive-action ConfirmDialog

    expect(
      findByText(
        document.body,
        "함께 지어진 건물이 사라지고, 씨앗 8개를 돌려받아요. 이 작업은 되돌릴 수 없어요. 지금 씨앗이 부족해서 다음 적립에서 차감돼요."
      )
    ).not.toBeNull();
  });

  it("delete confirm description says nothing about seeds when the preview is 0", () => {
    renderSheet({ entry: ENTRY_B, mutability: OPEN, clawbackPreview: { seeds: 0, shortfall: 0 } });

    act(() => findButton("삭제")!.click());

    expect(findByText(document.body, "함께 지어진 건물도 사라져요. 이 작업은 되돌릴 수 없어요.")).not.toBeNull();
  });
});
