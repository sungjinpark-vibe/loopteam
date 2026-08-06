/**
 * `useConfirmDialogBackdropFix` — see the hook's own file doc for the vendor
 * bug it works around (T012/T013 finding, fixed once here for all three call
 * sites: `EntryDetailSheet`, `SettingsSheet`, and `EntrySheet`, T016/T017).
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useConfirmDialogBackdropFix } from "./useConfirmDialogBackdropFix";

let container: HTMLDivElement;
let root: Root;

function Harness({ sheetOpen, confirmOpen }: { sheetOpen: boolean; confirmOpen: boolean }) {
  useConfirmDialogBackdropFix(sheetOpen, confirmOpen);
  return null;
}

// Reproduces the exact stuck shape found live: a `[aria-label="닫기"]`
// backdrop nested two levels under an `inert` wrapper (TDS's real structure),
// itself under document.body.
function mountStuckDom(): { inertWrapper: HTMLElement; dimmer: HTMLElement } {
  const inertWrapper = document.createElement("div");
  inertWrapper.setAttribute("inert", "");
  const middle = document.createElement("div");
  const dimmer = document.createElement("div");
  dimmer.setAttribute("aria-label", "닫기");
  middle.appendChild(dimmer);
  inertWrapper.appendChild(middle);
  document.body.appendChild(inertWrapper);
  return { inertWrapper, dimmer };
}

// T017 finding C2: reproduces the 2-dimmer window measured live in
// `EntrySheet` (a component-test DOM dump, both immediately after cancel and
// pre-raf) — while the nested confirm is open or mid-teardown, a SECOND
// `[aria-label="닫기"]` node (the confirm's own dimmer) coexists with the
// sheet's own stuck one. Unlike the sheet's, the confirm's own dimmer always
// carries `inert` DIRECTLY ON ITSELF (Radix's own — correctly self-cleaning —
// aria-hiding of the confirm layer), which is exactly the signal the hook
// uses to pick the right node regardless of DOM order. Mounted BEFORE the
// stuck dimmer so a DOM-order-only (`querySelector`-style) lookup would pick
// the wrong one first — this is what actually caught the bug this round.
function mountConfirmOwnDimmer(): HTMLElement {
  const confirmDimmer = document.createElement("div");
  confirmDimmer.setAttribute("aria-label", "닫기");
  confirmDimmer.setAttribute("inert", "");
  document.body.appendChild(confirmDimmer);
  return confirmDimmer;
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.querySelectorAll("[aria-label='닫기']").forEach((el) => el.closest("div")?.remove());
});

describe("useConfirmDialogBackdropFix", () => {
  it("clears a leftover `inert` ancestor once the nested confirm closes while the sheet stays open", async () => {
    const { inertWrapper } = mountStuckDom();

    act(() => {
      root.render(<Harness sheetOpen={true} confirmOpen={true} />);
    });
    expect(inertWrapper.hasAttribute("inert")).toBe(true); // untouched while the confirm is still open

    act(() => {
      root.render(<Harness sheetOpen={true} confirmOpen={false} />);
    });
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(inertWrapper.hasAttribute("inert")).toBe(false);
  });

  it("does nothing when the sheet itself closed along with the confirm", async () => {
    const { inertWrapper } = mountStuckDom();

    act(() => {
      root.render(<Harness sheetOpen={true} confirmOpen={true} />);
    });

    act(() => {
      root.render(<Harness sheetOpen={false} confirmOpen={false} />);
    });
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    // Sheet is gone too — nothing to unstick for it; leave the DOM as-is.
    expect(inertWrapper.hasAttribute("inert")).toBe(true);
  });

  it("does nothing while the confirm has not transitioned closed", async () => {
    const { inertWrapper } = mountStuckDom();

    act(() => {
      root.render(<Harness sheetOpen={true} confirmOpen={false} />);
    });
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    // Never opened -> closed within this hook instance, so no cleanup runs.
    expect(inertWrapper.hasAttribute("inert")).toBe(true);
  });

  it("resolves to the sheet's own dimmer (not the confirm's) when both coexist — T017 finding C2's exact repro", async () => {
    // Mounted FIRST and deliberately BEFORE the stuck one, so any lookup that
    // trusts document order (e.g. a bare `document.querySelector`) would pick
    // this node — the WRONG one — instead of the sheet's.
    const confirmDimmer = mountConfirmOwnDimmer();
    const { inertWrapper } = mountStuckDom();

    act(() => {
      root.render(<Harness sheetOpen={true} confirmOpen={true} />);
    });
    act(() => {
      root.render(<Harness sheetOpen={true} confirmOpen={false} />);
    });
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(inertWrapper.hasAttribute("inert")).toBe(false); // the sheet's own stuck ancestor got cleared
    expect(confirmDimmer.hasAttribute("inert")).toBe(true); // the confirm's own dimmer is untouched — never walked
  });
});
