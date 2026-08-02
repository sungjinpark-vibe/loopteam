/**
 * Chunked storage — MVP-SPEC.md §8.4 / F10.
 *
 * Month-chunked keys, not one blob: both `localStorage` and the future
 * Apps-in-Toss Storage API re-serialize the entire value on every `set`, so a
 * single growing blob makes every entry save more expensive than the last
 * for the life of the ledger (§13 trade-off 4). Built on the raw `storage`
 * port (`src/platform/storage.ts`) — this file owns the key layout only.
 */
import type { StoragePort } from "./platform/storage";
import { storage as defaultStoragePort } from "./platform/storage";
import { rebuildDerived } from "./selectors";
import type { Building, BudgetSetting, LedgerEntry, TownState } from "./types";

export const SCHEMA_VERSION = 1;

const KEY_PREFIX = "ait.v1";
const INDEX_KEY = `${KEY_PREFIX}.index`;
const CORE_KEY = `${KEY_PREFIX}.core`;
const entriesKey = (ym: string): string => `${KEY_PREFIX}.entries.${ym}`;
const buildingsKey = (ym: string): string => `${KEY_PREFIX}.buildings.${ym}`;

/** Exposed so fixtures/tests can address a specific chunk key without duplicating the layout. */
export const entriesStorageKey = entriesKey;
export const buildingsStorageKey = buildingsKey;

export interface StorageIndex {
  schemaVersion: number;
  entryMonths: string[]; // sorted 'YYYY-MM'
  buildingMonths: string[]; // sorted 'YYYY-MM'
}

export interface CoreState {
  town: TownState;
  budget: BudgetSetting;
  onboarded: boolean;
}

export interface CorruptionNotice {
  key: string;
  reason: string;
}

export interface BootState {
  index: StorageIndex;
  core: CoreState | null;
  /** Every building across every month chunk — the town view needs all of them (§8.4). */
  buildings: Building[];
  /** Quarantined/reset keys, for F10's "visible one-time notice, never a white screen". */
  corrupted: CorruptionNotice[];
}

function emptyIndex(): StorageIndex {
  return { schemaVersion: SCHEMA_VERSION, entryMonths: [], buildingMonths: [] };
}

const ENTRIES_PREFIX = `${KEY_PREFIX}.entries.`;
const BUILDINGS_PREFIX = `${KEY_PREFIX}.buildings.`;

/**
 * Rebuilds an index by scanning the raw key space instead of trusting the
 * (unparseable) `ait.v1.index` blob — the corrupt-index recovery path (F10).
 * Without this, `readIndex()` would boot to an empty index, and the very
 * next `saveEntriesForMonth` would persist that empty index right back
 * (`registerMonth`), permanently orphaning every entries/buildings chunk
 * that survived the corruption — the raw keys would still hold the data,
 * unreachable by anything in this module ever again.
 */
function rebuildIndexFromKeys(port: StoragePort): StorageIndex {
  const entryMonths = new Set<string>();
  const buildingMonths = new Set<string>();
  for (const key of port.keys()) {
    if (key.startsWith(ENTRIES_PREFIX)) entryMonths.add(key.slice(ENTRIES_PREFIX.length));
    else if (key.startsWith(BUILDINGS_PREFIX)) buildingMonths.add(key.slice(BUILDINGS_PREFIX.length));
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    entryMonths: [...entryMonths].sort(),
    buildingMonths: [...buildingMonths].sort(),
  };
}

/** A `TownState` with nothing recoverable — used only when the `core` chunk itself is lost. */
function defaultTownState(): TownState {
  return {
    townName: "우리 동네",
    nextPlotIndex: 0,
    streakDays: 0,
    longestStreakDays: 0,
    lastActOn: null,
    // "" sorts before every real 'YYYY-MM-DD' string, so slotsRemainingToday
    // (selectors.ts) always treats it as stale and resets to a fresh cap on
    // the first read — no need for this module to know "today".
    slotsUsedOn: "",
    slotsUsedToday: 0,
    highestTierSeen: 0,
    queue: [],
    noSpendDays: [],
    cumulativeSavingsKrw: 0,
    lastSettledPeriod: null,
  };
}

