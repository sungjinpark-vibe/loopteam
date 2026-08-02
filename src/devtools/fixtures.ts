/**
 * devtools fixtures — MVP-SPEC.md §11.
 *
 * Seeded and deterministic: a fixed PRNG seed per fixture means two machines
 * building the same fixture produce byte-identical state, so a QA bug report
 * is reproducible from a fixture name alone (§11.A). Dev-only — never
 * imported outside `src/devtools/**`; Gate 1 asserts this module is absent
 * from a production bundle (§11).
 *
 * No `new Date()` here either: dates are built with plain calendar math so
 * fixture output never depends on the machine's real clock. Pair a fixture
 * with `setTimeTravelDate(fixture.today)` (`src/platform/clock.ts`, §11.B) so
 * the app derives against the date the fixture was designed for.
 */
import { browserStorage } from "../platform/storage";
import type { StoragePort } from "../platform/storage";
import { BALANCE } from "../balance.placeholder";
import { buildingsStorageKey, createChunkedStorage, entriesStorageKey } from "../storage";
import type {
  Building,
  BudgetSetting,
  CategoryId,
  EntryType,
  ExpenseCategoryId,
  IncomeCategoryId,
  LedgerEntry,
  MonthSummary,
  SavingCategoryId,
  TownState,
} from "../types";

