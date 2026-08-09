/**
 * Data model — MVP-SPEC.md §8.1.
 *
 * All dates in this file are device-local 'YYYY-MM-DD' strings, never `Date`
 * objects and never UTC (§8.3). A ledger entry belongs to the day the user
 * thinks it is, which is why every date field is typed `string`, not `Date`.
 */

export type EntryType = "expense" | "income" | "saving";

// Assumption (content, not balance) — director may edit freely; see spec §13 D-2.
export type ExpenseCategoryId =
  | "food"
  | "cafe"
  | "transport"
  | "shopping"
  | "living"
  | "health"
  | "culture"
  | "education"
  | "social"
  | "etc";

export type IncomeCategoryId = "salary" | "sidejob" | "bonus" | "other_income";

// ADDENDUM-01 §2.2/§4.1: `deposit`/`stock` added (the two structures the
// director named — 예적금/주식 투자, ADDENDUM-01 §0); `invest` retired (this
// task, B3/B5, §5.2/§6) in favour of the readable-only `LegacySavingCategoryId`
// below — old `invest` data keeps working via `savingsBucketOf`'s alias
// (§4.5), it just can no longer be freshly chosen in the picker.
export type SavingCategoryId = "deposit" | "stock" | "emergency" | "goal" | "other_saving";

// NEW — readable-only legacy id, never offered in the picker (§4.4). Kept OUT
// of `CategoryId`/`SavingCategoryId` deliberately, same reasoning `ParkCategoryId`
// already documents below: a legacy id is a *readable* id, not a creatable one.
export type LegacySavingCategoryId = "invest";

export type CategoryId = ExpenseCategoryId | IncomeCategoryId | SavingCategoryId;

// F15 무지출 데이 park tile — a visual-only pseudo-category, never chosen on a
// LedgerEntry (a claimed no-spend day has no ledger entry, only a Building
// with `source.kind === 'nospend'`). Task-level deviation from the spec's
// "categoryId: null for nospend" note (§8.1): giving the park tile its own
// category id lets it render through PlaceholderBuilding's existing
// category-colour/icon/roof interface with no second component.
export type ParkCategoryId = "park";

// Building-only widening — kept OUT of `CategoryId` (round-2 finding C3) so
// `LedgerEntry`/`EntryDraft` stay honest to real categories at the type
// level, not just by runtime convention (CATEGORIES_BY_TYPE never lists
// "park"). Only `Building.categoryId` and PlaceholderBuilding accept this.
export type BuildingCategoryId = CategoryId | ParkCategoryId;

export interface LedgerEntry {
  id: string; // nanoid
  type: EntryType;
  amountKrw: number; // integer > 0; sign comes from `type`
  categoryId: CategoryId;
  occurredOn: string; // 'YYYY-MM-DD', device-local, never future
  memo?: string; // <= 40 chars
  createdAt: number; // epoch ms
  updatedAt: number;
  buildingId: string | null; // null = queued, over queue cap, or type 'saving'
  queued: boolean; // true while a material is pending (F14)
}

// Buildings have three legitimate origins, as a discriminated union — the
// ONLY ways a building can exist (design invariant 1, spec §7).
export type BuildingSource =
  | { kind: "entry"; entryId: string }
  | { kind: "nospend"; date: string }; // 'YYYY-MM-DD'

export interface Building {
  id: string;
  source: BuildingSource;
  categoryId: BuildingCategoryId | null; // 'park' only for nospend
  variantIndex: number; // category variant, or park variant 0
  plotIndex: number; // ADDENDUM-02 §6.4: position on the town grid, not identity — unique among live buildings, changed only by the player's move (F2b, follow-up task); written only by placement.ts (rule R-4)
  builtOn: string; // 'YYYY-MM-DD'
  createdAt: number;
  // ADDENDUM-04 §2 (building EXP): OPTIONAL, absent === 0, NO migration/schema
  // bump — same discipline `savingsByCategoryKrw` already sets on `TownState`
  // below: an old chunk parses unchanged, an old building simply reads exp 0
  // (via `expOf`, selectors.ts), so an existing town's tier is unchanged on
  // first load. A "grow" act (§5) increments this instead of placing a new
  // `Building`.
  exp?: number;
}

/** Pending material — an over-cap entry waiting for tomorrow (F14). */
export interface QueuedMaterial {
  entryId: string;
  categoryId: CategoryId;
  variantIndex: number; // rolled at queue time so the reward is already determined
  // ADDENDUM-04 §6 — OPTIONAL, no migration: a material queued before this
  // field existed simply has none. Read discipline lives at the drain site
  // (queueActions.ts), same rule `expOf`/`savingsOf` already set — never
  // open-code a fallback at a second call site. Missing === today's exact
  // behaviour (implicit gain 1), never a crash.
  amountKrw?: number;
  queuedOn: string; // 'YYYY-MM-DD'; may never build on this same date
  // 'YYYY-MM' of the ORIGINAL entry's `occurredOn` — the ledger chunk the
  // drain must patch (buildingId/queued) once this material builds. Distinct
  // from `queuedOn`'s month whenever the entry was backdated to a different
  // month than the day it queued (round-2 finding C2 #2) — using
  // `queuedOn`'s month there silently patches the wrong (or no) chunk.
  entryYm: string;
}

export interface TownState {
  townName: string;
  nextPlotIndex: number; // ADDENDUM-02 §6.4: opened-lot counter (growth frontier), +1 per placed building, never decremented — NOT the next building's position (that's placement.pickPlot, drawn uniformly at random over the open pool)
  streakDays: number;
  longestStreakDays: number;
  lastActOn: string | null; // entry OR no-spend claim
  slotsUsedOn: string; // 'YYYY-MM-DD' the counter belongs to
  slotsUsedToday: number;
  highestTierSeen: number; // tier-up fires exactly once per threshold
  queue: QueuedMaterial[]; // FIFO, length <= materialQueueMax
  noSpendDays: string[]; // claimed dates
  cumulativeSavingsKrw: number; // denormalized total; rebuildable from entries — still powers 기록
  // ADDENDUM-01 §4.1: per-structure levels for the 저축 블록 (§2). OPTIONAL —
  // a `TownState` written before this change has none; every reader goes
  // through `savingsOf` below rather than open-coding `?? {}` / `?? 0`.
  savingsByCategoryKrw?: Partial<Record<SavingCategoryId, number>>;
  // ponytail: retained inert — monument/settlement feature removed; kept to avoid a storage-schema migration
  lastSettledPeriod: string | null;
  // ADDENDUM-02 §4.5 (D-36): optional, no migration — an old core reads
  // `undefined` -> falsy -> hint eligible. Set in memory on the first
  // successful move (or an explicit dismiss) and folded into whatever
  // `saveCore` the app performs next for any OTHER reason; never written by
  // itself, so a move still writes exactly one storage key (AC-M10) and the
  // hint costs zero extra writes (AC-H1).
  moveHintSeen?: boolean;
}

/** Read discipline for `savingsByCategoryKrw` — so `?? 0` is never open-coded at a call site (ADDENDUM-01 §4.1). */
export function savingsOf(town: Pick<TownState, "savingsByCategoryKrw">, id: SavingCategoryId): number {
  return town.savingsByCategoryKrw?.[id] ?? 0;
}

export interface BudgetSetting {
  monthlyBudgetKrw: number | null;
  updatedAt: number;
}