function readJson<T>(port: StoragePort, key: string): { value: T | null; corrupt: boolean } {
  const raw = port.get(key);
  if (raw === null) return { value: null, corrupt: false };
  try {
    return { value: JSON.parse(raw) as T, corrupt: false };
  } catch {
    return { value: null, corrupt: true };
  }
}

function writeJson(port: StoragePort, key: string, value: unknown): void {
  port.set(key, JSON.stringify(value));
}

/** Builds a chunked-storage client over any `StoragePort` (defaults to the browser driver). */
export function createChunkedStorage(port: StoragePort = defaultStoragePort) {
  function readIndex(): { index: StorageIndex; corrupt: boolean } {
    const result = readJson<StorageIndex>(port, INDEX_KEY);
    if (!result.value && !result.corrupt) {
      return { index: emptyIndex(), corrupt: false }; // no index yet — genuinely fresh install
    }
    // Unparseable JSON and an unrecognized schemaVersion are both "we cannot
    // trust this index blob" — treat identically. Silently substituting an
    // empty index for either (as an earlier version of this function did for
    // a schema mismatch) is the exact orphaning bug `rebuildIndexFromKeys`
    // exists to prevent, just reached via the sibling branch: the very next
    // registerMonth would persist that empty index over the real one and
    // permanently strand every surviving entries/buildings chunk. There is
    // only one schema version today, so "migrate" means "rebuild from raw
    // keys"; a real migration replaces this branch once SCHEMA_VERSION > 1
    // (§8.4: "schemaVersion lives in the index; migrations key off it").
    if (result.corrupt || result.value?.schemaVersion !== SCHEMA_VERSION) {
      const rebuilt = rebuildIndexFromKeys(port);
      // Self-heal immediately rather than waiting for the next registerMonth
      // call: every caller (loadBoot, registerMonth, clearAll) shares this
      // function, so persisting the fix here means the corruption is
      // resolved after the first read that notices it, not left sitting in
      // storage until something happens to trigger a write.
      writeJson(port, INDEX_KEY, rebuilt);
      return { index: rebuilt, corrupt: true };
    }
    return { index: result.value, corrupt: false };
  }

  function registerMonth(list: "entryMonths" | "buildingMonths", ym: string): void {
    const { index } = readIndex();
    if (index[list].includes(ym)) return; // already registered — no extra write
    index[list] = [...index[list], ym].sort();
    writeJson(port, INDEX_KEY, index);
  }

  function saveCore(core: CoreState): void {
    writeJson(port, CORE_KEY, core);
  }

  return {
    /** Boot read: index + core + every building chunk (§8.4). Entry chunks load lazily. */
    loadBoot(): BootState {
      const corrupted: CorruptionNotice[] = [];
      const { index, corrupt: indexCorrupt } = readIndex();
      if (indexCorrupt) {
        corrupted.push({
          key: INDEX_KEY,
          reason: "index missing, unparseable, or unrecognized schema — rebuilt from surviving chunk keys",
        });
      }

      const coreResult = readJson<CoreState>(port, CORE_KEY);
      if (coreResult.corrupt) {
        corrupted.push({ key: CORE_KEY, reason: "unparseable core — recovered from surviving entries/buildings" });
      }

      const buildings: Building[] = [];
      for (const ym of index.buildingMonths) {
        const key = buildingsKey(ym);
        const result = readJson<Building[]>(port, key);
        if (result.corrupt) {
          corrupted.push({ key, reason: `unparseable building chunk for ${ym} — quarantined` });
          continue; // quarantine: skip this chunk, keep booting the rest
        }
        buildings.push(...(result.value ?? []));
      }

      // A `core` that parsed fine is ALWAYS authoritative and is never
      // touched below, regardless of whether the index was also corrupt — an
      // index rebuild says nothing about `core.town`'s denormalized fields,
      // and overwriting a surviving core with a guess reconstructed from
      // (possibly incomplete) entries is strictly less informed than the
      // value already in hand.
      let core = coreResult.corrupt ? null : coreResult.value;

      if (core === null && coreResult.corrupt) {
        // The `core` chunk itself is gone — this is the "corrupt-chunk
        // recovery path" spec §8.3 names: reconstruct what's recoverable
        // from surviving entries (rebuildDerived) rather than booting to a
        // state that has silently forgotten every 저축 and every 결산.
        let anyEntryChunkSkipped = false;
        const recoveredEntries: LedgerEntry[] = [];
        for (const ym of index.entryMonths) {
          const key = entriesKey(ym);
          const result = readJson<LedgerEntry[]>(port, key);
          if (result.corrupt) {
            anyEntryChunkSkipped = true;
            corrupted.push({ key, reason: `unparseable entries chunk for ${ym} — skipped during core recovery` });
            continue;
          }
          recoveredEntries.push(...(result.value ?? []));
        }
        if (anyEntryChunkSkipped) {
          // cumulativeSavingsKrw computed below is a sum over only the
          // chunks that parsed — it can only ever be an undercount when a
          // chunk was skipped, never an overcount, so it is safe to use as
          // a floor. Flagged here so a future reconciliation (F12 import,
          // or a manual fix) knows this number may be low, per spec §5
          // F13's AC that the tower must never shrink from data that still
          // exists — it just may not have been counted yet.
          corrupted.push({
            key: CORE_KEY,
            reason: "cumulativeSavingsKrw may be understated — one or more entries chunks were also unreadable",
          });
        }
        // Recovered buildings ARE fully known (buildings chunks were read
        // above independent of the core loss) — reuse their plot indices so
        // a freshly-placed building never collides with one that survived.
        const nextPlotIndex = buildings.reduce((max, b) => Math.max(max, b.plotIndex + 1), 0);
        core = {
          town: { ...defaultTownState(), ...rebuildDerived(recoveredEntries), nextPlotIndex },
          budget: { monthlyBudgetKrw: null, updatedAt: 0 },
          onboarded: true, // ledger data survives — do not re-run onboarding over it
        };
      }

      return { index, core, buildings, corrupted };
    },

    /** Lazily loaded — the current month at boot, others on demand (기록 navigation). */
    loadEntriesForMonth(ym: string): { entries: LedgerEntry[]; corrupt: boolean } {
      const result = readJson<LedgerEntry[]>(port, entriesKey(ym));
      if (result.corrupt) return { entries: [], corrupt: true };
      return { entries: result.value ?? [], corrupt: false };
    },

    loadBuildingsForMonth(ym: string): { buildings: Building[]; corrupt: boolean } {
      const result = readJson<Building[]>(port, buildingsKey(ym));
      if (result.corrupt) return { buildings: [], corrupt: true };
      return { buildings: result.value ?? [], corrupt: false };
    },

    saveCore,

    /** Save one month's entries + core — exactly two `set` calls when the month is already known (F10 AC). */
    saveEntriesForMonth(ym: string, entries: LedgerEntry[], core: CoreState): void {
      writeJson(port, entriesKey(ym), entries);
      saveCore(core);
      registerMonth("entryMonths", ym);
    },

    /** Save one month's buildings. Written alongside `saveEntriesForMonth` whenever a build happens. */
    saveBuildingsForMonth(ym: string, buildings: Building[]): void {
      writeJson(port, buildingsKey(ym), buildings);
      registerMonth("buildingMonths", ym);
    },

    /** Wipes every known key — used by 데이터 초기화 (S6) and by fixture loading (§11). */
    clearAll(): void {
      const { index } = readIndex();
      port.remove(INDEX_KEY);
      port.remove(CORE_KEY);
      for (const ym of index.entryMonths) port.remove(entriesKey(ym));
      for (const ym of index.buildingMonths) port.remove(buildingsKey(ym));
    },
  };
}

/** Default chunked-storage client over the active platform storage port. */
export const chunkedStorage = createChunkedStorage();
