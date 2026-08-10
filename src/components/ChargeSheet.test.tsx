/**
 * ChargeSheet (S8 캐시 충전 STUB) tests — PM-DECISIONS §F-ECON absolute rules,
 * each independently gate-failing:
 *  - no fake success path (no seeds granted, no "결제 완료"),
 *  - tapping any package shows exactly the one frozen message and nothing
 *    else,
 *  - `granite.config.ts`'s `permissions` array stays untouched,
 *  - no file under `src/` ever imports a payment bridge symbol.
 *
 * Same mount harness as `SettingsSheet.test.tsx`/`ShopSheet.test.tsx`.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "react";
import { ThemeProvider } from "@toss/tds-mobile";
import { afterEach, describe, expect, it } from "vitest";
import { mountComponent, type MountedComponent } from "../testUtils/mount";
import { ChargeSheet } from "./ChargeSheet";

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
    return nativeQuerySelectorAll.call(this, "[data-charge-sheet-test-no-match]");
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

function render(onClose: () => void = () => {}): void {
  const element = (
    <ThemeProvider>
      <ChargeSheet open onClose={onClose} />
    </ThemeProvider>
  );
  if (mounted === null) mounted = mountComponent(element);
  else act(() => mounted!.root.render(element));
}

function findButton(text: string): HTMLButtonElement | undefined {
  return [...document.body.querySelectorAll("button")].find((b) => b.textContent?.includes(text));
}

describe("ChargeSheet", () => {
  it("lists packages with a KRW price, never a seed<->KRW rate laid out side by side", () => {
    render();
    expect(document.body.textContent).toContain("새싹팩");
    expect(document.body.textContent).toContain("1,200원");
    // the seed count is prose, never a bare figure formatted like the price
    expect(document.body.textContent).toContain("씨앗 500개가 들어있어요");
  });

  it("shows a static not-live-yet notice regardless of any tap", () => {
    render();
    expect(document.body.textContent).toContain("충전 기능은 준비 중이에요");
  });

  it("tapping a package's primary action shows exactly the one frozen message and nothing else", () => {
    render();
    expect(document.body.textContent).not.toContain("토스 결제 연동은 추후 지원됩니다");
    act(() => findButton("1,200원")!.click());
    const matches = document.body.textContent!.match(/토스 결제 연동은 추후 지원됩니다/g) ?? [];
    expect(matches).toHaveLength(1);
    // no fake success anywhere
    expect(document.body.textContent).not.toContain("결제 완료");
    expect(document.body.textContent).not.toContain("구매 완료");
  });

  it("tapping does not close the sheet or call any callback beyond showing the message", () => {
    let closed = false;
    render(() => (closed = true));
    act(() => findButton("3,000원")!.click());
    expect(closed).toBe(false);
  });
});

describe("payment bridge ban (ADDENDUM-05 §6 absolute rules)", () => {
  const SRC_DIR = dirname(dirname(fileURLToPath(import.meta.url))); // src/components -> src

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(full);
      if (!/\.(ts|tsx)$/.test(entry.name)) return [];
      return [full];
    });
  }

  // Matches an actual IMPORT or CALL of a banned symbol, not a doc-comment
  // that merely names it (ChargeSheet.tsx's own header, and this file's own
  // test titles, both legitimately mention the banned names in prose).
  function importsOrCallsBannedSymbol(text: string): boolean {
    const namedImport = /\{[^}]*\b(?:checkoutPayment|requestTossPayPaysBilling)\b[^}]*\}\s*from/;
    const callSite = /\b(?:checkoutPayment|requestTossPayPaysBilling)\s*\(/;
    return namedImport.test(text) || callSite.test(text);
  }

  it("no file under src/ imports or calls checkoutPayment or requestTossPayPaysBilling", () => {
    const offenders = sourceFiles(SRC_DIR).filter((f) => importsOrCallsBannedSymbol(readFileSync(f, "utf-8")));
    expect(offenders).toEqual([]);
  });

  it("ChargeSheet.tsx never imports @apps-in-toss/web-bridge", () => {
    const text = readFileSync(join(SRC_DIR, "components", "ChargeSheet.tsx"), "utf-8");
    expect(text).not.toMatch(/from\s*["']@apps-in-toss\/web-bridge["']/);
  });

  it("granite.config.ts's permissions array is still empty", () => {
    const repoRoot = dirname(SRC_DIR);
    const text = readFileSync(join(repoRoot, "granite.config.ts"), "utf-8");
    expect(text).toMatch(/permissions:\s*\[\s*\]/);
  });
});
