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
  expPerLevel: 3, // director-confirmed, 2026-08-09 — EXP needed per visible level, untouched
  maxLevel: 5, // director-confirmed, 2026-08-09 — visual cap only, untouched
  // ADDENDUM-04 §7 — CLOSED, 2026-08-09: director chose Option 3. EXP scales
  // with amount for ALL entry types (저축/수입/지출 alike — `expGainFor` stays
  // type-agnostic, no per-type branching anywhere). Gate-3 finding #2
  // ("overspending has zero mechanical consequence") is now a required
  // follow-up, not just an open caveat — see the doc.
  //
  // Gate-3-RERUN retune (2026-08-12) — the bands below (not `expPerLevel`/
  // `maxLevel`, both untouched) superseded per every one of the 5 panelists'
  // #1/TOP FIX finding: combined with the `entryActions.ts` founding-exp fix
  // (the real bug — founding used to store `expGain - 1`, silently eating a
  // whole level), the OLD 10k/50k/200k bands still left every realistic
  // Korean spend below ~50,000원 rendering as an identical Lv.1, because
  // `expPerLevel=3` only has 5 discrete rungs (0/3/6/9/12 exp) and the old
  // table only ever produced exp 1/2/3/5 — never enough to clear more than
  // one rung. These 5 bands map directly onto the panel's own suggested
  // "5k/20k/50k/150k" ladder, one exp rung apart, so a coffee, a lunch, a
  // dinner, and a grocery run each land on a VISIBLY different building
  // within a single day of normal use; 150,000원+ reaches the top rung
  // (Lv.5, `maxLevel`'s hard visual cap — a 150,000원 dinner and a
  // 2,000,000원 purchase read the same from here up, same as any capped
  // system, and is not the flatness the panel flagged).
  expAmountTiers: [
    [5_000, 0],
    [20_000, 3],
    [50_000, 6],
    [150_000, 9],
    [Infinity, 12],
  ] as readonly (readonly [number, number])[] | null,

  // --- ADDENDUM-05 (F-ECON earn loop). PM-DECISIONS §F-ECON, 2026-08-10. ---
  // Sane starting values, NOT director-confirmed — tunable dials, same
  // discipline as `balance.placeholder.ts`'s own values before D-3 etc.
  // Pacing target from the spec: a normal user (a few entries/day, an
  // occasional 무지출 day) affords a first cosmetic within about a week, and
  // the catalogue (priced by W5, not fixed here) doesn't exhaust in under
  // about two months.
  //
  // B4 retune (2026-08-12) — the audited failure was that only an entry which
  // FOUNDS a building paid anything: a grow entry (ADDENDUM-04 §5) and a
  // queued entry (F14) both paid 0, so a mature town (every category already
  // standing, most saves growing) could log for weeks against a 150-seed
  // price floor and stay broke. `entry` below pays the ledger entry itself,
  // `build` stays the separate bonus for the entry that also raised a
  // building. Arithmetic — cheapest sku 150, mid sku 420 (고양이):
  //   normal pace, 3 founding entries/day -> 3*(4+3) = 21/day
  //     -> 150 / 21 = 7.1 days   (a week; ~6 with the one-off tier-1 bonus)
  //     -> 420 / 21 = 20  days   (~3 weeks for a mid item)
  //   HARD one-day ceiling (grinder, every reward path maxed):
  //     10 slot saves * (4+3) = 70
  //   +  25  tier-1 crossing at the 10th building (one-off, thresholds[1]=10)
  //   +  10 queued saves * 4  = 40   (their +3 build bonus lands only on a
  //                                   LATER boot's drain)
  //   = 135  < 150 — the floor cannot be bought in a single sitting. The
  //     ceiling holds because the entry award needs the save to have actually
  //     produced something (built/grew/queued) — see `useTownStore.addEntry`.
  //   month-end settlement (best bucket) pays 120 — a real monthly payout,
  //     ~6 days of normal logging, once per period and idempotent by period.
  seedAwards: {
    entry: 4, // per ledger entry that built, grew, or queued something (B4)
    build: 3, // per entry-sourced build, including a queue drain (§F-ECON table row 1)
    nospend: 8, // larger than a build — the behaviour the app most wants to reward
    tier: 25, // reuses the existing streak-tier threshold crossing, no new counter
    // Indexed by `MonthSummary.outcomeBucket` (settlementActions.ts's own
    // convention: 0 = no data, 1 = best pace .. 3 = worst pace). Scales DOWN
    // as the outcome worsens — a below-budget month is rewarded more than an
    // over-budget one, but every REAL month (bucket > 0) still earns something.
    // B4: raised from [0, 20, 12, 6] — at 20 a whole settled month paid less
    // than one day of logging, so F16 read as decoration rather than a reward.
    settlementByOutcomeBucket: [0, 120, 80, 40],
    // --- ADDENDUM-06 §3.2 (명당 prime-lot standing bonus). Not director-confirmed yet — tunable dial. ---
    primeLot: 3, // seeds per building standing on a prime lot, per settlement
    primeLotMax: 30, // ceiling, so a very large town cannot farm this into the shop's price floor
  },
} as const;
