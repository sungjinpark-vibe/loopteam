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
import { SettingsSheet, type ImportOutcome, type SettingsSheetProps } from "./SettingsSheet";

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
  const exportCalls: number[] = [];
  const importCalls: string[] = [];
  let importResult: ImportOutcome = { ok: true };
  const props: SettingsSheetProps = {
    open: true,
    townName: "우리 동네",
    budgetKrw: null,
    onClose: () => onClose.count++,
    onSaveTownName: (n) => savedNames.push(n),
    onSaveBudget: (b) => savedBudgets.push(b),
    onResetAll: () => resetCount++,
    onExport: async () => {
      exportCalls.push(1);
      return { json: "{}", filename: "town-export-test.json" };
    },
    onImport: async (raw) => {
      importCalls.push(raw);
      return importResult;
    },
  };
  return {
    props,
    onClose,
    savedNames,
    savedBudgets,
    getResetCount: () => resetCount,
    exportCalls,
    importCalls,
    setImportResult: (r: typeof importResult) => (importResult = r),
  };
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

// jsdom implements neither (this file's own header note, same class of gap as
// EntryDetailSheet.test.tsx's own) — stubbed so `downloadJsonFile` (real
// browser API, only reachable via 내보내기) doesn't throw under test.
(URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL ??= () => "blob:mock";
(URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL ??= () => {};

function fileInput(): HTMLInputElement {
  return document.body.querySelector<HTMLInputElement>(".settings-file-input")!;
}

/** Simulates picking `file` in the native file input, then flushes the microtask `file.text()` runs on. */
async function selectFile(file: File): Promise<void> {
  await act(async () => {
    Object.defineProperty(fileInput(), "files", { value: [file], configurable: true });
    fileInput().dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function clickAndFlush(button: HTMLButtonElement): Promise<void> {
  await act(async () => {
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("SettingsSheet — F12 내보내기/가져오기", () => {
  it("내보내기 tap calls onExport and triggers a download with no confirm (non-destructive)", async () => {
    const { props, exportCalls } = makeCalls();
    render(props);

    await clickAndFlush(findButton("내보내기")!);

    expect(exportCalls).toEqual([1]);
  });

  it("가져오기: picking a file opens a destructive-action confirm; canceling calls onImport zero times and leaves the sheet open", async () => {
    const { props, importCalls, onClose } = makeCalls();
    render(props);

    await selectFile(new File(["{\"schemaVersion\":1}"], "export.json", { type: "application/json" }));
    expect(findButton("덮어쓰기")).toBeTruthy(); // the confirm dialog is open

    act(() => {
      findButton("취소")!.click();
    });

    expect(importCalls).toEqual([]);
    expect(onClose.count).toBe(0);
  });

  it("가져오기: confirming calls onImport with the file's text; a successful import closes the sheet", async () => {
    const { props, importCalls, onClose } = makeCalls();
    render(props);
    const raw = '{"schemaVersion":1,"core":{}}';

    await selectFile(new File([raw], "export.json", { type: "application/json" }));
    await clickAndFlush(findButton("덮어쓰기")!);

    expect(importCalls).toEqual([raw]);
    expect(onClose.count).toBe(1);
  });

  it("가져오기: a rejected import (bad schemaVersion / malformed JSON) shows a visible error and never closes the sheet", async () => {
    const { props, onClose, setImportResult } = makeCalls();
    setImportResult({ ok: false, error: "지원하지 않는 데이터 버전이에요." });
    render(props);

    await selectFile(new File(["not valid json"], "export.json", { type: "application/json" }));
    await clickAndFlush(findButton("덮어쓰기")!);

    expect(onClose.count).toBe(0);
    expect(document.body.querySelector(".settings-import-error")?.textContent).toBe("지원하지 않는 데이터 버전이에요.");
  });

  // Round-1 finding C4 #2 — the row must be visibly non-interactive and not
  // re-triggerable while a (potentially slow, dense-town) export is in flight.
  it("내보내기: disables and relabels the row while in flight, and ignores a second tap until it resolves", async () => {
    const { props } = makeCalls();
    let resolveExport: ((v: { json: string; filename: string }) => void) | null = null;
    let callCount = 0;
    props.onExport = () =>
      new Promise((resolve) => {
        callCount++;
        resolveExport = resolve;
      });
    render(props);

    act(() => {
      findButton("내보내기")!.click();
    });
    expect(findButton("내보내는 중…")).toBeTruthy();
    expect(findButton("내보내는 중…")!.disabled).toBe(true);

    // A second tap while still pending must not start a second export.
    act(() => {
      findButton("내보내는 중…")!.click();
    });
    expect(callCount).toBe(1);

    await act(async () => {
      resolveExport!({ json: "{}", filename: "x.json" });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(findButton("내보내기")).toBeTruthy(); // back to normal, re-enabled
  });

  // Round-1 finding C3 — `handleExportClick` had no try/catch, so a throwing
  // export produced an unhandled rejection and no user feedback at all.
  it("내보내기: a throwing export shows a visible error instead of an unhandled rejection, and re-enables the row", async () => {
    const { props } = makeCalls();
    props.onExport = (): Promise<{ json: string; filename: string }> => {
      throw new Error("boom");
    };
    render(props);

    await clickAndFlush(findButton("내보내기")!);

    expect(document.body.querySelector(".settings-import-error")?.textContent).toBe("내보내기에 실패했어요. 다시 시도해주세요.");
    expect(findButton("내보내기")).toBeTruthy(); // not stuck on "내보내는 중…"
  });

  // Round-1 finding C3 — `void file.text().then(...)` had no `.catch`, so an
  // unreadable/removed picked file silently did nothing.
  it("가져오기: an unreadable file shows a visible error instead of silently doing nothing", async () => {
    const { props, importCalls } = makeCalls();
    render(props);
    const unreadable = { text: () => Promise.reject(new Error("cannot read")) } as unknown as File;

    await act(async () => {
      Object.defineProperty(fileInput(), "files", { value: [unreadable], configurable: true });
      fileInput().dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(importCalls).toEqual([]);
    expect(document.body.querySelector(".settings-import-error")?.textContent).toBe("파일을 읽을 수 없어요. 다시 시도해주세요.");
  });
});
