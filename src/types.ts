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

export type SavingCategoryId = "emergency" | "goal" | "invest" | "other_saving";

export type CategoryId = ExpenseCategoryId | IncomeCategoryId | SavingCategoryId;

// F15 무지출 데이 park tile — a visual-only pseudo-category, never chosen on a
// LedgerEntry (a claimed no-spend day has no ledger entry, only a Building
// with `source.kind === 'nospend'`). Task-level deviation from the spec's
// "categoryId: null for nospend/monument" note (§8.1): giving the park tile
// its own category id lets it render through PlaceholderBuilding's existing
// category-colour/icon/roof interface with no second component. Monument
// buildings (F16, out of scope here) still use `categoryId: null`.
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
  | { kind: "nospend"; date: string } // 'YYYY-MM-DD'
  | { kind: "monument"; period: string }; // 'YYYY-MM'

export interface Building {
  id: string;
  source: BuildingSource;
  categoryId: BuildingCategoryId | null; // null for monument; 'park' only for nospend
  variantIndex: number; // category variant, park variant 0, or monument outcome bucket
  plotIndex: number; // monotonic; plot = plotFromIndex(plotIndex) — absolute, never reflows
  builtOn: string; // 'YYYY-MM-DD'
  createdAt: number;
  monumentSummary?: MonthSummary; // only when source.kind === 'monument'
}

/** Pending material — an over-cap entry waiting for tomorrow (F14). */
export interface QueuedMaterial {
  entryId: string;
  categoryId: CategoryId;
  variantIndex: number; // rolled at queue time so the reward is already determined
  queuedOn: string; // 'YYYY-MM-DD'; may never build on this same date
  // 'YYYY-MM' of the ORIGINAL entry's `occurredOn` — the ledger chunk the
  // drain must patch (buildingId/queued) once this material builds. Distinct
  // from `queuedOn`'s month whenever the entry was backdated to a different
  // month than the day it queued (round-2 finding C2 #2) — using
  // `queuedOn`'s month there silently patches the wrong (or no) chunk.
  entryYm: string;
}

/** Frozen at settlement; never recomputed (past months must not change retroactively). */
export interface MonthSummary {
  period: string; // 'YYYY-MM'
  expenseKrw: number;
  incomeKrw: number;
  savingKrw: number;
  budgetKrw: number | null;
  outcomeBucket: number; // index into the mood/outcome buckets
  daysLogged: number;
}

export interface TownState {
  townName: string;
  nextPlotIndex: number; // monotonic; deletion leaves a permanent empty lot
  streakDays: number;
  longestStreakDays: number;
  lastActOn: string | null; // entry OR no-spend claim
  slotsUsedOn: string; // 'YYYY-MM-DD' the counter belongs to
  slotsUsedToday: number;
  highestTierSeen: number; // tier-up fires exactly once per threshold
  queue: QueuedMaterial[]; // FIFO, length <= materialQueueMax
  noSpendDays: string[]; // claimed dates
  cumulativeSavingsKrw: number; // denormalized for tower height; rebuildable from entries
  lastSettledPeriod: string | null; // idempotency key for F16
}

export interface BudgetSetting {
  monthlyBudgetKrw: number | null;
  updatedAt: number;
}
