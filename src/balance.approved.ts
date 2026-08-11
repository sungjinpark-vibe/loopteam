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
 *  - expPerLevel/maxLevel/expAmountTiers (ADDENDUM-04, building EXP):
 *    director-confirmed 2026-08-09, closing §7 Option 3 — EXP scales with
 *    amount for every entry type, no per-type branching.
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

  // --- ADDENDUM-04 (building EXP). director-confirmed, 2026-08-09. ---
  expPerLevel: 3, // director-confirmed, 2026-08-09 — EXP needed per visible level
  maxLevel: 5, // director-confirmed, 2026-08-09 — visual cap only; EXP past it still counts toward tier
  // ADDENDUM-04 §7 — CLOSED, 2026-08-09: director chose Option 3. EXP scales
  // with amount for ALL entry types (저축/수입/지출 alike — `expGainFor` stays
  // type-agnostic, no per-type branching anywhere). Gate-3 finding #2
  // ("overspending has zero mechanical consequence") is now a required
  // follow-up, not just an open caveat — see the doc.
  expAmountTiers: [
    [10_000, 1],
    [50_000, 2],
    [200_000, 3],
    [Infinity, 5],
  ] as readonly (readonly [number, number])[] | null,

  // --- ADDENDUM-05 (F-ECON earn loop). PM-DECISIONS §F-ECON, 2026-08-10. ---
  // Sane starting values, NOT director-confirmed — tunable dials, same
  // discipline as `balance.placeholder.ts`'s own values before D-3 etc.
  // Pacing target from the spec: a normal user (a few entries/day, an
  // occasional 무지출 day) affords a first cosmetic within about a week, and
  // the catalogue (priced by W5, not fixed here) doesn't exhaust in under
  // about two months. At these dials a ~3 build/day + ~2 no-spend/week user
  // earns roughly 70-90 seeds/week, ~500-600/month.
  seedAwards: {
    build: 3, // per entry-sourced build, including a queue drain (§F-ECON table row 1)
    nospend: 8, // larger than a build — the behaviour the app most wants to reward
    tier: 25, // reuses the existing streak-tier threshold crossing, no new counter
    // Indexed by `MonthSummary.outcomeBucket` (settlementActions.ts's own
    // convention: 0 = no data, 1 = best pace .. 3 = worst pace). Scales DOWN
    // as the outcome worsens — a below-budget month is rewarded more than an
    // over-budget one, but every REAL month (bucket > 0) still earns something.
    settlementByOutcomeBucket: [0, 20, 12, 6],
    // --- ADDENDUM-06 §3.2 (명당 prime-lot standing bonus). Not director-confirmed yet — tunable dial. ---
    primeLot: 3, // seeds per building standing on a prime lot, per settlement
    primeLotMax: 30, // ceiling, so a very large town cannot farm this into the shop's price floor
  },
} as const;
