/**
 * Chunked storage — MVP-SPEC.md §8.4 / F10.
 *
 * Month-chunked keys, not one blob: both `localStorage` and the future
 * Apps-in-Toss Storage API re-serialize the entire value on every `set`, so a
 * single growing blob makes every entry save more expensive than the last
 * for the life of the ledger (§13 trade-off 4). Built on the raw `storage`
 * port (`src/platform/storage.ts`) — this file owns the key layout only.
 *
 * Writes are debounced ~300ms and coalesced per key before they reach the raw
 * port (§10 F10: "Writes are debounced (~300ms) and per-chunk atomic") — see
 * `createChunkedStorage`'s `bufferedPort`. Reads always check the pending
 * (not-yet-flushed) write first, so a caller that reads its own write back
 * immediately (the normal in-app case) never sees stale data.
 */
import type { StoragePort } from "./platform/storage";
import { storage as defaultStoragePort } from "./platform/storage";
import { rebuildDerived, savingsByCategory } from "./selectors";
import { savingsBucketOf } from "./savingsBuckets";
import { LAYOUT_VERSION } from "./townLayout";
import type { Building, BudgetSetting, LedgerEntry, QueuedMaterial, TownState } from "./types";

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
  // ADDENDUM-01 §3.6 (rule R-1): optional — an index written before the road
  // layout shipped has none, which is exactly how `loadBoot()` recognizes a
  // pre-existing town and fires the one-time `relayout` notice.
  layoutVersion?: number;
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

/**
 * F12 export/import payload — MVP-SPEC.md §5. `entries`/`buildings` are keyed
 * by 'YYYY-MM' exactly as the chunked layout already stores them (§8.4) — not
 * flattened — so a round trip writes each chunk straight back through
 * `saveEntriesForMonth`/`saveBuildingsForMonth` unchanged, same as
 * `devtools/fixtures.ts`'s `loadFixtureIntoStorage` does for a fixture.
 */
export interface StorageExport {
  schemaVersion: number;
  // ADDENDUM-01 §3.6 (rule R-1) / F12 round-1 finding C2 #3 — carried through
  // the round trip so an old/foreign export keeps that fact on import
  // instead of silently being stamped as the CURRENT layout: `importAll`
  // writes this straight into the rebuilt index rather than letting
  // `emptyIndex()` default it to `LAYOUT_VERSION`, so `loadBoot`'s one-time
  // relayout notice still fires for a genuinely old town moved in from a
  // file (same absent-means-pre-addendum semantics as `StorageIndex`'s own
  // field).
  layoutVersion?: number;
  core: CoreState;
  entries: Record<string, LedgerEntry[]>;
  buildings: Record<string, Building[]>;
}

export type ImportResult = { ok: true } | { ok: false; error: string };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isChunkMap(v: unknown): v is Record<string, unknown[]> {
  return isPlainObject(v) && Object.values(v).every((x) => Array.isArray(x));
}

/**
 * F12 import validation, run BEFORE `importAll` touches storage — an unknown/
 * missing `schemaVersion` and malformed JSON are both rejected here with a
 * visible error, so a rejected file never gets the chance to wipe existing
 * state (AC: "existing state provably untouched").
 */
function parseStorageExport(rawJson: string): { ok: true; data: StorageExport } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { ok: false, error: "파일을 읽을 수 없어요. 올바른 내보내기 파일인지 확인해주세요." };
  }
  if (!isPlainObject(parsed) || parsed.schemaVersion !== SCHEMA_VERSION) {
    return { ok: false, error: "지원하지 않는 데이터 버전이에요." };
  }
  const { core, entries, buildings, layoutVersion } = parsed;
  if (
    !isPlainObject(core) ||
    !isPlainObject(core.town) ||
    !isPlainObject(core.budget) ||
    typeof core.onboarded !== "boolean" ||
    !isChunkMap(entries) ||
    !isChunkMap(buildings) ||
    (layoutVersion !== undefined && typeof layoutVersion !== "number")
  ) {
    return { ok: false, error: "파일 형식이 올바르지 않아요." };
  }
  return {
    ok: true,
    data: {
      schemaVersion: parsed.schemaVersion,
      layoutVersion,
      core: core as unknown as CoreState,
      entries: entries as Record<string, LedgerEntry[]>,
      buildings: buildings as Record<string, Building[]>,
    },
  };
}

