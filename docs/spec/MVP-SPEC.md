# MVP Spec — app_in_toss (draft, T001)

> Produced by `planner` (explore mode), scored 90/100 by 기획팀장 (pass mark 90).
> Score history: 89 -> 90. Rounds: 2.
> **Not yet approved by the director** — this is the deliverable to send for approval, not a
> finalized spec (engine VISION.md §4: finalizing a spec requires director approval).
>
> Winning angle: MVP-first, revised. The spine is unchanged: one ledger entry produces one visible building within a second, hard-capped per day, with town SIZE earned by the habit and town OUTCOME shown separately so the app never rewards spending more. What changed in this revision is that I stopped defending the FC-4/FC-5 cut on cost grounds and instead named the five *functions* Fortune City's loop performs, then discharged the one I had actually dropped — "something is waiting for you when you come back" — with three cheap mechanics (a capped materials queue that auto-builds on the next open, a 무지출 데이 action, and an idempotent monthly settlement monument) instead of a citizen/coin/City-Hall simulation. Everything added is individually cuttable and lands after the loop already closes at build step 2.

---

# MVP Spec — 우리동네 가계부 (working title)

**A Fortune-City-style ledger for Toss users**
Proposal angle: **MVP-first.** Everything that is not required to make one loop cycle is cut, named, and parked. Everything that *is* required — including the reason to come back tomorrow — is in.
Target doc location: `C:\Users\user\loop_engine\app_in_toss\docs\spec\MVP-SPEC.md`
Version: **draft 2** · `planner` · 2026-08-02 · **not yet director-approved**

Changes from draft 1 are marked **[d2]**. No files were written; this is the document for the PM to place.

---

## 0. The one-sentence bet

> **Log one line of your spending → one building rises in your town, today, within a second. You only get a handful of those a day, and whatever you log past the limit is waiting to be built when you open the app tomorrow.**

Everything below either serves that sentence or is deferred. The MVP has **no server, no login, no payments, no bank sync, no in-game currency, no citizens, no canvas/game engine, and no Toss SDK call that requires an account.** It runs on `npm run dev` on a laptop and is fully demoable to the director as a phone-sized browser window.

---

## 1. Research: what Fortune City actually does

Sourced from Fourdesire/SPARKFUL's own listing and help center, the community wiki, and reviewer write-ups (citations in §14).

| # | Fortune City's real mechanic | Why it works |
|---|---|---|
| FC-1 | **One tracked transaction = one new building**, appearing immediately after you save. | The reward is 1:1 with the *act of logging*, not with a distant milestone. Instant, deterministic, tangible. |
| FC-2 | **Category determines the building type.** 10+ categories, 100+ building styles; the style within a category varies. | Your city becomes a *readable picture of your own spending*. A skyline of food stalls is a spending report you feel instead of read. Style variation buys a collection itch at near-zero design cost. |
| FC-3 | **Hard daily cap: 5 buildings/day**, raised to a maximum of 7 only by upgrading the Builder's Hub in the shop. Logging a 6th expense still records the expense but builds nothing — and **"it is not possible to save up builders or buildings to surpass your daily construction limit."** | The retention engine, and it is counter-intuitive: the game *refuses* to reward binge-logging. It converts "I'll catch up on Sunday" into "I have to open this daily." |
| FC-4 | **Citizens move in; you assign them to jobs in matching buildings; they produce coins over time. A clock icon appears over a building when production finishes and you tap to collect.** Matching a citizen's interest score to the building's category raises both output and Happiness. | Two jobs: (a) a second thing to *do* when you have no new expense to log, and (b) — the one that matters most — **something accrues while you are away and visibly asks to be collected.** |
| FC-5 | **City Hall upgrades (Finance / Economy / Livelihood)** — Finance raises coin *storage*, and coins earned past the cap are lost. Prosperity level, VIP citizens, vehicles. | Long-horizon spend sink, plus a soft penalty for staying away too long (overflowing storage). |
| FC-6 | **A genuinely competent ledger underneath**: 10+ categories & subcategories, multiple accounts, per-category budgets, pie/bar charts, weekly/monthly/seasonal views, search, wants-vs-needs review. | The game is a wrapper on a real expense tracker. Without this it's a toy. |
| FC-7 | **Friend leaderboards, Civic Square.** | Social comparison of city development. |
| FC-8 | **Monetization:** "CFO" subscription (~$7.99/mo, ~$69.99/yr) for deeper analytics; paid Builder's Hub upgrades that raise the daily limit; cosmetic themes. | |

### 1.1 The flaw we must not copy

In Fortune City, **city growth is driven by the volume of transactions, and expenses vastly outnumber income entries.** More spending, logged, grows your city faster. The daily cap blunts this, but the incentive arrow still points the wrong way for an app whose job is helping people manage money. Reviewers consistently note the game drifts away from the finance job over time.

**The core adaptation is to split that single arrow into three:**

- **Town SIZE is earned by the habit** (did you log today?) — capped daily, and completely independent of how much you spent.
- **Town MOOD is the ambient outcome** (are you on pace against your budget?) — a town-wide visual state that never destroys anything you built.
- **[d2] One structure — the 저축탑 — is the only thing in the app whose size is driven by an amount, and only saving can grow it.** That is the one place where "bigger number = bigger visual" points in a direction we actually want.

### 1.2 [d2] Fortune City's loop is five functions, not one beat

Draft 1 cut FC-4/FC-5 on cost grounds, which is not a design argument. The honest way to judge fidelity is to name what each part of the reference loop *does*, then check that every function is discharged — by something, at MVP cost.

| Loop function in Fortune City | Delivered there by | Delivered here by | Fidelity |
|---|---|---|---|
| **A. Instant, deterministic reward on the tracked action** | FC-1 | F2 building placement, unchanged | Verbatim |
| **B. The reward doubles as a readable picture of your own money** | FC-2 | F2 category→sprite family + F3 town view | Verbatim |
| **C. Scarcity that creates a daily appointment** | FC-3 daily cap | F4 daily build slots (no paid raise) | Verbatim, minus the paid escape hatch |
| **D. Something accrues while you're away and asks to be collected on return** | FC-4 citizens produce coins offline; tap-to-collect; FC-5 storage overflows if you stay away | **[d2] F14 materials queue** (over-cap entries bank and auto-build on the next day's first open, announced on the town screen as a pending promise) + **[d2] F16 monthly settlement monument** placed on the first open of a new month | Same function, different machine. No citizens, no coins, no job assignment, no storage sim. Cost: one array and one idempotent function. |
| **E. A long-horizon arc that makes month 12 different from month 1** | FC-5 prosperity/City Hall ladder | F5 town tier ladder + **[d2] F16** twelve monuments a year + **[d2] F13** 저축탑 height | Bounded content instead of an upgrade economy |
| **F. Something to do on a day with nothing to log** | FC-4 citizen management | **[d2] F15 무지출 데이** — a zero-spend day is claimable for a park tile and a full streak day | Different, and better aligned: FC gives you a management minigame; we give the *best financial day* the prettiest tile |

