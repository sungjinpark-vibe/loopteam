/**
 * `useBackGuard` was extracted from `EntrySheet.tsx` specifically because the
 * original inline effect "cannot be tested independently of the form"
 * (round-4 lead finding, C3). This is that independent test.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useBackGuard } from "./useBackGuard";

let container: HTMLDivElement;
let root: Root;

function Harness({ open, touched, onBack }: { open: boolean; touched: boolean; onBack: (touched: boolean) => void }) {
  useBackGuard(open, touched, onBack);
  return null;
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("useBackGuard", () => {
  // A real hardware/gesture back both pops one history entry AND fires
  // `popstate`; jsdom's synthetic `dispatchEvent(new PopStateEvent(...))`
  // only does the latter (it does not change `history.length`), so these
  // assertions compare against the length right after open (not `pushState`
  // call count) rather than emulate real browser navigation.
  it("pushes one history entry while open, and calls onBack(false) on a back gesture without re-arming", () => {
    const calls: boolean[] = [];

    act(() => {
      root.render(<Harness open={true} touched={false} onBack={(t) => calls.push(t)} />);
    });
    const afterOpenLength = window.history.length;

    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(calls).toEqual([false]);
    // Not touched — the guard does not re-push.
    expect(window.history.length).toBe(afterOpenLength);
  });

  it("re-arms the guard (pushes again) when the form is touched at the moment of the back gesture", () => {
    const calls: boolean[] = [];

    act(() => {
      root.render(<Harness open={true} touched={true} onBack={(t) => calls.push(t)} />);
    });
    const afterOpenLength = window.history.length;

    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(calls).toEqual([true]);
    // Touched — the guard pushes a fresh entry to keep back-press protection while the confirm dialog is up.
    expect(window.history.length).toBe(afterOpenLength + 1);
  });

  it("does nothing while closed", () => {
    const calls: boolean[] = [];
    const startLength = window.history.length;
    act(() => {
      root.render(<Harness open={false} touched={false} onBack={(t) => calls.push(t)} />);
    });
    expect(window.history.length).toBe(startLength);
  });
});
