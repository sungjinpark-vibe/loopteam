/**
 * Gate-3 round-3 fix (near-unanimous panel finding): `BuildingDetailSheet`
 * ignored Escape while its sibling `EntrySheet` wires it (see
 * `EntrySheet.tsx`'s own Escape effect) — in the harness this left the sheet
 * open and blocked further FAB clicks until the 닫기 button was used.
 * `MonumentDetailSheet` has the identical gap, just never hit by a run that
 * happened to tap a monument. Both are read-only (no form/`touched` state to
 * gate on), so this is the simple case of `EntrySheet`'s effect with no
 * confirm-dialog branch — one hook so any future read-only sheet gets it by
 * just calling this instead of re-deriving the same `keydown` effect.
 */
import { useEffect } from "react";

export function useEscapeToClose(open: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);
}
