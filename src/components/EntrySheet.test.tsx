/**
 * EntrySheet (S4) component test — T017 finding C2 #2: zero tests bound
 * `useConfirmDialogBackdropFix` to this call site (deleting the wired hook
 * call would still pass the full suite). This reproduces the exact vendor
 * race live: touch a field (so backdrop-tap opens the unsaved-changes
 * confirm), fire the dimmer click, cancel via 계속 입력, advance one frame,
 * and assert no `inert` attribute remains anywhere above the sheet's own
 * backdrop — confirmed by temporarily reverting the hook wiring in
 * `EntrySheet.tsx` and re-running this file (it fails without the wiring;
 * the client-dev report has the before/after run).
 *
 * Same jsdom-vs-real-browser stubs `EntryDetailSheet.test.tsx`/
 * `SettingsSheet.test.tsx` already document (first two files to mount a real
 * `BottomSheet`) — `ResizeObserver` and a `querySelectorAll` guard around a
 * selector jsdom is stricter about than a real browser.
 */
import { act } from "react";
import { ThemeProvider } from "@toss/tds-mobile";
import { afterEach, describe, expect, it } from "vitest";
import { mountComponent, type MountedComponent } from "../testUtils/mount";
import { EntrySheet, type EntrySheetProps } from "./EntrySheet";

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
    return nativeQuerySelectorAll.call(this, "[data-entry-sheet-test-no-match]");
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

const NOOP_PROPS: EntrySheetProps = {
  open: true,
  today: "2026-08-15",
  onClose: () => {},
  onSave: () => {},
};

function renderSheet(props: Partial<EntrySheetProps> = {}): void {
  const element = (
    <ThemeProvider>
      <EntrySheet {...NOOP_PROPS} {...props} />
    </ThemeProvider>
  );
  if (mounted === null) mounted = mountComponent(element);
  else act(() => mounted!.root.render(element));
}

function findButton(text: string): HTMLButtonElement | undefined {
  return [...document.body.querySelectorAll("button")].find((b) => b.textContent === text);
}

/** The sheet's own dimmer — TDS renders it `role="button" aria-label="닫기"`, never `inert` on itself (only the confirm's own dimmer is, see the hook's own doc). */
function sheetDimmer(): HTMLElement {
  return [...document.body.querySelectorAll<HTMLElement>('[aria-label="닫기"]')].find((el) => !el.hasAttribute("inert"))!;
}

/** Any leftover `inert` attribute above `sheetDimmer()`, stopping at `document.body` — what the hook is supposed to clear. */
function hasInertAncestorAboveSheetDimmer(): boolean {
  let node: HTMLElement | null = sheetDimmer().parentElement;
  while (node && node !== document.body) {
    if (node.hasAttribute("inert")) return true;
    node = node.parentElement;
  }
  return false;
}

describe("EntrySheet — nested-confirm backdrop fix (T016/T017)", () => {
  it("touching a field, dismissing the backdrop, then canceling the unsaved-changes confirm leaves the sheet's own backdrop tappable again", async () => {
    renderSheet();

    // Touch a field so `touched` is true — backdrop-tap must confirm, not close outright.
    const memoInput = document.body.querySelector<HTMLInputElement>('input[placeholder="메모 (선택)"]')!;
    const nativeValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
      nativeValueSetter.call(memoInput, "iced americano");
      memoInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    // Fire the dimmer click — opens the nested "입력한 내용이 사라져요" confirm.
    act(() => {
      sheetDimmer().click();
    });
    expect(findButton("계속 입력")).not.toBeUndefined(); // the confirm really opened

    // Cancel via 계속 입력 — the confirm closes (TDS animates the actual DOM
    // teardown, so its nodes may still briefly exist), the sheet stays open.
    act(() => {
      findButton("계속 입력")!.click();
    });

    // Advance one frame — the hook's own fix runs on a `requestAnimationFrame`.
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(hasInertAncestorAboveSheetDimmer()).toBe(false);
  });
});