// ── Deterministic PRNG (mulberry32) — reproducibility, not cryptographic strength. ──
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Pure calendar math (no `Date`, no timezone) ──
function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}
function daysInMonth(y: number, m: number): number {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function ymd(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}
function ymOnly(y: number, m: number): string {
  return `${y}-${pad2(m)}`;
}
function shiftMonth(y: number, m: number, n: number): { y: number; m: number } {
  const total = y * 12 + (m - 1) + n;
  return { y: Math.floor(total / 12), m: (((total % 12) + 12) % 12) + 1 };
}

const EXPENSE_CATEGORIES: ExpenseCategoryId[] = [
  "food",
  "cafe",
  "transport",
  "shopping",
  "living",
  "health",
  "culture",
  "education",
  "social",
  "etc",
];
const INCOME_CATEGORIES: IncomeCategoryId[] = ["salary", "sidejob", "bonus", "other_income"];
const SAVING_CATEGORIES: SavingCategoryId[] = ["emergency", "goal", "invest", "other_saving"];

const BASE_MS = 1_700_000_000_000; // fixed anchor epoch — arbitrary, only needs to be constant

function makeEntry(args: {
  id: string;
  type: EntryType;
  amountKrw: number;
  categoryId: CategoryId;
  occurredOn: string;
  createdAt: number;
  buildingId: string | null;
  queued?: boolean;
  memo?: string;
}): LedgerEntry {
  return {
    id: args.id,
    type: args.type,
    amountKrw: args.amountKrw,
    categoryId: args.categoryId,
    occurredOn: args.occurredOn,
    memo: args.memo,
    createdAt: args.createdAt,
    updatedAt: args.createdAt,
    buildingId: args.buildingId,
    queued: args.queued ?? false,
  };
}

function makeBuilding(args: {
  id: string;
  source: Building["source"];
  categoryId: CategoryId | null;
  variantIndex: number;
  plotIndex: number;
  builtOn: string;
  createdAt: number;
  monumentSummary?: MonthSummary;
}): Building {
  return { ...args };
}

function freshTown(today: string): TownState {
  return {
    townName: "우리 동네",
    nextPlotIndex: 0,
    streakDays: 0,
    longestStreakDays: 0,
    lastActOn: null,
    slotsUsedOn: today,
    slotsUsedToday: 0,
    highestTierSeen: 0,
    queue: [],
    noSpendDays: [],
    cumulativeSavingsKrw: 0,
    lastSettledPeriod: today.slice(0, 7), // onboarding seeds this to "now" — no retroactive settlement
  };
}

function freshBudget(monthlyBudgetKrw: number | null, updatedAt: number): BudgetSetting {
  return { monthlyBudgetKrw, updatedAt };
}

/** A deterministic id/timestamp sequence, one per fixture build so re-running a fixture is stable. */
function makeSequence() {
  let idSeq = 0;
  let msSeq = 0;
  return {
    nextId: (prefix: string) => `${prefix}${(idSeq += 1)}`,
    nextMs: () => (BASE_MS + (msSeq += 60_000)),
  };
}

interface MonthGenResult {
  entries: LedgerEntry[];
  buildings: Building[];
  monthExpenseKrw: number;
  monthIncomeKrw: number;
  monthSavingKrw: number;
}

/**
 * Generates one month of ledger activity, spread round-robin across its
 * days, respecting the daily build cap (F4). Shared by `oneMonth` and
 * `dense` — queue/overflow behavior itself is exercised by the dedicated
 * `capExceeded`/`queueFull` fixtures, not here.
 */
function generateMonth(opts: {
  year: number;
  month: number;
  targetEntries: number;
  dailyCap: number;
  rng: () => number;
  seq: ReturnType<typeof makeSequence>;
  plotCursor: { next: number };
}): MonthGenResult {
  const { year, month, targetEntries, dailyCap, rng, seq, plotCursor } = opts;
  const dim = daysInMonth(year, month);
  const entries: LedgerEntry[] = [];
  const buildings: Building[] = [];
  let monthExpenseKrw = 0;
  let monthIncomeKrw = 0;
  let monthSavingKrw = 0;

  for (let i = 0; i < targetEntries; i++) {
    const day = (i % dim) + 1;
    const occurredOn = ymd(year, month, day);
    const roll = rng();
    const type: EntryType = roll < 0.78 ? "expense" : roll < 0.92 ? "income" : "saving";
    const amountKrw =
      type === "expense"
        ? 2_000 + Math.floor(rng() * 48_000)
        : type === "income"
          ? 200_000 + Math.floor(rng() * 1_800_000)
          : 20_000 + Math.floor(rng() * 180_000);
    const categoryPool = type === "expense" ? EXPENSE_CATEGORIES : type === "income" ? INCOME_CATEGORIES : SAVING_CATEGORIES;
    const categoryId = categoryPool[Math.floor(rng() * categoryPool.length)];
    const createdAt = seq.nextMs();
    const id = seq.nextId("e");

    if (type === "expense") monthExpenseKrw += amountKrw;
    else if (type === "income") monthIncomeKrw += amountKrw;
    else monthSavingKrw += amountKrw;

    if (type === "saving") {
      // Saving entries never build and never consume a slot (F13) — always ledger-only.
      entries.push(makeEntry({ id, type, amountKrw, categoryId, occurredOn, createdAt, buildingId: null }));
      continue;
    }

    const dayBuildingsSoFar = buildings.reduce((n, b) => n + (b.builtOn === occurredOn ? 1 : 0), 0);
    if (dayBuildingsSoFar < dailyCap) {
      const buildingId = seq.nextId("b");
      const variantIndex = Math.floor(rng() * BALANCE.variantsPerCategory);
      const plotIndex = plotCursor.next++;
      buildings.push(
        makeBuilding({
          id: buildingId,
          source: { kind: "entry", entryId: id },
          categoryId,
          variantIndex,
          plotIndex,
          builtOn: occurredOn,
          createdAt,
        }),
      );
      entries.push(makeEntry({ id, type, amountKrw, categoryId, occurredOn, createdAt, buildingId }));
    } else {
      // Day's cap already spent for this fixture — recorded as ledger data only.
      entries.push(makeEntry({ id, type, amountKrw, categoryId, occurredOn, createdAt, buildingId: null }));
    }
  }

  return { entries, buildings, monthExpenseKrw, monthIncomeKrw, monthSavingKrw };
}

export interface Fixture {
  name: string;
  description: string;
  /** Feed to `setTimeTravelDate` (src/platform/clock.ts) so the app derives against the date this fixture assumes. */
  today: string;
  entries: LedgerEntry[];
  buildings: Building[];
  town: TownState;
  budget: BudgetSetting;
}

// ── Fixtures (§11.A table) ──

/** Fresh install — S2/S3 empty states, onboarding. */
function empty(): Fixture {
  const today = "2026-08-02";
  return {
    name: "empty",
    description: "Fresh install — S2/S3 empty states, onboarding.",
    today,
    entries: [],
    buildings: [],
    town: freshTown(today),
    budget: freshBudget(null, BASE_MS),
  };
}

/** One month, ~90 entries, budget set — the normal case: donut, pace bar. */
function oneMonth(): Fixture {
  const rng = mulberry32(1);
  const seq = makeSequence();
  const plotCursor = { next: 0 };
  const { entries, buildings } = generateMonth({
    year: 2026,
    month: 7,
    targetEntries: 90,
    dailyCap: BALANCE.dailyBuildSlots,
    rng,
    seq,
    plotCursor,
  });
  // `today` must fall inside the generated month (2026-07) — otherwise the
  // current month has zero entries and monthTotal/budgetPace are both 0,
  // defeating this fixture's job ("the normal case, the donut, the pace
  // bar"). Last day of July: the whole month's data has "occurred" by then.
  const today = "2026-07-31";
  const cumulativeSavingsKrw = entries.filter((e) => e.type === "saving").reduce((sum, e) => sum + e.amountKrw, 0);
  const town: TownState = {
    ...freshTown(today),
    nextPlotIndex: plotCursor.next,
    streakDays: 5,
    longestStreakDays: 12,
    lastActOn: "2026-07-31",
    cumulativeSavingsKrw,
    lastSettledPeriod: "2026-07",
  };
  return {
    name: "oneMonth",
    description: "One month, ~90 entries, budget set — the normal case, the donut, the pace bar.",
    today,
    entries,
    buildings,
    town,
    budget: freshBudget(600_000, seq.nextMs()),
  };
}

/** 36 months, ~5,400 buildings, 36 monuments, full tower, one 300-entry month — F3/F8 dense ACs. */
function dense(): Fixture {
  const rng = mulberry32(2);
  const seq = makeSequence();
  const plotCursor = { next: 0 };
  const MONTHS = 36;
  const START = { y: 2023, m: 9 };
  const HEAVY_MONTH_INDEX = 17; // the one 300-entry month

  let entries: LedgerEntry[] = [];
  let buildings: Building[] = [];
  let cumulativeSavingsKrw = 0;
  let lastPeriod = "";

  for (let i = 0; i < MONTHS; i++) {
    const { y, m } = shiftMonth(START.y, START.m, i);
    const targetEntries = i === HEAVY_MONTH_INDEX ? 300 : 150;
    const result = generateMonth({ year: y, month: m, targetEntries, dailyCap: BALANCE.dailyBuildSlots, rng, seq, plotCursor });
    entries = entries.concat(result.entries);
    buildings = buildings.concat(result.buildings);
    cumulativeSavingsKrw += result.monthSavingKrw;
    lastPeriod = ymOnly(y, m);

    // One monument per month (F16) — no slot, no daily cap.
    const outcomeBucket = result.monthExpenseKrw > 500_000 ? 2 : result.monthExpenseKrw > 200_000 ? 1 : 0;
    const monumentSummary: MonthSummary = {
      period: lastPeriod,
      expenseKrw: result.monthExpenseKrw,
      incomeKrw: result.monthIncomeKrw,
      savingKrw: result.monthSavingKrw,
      budgetKrw: 600_000,
      outcomeBucket,
      daysLogged: new Set(result.entries.map((e) => e.occurredOn)).size,
    };
    buildings.push(
      makeBuilding({
        id: seq.nextId("mon"),
        source: { kind: "monument", period: lastPeriod },
        categoryId: null,
        variantIndex: outcomeBucket,
        plotIndex: plotCursor.next++,
        builtOn: ymd(y, m, daysInMonth(y, m)),
        createdAt: seq.nextMs(),
        monumentSummary,
      }),
    );
  }

  // Force a full tower regardless of what was actually saved above (this fixture's job is
  // to prove rendering at max height, not to model a plausible savings curve).
  cumulativeSavingsKrw = Math.max(cumulativeSavingsKrw, BALANCE.savingsTowerSegments[BALANCE.savingsTowerSegments.length - 1]);

  const lastMonth = shiftMonth(START.y, START.m, MONTHS - 1);
  const today = ymd(lastMonth.y, lastMonth.m, daysInMonth(lastMonth.y, lastMonth.m));
  const town: TownState = {
    ...freshTown(today),
    nextPlotIndex: plotCursor.next,
    streakDays: 24,
    longestStreakDays: 180,
    lastActOn: today,
    cumulativeSavingsKrw,
    lastSettledPeriod: lastPeriod,
  };

  return {
    name: "dense",
    description: "36 months, ~5,400 buildings, 36 monuments, full tower, one 300-entry month — F3/F8 dense ACs.",
    today,
    entries,
    buildings,
    town,
    budget: freshBudget(600_000, seq.nextMs()),
  };
}

/** Today at the daily cap + 3 over — F14 queue push, header promise. */
function capExceeded(): Fixture {
  const rng = mulberry32(3);
  const seq = makeSequence();
  const plotCursor = { next: 0 };
  const today = "2026-08-02";
  const cap = BALANCE.dailyBuildSlots;
  const overBy = 3;
  const entries: LedgerEntry[] = [];
  const buildings: Building[] = [];
  const queue: TownState["queue"] = [];

  for (let i = 0; i < cap + overBy; i++) {
    const categoryId = EXPENSE_CATEGORIES[i % EXPENSE_CATEGORIES.length];
    const amountKrw = 5_000 + i * 1_000;
    const createdAt = seq.nextMs();
    const id = seq.nextId("e");
    const variantIndex = Math.floor(rng() * BALANCE.variantsPerCategory);
    if (i < cap) {
      const buildingId = seq.nextId("b");
      buildings.push(
        makeBuilding({ id: buildingId, source: { kind: "entry", entryId: id }, categoryId, variantIndex, plotIndex: plotCursor.next++, builtOn: today, createdAt }),
      );
      entries.push(makeEntry({ id, type: "expense", amountKrw, categoryId, occurredOn: today, createdAt, buildingId }));
    } else {
      queue.push({ entryId: id, categoryId, variantIndex, queuedOn: today });
      entries.push(makeEntry({ id, type: "expense", amountKrw, categoryId, occurredOn: today, createdAt, buildingId: null, queued: true }));
    }
  }

  const town: TownState = {
    ...freshTown(today),
    nextPlotIndex: plotCursor.next,
    slotsUsedToday: cap,
    streakDays: 1,
    longestStreakDays: 1,
    lastActOn: today,
    queue,
  };
  return {
    name: "capExceeded",
    description: `Today at the cap (${cap}) + ${overBy} over — F14 queue push, header promise.`,
    today,
    entries,
    buildings,
    town,
    budget: freshBudget(600_000, seq.nextMs()),
  };
}

/** Queue already at materialQueueMax — F14 overflow branch (one more entry is ledger-only). */
function queueFull(): Fixture {
  const rng = mulberry32(4);
  const seq = makeSequence();
  const plotCursor = { next: 0 };
  const today = "2026-08-02";
  const cap = BALANCE.dailyBuildSlots;
  const queueMax = BALANCE.materialQueueMax;
  const entries: LedgerEntry[] = [];
  const buildings: Building[] = [];
  const queue: TownState["queue"] = [];

  for (let i = 0; i < cap + queueMax + 1; i++) {
    const categoryId = EXPENSE_CATEGORIES[i % EXPENSE_CATEGORIES.length];
    const amountKrw = 5_000 + i * 500;
    const createdAt = seq.nextMs();
    const id = seq.nextId("e");
    const variantIndex = Math.floor(rng() * BALANCE.variantsPerCategory);
    if (i < cap) {
      const buildingId = seq.nextId("b");
      buildings.push(
        makeBuilding({ id: buildingId, source: { kind: "entry", entryId: id }, categoryId, variantIndex, plotIndex: plotCursor.next++, builtOn: today, createdAt }),
      );
      entries.push(makeEntry({ id, type: "expense", amountKrw, categoryId, occurredOn: today, createdAt, buildingId }));
    } else if (queue.length < queueMax) {
      queue.push({ entryId: id, categoryId, variantIndex, queuedOn: today });
      entries.push(makeEntry({ id, type: "expense", amountKrw, categoryId, occurredOn: today, createdAt, buildingId: null, queued: true }));
    } else {
      // Overflow past materialQueueMax — still recorded in 기록, no material at all.
      entries.push(makeEntry({ id, type: "expense", amountKrw, categoryId, occurredOn: today, createdAt, buildingId: null }));
    }
  }

  const town: TownState = {
    ...freshTown(today),
    nextPlotIndex: plotCursor.next,
    slotsUsedToday: cap,
    streakDays: 1,
    longestStreakDays: 1,
    lastActOn: today,
    queue,
  };
  return {
    name: "queueFull",
    description: `Queue at materialQueueMax (${queueMax}) — F14 overflow branch.`,
    today,
    entries,
    buildings,
    town,
    budget: freshBudget(600_000, seq.nextMs()),
  };
}

/** Pace ≈ 2.0 mid-month — F6 worst mood, and proof that no building is harmed by it. */
function budgetBlown(): Fixture {
  const seq = makeSequence();
  const plotCursor = { next: 0 };
  const year = 2026;
  const month = 6; // June — 30 days, matches spec §5 F6's worked example shape
  const today = ymd(year, month, 15); // day 15 of a 30-day month
  const budgetKrw = 600_000;
  // elapsedFraction = 15/30 = 0.5 -> expectedSpend = 300,000 -> pace 2.0 needs 600,000 spent.
  const amounts = [250_000, 200_000, 150_000];
  const days = [1, 5, 10];
  const entries: LedgerEntry[] = [];
  const buildings: Building[] = [];
  amounts.forEach((amountKrw, i) => {
    const occurredOn = ymd(year, month, days[i]);
    const createdAt = seq.nextMs();
    const id = seq.nextId("e");
    const buildingId = seq.nextId("b");
    const categoryId = EXPENSE_CATEGORIES[i % EXPENSE_CATEGORIES.length];
    buildings.push(
      makeBuilding({ id: buildingId, source: { kind: "entry", entryId: id }, categoryId, variantIndex: 0, plotIndex: plotCursor.next++, builtOn: occurredOn, createdAt }),
    );
    entries.push(makeEntry({ id, type: "expense", amountKrw, categoryId, occurredOn, createdAt, buildingId }));
  });

  const town: TownState = {
    ...freshTown(today),
    nextPlotIndex: plotCursor.next,
    streakDays: 10,
    longestStreakDays: 10,
    lastActOn: today,
  };
  return {
    name: "budgetBlown",
    description: "Pace ≈ 2.0 mid-month — F6 worst mood, and no building is ever harmed by it.",
    today,
    entries,
    buildings,
    town,
    budget: freshBudget(budgetKrw, seq.nextMs()),
  };
}

/** 5 claimed no-spend days, one of them ready to be revoked by logging an expense on that date. */
function noSpendStreak(): Fixture {
  const seq = makeSequence();
  const plotCursor = { next: 0 };
  const claimedDays = ["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-08-05"];
  const today = "2026-08-06";
  const buildings: Building[] = claimedDays.map((date) =>
    makeBuilding({
      id: seq.nextId("b"),
      source: { kind: "nospend", date },
      categoryId: null,
      variantIndex: 0,
      plotIndex: plotCursor.next++,
      builtOn: date,
      createdAt: seq.nextMs(),
    }),
  );

  const town: TownState = {
    ...freshTown(today),
    nextPlotIndex: plotCursor.next,
    streakDays: claimedDays.length,
    longestStreakDays: claimedDays.length,
    lastActOn: claimedDays[claimedDays.length - 1],
    noSpendDays: claimedDays,
  };
  return {
    // The revocation target is claimedDays[2] ("2026-08-03"): log an expense with
    // occurredOn === that date and F15's revocation branch should fire.
    name: "noSpendStreak",
    description: "5 claimed no-spend days (2026-08-01..05) — F15 claim + revocation + refund. Revoke by logging an expense on 2026-08-03.",
    today,
    entries: [],
    buildings,
    town,
    budget: freshBudget(600_000, seq.nextMs()),
  };
}

/** lastSettledPeriod 3 months stale — F16 multi-month settlement, idempotency. */
function unsettled(): Fixture {
  const rng = mulberry32(6);
  const seq = makeSequence();
  const plotCursor = { next: 0 };
  const today = "2026-08-02";
  let entries: LedgerEntry[] = [];
  let buildings: Building[] = [];
  // 3 stale months: 2026-05, 06, 07 (current period is 2026-08).
  for (const month of [5, 6, 7]) {
    const result = generateMonth({ year: 2026, month, targetEntries: 20, dailyCap: BALANCE.dailyBuildSlots, rng, seq, plotCursor });
    entries = entries.concat(result.entries);
    buildings = buildings.concat(result.buildings);
  }

  const town: TownState = {
    ...freshTown(today),
    nextPlotIndex: plotCursor.next,
    streakDays: 0,
    longestStreakDays: 6,
    lastActOn: "2026-07-20",
    lastSettledPeriod: "2026-04", // 3 unsettled periods: 05, 06, 07
  };
  return {
    name: "unsettled",
    description: "lastSettledPeriod 3 months stale (2026-04) — F16 multi-month settlement, idempotency.",
    today,
    entries,
    buildings,
    town,
    budget: freshBudget(600_000, seq.nextMs()),
  };
}

/** Same shape as `oneMonth`; `loadFixtureIntoStorage` mangles one chunk after writing it — F10 quarantine + recovery notice. */
function corrupt(): Fixture {
  const base = oneMonth();
  return {
    ...base,
    name: "corrupt",
    description: "Valid data, but the current month's entries chunk is deliberately mangled after writing — F10 quarantine + recovery notice.",
  };
}

export const FIXTURES = {
  empty,
  oneMonth,
  dense,
  capExceeded,
  queueFull,
  budgetBlown,
  noSpendStreak,
  unsettled,
  corrupt,
} as const;

export type FixtureName = keyof typeof FIXTURES;

function groupByMonth<T>(items: readonly T[], dateOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = dateOf(item).slice(0, 7);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

/**
 * Writes a fixture through the chunked storage layer, replacing whatever was
 * there. This is the S7 "load fixture" action's implementation; the sheet
 * itself is a later (UI) task.
 */
export function loadFixtureIntoStorage(
  fixture: Fixture,
  storageClient = createChunkedStorage(),
  rawPort: StoragePort = browserStorage,
): void {
  storageClient.clearAll();
  const core = { town: fixture.town, budget: fixture.budget, onboarded: true };
  storageClient.saveCore(core);
  for (const [monthKey, monthEntries] of groupByMonth(fixture.entries, (e) => e.occurredOn)) {
    storageClient.saveEntriesForMonth(monthKey, monthEntries, core);
  }
  for (const [monthKey, monthBuildings] of groupByMonth(fixture.buildings, (b) => b.builtOn)) {
    storageClient.saveBuildingsForMonth(monthKey, monthBuildings);
  }
  if (fixture.name === "corrupt") {
    rawPort.set(entriesStorageKey(fixture.today.slice(0, 7)), "{not valid json,,,");
  }
}

// Re-exported so a fixture-loading UI (S7, later) can address building chunks
// the same way, without importing storage.ts directly for that one constant.
export { buildingsStorageKey };
