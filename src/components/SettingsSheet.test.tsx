/**
 * SettingsSheet (S6) back-guard test — round-2 fix-forward, C1 finding #1:
 * this sheet had no `useBackGuard` at all, so an Android/gesture back (or a
 * back press while the 초기화 `ConfirmDialog` was open) fell through and
 * popped the WHOLE mini-app (§10.4). Also covers the commit-on-dismiss half
 * of the same finding: a field that was typed into but never blurred must
 * still save on backdrop-tap/back, not just on `onBlur`.
 *
 * `useBackGuard` itself is unit-tested independently (`hooks/useBackGuard
 * .test.tsx`) — this file only asserts SettingsSheet WIRES it correctly
 * (touched = `confirmResetOpen`, dismiss = commit-then-close / just-close-
 * the-confirm), via a real mounted component and real `popstate` events.
 *
 * `BottomSheet` portals its content into `document.body` (a Radix portal),
 * not into `mountComponent`'s own container — same discovery
 * `EntryDetailSheet.test.tsx` already documents/works around (its own
 * `findByText`/`findButton` both query `document.body`, never the mounted
 * container).
 */
import { act } from "react";
import { ThemeProvider } from "@toss/tds-mobile";
import { afterEach, describe, expect, it } from "vitest";
import { mountComponent, type MountedComponent } from "../testUtils/mount";
import { SettingsSheet, type SettingsSheetProps } from "./SettingsSheet";

// Same jsdom-vs-real-browser gaps `EntryDetailSheet.test.tsx` already
// documents and stubs for — this is the second component test to mount a
// real `BottomSheet`.
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver ??=
  NoopResizeObserver as unknown as typeof ResizeObserver;

const nativeQuerySelectorAll = Document.prototype.querySelectorAll;
Document.prototype.querySelectorAll = function (this: Document, selector: string) {
  try {
    return nativeQuerySelectorAll.call(this, selector);
  } catch {
    return nativeQuerySelectorAll.call(this, "[data-settings-sheet-test-no-match]");
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

function makeCalls() {
  const onClose = { count: 0 };
  const savedNames: string[] = [];
  const savedBudgets: (number | null)[] = [];
  let resetCount = 0;
  const props: SettingsSheetProps = {
    open: true,
    townName: "우리 동네",
    budgetKrw: null,
    onClose: () => onClose.count++,
    onSaveTownName: (n) => savedNames.push(n),
    onSaveBudget: (b) => savedBudgets.push(b),
    onResetAll: () => resetCount++,
  };
  return { props, onClose, savedNames, savedBudgets, getResetCount: () => resetCount };
}

function render(props: SettingsSheetProps): void {
  const element = (
    <ThemeProvider>
      <SettingsSheet {...props} />
    </ThemeProvider>
  );
  if (mounted === null) mounted = mountComponent(element);
  else act(() => mounted!.root.render(element));
}

/** React-controlled-input-safe way to type into a native input under jsdom (plain `.value =` + a bare `dispatchEvent` does not notify React's onChange). */
function typeInto(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function popBack(): void {
  act(() => {
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

function nameInput(): HTMLInputElement {
  return document.body.querySelectorAll<HTMLInputElement>("input")[0];
}

function budgetInput(): HTMLInputElement {
  return document.body.querySelectorAll<HTMLInputElement>("input")[1];
}

function findButton(text: string): HTMLButtonElement | undefined {
  return [...document.body.querySelectorAll("button")].find((b) => b.textContent === text);
}

/** `BottomSheet`'s own dimmer — TDS renders it `role="button" aria-label="닫기"`. */
function dimmer(): HTMLElement {
  return document.body.querySelector<HTMLElement>('[aria-label="닫기"]')!;
}

describe("SettingsSheet — back guard (§10.4) + commit-on-dismiss", () => {
  it("pushes a back-guard history entry while open, so a back gesture does not fall through", () => {
    const { props } = makeCalls();
    render(props);
    // Same assertion style `useBackGuard.test.tsx` uses — jsdom's synthetic
    // popstate doesn't change `history.length`, so this only proves a push
    // happened, not that it's exactly 1 (see that file's own note).
    const lengthAfterOpen = window.history.length;
    popBack();
    expect(window.history.length).toBe(lengthAfterOpen); // not touched (no confirm open) — consumed, not re-armed
  });

  it("commits a typed-but-never-blurred town name on back gesture, then closes (does not silently drop it)", () => {
    const { props, onClose, savedNames } = makeCalls();
    render(props);
    typeInto(nameInput(), "행복동");

    popBack();

    expect(savedNames).toEqual(["행복동"]);
    expect(onClose.count).toBe(1);
  });

  it("commits a typed-but-never-blurred budget on backdrop tap, then closes", () => {
    const { props, onClose, savedBudgets } = makeCalls();
    render(props);
    typeInto(budgetInput(), "600000");

    act(() => {
      dimmer().click();
    });

    expect(savedBudgets).toEqual([600_000]);
    expect(onClose.count).toBe(1);
  });

  it("a back gesture while the 초기화 confirm is open closes ONLY the confirm and re-arms — a second back then closes the sheet, never falling through", () => {
    const { props, onClose, getResetCount } = makeCalls();
    render(props);

    act(() => {
      findButton("데이터 초기화")!.click();
    });

    // Confirm dialog is open — back press #1 must close ONLY it (re-arm), not the sheet.
    const lengthWithConfirmOpen = window.history.length;
    popBack();
    expect(onClose.count).toBe(0); // sheet itself is still open
    expect(getResetCount()).toBe(0); // nothing was actually reset — this was a dismiss, not a confirm
    expect(window.history.length).toBe(lengthWithConfirmOpen + 1); // re-armed

    // Back press #2 (confirm now closed) closes the sheet itself.
    popBack();
    expect(onClose.count).toBe(1);
  });
});