**What remains genuinely cut, and it is a real cut:** FC's *same-evening* second session. Nothing here brings a user back at 9pm on a day they already logged. Queue and monument pull toward *tomorrow morning's first open*. That is the deliberate MVP boundary, and Later-1 exists to close it (§5, WON'T table), with function F as its brief — not "add citizens."

### 1.3 [d2] Where we deliberately diverge from the reference, and why

Fortune City explicitly forbids banking builds. We allow it, capped. This is not an oversight of the source material — it is a reversal, and it needs a reason:

- FC bans banking to protect the daily appointment. **The queue does not break the appointment**, because banked materials build *only on a later day's first open*, never immediately. The scarce resource is still "a day", not "an entry."
- FC's ban produces the dead end draft 1 shipped: log a 6th expense, get an apologetic toast, nothing. That is the worst moment in the app landing on the user's *most diligent* behaviour.
- **Guard against re-coupling town size to spending volume:** the queue is capped (`materialQueueMax`, §9 — director's value), and **F15 lets a day with zero transactions still produce a build.** So the maximum achievable daily town growth is reachable *without spending anything at all*. Volume of transactions raises the floor, never the ceiling. This is stated as a design invariant in §7.

---

## 2. Explicit mapping: Fortune City → this app

| Fortune City | Verdict | This app (MVP) |
|---|---|---|
| FC-1 one entry = one building, instant | **Borrowed verbatim** | Saving a ledger entry immediately places one building on the town grid, with a rise animation and a toast. |
| FC-2 category → building type, style variation | **Borrowed** | Each category owns a sprite family; a random `variantIndex` picks the style. Town = readable spending picture. |
| FC-3 daily build cap | **Borrowed; the paid/upgrade escape hatch cut** | Fixed daily build slots, shown in the town header. No way to raise it in MVP — not by paying, not by upgrading. |
| FC-3 "cannot save up builds" | **[d2] REVERSED, deliberately (§1.3)** | Over-cap entries bank as **materials** and auto-build on the next day's first open. Queue is capped. |
| FC-4 citizens / jobs / coins / happiness | **Function D and F kept; the machine cut** | No citizens, no coins, no job assignment. Function D → materials queue + monthly monument. Function F → 무지출 데이. |
| FC-5 City Hall upgrades, prosperity, vehicles | **CUT; replaced by derived state + bounded content** | `town.tier` is a pure function of building count. Twelve monuments a year. No upgrade UI, no spend sink, no currency. |
| Coins as currency | **CUT entirely** | Removing currency removes the perverse farm loop by construction: there is nothing to farm by logging more spending. |
| Coin storage overflow penalty (FC-5) | **CUT** | Nothing in this app punishes absence. Being away costs you a streak number, never an asset. |
| **Growth ∝ amount/volume of expenses** | **CHANGED — this is the fix** | Growth ∝ *days you showed up*, hard-capped. `amountKrw` has **zero** effect on how many buildings you get. |
| (no equivalent) | **ADDED** | **Town mood** driven by budget pace — ambient outcome feedback that never touches the building system. |
| (no equivalent) | **[d2] ADDED** | **저축 as a first-class entry type + 저축탑**, the single structure whose size is amount-driven. Makes the anti-perverse-incentive claim structural instead of ambient. |
| (no equivalent) | **[d2] ADDED** | **무지출 데이** — the best financial day yields the rarest, prettiest tile. |
| (no equivalent) | **[d2] ADDED** | **Monthly settlement monument** — a permanent, dated record of how the month actually went. |
| FC-6 ledger utility | **Trimmed to the spine** | One flat category set, one account, one global monthly budget, one month view, one donut, one entry list, edit/delete, **[d2] recent-memo quick chips**. Sub-categories, multi-account, per-category budgets, search, seasonal views, wants/needs → Later. |
| FC-7 friend leaderboards | **DEFERRED** | Requires Toss Login + a backend. Both are account-gated. |
| FC-8 subscription / paid limit raises / themes | **DEFERRED** | Requires IAP + business registration. Monetization is a director decision (§13 D-7). |
| Bank/card automation, cloud backup, password lock, currency exchange, Smart Note (location) | **DEFERRED** | Manual entry only. KRW only. Local-only data. Location API is SDK-gated. **[d2]** Smart Note's actual benefit — not retyping the same memo — is delivered by recent-memo chips (F17) with no permission prompt. |

---

## 3. Product pillars, and how this design serves them

`app_in_toss/VISION.md` §"The project" gives the pillars: **(P-a)** turn real spending/saving habits into a growing town; **(P-b)** budgeting that feels less like a chore; **(P-c)** casual "watch something grow" motivation; **(P-d)** for Toss users, inside an app they already use daily for money.

| Pillar | How the MVP serves it | How it could have failed |
|---|---|---|
| P-a real habits → visible town | The *only* sources of a building are: a real ledger entry, a claimed no-spend day, and a month you actually lived through. No daily-login gift, no ad reward, no purchase. | A "collect stuff" loop with buildings obtainable by any other means would sever the link. Forbidden by the invariant in §7. |
| P-b less of a chore | Entry sheet targets **≤ 3 taps and ≤ 8 seconds** for a typical expense (amount → category → save; date defaults to today, memo optional, **[d2]** memo one-tap from recent chips). | A full form with account/subcategory/tags is the chore we're escaping. Cut. |
| P-c watch something grow | Cumulative and never lost: building count, tier, streak, longest streak, **[d2]** 저축탑 height, **[d2]** a monument per month. Mood dims the sky but **never demolishes a building** — progress is monotonic. | Punishing overspending by destroying buildings makes a finance app that punishes you for a hard month. Forbidden. |
| P-d Toss-native | TDS components throughout, KRW-only formatting, 만/억 Korean number reading, Korean copy, one-hand bottom-sheet ergonomics, max depth 2. **[d2]** Game-side numbers are never rendered as money (§7 rule 2), so the app never fakes a balance inside a financial super-app. | A generic web ledger with Toss colours bolted on. |

---

## 4. Core loop, end to end

```
   ── FIRST OPEN OF A DAY ────────────────────────────────────────────┐
   [0] App opens → boot sequence, in order:                           │
        a. slots reset if stored date < today                         │
        b. MONTH SETTLEMENT if period changed → 기념비 placed,        │
           one-time "지난달 결산" card                                 │
        c. MATERIALS QUEUE drains: up to today's slot count builds     │
           rise in sequence → "어제 남긴 자재로 3채가 지어졌어요"      │
        d. town scrolls to the newest structure                       │
   └───────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────▼───────────────────────────┐
        │  [1] TOWN screen                                │
        │   header: 남은 건축 슬롯 3/5 · 연속 12일         │
        │   sky: 이번 달 페이스 → 맑음/흐림/비             │
        │   skyline band: 저축탑 (height = 누적 저축)      │
        │   if queue > 0: "내일 지을 건물 2개 대기 중"     │
        │   if today has no expense: [오늘 무지출!] button │
        └───────┬───────────────────────────┬─────────────┘
                │ ⊕ FAB                      │ 무지출 버튼
                ▼                            ▼
        ┌───────────────────┐        ┌──────────────────────────┐
        │ [2] ENTRY sheet   │        │ [2'] claim no-spend day  │
        │  지출/수입/저축    │        │  costs 1 slot            │
        │  amount→category  │        │  → 공원 tile (rarest art)│
        │  ≤3 taps          │        │  → counts as streak day  │
        └───────┬───────────┘        │  → revoked if an expense │
                │ 저장                │     is later logged for  │
                ▼                     │     the same date        │
   ┌────────────────────────┐        └──────────────────────────┘
   │ [3] SAVE writes entry  │
   └──┬────────────┬────────┘
      │ 저축?      │ 지출/수입?
      ▼            ▼
 ┌──────────┐   slots left?
 │ no slot  │   ├── YES → build now: plot=plotFromIndex(next),
 │ consumed │   │           variant=random(category)
 │ 저축탑    │   │           → RISE ANIM (~600ms) + toast
 │ grows    │   └── NO  → queue not full?
 └──────────┘               ├── YES → banked as MATERIAL
                            │        toast "내일 아침에 지어드릴게요
                            │        (대기 2개)"
                            └── NO  → entry saved as ledger data only,
                                     toast says so plainly
      │
      ▼
 [4] Derived state recomputes, visibly:
      · buildingCount +1 → maybe TIER UP (full-screen moment)
      · month spend +amount → maybe MOOD SHIFT (sky tone)
      · streak: first act today → +1
      · 저축탑 → maybe a new segment
      │
      ▼
 [5] Optional: 기록 tab → month donut, budget-pace bar, entry list
      │
      ▼
 [6] Slots exhausted and queue non-empty → the town states the promise,
     not an apology. Session ends with something owed to you.
      │
      └────────── local midnight: slots reset ──────────► back to [0]
```

**Why this cycles rather than being a feature list:**

1. **The reward is on the action, not on a milestone.** Every save produces a visible, permanent artifact. There is no "log 30 entries to unlock" gap where motivation dies.
2. **The cap creates an appointment.** The scarce resource refills only with time.
3. **[d2] The appointment now has a debt attached.** Draft 1's cap made tomorrow *possible*; the queue makes tomorrow *owed*. Closing the app with "2개 대기 중" on screen is a different psychological object from closing it with "슬롯을 다 썼어요."
4. **[d2] There is no dead-end day.** Nothing to log is not nothing to do — a zero-spend day is claimable, and it is the best kind of day.
5. **The output is also the input.** The town is the reward *and* the spending report. Looking at your reward makes you think about your money.
6. **[d2] Three clocks, three payoffs.** Daily: slots + streak. Monthly: mood resets on the 1st (clean slate for a lapsed user) and a monument is minted. Cumulative: tier ladder and 저축탑, which never reset.
7. **Nothing decays.** Buildings, monuments, tower height and longest-streak are permanent. Only the sky can worsen, and it recovers.

---

## 5. Feature specs (MoSCoW)

Each item: behavior, then **AC** (acceptance criteria QA can write cases from). **[d2]** items are new or materially changed in this draft.

### MUST — the MVP

**F1 · Ledger entry (create)**
Bottom sheet over the town. Fields in tab order: **type** (**[d2]** 지출 / 수입 / **저축** segmented, default 지출) · **amount** (numeric keypad, integer KRW, positive only, live `1,234원` formatting + 만/억 hint) · **category** (icon grid, single-select, filtered by type; 저축 uses a small purpose set) · **date** (defaults today; compact picker; no future dates) · **memo** (optional, ≤40 chars, **[d2]** with recent-memo chips per F17). 저장 disabled until `amount > 0` and a category is chosen.
**AC:** amount 0/empty → 저장 disabled. Typing `12000` shows "12,000원" + hint "1만 2천원". Switching type swaps the category grid. Save with only amount+category succeeds. Sheet dismisses on save, on backdrop tap (confirm if any field was touched), and on Android back.

**F2 · Building placement (the payoff)**
On save of a 지출 or 수입 entry: if `slotsRemainingToday > 0`, create one `Building` bound to the entry; `plot = plotFromIndex(town.nextPlotIndex++)`; `variantIndex = uniformRandom(variantsPerCategory)`. If no slots, hand off to F14 (queue). 저축 entries never place a building and never consume a slot (F13).
**[d2] Placement is defined exactly once, in code, and there is exactly one placement function.** Draft 1's `spiralPlot` is deleted — the word "spiral" does not appear in this spec:

```ts
export const TOWN_COLUMNS = 6;               // layout constant (assumption, §13 note)

/** Serpentine row-major fill: the town reads as one street winding downward. */
export function plotFromIndex(i: number): { col: number; row: number } {
  const row = Math.floor(i / TOWN_COLUMNS);
  const k   = i % TOWN_COLUMNS;
  return { row, col: row % 2 === 0 ? k : TOWN_COLUMNS - 1 - k };
}
```

`plotIndex` is monotonic and never reused. Deletion leaves a permanent empty lot; nothing ever reflows.
**AC:** N-th build-producing act of the day where N ≤ cap → exactly one new building of that category's family, at `plotFromIndex(n)` and nowhere else. **Amount never changes the number of buildings** (1,000원 and 1,000,000원 → one each). Slot counter survives a full app reload. Building at index 6 is directly below index 5 (serpentine adjacency), verified by unit test on `plotFromIndex` for i = 0..23.

**F3 · Town view (home)**
Vertically scrolling fixed-width tile grid (`TOWN_COLUMNS`), extending downward. Occupied plots render a building; empty plots render an empty lot. New buildings animate in; the view auto-scrolls to the newest. Background is the mood sky. **[d2]** A fixed skyline band above the grid renders the 저축탑. Header: town name, tier badge, building count, streak, slot counter, **[d2]** queue promise line when `queue.length > 0`.
**AC:** 0 buildings → "첫 지출을 기록하면 첫 건물이 생겨요" with an arrow to the FAB. **[d2]** Loaded from the `dense` fixture (§11, ~5,400 buildings ≈ 3 years), initial paint < 1s and scroll holds 60fps on the mid-range Android WebView floor; rows outside the viewport are virtualized. Scroll position is preserved when returning from 기록.

**F4 · Daily build slots**
`slotsUsedToday` resets when the app's clock port (§10.2) reports a date later than `town.slotsUsedOn`. Evaluated on app open and on every save — no timers, no background jobs.
**AC:** Use all slots, advance the date by one day (via the clock port / TimeTravel), reopen → slots full. Advancing the date *backward* grants nothing (reset only when the stored date is strictly earlier than today).

**F5 · Town tier (cumulative progress)**
`tier = f(buildingCount)` via `tierThresholds` (§9). Crossing a threshold upward on save triggers a one-time full-screen celebration, then returns to the town. `highestTierSeen` guarantees once-per-threshold.
**AC:** Tier recomputes purely from building count; deleting entries can lower the displayed tier, and the celebration re-fires only on a new upward crossing. Celebration is skippable by tap.

**F6 · Monthly budget + town mood**
One global monthly budget in KRW, set at onboarding (skippable) and editable from 기록.
`elapsedFraction = dayOfMonth / daysInMonth` · `expectedSpend = budget × elapsedFraction` · `pace = monthExpenseTotal / expectedSpend` (guard `expectedSpend > 0`). Pace buckets into **3 mood tiers** (`moodPaceThresholds`, §9). Mood drives (a) the sky gradient, (b) a one-line status in the town header, (c) the budget bar colour in 기록. If `budget === null`, mood is pinned neutral and the header nudges "예산을 정하면 우리 동네 날씨가 생겨요".
**AC:** Day 15 of a 30-day month, 600,000원 budget, 300,000원 spent → pace = 1.0. Mood responds on day 3, not only at month end. Mood **never** removes, greys out, or downgrades a building. Month rollover resets month totals and therefore mood.

**F7 · Streak**
`streakDays` increments on the first *build-producing act* of a calendar day (entry or claimed no-spend day) if the previous act day was yesterday; resets to 1 otherwise. `longestStreakDays` never decreases.
**AC:** Two acts the same day → +1 total. Skipping a day → next act resets to 1, longest retained. **[d2]** A claimed 무지출 데이 counts as a full streak day.

**F8 · 기록 (history + stats)**
Month header with ‹ ›. Totals 지출 / 수입 / **[d2]** 저축 / 순액; budget-pace bar; expense category donut (descending, legend with amount and %); reverse-chronological entry list grouped by day with day subtotals. **[d2]** No-spend days appear in the list as a distinct zero-amount row. Tapping a row opens F9.
**AC:** Donut percentages sum to 100 within rounding. Empty month → empty state, not a broken chart. **[d2]** The `dense` fixture's heaviest month (300+ entries) scrolls without jank, and month ‹ › navigation across 36 months never blocks the main thread > 100ms (only the viewed month's chunk is loaded, §8.4).

**F9 · Edit / delete an entry**
List row → detail sheet with F1's fields plus 삭제. **Delete removes the entry and its building; the consumed slot is not refunded** (see D-10). Editing amount/memo/date does not move the building; editing **category** re-skins it to the new family, keeping the plot. **[d2]** Editing the date across a month boundary moves the entry between month chunks (§8.4); the building stays in its `builtOn` chunk.
**AC:** Delete → building count −1, the plot becomes an empty lot, remaining buildings do not shift. Slot counter unchanged. Destructive action confirms. **[d2]** Re-dating an entry from 2026-08 to 2026-07 updates both months' totals and both chunks; a reload confirms it.

**F10 · Persistence**
All state behind a storage port (§10.2). **[d2] Month-chunked keys, not one blob** (§8.4) — both `localStorage` and the future Toss Storage API re-serialize the entire value on every write, so a single growing blob makes every entry save more expensive than the last for the life of the ledger. Writes are debounced (~300ms) and per-chunk atomic. `schemaVersion` in the index key from day one.
**AC:** Hard reload → town, entries, streak, slots, queue, tower all identical. Saving one entry writes exactly two keys (current month chunk + core), verified by a spy on the port. A corrupt/unparseable chunk quarantines that chunk and boots with a visible one-time notice, never a white screen; a corrupt *index* boots to a clean state with the same notice.

**F11 · Onboarding**
Two steps, both skippable in one tap: (1) one card explaining the loop in one sentence with an illustrative town; (2) town name + monthly budget. Ends on the town screen with the FAB highlighted.
**AC:** Skipping both lands on a working town with the default name and `budget: null`. Never shows again after completion or skip.

**[d2] F12 · JSON export / import**
설정 sheet: **내보내기** serializes the entire state (all chunks + core) to a single downloadable `.json`; **가져오기** accepts one and replaces state after an explicit confirm, validating `schemaVersion`. Rejected imports change nothing.
**Why this is a Must, not a nice-to-have:** it is the only way a demo state moves between the director's machine, QA's machine, and a bug report; it makes the "no server yet" decision reversible; and it is the sole mitigation for local-only storage (§Trade-offs 7).
**AC:** Export → wipe the browser profile → import → byte-identical state including plot indices, queue, streak and tower. Importing a file with an unknown `schemaVersion` shows an error and leaves the existing state untouched.

**[d2] F13 · 저축 entry type + 저축탑 (savings tower)**
A 저축 entry consumes **no build slot** and creates **no plot building**. It adds to `cumulativeSavingsKrw`, which maps through `savingsTowerSegments` (§9) to a **segment count**; the tower in the skyline band renders that many segments and animates one segment rising when the count increases.
**Why 저축 escapes the daily cap:** the cap exists to stop binge-*logging* from replacing a daily habit. Rationing how much a user may *save* in a day is indefensible in a finance app — the app must never say "you saved too much today."
**This is the structural answer to the inverted incentive.** Draft 1's counterweight was a sky gradient, i.e. decoration. Here, the single tallest thing in town can only be built by saving, and it is the only object in the app whose size responds to an amount.
**AC:** Logging 저축 leaves `slotsUsedToday` and `buildingCount` unchanged. Crossing a segment threshold animates exactly one segment. The tower never shrinks except by deleting the underlying entries. **[d2]** The town screen renders the tower's *segment count*, never a 원 figure (§7 rule 2); the KRW total lives in 기록 only.

**[d2] F14 · Materials queue (the return promise)**
When a 지출/수입 entry is saved with `slotsRemainingToday === 0`:
- if `queue.length < materialQueueMax` → push `{ entryId, categoryId, variantIndex, queuedOn }`; the entry stores `buildingId: null, queued: true`; toast: "오늘 슬롯을 다 썼어요. 내일 아침에 지어드릴게요 (대기 N개)".
- else → the entry is saved as ledger data with no material; the toast says so plainly, once.
On app open, **after** the slot reset, drain the queue in FIFO order up to that day's slot count, creating buildings and consuming slots exactly as F2 would. Drained builds animate in sequence (staggered, ≤2s total, skippable by tap) with a summary toast.
The town screen shows "내일 지을 건물 N개 대기 중" whenever the queue is non-empty.
**AC:** Log cap+3 entries in one day with `materialQueueMax ≥ 3` → building count rises by exactly cap, queue = 3, header shows 3. Advance a day, reopen → 3 buildings rise, queue = 0, `slotsRemainingToday = cap − 3`. Queued materials survive reload. Deleting a *queued* entry removes its material from the queue. A queued material never builds on the same calendar day it was queued, even if slots free up (they can't, but the invariant is tested). Overflow past `materialQueueMax` still records the entry in 기록.

**[d2] F15 · 무지출 데이 (no-spend day)**
The town screen offers **[오늘 무지출!]** when: today has zero 지출 entries, `slotsRemainingToday > 0`, and today is not already claimed. Claiming consumes one slot, places a **공원** tile at the next plot (the rarest and most attractive asset in the set), records the date in `noSpendDays`, and counts as a build-producing act for F7.
**Revocation:** if a 지출 entry is later saved with `occurredOn` equal to a claimed date, the claim is revoked — the park is removed and the date leaves `noSpendDays`. If the revoked date is *today*, the slot is refunded so the expense can build; if it is a past date, no refund (past slots aren't spendable now) and the expense follows the normal path for today.
**Why it earns its place:** it gives the app a same-day action on the days with nothing to log, and it makes the best financial outcome the most beautiful thing in town — which no amount of sky-dimming achieves. It is also the guard that keeps town growth from tracking transaction volume (§1.3).
**AC:** Button is hidden once any 지출 exists for today and after claiming. Claim → building count +1, slots −1, streak counts the day. Log an expense for the same day afterwards → park gone, slot refunded, expense builds; building count net +1. Claiming twice in one day is impossible via UI and rejected by the domain function.

**[d2] F16 · Monthly settlement + 기념비 (monument)**
On app open, if `core.lastSettledPeriod` is earlier than the current period, settle each unsettled month in order (so a 3-month absence mints 3 monuments, oldest first). For each: compute that month's expense total, income total, savings total, budget outcome bucket and days-logged; place one **monument** building (`source.kind = 'monument'`, `variantIndex` = the outcome bucket) at the next plot, consuming **no slot**; store the summary on the building for its detail popover. Show a one-time "지난달 결산" card summarizing the most recent settled month. Idempotent: `lastSettledPeriod` advances inside the same write.
**Why:** the tier ladder was draft 1's only long-horizon artifact, and it is a single number. Twelve dated monuments a year is bounded content (one sprite family × the number of outcome buckets) that makes year two legible, and it makes the month-scale *outcome* permanent rather than ambient.
**AC:** Fixture with an unsettled 3-month gap → exactly 3 monuments in chronological plot order, each engraved with its own `YYYY-MM`. Reopening the app mints nothing further. Settlement of a month with zero entries produces a monument in the "no data" bucket (no crash, no divide-by-zero when `budget === null`). Tapping a monument shows that month's summary.

**[d2] F17 · Recent-memo chips**
In the entry sheet, once a category is selected, show up to 6 chips of the most recent *distinct* memos used with that category (scan limited to the current and previous month chunks). One tap fills the memo field.
**Why:** it is the actual user benefit of Fortune City's Smart Note, with no location permission and no SDK dependency, and it fits inside the ≤3-tap / ≤8-second entry budget.
**AC:** Chips are per-category, distinct, most-recent-first, ≤6. A category never used shows no chip row (no empty container). Tapping a chip fills the field and leaves it editable.

### SHOULD — in MVP only if it costs under half a day

- **F18** Haptic + sound on building placement, behind the haptics port (silent on desktop web).
- **F19** "이번 달 요약" one-line strip on the town header ("이번 달 42만원 · 예산의 68%").

### COULD — post-MVP, pre-launch

- **F20** Category management (rename, hide, reorder).
- **F21** Building collection album (FC-2's "100 styles" made explicit).
- **F22** Recurring/fixed expenses.
- **F23** CSV export (F12 already covers JSON).

### WON'T — explicitly out of MVP, with the reason

| Deferred | Reason |
|---|---|
| **Later-1: a same-day second session loop** (FC-4's job (a)) | The one genuine gap (§1.2 function F caveat). Its brief is "give a user who already logged today a reason to reopen tonight" — **not** "add citizens." Needs art + simulation budget the MVP doesn't have. |
| Citizens, jobs, coins, happiness, City Hall (FC-4/FC-5 machinery) | Largest art + sim cost in the reference app and the part that pulls hardest away from finance. Functions D/E/F are discharged more cheaply (§1.2). |
| Any backend, account, or sync | Would require Toss Login + infra. **`server-dev` has zero MVP tasks.** |
| Toss Login, IAP, Toss Pay, ads, analytics, push, leaderboards, share/referral rewards | Every one is developer-console / business-registration gated. |
| Real bank or card linkage | Separate approval path, and a director-level product decision (§13 D-6). |
| Multi-currency, multi-account, sub-categories, per-category budgets, search, wants/needs | Fortune City has them; none are needed to close the loop. |
| Canvas / WebGL / isometric rendering | CSS-grid + SVG is enough and removes an entire class of risk. |
| Cloud backup, password lock, dark theme | Not loop-critical. F12 export covers the demo/QA need. |

---

## 6. Screen list (MVP = 3 screens + 4 sheets)

**[d2] Every screen specifies three states: empty, normal, and dense** (dense = the 3-year fixture, §11). Dense is the state that breaks in year two, and draft 1 only specified two.

| # | Name | Route | Purpose | Key elements | Navigation | Empty / Normal / **Dense** |
|---|---|---|---|---|---|---|
| S1 | **온보딩** | `/onboarding` | Explain the loop in one sentence; capture town name + budget | 2 cards, 건너뛰기, 시작하기 | → S2 once, never returns | n/a |
| S2 | **우리 동네** (home tab) | `/` | The reward surface *and* the spending picture | Mood sky · skyline band with **저축탑** · header (name, tier, building count, streak, **slot counter**, **queue promise**) · serpentine tile grid · **[오늘 무지출!]** secondary action · ⊕ FAB · bottom tabs | FAB → S4. Tab → S3 | **empty:** 0 buildings, arrow to FAB · **normal:** scrolls, auto-scroll to newest · **dense:** ~5,400 buildings + 36 monuments + full tower — virtualized rows, <1s first paint, tier badge at ladder top, header does not wrap |
| S3 | **기록** (tab 2) | `/history` | The ledger utility: is my money OK? | Month ‹ › · totals (지출/수입/저축/순액) · budget-pace bar · category donut · day-grouped entry list · budget edit | Row → S5. 설정 → S6. Tab → S2 | **empty:** empty-month state, no broken chart · **normal:** donut + list · **dense:** 300+ entries in one month, 36 months of ‹ › navigation, only the viewed chunk loaded |
| S4 | **입력 시트** | sheet over S2 | Log an entry in ≤3 taps | 지출/수입/**저축** segmented · numeric keypad · amount display · category grid · date chip · memo + **recent chips** · 저장 | Save → S2 with animation | **empty:** no memo chips for an unused category · **normal:** 3 taps · **dense:** chip scan stays bounded to 2 chunks; category grid does not scroll-jank |
| S5 | **내역 상세 시트** | sheet over S3 | Edit or delete one entry | F1's fields + 삭제 + 저장 | Save/delete → S3 | view / edit / delete-confirm; **dense:** deleting from a 300-entry month re-renders only the affected day group |
| S6 | **설정 시트** | sheet over S3 | Town name, monthly budget, **내보내기 / 가져오기**, 데이터 초기화 | 5 rows | back to S3 | **dense:** export of a 3-year state completes without blocking the UI (chunked serialize) |
| **S7** | **[d2] 개발자 도구 시트** (dev-only) | sheet, hidden entry | Load fixtures, time-travel, dump state | Fixture picker, date override, queue/slot inspector, "reset all" | back to S2 | Stripped from any non-dev build by `import.meta.env.DEV`; §11 |

**Navigation model:** a 2-item bottom tab bar (우리 동네 / 기록). **Maximum depth is 2** — nothing is more than one sheet from a tab. Deliberate: mini-apps live inside the host app's own back stack, and deep hierarchies are where WebView back-button bugs live.

### 6.1 What `ui-ux` needs to produce (art order) — **[d2] ordered against slots, not names**

The director's naming and threshold decisions (D-3, D-4) are still open. Art must not wait on them, so **every asset is ordered against a numbered slot with a fixed visual role.** Renaming a tier or a mood later is a one-line change in `content.placeholder.ts` and requires **no re-art**.

| # | Asset group | Count | Slot contract |
|---|---|---|---|
| 1 | **Building sprites** | 10 expense categories × **3 variants** = 30 | Variant **0 of every category first** — that alone makes the app fully renderable at any `variantsPerCategory ≥ 1`. Variants 1–2 in a second pass. If D-5 changes the count, cost scales linearly per category; nothing else moves. |
| 2 | **Income structure** | 1 family × 3 variants = 3 | Same footprint as a normal tile |
| 3 | **[d2] 공원 tile (무지출 데이)** | 1, highest polish in the set | The visual payoff of the best financial day. Deliberately the prettiest asset. |
| 4 | **[d2] 저축탑 segments** | 1 base + 1 repeatable segment + 1 cap | Tower renders as base + N segments + cap; N is data-driven, so the art does not depend on D-13's thresholds |
| 5 | **[d2] 기념비 (monument)** | 1 family × **one per outcome bucket** (bucket count = D-4's mood tier count, currently 3) + an engraved `YYYY-MM` text layer | Ordered as "one per bucket slot"; if the director changes the bucket count, cost is one sprite per added bucket |
| 6 | **Empty lot tile** | 1 | — |
| 7 | **Sky / mood backgrounds** | **3 slots** (mood-0 / mood-1 / mood-2), CSS gradient tokens + optional overlay element | Ordered by slot index, not by name. D-4 decides which pace range maps to which slot and what each is called; the art is unaffected. |
| 8 | **Tier-up celebration** | 1 layout, text-driven, **5 tier slots** | Layout is identical per tier; only the label string and a badge colour token differ. D-3's labels drop in as text. |
| 9 | **Category icons** | prefer TDS's icon set | Only order custom art for gaps |

**Total: ~40 assets, of which 12 (variant 0 of each category + empty lot + park) unblock a fully playable build.**

**Dev is never blocked on art:** the MVP ships `PlaceholderBuilding` (rounded rect in the category colour + category icon + a variant-driven roof shape) behind the same interface as the final sprite component. Swapping in real art is one component and one asset manifest. This matches the engine's known limitation that real illustration cannot be generated here.

**[d2]** Art direction carries an unresolved risk the director must rule on before the order is placed: **how close the style may sit to Fourdesire's isometric-cute look** (§13 D-12).

---

## 7. Gamification design, and the motivation it's tied to

| Mechanic | Motivational driver | MVP cost |
|---|---|---|
| **Instant 1:1 building on save** | Operant conditioning with zero delay; the action *is* the reward. If only one thing shipped, this. | Low |
| **Random style variant within category** | Small variable reward + collection instinct (FC-2), for one `random()` call. | Near zero |
| **Hard daily slot cap** | Scarcity → appointment. Also protects the habit from catch-up batching, which is how ledger habits die. | Low |
| **[d2] Materials queue** | Zeigarnik effect / owed reward. Converts the cap's worst moment (a refusal) into the app's strongest return hook, and is the direct answer to FC-4's offline-accrual function. | One array + one drain function |
| **[d2] 무지출 데이 park** | Positive reinforcement of the *outcome*, not just the logging. Removes the dead day. Rarest asset = highest perceived value. | One button + one asset |
| **[d2] 저축탑** | Endowment + visible mastery, pointed at saving. The only amount-driven visual in the app. | One structure, data-driven height |
| **Streak + longest streak** | Loss aversion, bounded: losing a streak costs a number, never a building. | Low |
| **Town tier ladder** | Competence / milestone; gives the daily grind a visible arc. | Low |
| **[d2] Monthly monument** | Episodic memory + narrative. Twelve dated artifacts a year make year two legible where a single tier number cannot. | One idempotent function + one sprite family |
| **Sky mood from budget pace** | Ambient, non-nagging outcome feedback. | Low |
| **Monotonic town** | Endowment effect. The town only ever grows; a bad month greys the sky, not the skyline. | Zero (a rule) |

### [d2] Design invariants (violating one needs director sign-off)

1. **The only sources of a building are:** a real ledger entry, a claimed no-spend day, and a lived month. No login gift, no ad reward, no purchase, no achievement payout.
2. **Game-side quantities are never rendered in monetary format** — no ₩, no 원, no thousands separators on slots, queue depth, tier, tower segments, streak or monument counts. Money formatting is reserved for real ledger amounts. This costs nothing today and is what stops a future "coins" feature from making a finance super-app's mini-app look like it holds a fake balance.
3. **Amount drives exactly one visual, the 저축탑, and only via 저축.** Everywhere else, `amountKrw` is invisible to the town.
4. **Nothing in the town is ever destroyed by a financial outcome.** Deletion by the user is the only way a building disappears.
5. **Transaction volume raises the floor of town growth, never the ceiling** — the queue is capped, and a zero-transaction day can reach the same daily build count (§1.3).

**Deliberately excluded from MVP:** currency, shops, cosmetic purchases, leaderboards, achievements/badges, daily-login rewards, ads. Every one either needs the Toss console or re-introduces a reward not earned by logging real money.

---

## 8. Data model

All types in `src/domain/types.ts`.

### 8.1 Entities

```ts
type EntryType = 'expense' | 'income' | 'saving';   // [d2] saving added

// Assumption (content, not balance) — director may edit freely; see D-2.
type ExpenseCategoryId =
  | 'food' | 'cafe' | 'transport' | 'shopping' | 'living'
  | 'health' | 'culture' | 'education' | 'social' | 'etc';
type IncomeCategoryId  = 'salary' | 'sidejob' | 'bonus' | 'other_income';
type SavingCategoryId  = 'emergency' | 'goal' | 'invest' | 'other_saving';   // [d2]
type CategoryId = ExpenseCategoryId | IncomeCategoryId | SavingCategoryId;

interface LedgerEntry {
  id: string;                 // nanoid
  type: EntryType;
  amountKrw: number;          // integer > 0; sign comes from `type`
  categoryId: CategoryId;
  occurredOn: string;         // 'YYYY-MM-DD', device-local, never future
  memo?: string;              // <= 40 chars
  createdAt: number;          // epoch ms
  updatedAt: number;
  buildingId: string | null;  // null = queued, over queue cap, or type 'saving'
  queued: boolean;            // [d2] true while a material is pending
}

// [d2] Buildings now have three legitimate origins, as a discriminated union.
type BuildingSource =
  | { kind: 'entry';    entryId: string }
  | { kind: 'nospend';  date: string }        // 'YYYY-MM-DD'
  | { kind: 'monument'; period: string };     // 'YYYY-MM'

interface Building {
  id: string;
  source: BuildingSource;     // the ONLY ways a building can exist (invariant 1)
  categoryId: CategoryId | null;  // null for nospend/monument
  variantIndex: number;       // category variant, park variant 0, or monument outcome bucket
  plotIndex: number;          // monotonic; plot = plotFromIndex(plotIndex) — absolute, never reflows
  builtOn: string;            // 'YYYY-MM-DD'
  createdAt: number;
  monumentSummary?: MonthSummary;  // [d2] only when source.kind === 'monument'
}

// [d2] Pending material — an over-cap entry waiting for tomorrow.
interface QueuedMaterial {
  entryId: string;
  categoryId: CategoryId;
  variantIndex: number;       // rolled at queue time so the reward is already determined
  queuedOn: string;           // 'YYYY-MM-DD'; may never build on this same date
}

// [d2] Frozen at settlement; never recomputed (past months must not change retroactively).
interface MonthSummary {
  period: string;             // 'YYYY-MM'
  expenseKrw: number; incomeKrw: number; savingKrw: number;
  budgetKrw: number | null;
  outcomeBucket: number;      // index into the mood/outcome buckets
  daysLogged: number;
}

interface TownState {
  townName: string;
  nextPlotIndex: number;      // monotonic; deletion leaves a permanent empty lot
  streakDays: number;
  longestStreakDays: number;
  lastActOn: string | null;   // [d2] renamed: entry OR no-spend claim
  slotsUsedOn: string;        // 'YYYY-MM-DD' the counter belongs to
  slotsUsedToday: number;
  highestTierSeen: number;    // tier-up fires exactly once per threshold
  queue: QueuedMaterial[];    // [d2] FIFO, length <= materialQueueMax
  noSpendDays: string[];      // [d2] claimed dates
  cumulativeSavingsKrw: number; // [d2] denormalized for tower height; rebuildable from entries
  lastSettledPeriod: string | null; // [d2] idempotency key for F16
}

interface BudgetSetting { monthlyBudgetKrw: number | null; updatedAt: number; }
```

### 8.2 Derived, never stored

Pure selectors in `src/domain/selectors.ts`, unit-testable with no React.

| Selector | Definition |
|---|---|
| `buildingCount` | number of buildings |
| `tier` | largest `i` where `buildingCount >= BALANCE.tierThresholds[i]` |
| `slotsRemainingToday` | `slotsUsedOn === today ? dailyBuildSlots - slotsUsedToday : dailyBuildSlots` |
| `monthTotal(ym, type)` | sum of `amountKrw` for that type with `occurredOn` in `ym` |
| `budgetPace(ym)` | `monthTotal(ym,'expense') / (budget × dayOfMonth/daysInMonth)`; `null` if no budget |
| `moodTier(ym)` | bucket `budgetPace` by `moodPaceThresholds`; neutral if `null` |
| `categoryTotals(ym)` | expense sums grouped by `categoryId`, descending |
| **[d2]** `towerSegments` | count of `savingsTowerSegments` thresholds `<= cumulativeSavingsKrw` |
| **[d2]** `canClaimNoSpend(today)` | no expense entry on `today` && `slotsRemainingToday > 0` && `!noSpendDays.includes(today)` |
| **[d2]** `unsettledPeriods(today)` | ordered `YYYY-MM` list from `lastSettledPeriod` (exclusive) to the current period (exclusive) |
| **[d2]** `recentMemos(categoryId)` | ≤6 distinct memos, most recent first, scanning only the current + previous chunk |

### 8.3 Rules for dev

- `plotIndex` is monotonic and never reused, so nothing reflows on delete.
- A building of kind `entry` can never exist without its entry; deletion cascades. Deleting a queued entry removes its material.
- All dates are device-local `YYYY-MM-DD` strings — never `Date` objects in storage, never UTC. A ledger entry belongs to the day the *user* thinks it is.
- **[d2]** `cumulativeSavingsKrw` and `lastSettledPeriod` are the only denormalized fields. A `rebuildDerived()` function reconstructs both from entries and is run by import (F12) and by the corrupt-chunk recovery path.

### 8.4 [d2] Storage layout — month-chunked

Both `localStorage` and the Apps-in-Toss Storage API re-serialize the whole value on every `set`. A single blob makes the cost of saving one coffee grow with the lifetime of the ledger. Chunking bounds it.

| Key | Contents | Written when |
|---|---|---|
| `ait.v1.index` | `{ schemaVersion, entryMonths: string[], buildingMonths: string[] }` | a new month appears |
| `ait.v1.core` | `TownState`, `BudgetSetting`, onboarding flag, settings | every act |
| `ait.v1.entries.{YYYY-MM}` | entries with `occurredOn` in that month | that month is touched |
| `ait.v1.buildings.{YYYY-MM}` | buildings with `builtOn` in that month | that month is touched |

- **Boot:** read index + core + **all** building chunks (the town view needs every building; ~80 bytes each → 3 years at ~150/month ≈ 400 KB, proven by the `dense` fixture). Entry chunks load lazily — the current month at boot, others on 기록 navigation.
- **Save one entry:** exactly two writes (its month's entry chunk + core), plus one building chunk when a building is placed.
- **Re-dating across months:** remove from the old chunk, insert into the new, update the index. The building stays in its `builtOn` chunk (it was built when it was built).
- `schemaVersion` lives in the index; migrations key off it.

---

## 9. [d2] Balance file — placeholders that run, never a decision

Draft 1 shipped `dailyBuildSlots: 0, tierThresholds: []` with an instruction not to quote temporary values. That is honest but unbuildable: nothing renders and nothing paces until somebody invents numbers off-spec, which is the failure mode the rule exists to prevent.

`src/domain/balance.placeholder.ts` instead ships **every key present, typed, documented, and flagged**:

```ts
/**
 * PLACEHOLDER — NOT A DESIGN DECISION.
 * Every value here exists only so the app runs before the director's balance pass.
 * Sourced values are marked [ref]; the rest are arbitrary. Do not quote any of these
 * as design, in a report, a screenshot caption, or a review. See MVP-SPEC §13 D-3/4/5/13/14.
 */
export const BALANCE = {
  BALANCE_UNSET: true,          // flipped to false ONLY by the director's approved values file

  dailyBuildSlots: 5,           // [ref] Fortune City's real starting value (max 7 via Builder's Hub) — D-3
  materialQueueMax: 10,         // arbitrary — D-14
  tierThresholds: [0, 10, 30, 80, 200],          // arbitrary, 5 slots — D-3
  moodPaceThresholds: [0.9, 1.1],                // arbitrary, yields 3 buckets — D-4
  variantsPerCategory: 3,       // art-budget figure, matches §6.1 order — D-5
  savingsTowerSegments: [       // arbitrary cumulative KRW thresholds, 8 segments — D-13
    100_000, 300_000, 600_000, 1_000_000,
    2_000_000, 4_000_000, 7_000_000, 10_000_000,
  ],
  noSpendDayCostsSlot: true,    // design rule, confirm — D-15
} as const;
```

**Enforcement (all three are Gate-relevant, not advisory):**

1. While `BALANCE_UNSET === true` the app shows a persistent, non-dismissable dev banner **"밸런스 미승인 — 임시 수치"**, so no screenshot can be mistaken for a finished build.
2. **A build with `BALANCE_UNSET === true` must not pass Gate 3.** The playtest panel is scoring a game whose pacing is unset; that is not a finished app. QA states the flag's value in every evidence report.
3. The director's approved values land as a separate `balance.approved.ts` that sets the flag false. Placeholders are never edited in place — the diff between the two files *is* the record of the balance decision.

`TOWN_COLUMNS = 6` is **not** in this file: it is a layout constant (how wide the grid renders), not a pacing dial. It is a marked assumption (§13).

---

## 10. Toss platform: what MVP uses vs defers

### 10.1 Uses (all account-free)

| Capability | How |
|---|---|
| `create-ait-app` scaffold, React + TS + Vite | Local. Per `app_in_toss/VISION.md`, the CLI is interactive with no documented non-interactive flags — the first build task runs it by hand and reports its choices verbatim. |
| Toss Design System components | Local npm dependency. Exact component names must be read off the installed package by `client-dev`, not guessed from docs. |
| `vite dev` in a phone-sized browser window | The entire demo surface for MVP. |
| Browser `localStorage` | Behind the storage port (§10.2). |

### 10.2 [d2] The platform port layer, and the lint rule that keeps it honest

All platform touchpoints live in `src/platform/*`, each with a `browser` driver today and a `toss` driver later:

| Port | Browser driver (MVP) | Later |
|---|---|---|
| `storage` | `localStorage`, chunked (§8.4) | Apps-in-Toss Storage API |
| `clock` | `new Date()` **plus a dev-only override** (§11 TimeTravel) | unchanged |
| `haptics` | no-op | native haptics |
| `insets` | CSS `env(safe-area-inset-*)` with a fallback | native insets |
| `analytics` | `console.debug` sink | Toss event logging |

Two lint rules make this structural rather than a convention:

- `no-restricted-imports`: nothing outside `src/platform/**` may import any `@apps-in-toss/*` symbol.
- `no-restricted-syntax`: `new Date()` and `Date.now()` are banned outside `src/platform/clock.ts`. This is what makes the whole app time-travelable for QA (§11) with no extra machinery — the fixture requirement and the port layer are the same mechanism.

### 10.3 Explicitly deferred — every one is developer-console / business-registration gated

Toss Login & user identity keys · user consent data · IAP (one-time + subscription) · Toss Pay · in-app ads (banner/interstitial/rewarded) · event logging & analytics · referrer attribution · Toss Ads pixel · push notification agreements · smart messaging · review requests · leaderboards & profiles · share/referral rewards · deep links · console workspace, testing, deployment, emergency maintenance.

**Not assumed:** whether the Apps-in-Toss Storage API functions at all without a registered console app is **unverified**. The MVP does not depend on the answer. `client-dev` records the finding at scaffold time (§13 D-8).

### 10.4 Toss-specific UI constraints the MVP honours

The host app owns the top nav and back gesture, so no custom top-level back button; safe-area insets via the `insets` port; portrait only; no orientation-locking calls; a mid-range Android WebView is the performance floor for every AC in this document.

---

## 11. [d2] QA enablement: fixtures, time travel, export

Draft 1 set an acceptance criterion ("200 buildings, 60fps, <1s paint") that nobody could reach — under its own daily cap that state is ~40 days of real use or ~40 manual device-date changes, against an opaque `localStorage` blob that could not move between machines. Three things fix that, and all three are MVP Must.

**A. `src/devtools/fixtures.ts` — seeded, reproducible, deterministic** (fixed PRNG seed, so two machines produce identical states):

| Fixture | Shape | What it proves |
|---|---|---|
| `empty` | fresh install | S2/S3 empty states, onboarding |
| `oneMonth` | 1 month, ~90 entries, budget set | the normal case, the donut, the pace bar |
| `dense` | **36 months, ~5,400 buildings, 36 monuments, full tower, one 300-entry month** | F3/F8 dense ACs, virtualization, chunked load, boot time |
| `capExceeded` | today at the cap + 3 over | F14 queue push, header promise |
| `queueFull` | queue at `materialQueueMax` | F14 overflow branch |
| `budgetBlown` | pace ≈ 2.0 mid-month | F6 worst mood, and that no building is harmed |
| `noSpendStreak` | 5 claimed no-spend days, one to revoke | F15 claim + revocation + refund |
| `unsettled` | `lastSettledPeriod` 3 months stale | F16 multi-month settlement, idempotency |
| `corrupt` | one chunk deliberately mangled | F10 quarantine + recovery notice |

**B. TimeTravel** — a dev-only control (S7) that sets the date the `clock` port returns. Because §10.2 bans `new Date()` outside that port, *everything* derives from it: slot reset, streak, settlement, mood pace. QA can walk a week in seconds and it is reproducible in a bug report.

**C. Export/import (F12)** — the transport. A fixture or a bug state moves as one `.json` from QA's machine to the director's phone-sized browser window.

**S7 is stripped from any non-dev build** via `import.meta.env.DEV`, and Gate 1 fails if a production bundle contains the fixture module (a grep assertion in the gate script).

**QA note for the loop:** the `qa` agent drives the real build. Every performance AC in this doc names the fixture that reaches its state, so no AC in this spec is unreachable by the person asked to verify it.

---

## 12. Build order (so dev can start Monday)

| Step | Deliverable | Blocked by |
|---|---|---|
| 0 | Run `create-ait-app` by hand; report package manager, template, TDS y/n, example code. Commit the scaffold. Write the Node/React Gate 1 script (`npm ci` → `tsc --noEmit` → `vite build` → lint → the fixture-not-in-bundle assertion) to the same JSON/exit-code contract as `gate.ps1` and wire it into `quality-loop.js`. | — (**a real blocker for every build-mode task — `app_in_toss/VISION.md` stack notes flag it**) |
| 1 | `types.ts`, `selectors.ts`, `balance.placeholder.ts`, `platform/*` ports + lint rules, chunked `storage`, `devtools/fixtures.ts`. Unit tests on `plotFromIndex` and every selector. No UI. | 0 |
| 2 | S2 town with placeholder buildings + S4 entry sheet. **F1+F2+F3 = the loop closes here.** First demoable milestone. | 1 |
| 3 | F4 slots, F7 streak, F5 tier, **F14 queue**, **F15 무지출 데이**. The retention layer. | 2 |
| 4 | S3 기록 + F9 edit/delete + F6 budget/mood + **F13 저축탑** + S6 settings + **F12 export/import**. | 3 |
| 5 | **F16 monthly settlement + 기념비**, S1 onboarding, F17 memo chips, polish, empty/dense/error states. | 4 |
| 6 | Real art swap-in when `ui-ux` delivers (variant 0 set first). | parallel |
| 7 | Balance pass once the director's values land; flip `BALANCE_UNSET`. **Gate 3 only after this.** | director |

**If time runs out, cut in this order** (each is independently removable without breaking the loop): F17 → F16 → F13 → F15 → F12. **F14 is not on the cut list** — it is the fix for the loop's only structural hole.

**Demo script for the director (90 seconds, from step 3):** open → empty town → log 커피 4,500원 → café rises → log up to the cap, cross a tier → log 2 more → "내일 아침에 지어드릴게요 (대기 2개)" → TimeTravel +1 day → reopen → the 2 banked buildings rise on their own → claim 무지출 데이 → park appears → log 저축 → tower gains a segment → 기록 tab shows donut and budget bar → hard reload, everything persists.

---

## 13. Open decisions — director's call, not filled in

| # | Decision | Why it isn't mine | Blocks |
|---|---|---|---|
| **D-1** | **App name.** "우리동네 가계부" is a placeholder in this document only. | Branding. | Store copy, onboarding, art |
| **D-2** | **Category set.** The 10 expense / 4 income / **4 saving** categories in §8.1 are a marked **assumption** (Fortune City ships 10+). Add, cut, rename freely. | Content taste; drives the art order size. | Art order |
| **D-3** | **`dailyBuildSlots`, `tierThresholds`, and the tier labels.** Fortune City's real values (5/day, max 7) are cited as reference, **not adopted**. Also: how many tier steps (§9 placeholder ships 5 slots). | Balance constants. The cap is *the* retention dial. | F4, F5 |
| **D-4** | **`moodPaceThresholds`**, the number of mood/outcome buckets, and their names/visuals. Also decides how many monument variants §6.1 item 5 needs. | Balance constant + a tone decision: how harsh should the app be about overspending? | F6, F16, art |
| **D-5** | **`variantsPerCategory`.** §6.1 sizes the order at 3; that is an art-budget figure, not a design decision. | Trades art cost against collection feel. | Art order |
| **D-6** | **Is real bank/card sync ever in scope?** MVP is manual-only regardless, but the answer reshapes the roadmap and possibly the data model. **[d2]** It is also the only thing that could ever verify a 저축 entry (see Trade-off 3). | Product strategy + a separate Toss approval path. | Roadmap |
| **D-7** | **Monetization.** Fortune City sells a CFO subscription, paid daily-limit raises, and cosmetic themes. Nothing is in MVP. Which, if any, later? **Paid limit raises would directly weaken the retention mechanic** — worth an explicit decision, not a default. | Business model. | Later scope |
| **D-8** | **Does the Apps-in-Toss Storage API work without console registration?** Unverified. MVP doesn't need it. Record the answer at scaffold time. | Fact-finding, not a design choice. | Nothing in MVP |
| **D-9** | **Rubric substitution for React** (`app_in_toss/VISION.md`: C3/C4 re-read for React/TS) is *proposed, not approved*. Needs sign-off before any build-mode task is scored. | Rubric changes aren't free (engine `VISION.md` §4). | All build tasks |
| **D-10** | **Delete policy.** §5 F9 chooses: delete removes the building, slot not refunded. The alternative (the building survives as a memorial) is defensible. Confirm. | A feel decision with an integrity consequence. | F9 |
| **D-11** | **Does 수입 build anything?** §5 assumes yes — one income structure, one slot — since Fortune City builds from income and expenses both. Arguable that income should feed the mood instead. Marked assumption; confirm. | Design taste with a loop consequence. | F2, art order |
| **D-12** | **[d2] Art-style proximity to Fourdesire.** Fortune City's isometric-cute look is the reference the director named. How close may our style sit before it is imitation rather than adaptation? This needs an answer **before the art order is placed**, not after 40 assets exist. | Legal/brand exposure, and the director's call on how much the app should read as "the Fortune City one." | §6.1 art order |
| **D-13** | **[d2] `savingsTowerSegments`** — the KRW→height curve, and the segment count. Whether the tower should ever cap. | Balance constant, and a tone decision about what counts as "a lot saved." | F13, art item 4 |
| **D-14** | **[d2] `materialQueueMax`.** How much may bank? Too small and a heavy day still dead-ends; too large and a Sunday binge re-couples town size to transaction volume (§1.3). | Balance constant, and the exact dial that governs the divergence from Fortune City's "no saved builds" rule. | F14 |
| **D-15** | **[d2] Should 무지출 데이 cost a build slot?** §5 F15 says yes (`noSpendDayCostsSlot: true`) so it can't be stacked with a full logging day. The alternative — free, so a no-spend day is strictly a bonus — is defensible and more generous. | A design rule with a direct pacing consequence. | F15 |
| **D-16** | **[d2] Confirm 저축 escapes the daily cap.** §5 F13 asserts the app must never ration saving. It is a strong rule and I believe it, but it is the single biggest structural divergence from the reference and deserves an explicit yes. | Design principle with a loop consequence. | F13 |

**Assumptions I did make** (fair game to overturn, all cheap to change): the category sets (D-2), Korean-only copy, KRW-only, portrait-only, `TOWN_COLUMNS = 6` with serpentine fill, 2-tab navigation, ≤40-char memos, income builds a structure (D-11), monuments and 저축 entries consume no slot, memo chips capped at 6 and scanned over 2 chunks.

---

## 14. Sources

- [Fortune City — SPARKFUL](https://sparkful.app/fortune-city)
- [Fortune City: Expense Tracker — App Store](https://apps.apple.com/us/app/fortune-city-expense-tracker/id1172713884)
- [Fortune City — Google Play](https://play.google.com/store/apps/details?id=com.fourdesire.fortunecity&hl=en)
- [Lesson 2: Buildings — Fortune City Help Center](https://fourdesire.helpshift.com/hc/en/5-fortune-city/faq/653-lesson-2-buildings/) — 5 buildings/day at start, raised via Builder's Hub
- [Builders' Hub — Fortune City Wiki](https://fortune-city.fandom.com/wiki/Builders%27_Hub) — max 7/day; **"it is not possible to save up builders or buildings to surpass your daily construction limit"**
- [Quick Guide — Fortune City Wiki](https://fortune-city.fandom.com/wiki/Quick_Guide)
- [Currency Guide — Fortune City Wiki](https://fortune-city.fandom.com/wiki/Currency_Guide) — coins accrued by citizens; spent on merging buildings and City Hall Finance upgrades
- [Lesson 3: Gold Coins and Diamonds — Fortune City Help Center](https://fourdesire.helpshift.com/hc/en/5-fortune-city/faq/654-lesson-3-gold-coins-and-diamonds/) — tap the clock icon to collect finished coin production; coins past storage cap are lost
- [Lesson 5: Citizens — Fortune City Help Center](https://fourdesire.helpshift.com/hc/en/5-fortune-city/faq/656-lesson-5-citizens/)
- [How can I increase "happiness"? — Fortune City Help Center](https://fourdesire.helpshift.com/hc/en/5-fortune-city/faq/218-how-can-i-increase-happiness/) — dream-job matching, interest values
- [Prosperity · City Hall · Happiness — Fortune City Help Center](https://fourdesire.helpshift.com/hc/en/5-fortune-city/section/70-prosperity-city-hall-happiness/)
- [Fortune City: Cute and Fun Finance Tracking Gamification App — TechAcute](https://techacute.com/fortune-city-app/)
- [Optimally playing Fortune City — Water Bottled](https://waterbottled.wordpress.com/2017/11/10/optimally-playing-fortune-city/)
- [Build the Habit to Track Our Spending Using Fortune City — Medium](https://medium.com/@rnsantosa/build-the-habit-to-track-our-spending-using-fortune-city-a47f7be1314e)
- [Fortune City's game-like approach works but leaves users wanting — YourStory](https://yourstory.com/2022/06/app-friday-fortune-city-game-like-approach-personal-finance)
- [Fortune City makes tracking your finances fun — MobileSyrup](https://mobilesyrup.com/2018/07/07/fortune-city-tracking-finances-fun-budget/)
- [Apps in Toss developer docs](https://developers-apps-in-toss.toss.im/) and its SDK index (`/llms.txt`)

---

## Trade-offs the author admits

1. **The materials queue reverses Fortune City's explicit "you cannot save up builds" rule.** Research confirms FC bans it outright (Builders' Hub wiki), so this is a divergence, not a copy. The risk it re-opens: a user who batches 30 entries on Sunday now fills a queue that drains over following days, partially re-coupling town size to transaction volume. Mitigated two ways — `materialQueueMax` caps it (D-14 is exactly this dial), and 무지출 데이 lets a zero-transaction day reach the same daily build count, so volume raises the floor and never the ceiling. Mitigated, not eliminated: a heavy spender still logs more entries than a light one.

2. **There is still no same-evening second session.** The queue and the monument pull toward tomorrow's first open; nothing brings back a user who already logged today at 9pm. That is precisely job (a) of FC's citizen economy, and it costs a simulation plus an art budget the MVP does not have. It is named as Later-1 with its *function* as the brief rather than "add citizens," so whoever picks it up is not obliged to clone the reference.

3. **저축 entries are unverifiable.** The 저축탑 is the one amount-driven visual, so a user can inflate the tallest thing in town by logging savings that never happened. No fix exists without bank sync (D-6). Accepted because the failure mode is self-deception in a personal tool with no leaderboard and no reward economy attached — and invariant 1 keeps it from ever unlocking anything.

4. **Month-chunked storage costs a multi-key boot read and a cross-month move on re-dating.** A single blob is simpler to write and to reason about. Chosen anyway because writes dominate by an order of magnitude in this app — one write per logged coffee, for years.

5. **Scope grew against draft 1** (queue, no-spend day, 저축 type, monument, export/import, fixtures). Held by build order: the loop still closes at step 2, the retention layer is step 3, and §12 gives an explicit cut order for the rest. F14 is deliberately absent from that cut list because removing it re-opens the deduction this revision exists to fix.

6. **Running placeholders can be mistaken for decisions.** `BALANCE_UNSET` plus an undismissable banner plus a Gate 3 block are strong guards, but a Discord screenshot cropped above the banner would still mislead the director. The PM should caption balance-bearing screenshots explicitly until the approved values file lands.

7. **Local-only storage is still device-bound.** Export/import makes demos and bug reports portable and keeps the "no server" call reversible, but it is not a backup story for a real user — a cleared browser profile still loses a town. That is acceptable only while there are no real users, which is exactly the MVP's situation.

8. **Art style proximity to Fourdesire is unresolved** (D-12) and it gates the art order, not the code. If the director rules for maximum distance, the sprite direction changes but no slot, count, or interface in §6.1 does.

9. **`TOWN_COLUMNS = 6` and serpentine fill are my call, not the director's.** They are layout, not pacing, and deliberately kept out of the balance file. If the town later wants a 2D expanding field, `plotFromIndex` is one pure function with unit tests — but every plot index already assigned would render differently, so this is cheap now and expensive after real users exist.
