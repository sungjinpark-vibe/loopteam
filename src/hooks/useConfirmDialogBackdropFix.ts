/**
 * Works around a vendor bug in `@toss/tds-mobile` (v2.5.1, shipped minified —
 * no source to patch): nesting a `ConfirmDialog` on top of an open
 * `BottomSheet` correctly marks the sheet's own backdrop `inert` while the
 * confirm is stacked on top (so the sheet can't be tapped through the
 * confirm), but CANCELLING the confirm never clears that `inert` back —
 * confirmed with `document.elementFromPoint`/CDP `DOM.getNodeForLocation`
 * (returns nothing at the backdrop's own coordinates) and by watching
 * `getComputedStyle(dimmer).interactivity` flip `auto` -> `inert` on nested
 * open and simply stay `inert` forever after the nested dialog closes — a
 * forced reflow does not help, so it is a real leftover DOM attribute, not a
 * stale paint cache. Keyboard/gesture dismissal is unaffected (`useBackGuard`
 * still works); only pointer hit-testing on the backdrop is blocked.
 *
 * Found independently in sheets that nest a `ConfirmDialog` inside their own
 * `BottomSheet` (`EntryDetailSheet`'s delete-confirm, T012; `SettingsSheet`'s
 * 초기화/가져오기 confirms, T013; `EntrySheet`'s close-with-unsaved-changes
 * confirm, T016) — same TDS pairing, same bug, so the fix lives once here
 * rather than being copy-pasted into each sheet.
 *
 * Fix: once a nested confirm's `open` flips true -> false while the outer
 * sheet is still `open`, wait one frame for React to finish committing the
 * confirm's own portal teardown (TDS's own — buggy — cleanup runs in that
 * same window), then strip any leftover `inert` attribute among the SHEET's
 * own backdrop's ancestors, stopping at `document.body`.
 *
 * T017 round 3: the sheet's own backdrop can't be found by inspecting live
 * DOM state once the confirm is open — while it is, there are TWO
 * `[aria-label="닫기"]` nodes in the document (the sheet's own dimmer and
 * the confirm's own). Rounds 1 and 2 each tried to tell them apart by some
 * attribute one node was assumed to carry and the other wasn't (document
 * order, then `inert` directly on the node) — both assumptions were
 * contradicted by a real-Chromium trace on a LATER attempt (an attribute
 * that looked stable in one build/timing turned out not to be), which is
 * exactly the failure mode to stop repeating: whatever TDS puts on these
 * nodes internally is undocumented and has already been observed to vary.
 * So this hook stops inspecting vendor DOM state altogether and CAPTURES a
 * ref to the sheet's own backdrop while `confirmOpen` is `false` — the only
 * moment exactly one `[aria-label="닫기"]` node exists in the document at
 * all, so there is nothing to disambiguate yet. On the confirm's
 * `open -> false` transition, cleanup walks up from that remembered node
 * instead of re-querying the DOM, which is correct no matter how many
 * `닫기`-labeled nodes coexist or what attributes vendor code puts on them
 * (verified live in Chromium at all three call sites, T017 round 3: after
 * cancelling the nested confirm, `document.elementFromPoint` over the
 * dimmer's own coverage area resolves back to the dimmer itself).
 */
import { useEffect, useLayoutEffect, useRef } from "react";

export function useConfirmDialogBackdropFix(sheetOpen: boolean, confirmOpen: boolean): void {
  const wasConfirmOpen = useRef(confirmOpen);
  const sheetDimmerRef = useRef<Element | null>(null);

  // Capture the sheet's OWN backdrop while no nested confirm is open — the
  // only moment exactly one `[aria-label="닫기"]` node exists in the
  // document (the confirm's own dimmer isn't mounted yet). Runs before paint
  // so it's captured on the render right before a later render flips
  // `confirmOpen` true.
  useLayoutEffect(() => {
    if (!sheetOpen || confirmOpen) return;
    const dimmers = document.querySelectorAll('[aria-label="닫기"]');
    if (dimmers.length === 1) sheetDimmerRef.current = dimmers[0];
  }, [sheetOpen, confirmOpen]);

  useEffect(() => {
    const justClosed = wasConfirmOpen.current && !confirmOpen;
    wasConfirmOpen.current = confirmOpen;
    if (!justClosed || !sheetOpen) return;

    const raf = requestAnimationFrame(() => {
      let sheetDimmer = sheetDimmerRef.current;
      // The ref should always be populated by the time a confirm closes —
      // it's (re)captured on every render where the confirm isn't open,
      // which necessarily includes the render right before this one opened
      // it. Fallback only for a hook instance that mounted with the confirm
      // ALREADY open (so the capture effect above never got a
      // confirm-closed render to run on): safe only when there is exactly
      // one candidate to begin with — otherwise leave the DOM alone rather
      // than guess.
      if (sheetDimmer === null || !sheetDimmer.isConnected) {
        const dimmers = document.querySelectorAll('[aria-label="닫기"]');
        sheetDimmer = dimmers.length === 1 ? dimmers[0] : null;
      }
      let node = sheetDimmer?.parentElement ?? null;
      while (node && node !== document.body) {
        if (node.hasAttribute("inert")) node.removeAttribute("inert");
        node = node.parentElement;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [confirmOpen, sheetOpen]);
}
