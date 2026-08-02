/**
 * Android/browser back guard for an in-page modal (extracted from
 * `EntrySheet.tsx`, round-5 fix — C3 finding: the guard is a self-contained
 * effect with global side effects on the host's back stack and wants its own
 * hook so it is testable independent of the form; see `useBackGuard.test.tsx`).
 *
 * §10.4: the host app owns the top-level back gesture, so an unhandled
 * hardware/gesture back pops the whole mini-app, not an open sheet. Pushing
 * one history entry while `open` turns that gesture into a `popstate` this
 * hook can catch — the standard WebView-safe way to make an in-page modal
 * consume one "back" locally, no native bridge required.
 *
 * `touched`/`onBack` are read through a ref, synced every render, so the
 * push/listen effect itself stays keyed on `[open]` alone — the caller does
 * not need to memoize `onBack` to avoid spurious pushState/back churn.
 */
import { useEffect, useRef } from "react";

export function useBackGuard(open: boolean, touched: boolean, onBack: (touched: boolean) => void): void {
  const latestRef = useRef({ touched, onBack });
  useEffect(() => {
    latestRef.current = { touched, onBack };
  });

  const guardPushed = useRef(false);
  useEffect(() => {
    if (!open) return;
    window.history.pushState({ entrySheet: true }, "");
    guardPushed.current = true;

    function onPopState() {
      guardPushed.current = false; // the browser already popped it
      const isTouched = latestRef.current.touched;
      if (isTouched) {
        // Re-arm immediately so the confirm dialog's "keep editing" choice
        // still has back-press protection.
        window.history.pushState({ entrySheet: true }, "");
        guardPushed.current = true;
      }
      latestRef.current.onBack(isTouched);
    }

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (guardPushed.current) {
        guardPushed.current = false;
        window.history.back(); // closed some other way (save/backdrop/confirm) — consume the guard entry
      }
    };
  }, [open]);
}
