/**
 * The shared "camera follows the thing that just happened" scroll — smooth,
 * centered on both axes. Three call sites now use this exact call
 * (`TownGrid.tsx`'s `justBuiltId` effect, `SavingsRow.tsx`'s `justGrew`
 * effect, and the guided-highlight `spotlight` effect below) — each keeps
 * its own `useEffect`/dependency array (their trigger conditions genuinely
 * differ: `TownGrid`'s also depends on `zoomedOut` so it re-measures after a
 * zoom-state flip), only the DOM action itself is factored out here so it
 * isn't hand-copied a third time.
 */
export function scrollTileIntoView(el: Element | null | undefined): void {
  el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
}
