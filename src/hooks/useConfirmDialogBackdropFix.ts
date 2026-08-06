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
 * Found independently in two sheets that nest a `ConfirmDialog` inside their
 * own `BottomSheet` (`EntryDetailSheet`'s delete-confirm, T012; `SettingsSheet`'s
 * 초기화/가져오기 confirms, T013) — same TDS pairing, same bug, so the fix lives
 * once here rather than being copy-pasted into each sheet.
 *
 * Fix: once a nested confirm's `open` flips true -> false while the outer
 * sheet is still `open`, wait one frame for React to finish committing the
 * confirm's own portal teardown (TDS's own — buggy — cleanup runs in that
 * same window), then walk up from the sheet's own backdrop (uniquely
 * identified in this app by TDS's built-in `aria-label="닫기"` — there is
 * only ever one such dismiss-backdrop mounted at a time, verified live) and
 * strip any leftover `inert` attribute among its ancestors, stopping at
 * `document.body`.
 */
import { useEffect, useRef } from "react";

export function useConfirmDialogBackdropFix(sheetOpen: boolean, confirmOpen: boolean): void {
  const wasConfirmOpen = useRef(confirmOpen);

  useEffect(() => {
    const justClosed = wasConfirmOpen.current && !confirmOpen;
    wasConfirmOpen.current = confirmOpen;
    if (!justClosed || !sheetOpen) return;

    const raf = requestAnimationFrame(() => {
      const dimmer = document.querySelector('[aria-label="닫기"]');
      let node = dimmer?.parentElement ?? null;
      while (node && node !== document.body) {
        if (node.hasAttribute("inert")) node.removeAttribute("inert");
        node = node.parentElement;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [confirmOpen, sheetOpen]);
}
