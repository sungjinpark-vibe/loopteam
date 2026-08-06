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
 * T017 finding C2: while the confirm is still open (or mid-teardown, the
 * exact window this hook fires in), there are TWO `[aria-label="닫기"]`
 * nodes in the document — the sheet's own dimmer AND the confirm's own
 * dimmer — so a bare `document.querySelector` picks whichever the browser
 * happens to return first, which is a document-order accident, not a
 * guarantee. Disambiguated by a DOM signal verified live (component-test DOM
 * dump, both immediately after cancel and pre-raf): the confirm's own dimmer
 * always carries `inert` DIRECTLY ON ITSELF while its dialog is open/closing
 * (that's Radix's normal, correctly-self-cleaning aria-hiding of the confirm
 * layer — unrelated to the vendor bug), while the SHEET's own dimmer never
 * does — only an ANCESTOR of it does, and only because of the bug this hook
 * exists to undo. Filtering to the one `[aria-label="닫기"]` node that is
 * NOT itself `inert` picks the sheet's backdrop deterministically regardless
 * of how many `닫기`-labeled nodes exist or what order they're in.
 */
import { useEffect, useRef } from "react";

export function useConfirmDialogBackdropFix(sheetOpen: boolean, confirmOpen: boolean): void {
  const wasConfirmOpen = useRef(confirmOpen);

  useEffect(() => {
    const justClosed = wasConfirmOpen.current && !confirmOpen;
    wasConfirmOpen.current = confirmOpen;
    if (!justClosed || !sheetOpen) return;

    const raf = requestAnimationFrame(() => {
      const dimmers = document.querySelectorAll('[aria-label="닫기"]');
      const sheetDimmer = [...dimmers].find((el) => !el.hasAttribute("inert"));
      let node = sheetDimmer?.parentElement ?? null;
      while (node && node !== document.body) {
        if (node.hasAttribute("inert")) node.removeAttribute("inert");
        node = node.parentElement;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [confirmOpen, sheetOpen]);
}
