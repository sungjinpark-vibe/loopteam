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
    // Gate-3 round-5 (게임 디자이너's TOP FIX, panel's #1 finding for this
    // dial): was a flat 4/3, amount-blind — 15 same-day 100원 entries
    // (1,500원 total) minted 197 seeds, clearing the 150-seed shop floor on
    // day one, and taught "log often" rather than "log real spending". Now a
    // 5-row table indexed by the entry's own `expAmountTiers` rung (same
    // 5,000/20,000/50,000/150,000원 bands the building EXP curve already
    // uses — see `awards.ts`'s `seedsForExpTier`), so the two currencies
    // finally agree: a 100원 entry is worth little in seeds AND exp, a
    // 150,000원 entry is worth the top rung of both. Index 1 (the
    // 5,000–20,000원 band — an actual coffee/lunch, not a farmed row) keeps
    // the old flat value (4/3) so a real "few entries a day" logger's pacing
    // is unchanged (see `pacing.test.ts`); only entries BELOW 5,000원 pay
    // less than before.
    entry: [2, 4, 6, 8, 10],
    build: [1, 3, 4, 6, 8], // per entry-sourced build, including a queue drain (§F-ECON table row 1)
    // Gate-3-rerun retune (게임 디자이너's TOP FIX): was 8 — below even the
    // CHEAPEST founding expense (entry[0]+build[0] = 3), so the app's own
    // "best" day (spending nothing) paid less than its worst one (a tiny
    // impulse buy). Raised to 18, matching the TOP expense rung
    // (entry[4]+build[4] = 10+8 = 18) so 무지출 is never mechanically worse
    // than spending. ADDENDUM-05 tunable, not director-confirmed — same
    // discipline as every other dial in this block, `expAmountTiers` untouched.
    nospend: 18,
    tier: 25, // reuses the existing streak-tier threshold crossing, no new counter
    // --- ADDENDUM-11 §5.3 (building fusion). NEW dial, not director-confirmed
    // — same discipline as `primeLot`/`primeLotMax` below. Sits between
    // `nospend` (8) and `tier` (25): a fusion is rarer and more deliberate
    // than a no-spend day, less momentous than a tier crossing. Does not
    // touch `expAmountTiers`/`expPerLevel`/`maxLevel`, which stay exactly as
    // re-confirmed 2026-08-12.
    fuse: 12,
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
