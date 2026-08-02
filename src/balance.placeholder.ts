/**
 * PLACEHOLDER — NOT A DESIGN DECISION.
 * MVP-SPEC.md §9.
 *
 * Every value here exists only so the app runs before the director's balance
 * pass. Sourced values are marked [ref]; the rest are arbitrary. Do not quote
 * any of these as design, in a report, a screenshot caption, or a review.
 * See MVP-SPEC §13 D-3/D-4/D-5/D-13/D-14/D-15.
 *
 * Enforcement (spec §9, all Gate-relevant, not advisory):
 *  1. While BALANCE_UNSET === true the app must show a persistent,
 *     non-dismissable dev banner "밸런스 미승인 — 임시 수치" (wired in the UI task).
 *  2. A build with BALANCE_UNSET === true must not pass Gate 3.
 *  3. The director's approved values land as a separate `balance.approved.ts`
 *     that sets the flag false. Placeholders are never edited in place.
 */
export const BALANCE = {
  BALANCE_UNSET: true, // flipped to false ONLY by the director's approved values file

  dailyBuildSlots: 5, // [ref] Fortune City's real starting value (max 7 via Builder's Hub) — D-3
  materialQueueMax: 10, // arbitrary — D-14
  tierThresholds: [0, 10, 30, 80, 200], // arbitrary, 5 slots — D-3
  moodPaceThresholds: [0.9, 1.1], // arbitrary, yields 3 buckets — D-4
  variantsPerCategory: 3, // art-budget figure, matches §6.1 order — D-5
  savingsTowerSegments: [
    // arbitrary cumulative KRW thresholds, 8 segments — D-13
    100_000, 300_000, 600_000, 1_000_000, 2_000_000, 4_000_000, 7_000_000, 10_000_000,
  ],
  noSpendDayCostsSlot: true, // design rule, confirm — D-15
} as const;

// TOWN_COLUMNS is deliberately NOT here: per spec §9 it is a layout constant
// (how wide the grid renders), not a pacing dial. It lives next to
// `plotFromIndex` in selectors.ts instead (spec §5 F2 / §13 trade-off 9).
