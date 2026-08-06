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

// The sheet's own backdrop: a `[aria-label="닫기"]` node nested two levels
// under a wrapper (TDS's real structure), itself a child of document.body.
// Starts WITHOUT `inert` — the vendor bug (reproduced via `stick()`, called
// once the nested confirm "opens") is what leaves the wrapper `inert` after
// the confirm closes; that's the state this hook has to undo.
function mountSheetDimmer(): { wrapper: HTMLElement; dimmer: HTMLElement; stick: () => void } {
  const wrapper = document.createElement("div");
  const middle = document.createElement("div");
  const dimmer = document.createElement("div");
  dimmer.setAttribute("aria-label", "닫기");
  middle.appendChild(dimmer);
  wrapper.appendChild(middle);
  document.body.appendChild(wrapper);
  return { wrapper, dimmer, stick: () => wrapper.setAttribute("inert", "") };
}

// T017 round 3: reproduces the real-browser DOM shape (verified live via a
// Chrome CDP trace) — the confirm's own `[aria-label="닫기"]` dimmer is a
// DIRECT CHILD of `document.body`, and while open/closing it carries
// `data-inert-ed`/`data-state` — NOT an `inert` attribute on itself (round
// 2's "confirm's own dimmer always carries inert on itself" was false; this
// is the corrected fixture). Inserted as `document.body`'s FIRST child so it
// sorts before the sheet's own dimmer in document order — a live
// `document.querySelector`/`.find()`-based lookup would reach for this node
// first, which is the wrong one.
function mountConfirmOwnDimmer(): HTMLElement {
  const confirmDimmer = document.createElement("div");
  confirmDimmer.setAttribute("aria-label", "닫기");
  confirmDimmer.setAttribute("data-inert-ed", "true");
  confirmDimmer.setAttribute("data-state", "closed");
  document.body.insertBefore(confirmDimmer, document.body.firstChild);
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
    const { wrapper, stick } = mountSheetDimmer();

    act(() => {
      root.render(<Harness sheetOpen={true} confirmOpen={false} />); // captures the ref while it's the only dimmer
    });

    stick(); // vendor bug: opening the nested confirm marks the sheet's own dimmer's ancestor inert
    act(() => {
      root.render(<Harness sheetOpen={true} confirmOpen={true} />);
    });
    expect(wrapper.hasAttribute("inert")).toBe(true); // untouched while the confirm is still open

    act(() => {
      root.render(<Harness sheetOpen={true} confirmOpen={false} />);
    });
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(wrapper.hasAttribute("inert")).toBe(false);
  });

  it("does nothing when the sheet itself closed along with the confirm", async () => {
    const { wrapper, stick } = mountSheetDimmer();
    act(() => {
      root.render(<Harness sheetOpen={true} confirmOpen={false} />);
    });
    stick();
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
    expect(wrapper.hasAttribute("inert")).toBe(true);
  });

  it("does nothing while the confirm has not transitioned closed", async () => {
    const { wrapper, stick } = mountSheetDimmer();
    stick(); // pretend already stuck from a previous cycle — no fresh close transition happened in this hook instance
    act(() => {
      root.render(<Harness sheetOpen={true} confirmOpen={false} />);
    });
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(wrapper.hasAttribute("inert")).toBe(true);
  });

  it("resolves to the sheet's own dimmer via the captured ref, not live DOM state — T017 round 3's exact repro", async () => {
    const { wrapper, dimmer, stick } = mountSheetDimmer();

    // Ref capture happens here, BEFORE the confirm (and its own dimmer)
    // exist — exactly one `[aria-label="닫기"]` node is in the document.
    act(() => {
      root.render(<Harness sheetOpen={true} confirmOpen={false} />);
    });

    // Confirm opens: its own dimmer appears too, sorted FIRST in document
    // order, and carries none of the round-2 `inert`-on-self signal.
    const confirmDimmer = mountConfirmOwnDimmer();
    stick();
    act(() => {
      root.render(<Harness sheetOpen={true} confirmOpen={true} />);
    });

    act(() => {
      root.render(<Harness sheetOpen={true} confirmOpen={false} />);
    });
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(wrapper.hasAttribute("inert")).toBe(false); // resolved via the captured ref, not a live query
    expect(dimmer.isConnected).toBe(true);
    expect(confirmDimmer.hasAttribute("data-inert-ed")).toBe(true); // the confirm's own dimmer is untouched — never walked
  });
});
