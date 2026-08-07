/**
 * DIRECTOR-APPROVED — MVP-SPEC.md §9 rule 3.
 *
 * This is the live balance config. `balance.placeholder.ts` is now historical
 * record only — never edited in place, never re-imported by app code — so the
 * diff between that file and this one is the permanent record of what the
 * director actually decided. See MVP-SPEC §13 D-3/D-4/D-5/D-13/D-14/D-15.
 *
 * Changed from placeholder:
 *  - dailyBuildSlots: 5 -> 10 (director's explicit change, 2026-08-07).
 *    Building past 10/day is intended to require a paid unlock later
 *    (see docs/spec/ADDENDUM-03-monetization.md, not-yet-approved) — that
 *    monetization system is out of scope here. This ships only the flat cap.
 * Everything else is unchanged from the placeholder (materialQueueMax was
 * left out of the director's question — defaulted to unchanged, per the
 * rest of the dials the director didn't ask to touch).
 */
import type { SavingCategoryId } from "./types";

export const BALANCE = {
  BALANCE_UNSET: false,

  dailyBuildSlots: 10, // director-approved, 2026-08-07 — D-3
  materialQueueMax: 10, // unchanged from placeholder — D-14
  tierThresholds: [0, 10, 30, 80, 200], // unchanged from placeholder — D-3
  moodPaceThresholds: [0.9, 1.1], // unchanged from placeholder — D-4
  variantsPerCategory: 3, // unchanged from placeholder — D-5
  savingsTowerSegments: [
    // unchanged from placeholder — D-13. Default ladder for every 저축 블록
    // structure (ADDENDUM-01 §2.5), not a single tower.
    100_000, 300_000, 600_000, 1_000_000, 2_000_000, 4_000_000, 7_000_000, 10_000_000,
  ],
  // unchanged from placeholder — no per-structure override.
  savingsStructureSegments: {} as Partial<Record<SavingCategoryId, readonly number[]>>,
  noSpendDayCostsSlot: true, // unchanged from placeholder — D-15
} as const;
