/**
 * `useConfirmDialogBackdropFix` — see the hook's own file doc for the vendor
 * bug it works around (T012/T013 finding, fixed once here for both
 * `EntryDetailSheet` and `SettingsSheet`).
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
});
