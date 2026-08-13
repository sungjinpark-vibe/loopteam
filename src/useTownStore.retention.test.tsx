/**
 * Integration coverage for this task's retention layer (F4/F5/F7/F14/F15),
 * driven through the real hook (storage + pure domain functions together),
 * matching the harness pattern `useTownStore.test.tsx` (T003) already
 * established — mount, act, remount to simulate a reload/day-advance.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BALANCE } from "./balance.approved";
import type { EntryDraft } from "./entryActions";
import { setTimeTravelDate } from "./platform/clock";
import { createChunkedStorage, defaultTownState, type CoreState } from "./storage";
import type { LedgerEntry } from "./types";
import { useTownStore } from "./useTownStore";

let container: HTMLDivElement;
let root: Root;
let latest: ReturnType<typeof useTownStore> | null = null;
// Only read by the C4 perf test below — every other test ignores it.
let renderCount = 0;

function Harness() {
  renderCount++;
  latest = useTownStore();
  return null;
}

async function mountAndWaitForBoot(): Promise<void> {
  root = createRoot(container);
  latest = null;
  await act(async () => {
    root.render(<Harness />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function remount(): Promise<void> {
  act(() => {
    window.dispatchEvent(new Event("pagehide")); // flush the debounced writes, same as a real reload
    root.unmount();
  });
  await mountAndWaitForBoot();
}

function expenseDraft(occurredOn: string, memo: string): EntryDraft {
  return { type: "expense", amountKrw: 5_000, categoryId: "cafe", occurredOn, memo };
}

const DAY1 = "2026-08-02";
const DAY2 = "2026-08-03";

beforeEach(() => {
  window.localStorage.clear();
  setTimeTravelDate(DAY1);
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  setTimeTravelDate(null);
});

describe("F4 daily slot reset + F14 queue drain, across a real reload", () => {
  it("fills the queue past the cap, then drains it exactly on the next day's reopen", async () => {
    await mountAndWaitForBoot();
    expect(latest?.dailyBuildSlots).toBe(BALANCE.dailyBuildSlots); // 10, per balance.approved.ts
    expect(latest?.notice).toBeNull(); // nothing was pending on a fresh boot

    // cap(5) + 3 over — the first 5 build, the last 3 queue. `addEntry`'s
    // OWN return value (not the stale `store.queueLength` closure) must
    // report the queue length AFTER each push — round-1 finding C1: the
    // toast in App.tsx read one save behind reality.
    const queueLengthsSeen: number[] = [];
    for (let i = 0; i < BALANCE.dailyBuildSlots + 3; i++) {
      act(() => {
        const result = latest!.addEntry(expenseDraft(DAY1, `e${i}`));
        if (result.queued) queueLengthsSeen.push(result.queueLength);
      });
    }
    expect(queueLengthsSeen).toEqual([1, 2, 3]); // one push each — never off by one
    expect(latest?.buildingCount).toBe(BALANCE.dailyBuildSlots);
    expect(latest?.slotsRemaining).toBe(0);
    expect(latest?.queueLength).toBe(3);

    // Advance the date by one day and reopen (F4 AC).
    setTimeTravelDate(DAY2);
    await remount();
    expect(latest?.slotsRemaining).toBe(BALANCE.dailyBuildSlots - 3); // 3 slots spent draining the queue
    expect(latest?.buildingCount).toBe(BALANCE.dailyBuildSlots + 3); // all 3 queued materials rose
    expect(latest?.queueLength).toBe(0);
    // The boot-time drain reports itself (spec §5 F14: "with a summary
    // toast") — App.tsx turns this into the toast; here we drive the notice
    // the toast is built from, one-shot until dismissed (queued alongside
    // corruption/tier notices, useTownStore.ts's `Notice`).
    expect(latest?.notice).toEqual({ kind: "drained", count: 3 });
    act(() => latest!.dismissNotice());
    expect(latest?.notice).toBeNull();

    // Advancing backward must NOT hand out a fresh cap (F4 AC).
    setTimeTravelDate(DAY1);
    await remount();
    expect(latest?.slotsRemaining).toBe(BALANCE.dailyBuildSlots - 3); // unchanged, not reset to 5
    // F4's own concern — nothing DRAIN-related fires on a reopen with an
    // empty queue — still holds. ADDENDUM-02 §4.5 is a separate, correct,
    // orthogonal boot-time check: this town now has 8 buildings and
    // `moveHintSeen` was never set (never dismissed nor moved in this test),
    // so THIS reopen is exactly the boot where the hint is expected to
    // appear — round-2 finding C1 #1's fix (`useTownStore.move.test.tsx`
    // covers the hint's own ACs in isolation; this assertion only needs to
    // not regress into treating a real hint as a bug).
    expect(latest?.notice).toEqual({ kind: "moveHint" });
  });

  it("ADDENDUM-04 §6 — a queued material carries its amount through the drain and founds at the matching level", async () => {
    await mountAndWaitForBoot();
    // Fill every slot with small entries (their own exp doesn't matter here)
    // so the cap is hit, then one more — large enough (>= 150,000) to land
    // in `BALANCE.expAmountTiers`' top tier (gain 12) — that must queue
    // instead of building today.
    for (let i = 0; i < BALANCE.dailyBuildSlots; i++) {
      act(() => {
        latest!.addEntry(expenseDraft(DAY1, `fill${i}`));
      });
    }
    act(() => {
      const result = latest!.addEntry({ type: "expense", amountKrw: 250_000, categoryId: "cafe", occurredOn: DAY1, memo: "big" });
      expect(result.queued).toBe(true);
    });

    setTimeTravelDate(DAY2);
    await remount();

    // DAY1/DAY2 share the same month (2026-08) — read the queued entry's own
    // (now-patched) `buildingId` off it rather than depending on a
    // queue-internal id.
    const queuedEntry = latest!.getMonthEntries("2026-08").find((e) => e.memo === "big");
    expect(queuedEntry?.buildingId).not.toBeNull();
    const drainedBuilding = latest!.buildings.find((b) => b.id === queuedEntry?.buildingId);
    // 250,000 -> gain 12 (BALANCE.expAmountTiers' [Infinity, 12] tier) ->
    // founding exp = the full gain (Gate-3-rerun fix: no longer `gain - 1`),
    // same parity rule a same-day founding save gets (ADDENDUM-04 §5/§7) —
    // never the old flat implicit gain 1 this task closed.
    //
    // Restored to 12 alongside commit bed6cca, which put `expAmountTiers` back
    // to the director-confirmed table the user re-confirmed on 2026-08-12; the
    // round-5 per-entry cap (0/1/2/3/3) this line was retuned for was NOT
    // adopted, so the expectation had to follow the table back.
    expect(drainedBuilding?.exp).toBe(12);
    expect(BALANCE.expAmountTiers).not.toBeNull(); // sanity: the dial this test depends on is actually on
  });
});

describe("F14 drain patches a backdated entry's OWN month chunk — round-2 finding C2 #2", () => {
  it("patches the queued material's ledger row in the month it actually occurred, not the month it queued in", async () => {
    await mountAndWaitForBoot();

    // Fill all 5 of DAY1's slots with today-dated entries.
    for (let i = 0; i < BALANCE.dailyBuildSlots; i++) {
      act(() => {
        latest!.addEntry(expenseDraft(DAY1, `fill${i}`));
      });
    }
    expect(latest?.slotsRemaining).toBe(0);

    // One more entry, BACKDATED to a different month than DAY1 (August) —
    // no slot remains, so it queues. Its own ledger row lives in JULY's
    // chunk (occurredOn), even though it queued on an August day.
    const PAST_MONTH_DAY = "2026-07-20";
    act(() => {
      latest!.addEntry(expenseDraft(PAST_MONTH_DAY, "backdated"));
    });
    expect(latest?.queueLength).toBe(1);

    // Advance a day and reopen — the drain builds it.
    setTimeTravelDate(DAY2);
    await remount();
    expect(latest?.queueLength).toBe(0);
    expect(latest?.notice).toEqual({ kind: "drained", count: 1 });

    // Force the newly-mounted instance's own debounced writes down to real
    // storage (same "flush before an external read" discipline storage.ts's
    // own doc comment calls for) before reading it back through a SEPARATE
    // client instance below.
    act(() => window.dispatchEvent(new Event("pagehide")));

    // The entry's OWN chunk (July, not August) must be patched: queued:false
    // and a real buildingId — not left permanently `queued: true` (which
    // would make storage.ts's recoverQueue resurrect and rebuild it a
    // second time on any future core-chunk loss).
    const inspector = createChunkedStorage();
    const { entries: julyEntries } = inspector.loadEntriesForMonth("2026-07");
    const backdated = julyEntries.find((e) => e.memo === "backdated");
    expect(backdated?.queued).toBe(false);
    expect(backdated?.buildingId).not.toBeNull();
  });
});

describe("F5 tier celebration", () => {
  it("fires once on a fresh upward crossing and never again for the same threshold", async () => {
    await mountAndWaitForBoot();
    const thresholds = BALANCE.tierThresholds; // [0, 10, 30, 80, 200]
    // Fill up to (but not past) the second threshold (10), one entry per day so nothing ever queues.
    let day = 1;
    for (let i = 0; i < thresholds[1]; i++) {
      const dateStr = `2026-08-${String(day).padStart(2, "0")}`;
      setTimeTravelDate(dateStr);
      if (i > 0) await remount();
      act(() => {
        latest!.addEntry(expenseDraft(dateStr, `t${i}`));
      });
      // ADDENDUM-02 §4.5 — orthogonal to this test's F5 concern: each of
      // THESE remounts is also a boot with buildingCount >= 2 and
      // `moveHintSeen` unset, so it correctly (re-)queues the move hint
      // (round-2 finding C1 #1's fix) whenever the notice queue happens to be
      // empty at that boot. Clearing it out of the way here keeps THIS test
      // scoped to tier notices — `useTownStore.move.test.tsx` covers the
      // hint's own ACs (including that it does NOT re-queue once actually
      // persisted as seen).
      if (latest?.notice?.kind === "moveHint") act(() => latest!.dismissNotice());
      day++;
    }
    expect(latest?.buildingCount).toBe(thresholds[1]);
    expect(latest?.notice).toEqual({ kind: "tier", tier: 1 }); // crossed tierThresholds[1] on the 10th building

    act(() => latest!.dismissNotice());
    expect(latest?.notice).toBeNull();

    // Reopening (no new building) must not re-fire it.
    await remount();
    if (latest?.notice?.kind === "moveHint") act(() => latest!.dismissNotice()); // see above — orthogonal to F5
    expect(latest?.notice).toBeNull();
  });
});

describe("F7 streak", () => {
  it("two acts the same day count once; skipping a day resets to 1 but keeps the record", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.addEntry(expenseDraft(DAY1, "a"));
    });
    expect(latest?.streakDays).toBe(1);
    act(() => {
      latest!.addEntry(expenseDraft(DAY1, "b"));
    });
    expect(latest?.streakDays).toBe(1); // second act same day — no double count

    setTimeTravelDate(DAY2);
    await remount();
    act(() => {
      latest!.addEntry(expenseDraft(DAY2, "c"));
    });
    expect(latest?.streakDays).toBe(2);
    expect(latest?.longestStreakDays).toBe(2);

    // Skip a day (2026-08-05, leaving 08-04 untouched) — streak resets to 1, record survives.
    setTimeTravelDate("2026-08-05");
    await remount();
    act(() => {
      latest!.addEntry(expenseDraft("2026-08-05", "d"));
    });
    expect(latest?.streakDays).toBe(1);
    expect(latest?.longestStreakDays).toBe(2);
  });
});

// F16 — seeds a stale `lastSettledPeriod` (+ optional past-month entries)
// straight into real storage with a throwaway client, flushed BEFORE the
// harness's own boot ever reads it — same "write with one client, flush,
// read with another" approach `useTownStore.reconcile.test.tsx` uses for its
// own pre-boot fixtures. Must run before `mountAndWaitForBoot()`.
function seedUnsettled(lastSettledPeriod: string, budgetKrw: number | null, entriesByMonth: Record<string, LedgerEntry[]> = {}): void {
  const seeder = createChunkedStorage();
  const core: CoreState = {
    town: { ...defaultTownState(), lastSettledPeriod },
    budget: { monthlyBudgetKrw: budgetKrw, updatedAt: 0 },
    onboarded: true,
  };
  seeder.saveCore(core);
  for (const [ym, entries] of Object.entries(entriesByMonth)) {
    seeder.saveEntriesForMonth(ym, entries, core);
  }
  seeder.flush();
}

let seedSeq = 0;
function pastEntry(occurredOn: string, amountKrw: number): LedgerEntry {
  seedSeq++;
  return {
    id: `seed${seedSeq}`,
    type: "expense",
    amountKrw,
    categoryId: "food",
    occurredOn,
    createdAt: 0,
    updatedAt: 0,
    buildingId: null,
    queued: false,
  };
}

describe("F16 monthly settlement, through the store", () => {
  it("settles an unsettled 3-month gap, minting a monument only for the month that has entries (Gate-3-rerun fix: zero-activity months settle with no monument), and reopening mints nothing further", async () => {
    // lastSettledPeriod stale by 3 -> unsettled: 2026-05, 06, 07 (today, DAY1, is 2026-08-02).
    // 2026-05 gets a real entry; 06/07 stay empty (the zero-entry AC) and earn no monument.
    seedUnsettled("2026-04", 300_000, { "2026-05": [pastEntry("2026-05-10", 50_000)] });
    await mountAndWaitForBoot();

    const monuments = latest!.buildings.filter((b) => b.source.kind === "monument");
    expect(monuments).toHaveLength(1);
    expect((monuments[0].source as { period: string }).period).toBe("2026-05");
    expect(monuments[0].categoryId).toBeNull();
    expect(monuments[0].builtOn).toBe(DAY1);
    expect(monuments[0].monumentSummary?.outcomeBucket).not.toBe(0); // has an entry + a budget

    // All 3 months are still marked settled (06/07 just claimed no plot) —
    // proven by nothing minting again on a same-day reopen.
    await remount();
    expect(latest?.buildings.filter((b) => b.source.kind === "monument")).toHaveLength(1);
  });

  it("shows a one-time 지난달 결산 card for the most recently settled month, which does not reappear after dismissal — even across a reload", async () => {
    // Gate-3-rerun fix: a monument-less (zero-activity) month no longer
    // carries a summary at all, so a real entry is needed here to still
    // exercise the card's own one-time/dedup mechanism (below covers the
    // zero-activity case separately).
    seedUnsettled("2026-06", 300_000, { "2026-07": [pastEntry("2026-07-10", 20_000)] }); // one unsettled month: 2026-07
    await mountAndWaitForBoot();

    expect(latest?.notice).toMatchObject({ kind: "settlement", summary: { period: "2026-07" } });
    act(() => latest!.dismissNotice());
    expect(latest?.notice?.kind).not.toBe("settlement");

    await remount(); // reload — settlement is idempotent, so nothing new to announce
    expect(latest?.notice?.kind).not.toBe("settlement");
  });

  // Gate-3-rerun fix — companion to the monument fix above: a month with
  // nothing in it settles silently (no monument, no "결산" card either) so
  // it never reads as a finished result for a month the player didn't live.
  it("a zero-activity settled month shows no 지난달 결산 card at all", async () => {
    seedUnsettled("2026-06", 300_000); // one unsettled month: 2026-07, no entries seeded
    await mountAndWaitForBoot();
    expect(latest?.notice?.kind).not.toBe("settlement");
    expect(latest?.buildings.filter((b) => b.source.kind === "monument")).toHaveLength(0);
  });

  // Gate-3 round-3 TOP FIX, unanimous across all five expert lenses: a
  // genuinely FRESH town (no seeded core — real onboarding via `freshCore`,
  // not `seedUnsettled`) must settle its OWN founding month once that month
  // closes. Previously `lastSettledPeriod` was seeded to the founding month
  // itself, which `unsettledPeriods` treats as "already settled" — so the
  // founding month could never close, for the life of the install.
  it("a real fresh town (freshCore) settles its own founding month at the next month boundary", async () => {
    await mountAndWaitForBoot(); // fresh install, DAY1 = 2026-08-02, no core in storage
    act(() => {
      latest!.addEntry(expenseDraft(DAY1, "first spend"));
    });
    expect(latest?.buildings.filter((b) => b.source.kind === "monument")).toHaveLength(0);
    act(() => window.dispatchEvent(new Event("pagehide"))); // flush debounced writes without unmounting
    let core = (await createChunkedStorage().loadBoot()).core;
    expect(core?.town.lastSettledPeriod).toBe("2026-07"); // month BEFORE founding, not founding itself

    setTimeTravelDate("2026-09-03"); // roll past the month boundary
    await remount();
    act(() => window.dispatchEvent(new Event("pagehide"))); // flush this instance's own debounced writes

    core = (await createChunkedStorage().loadBoot()).core;
    expect(core?.town.lastSettledPeriod).toBe("2026-08");
    const monuments = latest!.buildings.filter((b) => b.source.kind === "monument");
    expect(monuments).toHaveLength(1);
    expect((monuments[0].source as { period: string }).period).toBe("2026-08");
    expect(latest?.notice).toMatchObject({ kind: "settlement", summary: { period: "2026-08" } });
  });
});

describe("F15 무지출 데이 claim + revocation", () => {
  it("claim counts as a streak act, hides the button, and is undone by a same-day expense", async () => {
    await mountAndWaitForBoot();
    expect(latest?.canClaimNoSpend).toBe(true);

    // `claimNoSpend` now returns a result object (null = rejected) so the
    // caller can tell "park built" from "park deferred to tomorrow" on a full
    // town — the accept/reject assertions below are unchanged.
    let claimed = false;
    act(() => {
      claimed = latest!.claimNoSpend() !== null;
    });
    expect(claimed).toBe(true);
    expect(latest?.buildingCount).toBe(1);
    expect(latest?.buildings[0]?.source).toEqual({ kind: "nospend", date: DAY1 });
    expect(latest?.slotsRemaining).toBe(BALANCE.dailyBuildSlots - 1);
    expect(latest?.streakDays).toBe(1);
    expect(latest?.canClaimNoSpend).toBe(false); // hidden: already claimed today

    // Claiming again the same day must be rejected by the domain function, not just hidden.
    let secondClaim = true;
    act(() => {
      secondClaim = latest!.claimNoSpend() !== null;
    });
    expect(secondClaim).toBe(false);
    expect(latest?.buildingCount).toBe(1);

    // Logging a same-day expense revokes it: park removed, slot refunded, expense builds normally.
    act(() => {
      latest!.addEntry(expenseDraft(DAY1, "oops"));
    });
    expect(latest?.buildingCount).toBe(1); // park (-1) + new building (+1) — net unchanged
    expect(latest?.buildings.some((b) => b.source.kind === "nospend")).toBe(false);
    expect(latest?.buildings.some((b) => b.source.kind === "entry")).toBe(true);
    expect(latest?.slotsRemaining).toBe(BALANCE.dailyBuildSlots - 1); // refunded then re-spent — net -1, not -2
    expect(latest?.canClaimNoSpend).toBe(false); // an expense now exists today
  });

  it("hides the button once any 지출 exists for today, before any claim", async () => {
    await mountAndWaitForBoot();
    act(() => {
      latest!.addEntry(expenseDraft(DAY1, "coffee"));
    });
    expect(latest?.canClaimNoSpend).toBe(false);
  });

  it("revokes a PAST-date claim living in a DIFFERENT month's chunk, with no slot refund — round-1 finding C1", async () => {
    const PAST_DAY = "2026-07-15"; // a different month than DAY1/DAY2 (August)
    setTimeTravelDate(PAST_DAY);
    await mountAndWaitForBoot();

    let claimed = false;
    act(() => {
      claimed = latest!.claimNoSpend() !== null;
    });
    expect(claimed).toBe(true);
    expect(latest?.buildings.some((b) => b.source.kind === "nospend" && b.source.date === PAST_DAY)).toBe(true);

    // Jump forward to a different month and do a REAL reload (not just a
    // state mutation) before touching the claimed date again.
    setTimeTravelDate(DAY1); // 2026-08-02
    await remount();
    const baselineSlots = latest!.slotsRemaining;
    expect(baselineSlots).toBe(BALANCE.dailyBuildSlots); // July's usage is stale by August — full cap

    // Log an expense backdated to the already-claimed PAST_DAY. This must
    // revoke the claim (remove the park from JULY's building chunk, not
    // today's) but must NOT refund a slot — the revoked date isn't today.
    act(() => {
      latest!.addEntry(expenseDraft(PAST_DAY, "late entry"));
    });
    expect(latest?.buildings.some((b) => b.source.kind === "nospend" && b.source.date === PAST_DAY)).toBe(false);
    // The new expense still rises TODAY regardless of the backdated
    // occurredOn (entryActions.ts) — exactly one slot spent, nothing refunded.
    expect(latest?.slotsRemaining).toBe(baselineSlots - 1);

    // Reload again: proves the park's removal was actually PERSISTED to
    // July's own chunk, not just filtered out of this render's in-memory
    // state — a fresh hook instance must not resurrect it.
    await remount();
    expect(latest?.buildings.some((b) => b.source.kind === "nospend" && b.source.date === PAST_DAY)).toBe(false);
    expect(latest?.slotsRemaining).toBe(baselineSlots - 1);
  });
});

// Round-2 finding C4: no measurement was captured for the boot-time drain
// path (load -> map -> save per month chunk, behind the loading screen,
// before first paint). This does not replace real render-count/timing
// profiling in an actual browser, but it is concrete, re-runnable evidence
// instead of none: a queue at `materialQueueMax` drains in a bounded number
// of commits and under a generous (jsdom, not tuned hardware) time budget.
describe("F14 boot-time drain — performance evidence", () => {
  it("drains a full queue in a small, fixed number of renders and well under budget", async () => {
    await mountAndWaitForBoot();
    for (let i = 0; i < BALANCE.dailyBuildSlots + BALANCE.materialQueueMax; i++) {
      act(() => {
        latest!.addEntry(expenseDraft(DAY1, `q${i}`));
      });
    }
    expect(latest?.queueLength).toBe(BALANCE.materialQueueMax);

    setTimeTravelDate(DAY2);
    renderCount = 0;
    const start = performance.now();
    await remount();
    const elapsedMs = performance.now() - start;

    // Day 2 only has `dailyBuildSlots` fresh slots — it drains that many off
    // the front of the queue, not the whole thing (materialQueueMax > dailyBuildSlots here).
    expect(latest?.queueLength).toBe(BALANCE.materialQueueMax - BALANCE.dailyBuildSlots);
    expect(latest?.notice).toEqual({ kind: "drained", count: BALANCE.dailyBuildSlots });
    // One render for the "불러오는 중…" loading state, one for the loaded
    // state — the drain's storage side effects (`drainQueueAndPersist`) run
    // inside the SAME boot effect before `setState` commits, not as one
    // extra render per drained item.
    expect(renderCount).toBeLessThanOrEqual(2);
    expect(elapsedMs).toBeLessThan(1000);
  });
});

// Round-3 finding C2: reconcilePlacement's boot-time saveCore/saveBuildingsForMonth
// writes (§3.6) made a PRE-EXISTING gap much more likely to bite — every
// `storageRef` is a `createChunkedStorage()` instance whose debounced writes
// are buffered in-memory and flushed to the SHARED real `window.localStorage`
// only via an explicit `pagehide`/`flush()` call or its own ~300ms timer. A
// component teardown that is neither of those (a test's bare `unmount()`; any
// future non-pagehide unmount) used to leave that timer dangling, still
// pointed at the same storage keys every other test in this file also
// writes — a slow full-suite run could let it fire mid a LATER test and
// silently overwrite that test's fresh state with a stale snapshot (observed:
// `slotsRemaining` short by exactly the slots a stale core snapshot had
// already spent). Proven by QA's stash bisect: pre-task HEAD ran this same
// suite 5/5 clean; post-task it failed ~30-50% of full-suite runs, always in
// this file, always as a wrong domain value rather than a timeout.
//
// This test proves the fix directly and deterministically — no real 300ms
// wait, no `pagehide` dispatch — by asserting a write is ALREADY visible to a
// fresh, independent storage client the instant `unmount()` returns.
describe("storage flush on component unmount — round-3 finding C2 regression", () => {
  it("commits pending debounced writes to real storage on unmount, with no pagehide and no wait", async () => {
    const localContainer = document.createElement("div");
    document.body.appendChild(localContainer);
    const localRoot = createRoot(localContainer);
    let hookResult: ReturnType<typeof useTownStore> | null = null;
    function LocalHarness() {
      hookResult = useTownStore();
      return null;
    }
    await act(async () => {
      localRoot.render(<LocalHarness />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    act(() => {
      hookResult!.addEntry(expenseDraft(DAY1, "unflushed-on-unmount"));
    });

    // Bare teardown — deliberately NOT the `pagehide`/`remount()` pattern
    // every other test in this file uses to force a flush.
    act(() => localRoot.unmount());
    localContainer.remove();

    // A brand-new client, reading straight from real localStorage (nothing
    // buffered of its own) — if the unmounted instance's write is not
    // already committed, this reads it as absent.
    const inspector = createChunkedStorage();
    const { entries } = inspector.loadEntriesForMonth(DAY1.slice(0, 7));
    expect(entries.some((e) => e.memo === "unflushed-on-unmount")).toBe(true);
  });
});