export interface BootState {
  index: StorageIndex;
  core: CoreState | null;
  /** Every building across every month chunk — the town view needs all of them (§8.4). */
  buildings: Building[];
  /** Quarantined/reset keys, for F10's "visible one-time notice, never a white screen". */
  corrupted: CorruptionNotice[];
  /**
   * ADDENDUM-01 §3.6 (rule R-1): true exactly once, on the first boot after
   * this ships, for a town that already had buildings before the road
   * layout existed — every building just moved on screen. A genuinely fresh
   * install never sees this (see `emptyIndex()`'s own comment).
   */
  relayout: boolean;
}

/**
 * A genuinely fresh install stamps the CURRENT layout version immediately —
 * it has never rendered any layout, old or new, so there is nothing to
 * "relayout" and nothing to notify about (ADDENDUM-01 §3.6).
 */
function emptyIndex(): StorageIndex {
  return { schemaVersion: SCHEMA_VERSION, layoutVersion: LAYOUT_VERSION, entryMonths: [], buildingMonths: [] };
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

/**
 * A `TownState` with nothing recoverable — used when the `core` chunk itself
 * is lost, and reused as-is by callers of `loadBoot()` for a genuinely fresh
 * install (`core === null`, nothing corrupt): both cases want the same
 * "nothing exists yet" defaults, so this is exported rather than duplicated.
 */
export function defaultTownState(): TownState {
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
    savingsByCategoryKrw: {}, // ADDENDUM-01 §4.1 — explicit `{}`, not "absent", for a fresh town
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

/** Recovers claimed no-spend dates from surviving buildings — `source.kind === 'nospend'` carries the date (§7). */
function recoverNoSpendDays(buildings: readonly Building[]): string[] {
  const days = buildings
    .filter((b): b is Building & { source: { kind: "nospend"; date: string } } => b.source.kind === "nospend")
    .map((b) => b.source.date);
  return [...new Set(days)].sort();
}

/**
 * Recovers the queue of pending materials from surviving entries flagged
 * `queued: true` (F14). `variantIndex` was rolled once at queue time and
 * lives only on the original `QueuedMaterial`, never on the `LedgerEntry` —
 * it cannot be recovered after the `core` chunk that held it is gone, so it
 * is re-rolled to a fixed, valid default (0) rather than left undefined.
 * That is an acceptable loss (the reward for one still-queued item may look
 * different than before) against the alternative of dropping the queue slot
 * entirely, which would silently shrink `materialQueueMax` accounting.
 */
function recoverQueue(entries: readonly LedgerEntry[]): QueuedMaterial[] {
  return entries
    .filter((e) => e.queued)
    .map((e) => ({ entryId: e.id, categoryId: e.categoryId, variantIndex: 0, queuedOn: e.occurredOn, entryYm: e.occurredOn.slice(0, 7) }));
}

const nowMs = (): number => performance.now();

/**
 * Yields one macrotask so the browser can paint/handle input between
 * batches (§10.4 main-thread budget). Exported so other main-thread-bounded
 * work (e.g. `useTownStore.ts`'s F14 boot-time queue drain) can reuse the
 * same yield primitive instead of re-implementing it.
 */
export function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Roughly half a 60fps frame — conservative, not tuned against real hardware (§10.4). */
const MAIN_THREAD_BUDGET_MS = 8;

/**
 * The one time-budgeted iteration primitive every batched pass in this
 * module shares (round-1 F12 finding C3: `exportAll` used to re-implement
 * this same budget/yield loop inline instead of reusing it): runs `fn` once
 * per item, yielding to the main thread whenever more than `budgetMs` of
 * continuous work has elapsed since the last yield. `readBuildingChunksBatched`
 * and F12's `exportAll`/`serializeExport` all go through this rather than
 * each re-timing its own loop.
 */
async function forEachBatched<T>(items: readonly T[], fn: (item: T) => void, budgetMs = MAIN_THREAD_BUDGET_MS): Promise<void> {
  let sliceStart = nowMs();
  for (const item of items) {
    fn(item);
    if (nowMs() - sliceStart > budgetMs) {
      await yieldToMainThread();
      sliceStart = nowMs();
    }
  }
}

/**
 * Reads every building chunk, yielding to the main thread every ~8ms of
 * continuous parsing instead of doing all of it in one blocking pass — the
 * dense fixture (~5,400 buildings across 36 month chunks, §11) is exactly
 * the cost §10.4's <1s initial-paint AC is worried about.
 */
async function readBuildingChunksBatched(
  bufferedPort: StoragePort,
  buildingMonths: readonly string[],
  corrupted: CorruptionNotice[],
): Promise<Building[]> {
  const buildings: Building[] = [];
  await forEachBatched(buildingMonths, (ym) => {
    const key = buildingsKey(ym);
    const result = readJson<Building[]>(bufferedPort, key);
    if (result.corrupt) {
      corrupted.push({ key, reason: `unparseable building chunk for ${ym} — quarantined` });
    } else {
      buildings.push(...(result.value ?? []));
    }
  });
  return buildings;
}

/**
 * F12 export — turns a `StorageExport` into the JSON text a `<a download>`
 * actually writes to disk. Deliberately NOT one `JSON.stringify(data, null,
 * 2)` over the whole state: a dense town's chunk maps are multi-MB once
 * serialized, so stringifying them as a single value is itself an unbounded
 * synchronous step (round-1 finding C4 #2). `core` is small and serialized
 * directly; every entries/buildings chunk is stringified one month at a
 * time through `forEachBatched`, yielding between chunks the same way every
 * other batched pass in this module does — exporting the dense fixture
 * (~5,400 buildings, §11) never blocks the main thread for longer than one
 * chunk's own stringify.
 */
export async function serializeExport(data: StorageExport): Promise<string> {
  const entryParts: string[] = [];
  await forEachBatched(Object.keys(data.entries), (ym) => {
    entryParts.push(`${JSON.stringify(ym)}:${JSON.stringify(data.entries[ym])}`);
  });
  const buildingParts: string[] = [];
  await forEachBatched(Object.keys(data.buildings), (ym) => {
    buildingParts.push(`${JSON.stringify(ym)}:${JSON.stringify(data.buildings[ym])}`);
  });
  const layoutVersionField = data.layoutVersion === undefined ? "" : `,"layoutVersion":${data.layoutVersion}`;
  return (
    `{"schemaVersion":${data.schemaVersion}${layoutVersionField},"core":${JSON.stringify(data.core)},` +
    `"entries":{${entryParts.join(",")}},"buildings":{${buildingParts.join(",")}}}`
  );
}

const DEBOUNCE_MS = 300;

/** Builds a chunked-storage client over any `StoragePort` (defaults to the browser driver). */
export function createChunkedStorage(port: StoragePort = defaultStoragePort) {
  // ── Debounced write buffer (§10 F10: "~300ms debounced, per-chunk atomic") ──
  // Every `set` lands here first; the underlying `port.set` only fires once
  // per key, ~300ms after the last write to that key, coalescing bursts (e.g.
  // several `saveEntriesForMonth` calls in quick succession) into one real
  // write. `get`/`keys` check this buffer first so a caller reading its own
  // just-written data (the normal in-app path) never has to wait for the
  // flush — only an external change to the raw port (or a genuinely fresh
  // read before anything was ever written) falls through to `port` itself.
  const pending = new Map<string, string>();
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  function flushPendingWrites(): void {
    if (flushTimer !== null) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    for (const [key, value] of pending) port.set(key, value);
    pending.clear();
  }

  const bufferedPort: StoragePort = {
    get: (key) => (pending.has(key) ? (pending.get(key) as string) : port.get(key)),
    set: (key, value) => {
      pending.set(key, value);
      if (flushTimer === null) flushTimer = setTimeout(flushPendingWrites, DEBOUNCE_MS);
    },
    remove: (key) => {
      pending.delete(key);
      port.remove(key);
    },
    keys: () => [...new Set([...port.keys(), ...pending.keys()])],
  };

  function readIndex(): { index: StorageIndex; corrupt: boolean } {
    const result = readJson<StorageIndex>(bufferedPort, INDEX_KEY);
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
      const rebuilt = rebuildIndexFromKeys(bufferedPort);
      // Self-heal immediately rather than waiting for the next registerMonth
      // call: every caller (loadBoot, registerMonth, clearAll) shares this
      // function, so persisting the fix here means the corruption is
      // resolved after the first read that notices it, not left sitting in
      // storage until something happens to trigger a write.
      writeJson(bufferedPort, INDEX_KEY, rebuilt);
      return { index: rebuilt, corrupt: true };
    }
    return { index: result.value, corrupt: false };
  }

  function registerMonth(list: "entryMonths" | "buildingMonths", ym: string): void {
    const { index } = readIndex();
    if (index[list].includes(ym)) return; // already registered — no extra write
    index[list] = [...index[list], ym].sort();
    writeJson(bufferedPort, INDEX_KEY, index);
  }

  function saveCore(core: CoreState): void {
    writeJson(bufferedPort, CORE_KEY, core);
  }

  /** Save one month's entries + core — exactly two chunk keys touched when the month is already known (F10 AC), debounced before reaching the raw port. */
  function saveEntriesForMonth(ym: string, entries: LedgerEntry[], core: CoreState): void {
    writeJson(bufferedPort, entriesKey(ym), entries);
    saveCore(core);
    registerMonth("entryMonths", ym);
  }

  /** Save one month's buildings. Written alongside `saveEntriesForMonth` whenever a build happens. */
  function saveBuildingsForMonth(ym: string, buildings: Building[]): void {
    writeJson(bufferedPort, buildingsKey(ym), buildings);
    registerMonth("buildingMonths", ym);
  }

  /** Wipes every known key — used by 데이터 초기화 (S6), fixture loading (§11), and F12 import (the old state must not linger under a key the imported file never touches). */
  function clearAll(): void {
    const { index } = readIndex();
    bufferedPort.remove(INDEX_KEY);
    bufferedPort.remove(CORE_KEY);
    for (const ym of index.entryMonths) bufferedPort.remove(entriesKey(ym));
    for (const ym of index.buildingMonths) bufferedPort.remove(buildingsKey(ym));
    // Drop anything still pending too — a flush after clearAll must never
    // resurrect data that was just wiped.
    if (flushTimer !== null) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    pending.clear();
  }

  /**
   * F12 export — reads every chunk back out through the same helpers
   * `loadBoot` uses (`readIndex`, `readJson`, the chunk key builders),
   * batched through the same `forEachBatched` primitive `readBuildingChunksBatched`
   * uses (§10.4 main-thread budget) so exporting a dense fixture's state does
   * not block the UI (rubric C4). Returns chunks exactly as stored — nothing
   * flattened or re-derived — so `importAll` can write them straight back.
   * `layoutVersion` rides along so an old/foreign export still carries that
   * fact through the round trip (`StorageExport`'s own doc comment).
   */
  async function exportAll(): Promise<StorageExport> {
    const { index } = readIndex();
    const coreResult = readJson<CoreState>(bufferedPort, CORE_KEY);
    const core: CoreState =
      coreResult.value ?? { town: defaultTownState(), budget: { monthlyBudgetKrw: null, updatedAt: 0 }, onboarded: false };
    const entries: Record<string, LedgerEntry[]> = {};
    const buildings: Record<string, Building[]> = {};
    await forEachBatched(index.entryMonths, (ym) => {
      entries[ym] = readJson<LedgerEntry[]>(bufferedPort, entriesKey(ym)).value ?? [];
    });
    await forEachBatched(index.buildingMonths, (ym) => {
      buildings[ym] = readJson<Building[]>(bufferedPort, buildingsKey(ym)).value ?? [];
    });
    return { schemaVersion: SCHEMA_VERSION, layoutVersion: index.layoutVersion, core, entries, buildings };
  }

  /**
   * F12 import — validates first (`parseStorageExport`), touching nothing on
   * failure, then replaces every chunk through the exact same public write
   * path `devtools/fixtures.ts`'s `loadFixtureIntoStorage` uses (`clearAll`
   * -> `saveCore` -> `saveEntriesForMonth`/`saveBuildingsForMonth` per
   * month) — import is structurally that same "write a full state blob
   * through the chunked API in one pass" operation, just sourced from a
   * downloaded file instead of a fixture object.
   *
   * The index is written directly here (round-1 finding C2 #3), BEFORE any
   * `saveEntriesForMonth`/`saveBuildingsForMonth` call below: those go
   * through `registerMonth`, which only touches the index when a month isn't
   * already listed, so pre-populating it with the imported `layoutVersion`
   * (possibly absent, for an old/foreign export) is what stops
   * `emptyIndex()`'s "genuinely fresh install" default from silently
   * stamping an imported old town as the CURRENT layout — without this, the
   * one-time relayout notice (ADDENDUM-01 §3.6) could never fire again.
   */
  function importAll(rawJson: string): ImportResult {
    const parsed = parseStorageExport(rawJson);
    if (!parsed.ok) return parsed;
    const { core, entries, buildings, layoutVersion } = parsed.data;
    clearAll();
    const index: StorageIndex = {
      schemaVersion: SCHEMA_VERSION,
      layoutVersion,
      entryMonths: Object.keys(entries).sort(),
      buildingMonths: Object.keys(buildings).sort(),
    };
    writeJson(bufferedPort, INDEX_KEY, index);
    saveCore(core);
    for (const [ym, monthEntries] of Object.entries(entries)) saveEntriesForMonth(ym, monthEntries, core);
    for (const [ym, monthBuildings] of Object.entries(buildings)) saveBuildingsForMonth(ym, monthBuildings);
    return { ok: true };
  }

  return {
    /** Boot read: index + core + every building chunk (§8.4). Entry chunks load lazily. */
    async loadBoot(): Promise<BootState> {
      const corrupted: CorruptionNotice[] = [];
      const { index, corrupt: indexCorrupt } = readIndex();
      if (indexCorrupt) {
        corrupted.push({
          key: INDEX_KEY,
          reason: "index missing, unparseable, or unrecognized schema — rebuilt from surviving chunk keys",
        });
      }

      const coreResult = readJson<CoreState>(bufferedPort, CORE_KEY);
      if (coreResult.corrupt) {
        corrupted.push({ key: CORE_KEY, reason: "unparseable core — recovered from surviving entries/buildings" });
      }

      const buildings = await readBuildingChunksBatched(bufferedPort, index.buildingMonths, corrupted);

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
          const result = readJson<LedgerEntry[]>(bufferedPort, key);
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
        // noSpendDays and queue were already fully recoverable from data this
        // same function reads anyway (buildings above, recoveredEntries
        // here) — dropping them to defaultTownState()'s `[]` would let a
        // previously-claimed 무지출 데이 become re-claimable (F15's guard is
        // `town.noSpendDays.includes(today)`) and would silently forget every
        // still-queued material (F14).
        core = {
          town: {
            ...defaultTownState(),
            ...rebuildDerived(recoveredEntries),
            savingsByCategoryKrw: savingsByCategory(recoveredEntries, savingsBucketOf), // ADDENDUM-01 §4.2
            nextPlotIndex,
            noSpendDays: recoverNoSpendDays(buildings),
            queue: recoverQueue(recoveredEntries),
          },
          budget: { monthlyBudgetKrw: null, updatedAt: 0 },
          onboarded: true, // ledger data survives — do not re-run onboarding over it
        };
      }

      // ADDENDUM-01 §3.6 (rule R-1): an index written before the road layout
      // shipped has no `layoutVersion` (reads as 0). Both the notice AND the
      // index rewrite are gated on "buildings actually exist" — a town with
      // zero buildings has never rendered any layout, old or new, so there is
      // nothing to relayout and stamping it here (rather than waiting for the
      // first real relayout) would be a claim about a move that never
      // happened. `emptyIndex()` already stamps the current version for a
      // genuinely fresh install, so this branch only ever fires for a town
      // that predates this change.
      const layoutMismatch = (index.layoutVersion ?? 0) !== LAYOUT_VERSION;
      const relayout = layoutMismatch && buildings.length > 0;
      const finalIndex = relayout ? { ...index, layoutVersion: LAYOUT_VERSION } : index;
      if (relayout) writeJson(bufferedPort, INDEX_KEY, finalIndex);

      return { index: finalIndex, core, buildings, corrupted, relayout };
    },

    /** Lazily loaded — the current month at boot, others on demand (기록 navigation). */
    loadEntriesForMonth(ym: string): { entries: LedgerEntry[]; corrupt: boolean } {
      const result = readJson<LedgerEntry[]>(bufferedPort, entriesKey(ym));
      if (result.corrupt) return { entries: [], corrupt: true };
      return { entries: result.value ?? [], corrupt: false };
    },

    loadBuildingsForMonth(ym: string): { buildings: Building[]; corrupt: boolean } {
      const result = readJson<Building[]>(bufferedPort, buildingsKey(ym));
      if (result.corrupt) return { buildings: [], corrupt: true };
      return { buildings: result.value ?? [], corrupt: false };
    },

    saveCore,
    saveEntriesForMonth,
    saveBuildingsForMonth,

    /**
     * Forces any debounced writes to the raw port immediately — call before
     * anything that reads/writes the raw port directly (a `beforeunload`
     * handler; a dev tool that then deliberately corrupts a key to
     * demonstrate F10 recovery), and before tearing down a page where a
     * pending 300ms timer would otherwise never fire.
     */
    flush(): void {
      flushPendingWrites();
    },

    clearAll,

    /** F12 — serializes every chunk plus the core into one downloadable blob (MVP-SPEC §5). */
    exportAll,

    /** F12 — validates then replaces every chunk (MVP-SPEC §5); untouched on validation failure. */
    importAll,
  };
}

/** Default chunked-storage client over the active platform storage port. */
export const chunkedStorage = createChunkedStorage();
