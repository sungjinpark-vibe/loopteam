> **STATUS BANNER (2026-08-10):** This remains an **unapproved proposal**, never implemented.
> `ADDENDUM-05-village-life.md` supersedes its currency/shop sections (§8 there has the full table).
> F25 (ad bubble) and F26 (paid extra build) are **out of scope and unbuilt** — do not build them.

# ADDENDUM-03 — 광고 말풍선 · 추가 건축 결제 · 꾸미기 상점 (the economy) · rev. 3

> Proposed target path: `app_in_toss/docs/spec/ADDENDUM-03-monetization.md`
> Status: **proposal, not approved.** `MVP-SPEC.md`, `ADDENDUM-01` and `ADDENDUM-02` are untouched; the PM merges after the director approves.
> Author: `planner` · 2026-08-07 · Angle: **risk-first** — assume this ships and is maintained for years; optimise against dead ends, not against today's diff size.
>
> **Supersedes, if approved** (each passage quoted and replaced in §10, never left silently contradicting):
> - **MVP-SPEC §1.3** (`:96`) — *"banked materials build only on a later day's first open, never immediately"*. F26 is exactly the exception. Amended in §10, and the "scarce resource is still a day" claim is re-argued rather than dropped.
> - **MVP-SPEC §2 mapping table**: the `Coins as currency — CUT entirely` row (`:112`), the `FC-3 daily build cap — Borrowed; the paid/upgrade escape hatch cut` row (`:108`, which is where *"No way to raise it in MVP — not by paying, not by upgrading"* actually lives), the `FC-8 subscription / paid limit raises / themes — DEFERRED` row (`:121`).
> - **MVP-SPEC §3 pillar table, P-a row** (`:132`) — "No daily-login gift, no ad reward, no purchase" is amended in step with invariant 1 (§5.1).
> - **MVP-SPEC §5 F4** (`:248`) — its body says slots are *"Evaluated on app open and on every save — no timers, no background jobs."* F25 introduces the app's first timer, so this sentence is amended to say exactly what that timer is allowed to be (a repaint trigger, never a source of truth).
> - **MVP-SPEC §5 F14 AC** (`:297`) — the "never builds on the same calendar day" clause is scoped to the drain path (§6.4).
> - **MVP-SPEC §5 WON'T table** (`:334`) — `IAP · Toss Pay · ads` move out of WON'T; Toss Login, analytics, push, leaderboards and share/referral rewards **stay**.
> - **MVP-SPEC §7 invariant 1** (`:400`) — amended, **not deleted** (§5.1). **§7's own header says adding or violating an invariant needs the director: D-49.**
> - **MVP-SPEC §7 invariant 2** (`:401`) — **strengthened**, not weakened (§5.2).
> - **MVP-SPEC §7 exclusion line** (`:406`) — "currency, shops, cosmetic purchases, ads" leave the list; leaderboards, achievements/badges and daily-login rewards **stay excluded**.
> - **MVP-SPEC §10.2 port table** (`:589-596`) — gains `ads` and `payment` rows.
> - **MVP-SPEC §10.3** (`:604`) — IAP (one-time), Toss Pay and rewarded ads move from "explicitly deferred" to "port shipped, `toss` driver blocked on console access".
> - **MVP-SPEC §13 D-7** (`:671`) — **answered** by the director 2026-08-05. §13 records the answer and what remains open.
> - **ADDENDUM-01 §3.5/§3.6 rule R-2** ("decoration is never persisted") — **narrowed**, not revoked (§7.5).
>
> **Does NOT amend** (this list was wrong in rev. 2 and is now precise):
> - `plotFromIndex`, `cellFromIndex`, `renderedTileCount`, `requiredLots`/`openPlotCount`, ADDENDUM-02 §3.2's one-step-ahead free-lot proof, the frontage invariant, F13/저축 블록, F15, F16, `LAYOUT_VERSION`, `SCHEMA_VERSION`.
> - **F14's queue *mechanics*** — `materialQueueMax`, FIFO ordering of the queue itself, the overflow-to-ledger-only branch, and the next-morning drain — are all unchanged, and `drainQueue` is not edited (§6.3 calls it with different arguments, that is all).
> - **But F14's *stated guarantees* are amended in two places**: the AC clause at `:297` and §1.3's "never immediately" sentence at `:96`. Both get supersession rows in §10. Saying "F14 is untouched" would have been the silent contradiction the brief forbids.

**What changed in rev. 3** (round-2 lead findings, all fixed at the root — none re-litigated):

1. **§6.5 exists.** It is the argument for the document's own "highest-stakes number": a recommended shape and value for `paidBuildsMaxPerDay`, three independent reasons, why 1 rather than 2–3, and exactly what changes if the director chooses unbounded. Three prior citations now point somewhere.
2. **§7.3's geometry is re-derived from shipped code, and the previous numbers were wrong.** A plot tile is **not** 72 × 72. It is `plotTileWidthPx(vw) × TILE_HEIGHT_PX` = **38.3 / 45 / 50 / 56.7 px wide at 320 / 360 / 390 / 430**, fixed **72 px** tall. Two further facts changed the art order beyond the number: `.building-icon` is **bottom-anchored**, not centred, and `.building-roof-peak` is a **fixed 36 px** triangle that is 94 % of the tile at a 320 px viewport. Two slots were redesigned because they would have clipped, and new rule **R-16** puts every overlay box in `townLayout.ts` with a disjointness test at four viewports.
3. **MVP-SPEC §1.3 has a supersession row**, and the "Does NOT amend" list above is rewritten to stop claiming F14 is untouched when two of its guarantees are amended.
4. **The demo and the null-dial rule no longer contradict.** S7 gains a `데모 값 적용` control loading a dev-only, production-stripped `balance.demo.dev.ts` that paints a persistent `개발용 임시 수치 (승인 전)` ribbon while active (§9.3a). The demo works today; no screenshot can be quoted back as design, which was the rule's whole purpose.
5. **The seed economy's terminal state is designed** — **DE-16** and invariant **E-6**: once every seed-priced item is owned, the bubble stops arming and the shop reads 모두 모았어요. The long-run sink shape is routed as **D-54**, with the tempting option (seeds buy build capacity) named and refused with a concrete reason.
6. **§8.2 maps all eleven documented SDK error codes** onto `PurchaseOutcome`, which gains **`alreadyOwned`** — the normal re-purchase case on a NON_CONSUMABLE decoration, previously unrepresentable — and routes `PAYMENT_PENDING` to E7's reconciliation path.

---

## 0. What the director asked, and what this delivers

Verbatim (Discord, 2026-08-05, translated in the task brief):

> 1. 광고를 앱 여기저기 뿌리지 말고 — 지어진 건물이 10분에 한 번쯤 말풍선을 띄우고, 그걸 누르면 광고가 재생되고 인게임 재화를 준다.
> 2. 추가 건축: 하루 10개 제한을 넘어서 하나 더 지으려면 1,000원.
> 3. 마을/건물 꾸미기 아이템: 100~5,000원 범위, 인게임 재화 **또는** 현금으로 구매 가능.

| Ask | Delivered by | Not watered down because |
|---|---|---|
| 광고를 뿌리지 말 것 | **F25 말풍선.** At most **one bubble in the entire town at any moment** (§4.2, invariant E-2). No banner, no interstitial, no ad on app open, no ad on 기록, no ad anywhere off the town screen. | The anti-spam property is a stated invariant with a DOM test (`querySelectorAll("[data-ad-bubble]").length <= 1`), not a guideline. |
| 지어진 건물이 ~10분마다 말풍선 | The bubble sits **on a real built building**, chosen by `src/platform/random.ts` among eligible buildings, present when `clock.now() >= economy.adBubble.readyAtMs`. Which buildings count as "지어진 건물" is **the director's** (D-48); the interval is his number too (D-42), seeded with his stated ~10 minutes. | Derived from the **clock port** per MVP-SPEC §10.2's lint rule — no `setInterval` as a source of truth, no `Date.now()`. |
| 누르면 광고 재생 + 인게임 재화 지급 | Tap → a confirm sheet stating the reward → `ads.showRewarded()` → **씨앗** granted only on a real reward signal (`userEarnedReward` on the `toss` driver), idempotently per bubble id. | The dev driver grants after a short stub delay, so the whole loop is demoable today; the grant path is identical, so wiring the real SDK changes one file. |
| 10개 초과 시 1채 더 = 1,000원 | **F26 추가 건축 구매.** Flat ₩1,000 real money via the `payment` port → `IAP.createOneTimePurchaseOrder`. A mandatory confirm dialog precedes the SDK call. | The price is the director's number, verbatim. Repeatable or capped is **not** in the brief → **§6.5 designs it, D-44 decides it**; one constant either way. |
| 꾸미기 아이템, 100~5,000원 | **F27/F28 꾸미기 상점** — 8 items, visual-only, zero gameplay effect, three existing render surfaces. | Range honoured; per-item prices are director numbers (D-46). |
| 인게임 재화 **또는** 현금 | Every catalog item carries **two independent prices** and two deliberately non-parallel buttons. Owning by either route is identical and permanent. | The two prices are two director numbers; the app never derives one from the other, **never renders an exchange rate**, and never renders them in parallel typography (R-9a/R-9b, §5.2) — that pair is the concrete answer to the confusion risk. |

**What the player sees on day one (dev build, no accounts, demo values on):** they log a coffee, a café rises, and a few minutes later a speech bubble pops over one of their buildings. Tapping it opens a small sheet — "광고를 보면 씨앗을 받아요 · 영상이 재생돼요" — with 나중에 and 광고 보기. They watch a stub panel labelled `개발용 광고 (실제 광고 아님)`, 씨앗 land with a toast. They tap the 꾸미기 button above the FAB, see eight items, buy 벚꽃길 with 씨앗, and the ground turns pink — the **sky does not change**, because the sky belongs to their budget and money may not touch it (§4.6, DE-12). Later they log an 11th expense, get the queue promise as always, and now also `지금 바로 짓기 · 1,000원` → confirm → mock payment → the building they just logged rises immediately.

---

## 1. How this serves the pillars (`app_in_toss/VISION.md` §2)

| Pillar | Effect of this addendum | The way it could have failed |
|---|---|---|
| **P-a** real habits → visible town | **Preserved by construction, and this is the load-bearing claim of the document.** Money buys **capacity**, never a building: F26 releases a build for an entry the player *actually logged* (§5.1). No purchase and no ad can produce a building with no real ledger entry behind it. 씨앗 buy **only** cosmetics — never a building, never a slot, never a streak day. R-14 additionally forbids a cosmetic from changing what a building *says* about your spending. | Letting ₩1,000 mint a building would sever the link permanently, and no later patch could restore it — every town in existence would already contain bought buildings. |
| **P-b** budgeting less like a chore | Neutral, and §2's attach map proves it: the entry flow gains **zero** taps. The paid option appears only on the over-cap path, which already interrupts with a toast today, and it appears **after the entry is saved** (§6.2). Nobody is asked to pay before their coffee is recorded. | A paywall inside the save flow would make logging feel like a toll booth — the exact chore the app exists to remove. |
| **P-c** casual "watch something grow" | The biggest win. The town gains its first *reason to look at old buildings* (bubbles land on any eligible building, not the newest) and its first customisation axis that is not the buildings themselves. Cosmetics are permanent, re-appliable and never lost to a deletion (§7.1 rule 4). | A cosmetic destroyed by deleting a building would turn a delight into a support ticket. Ownership is deliberately separated from application to make that impossible. |
| **P-d** Toss-native | Protected by the strictest rule here: **씨앗 are never rendered on 기록, never in the town header, never with a thousands separator, never with 원**, and never typographically parallel to a KRW figure (§5.2). The app never looks like it holds a balance inside a bank. | This is precisely the failure mode MVP-SPEC §1.3/§7 rule 2 cut currency to avoid. §5.2 is the replacement guard and it is stronger than the cut, because it is testable. |

**Gamification framing (why this is a loop, not an IAP bolt-on):** the ad bubble is a *collectible interruption* — the same operant beat as FC-4's tap-to-collect clock icon, which MVP-SPEC §1.2 named as loop-function D and discharged with the materials queue. The bubble discharges it a second time, on the **same-session** timescale that MVP-SPEC §1.2's closing paragraph (`:90`) admits is the loop's one remaining hole ("Nothing here brings a user back at 9pm on a day they already logged"). That is the honest motivational argument for the feature existing at all, and it is why the bubble **waits instead of expiring**: the pull must be "something is waiting for you", never "hurry or lose it".

---

## 2. Where this attaches to the core loop — three points, drawn

MVP-SPEC §4 (`:141-201`) is the loop of record. Below it is redrawn with **every** addition marked `«NEW»`. Nothing else in the loop changes, and the diagram is the evidence, not the sentence.

```
   ── FIRST OPEN OF A DAY ────────────────────────────────────────────┐
   [0] App opens → boot sequence, in order:                           │
        a. slots reset if stored date < today                         │
        b. MONTH SETTLEMENT if period changed → 기념비                 │
        c. MATERIALS QUEUE drains                                     │
        d. town scrolls to the newest structure                       │
   «NEW» e. ECONOMY chunk loads (`ait.v1.economy`, optional key —     │  ATTACH 1
        absent = pre-economy town). Pure read. Runs AFTER (a) because │  read-only,
        it needs `today`; independent of (b)(c)(d). No new order      │  no new
        dependency, no new failure mode for the town (§9.2).          │  ordering
   └───────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────▼───────────────────────────┐
        │  [1] TOWN screen                                │
        │   header: 남은 건축 슬롯 · 연속 N일  (unchanged) │
        │   sky: 이번 달 페이스   (unchanged, R-12)        │
        │   저축 블록             (unchanged)              │
        │   ⊕ FAB                (unchanged)              │
        │ «NEW» at most ONE ad bubble on one eligible      │  ATTACH 2
        │       building, present iff clock.now() >=       │  additive
        │       readyAtMs                                  │  surface
        │ «NEW» 꾸미기 mini-FAB above the ⊕ FAB (§7.4)     │
        └───────┬───────────────────────────┬─────────────┘
                │ ⊕ FAB                      │ 무지출 버튼
                ▼                            ▼
        ┌───────────────────┐        ┌──────────────────────────┐
        │ [2] ENTRY sheet   │        │ [2'] claim no-spend day  │
        │  ≤3 taps          │        │  UNCHANGED               │
        │  UNCHANGED — the  │        └──────────────────────────┘
        │  economy adds ZERO│
        │  taps here        │
        └───────┬───────────┘
                ▼
   ┌────────────────────────┐
   │ [3] SAVE writes entry  │  UNCHANGED
   └──┬────────────┬────────┘
      │ 저축?      │ 지출/수입?
      ▼            ▼
 ┌──────────┐   slots left?
 │ UNCHANGED│   ├── YES → build now              UNCHANGED
 └──────────┘   └── NO  → queue not full?
                          ├── YES → banked as MATERIAL, promise toast
                          │        «NEW» + secondary action              ATTACH 3
                          │          [지금 바로 짓기 · 1,000원]           only on the
                          └── NO  → saved as ledger data only            over-cap
                                   «NEW» + the same secondary action     branch,
                                     (builds directly from the entry)    AFTER save
      │
      ▼
 [4] Derived state recomputes: tier, mood, streak, 저축탑
     UNCHANGED — the economy is NOT derived state (§9.1) and contributes
     nothing to any selector (AC-S1 pins this byte-for-byte).
      │
      ▼
 [5] 기록 tab — UNCHANGED. No 씨앗 balance here, ever (§5.2 rule 5, AC-S5).
      │
      ▼
 [6] Slots exhausted, queue non-empty → the promise. UNCHANGED.
      │
      └────────── local midnight: slots reset ──────────► back to [0]
```

**Read off the diagram:** the ad bubble hangs off [1] only, the shop hangs off [1] only, the purchase hangs off the *failure branch* of [3] only, and the boot addition is a pure read. The three loops MVP-SPEC §4 note 6 names (daily / monthly / cumulative) gain a **fourth, shorter one** — minutes, inside a session — and that is the whole intended change to the loop's shape.

---

## 3. The risk frame — eleven dead ends this design is shaped against

Everything in §4–§9 closes one of these. This is the section to argue with; the rest is consequence.

| # | Dead end | How it kills you in year two | Closed by |
|---|---|---|---|
| **DE-6** | A game-currency number reads as a KRW balance inside a financial super-app | The exact risk MVP-SPEC §7 rule 2 (`:401`) cut currency to avoid. Unfixable after the fact: screenshots, support tickets and possibly a platform review all land on "이 미니앱이 내 돈을 들고 있는 줄 알았다". | §5.2: a currency named after a physical object, a `SeedCount` branded type, a `formatSeeds` that cannot emit `,` or `원`, `src/economy/**` forbidden from importing `format.ts` (R-7), balance on **exactly two surfaces**, never on 기록, no exchange rate anywhere (R-9a), and **no typographic parallelism** between the two prices (R-9b). |
| **DE-7** | Ad bubbles multiply — per-building timers, stacking, offline accrual | A week away and the town is a field of ad buttons. That *is* the "여기저기 뿌리는 광고" the director rejected, arrived at by increments. It also re-creates FC-5's punish-absence dynamic MVP-SPEC §2 (`:113`) explicitly cut. | Invariant **E-2: one bubble town-wide, ever.** One `readyAtMs`, one `buildingId`, no per-building state, no stacking, no unclaimed queue. Absence yields **at most one** waiting bubble by arithmetic, not by tuning (§4.2). |
| **DE-8** | Paid extra builds quietly dissolve the daily appointment | The cap is the retention engine (MVP-SPEC §1.2 function C). D-7 (`:671`) itself warns "paid limit raises would directly weaken the retention mechanic". Unbounded paid builds make the town purchasable and the appointment optional. | The purchase is **one slot for one already-logged entry**, never a bulk unlock; **§6.5 designs the cap** (`paidBuildsMaxPerDay`, recommended 1/day) and it exists from day one so a cap needs no migration; §5.1 forbids money from creating a building without an entry. |
| **DE-9** | A real-money purchase that can be destroyed | No server, local storage only. "I paid ₩1,000 and deleted the building / cleared my browser" has no answer, and every instance is a refund. | (a) F26 buys a build **for an entry already saved and queued** — payment can fail at any point with zero data loss (§6.2). (b) Mock receipts live under a **separate storage key** that `clearAll()` does not touch, and `payment.listEntitlements()` restores owned items at boot from that key today and from `IAP.getCompletedOrRefundedOrders` at E7 (§7.7). (c) F12 import can never reduce owned items (R-13). |
| **DE-10** | SKU ids and ad-group ids invented today | Store/console identifiers are permanent. A SKU named `item1`, or a scheme with no version segment, is carried for the life of the product. | §8.3 fixes the id scheme now (`build.extra.v1`, `deco.<family>.<slug>.v1`), freezes it in `src/economy/skus.ts` with a snapshot test (R-10). Ad group ids are **not** invented — they are console outputs, held as `null` until D-50. |
| **DE-11** | Real-money code paths that cannot be tested without accounts | The riskiest code in the app becomes the only untested code, first exercised on a real user's money. | The port pattern MVP-SPEC §10.2 already established: `ads` and `payment` with a `browser`/dev driver today, `toss` later (§8). Every purchase and grant path is unit-testable against a fake driver, including cancel, failure, already-owned and unavailability. **What cannot be faked convincingly is deferred to E7 rather than mocked into MVP** (§11). |
| **DE-12** | Purchased cosmetics overwrite the mood signal | The sky is the budget-pace channel (F6). A bought "always sunny" theme lets money hide a bad month — in a budgeting app. Once sold, it cannot be withdrawn. | **R-12**: no purchased item and no ad reward may alter the sky gradient, the mood status line, or the pace bar. Ground, street, props and signage only. A DOM test asserts the sky class stays a pure function of `moodTier` with every item applied. |
| **DE-13** | A `SCHEMA_VERSION` bump to carry the new state | `parseStorageExport` rejects any file whose `schemaVersion !== SCHEMA_VERSION` (`storage.ts:102`). Bumping invalidates **every export file already in existence**, including the director's demo states and every QA bug report attachment. | §9.2 follows the **`LAYOUT_VERSION` precedent** (`storage.ts:35-43`, `:63-77`): an **optional** key/field, absent meaning "pre-economy", defaulted on read. **`SCHEMA_VERSION` stays 1.** |
| **DE-14** | The ~10-minute timer implemented with `setInterval` / `Date.now()` | Breaks `no-restricted-syntax` (MVP-SPEC §10.2 `:600`), makes the feature invisible to TimeTravel, and makes every QA test a wall-clock wait. | §4.5: readiness is **always recomputed from `clock.now()`**; one `setTimeout` exists solely as a repaint trigger and is never the source of truth. Because TimeTravel is date-granular (§12.2), the S7 force control is a **required** deliverable, not a nicety. |
| **DE-15** | Decorations placed on empty lots | A decorated lot is either removed from the open pool — breaking ADDENDUM-02 §3.2's **proven** guarantee that a free lot always exists — or overwritten when a building lands on it, destroying a paid item. | **MVP ships no lot-placed decorations** (§7.1 rule 3). `openPlotCount`/`requiredLots` are not opened. Lot decoration is Later-2 with this as its stated blocker (§7.6). |
| **DE-16** | **A currency that outlives its catalogue** | 7 paid SKUs, permanent ownership, and E-1 forbids any other sink. The week a player owns everything, the headline ad mechanic starts paying a currency with nothing to buy. The bubble does not become neutral — it becomes an ad request with a visibly worthless reward, which teaches the player that *every* reward in the app is decorative. That lesson does not un-teach. | **E-6** (§4.2): a bubble arms only while at least one unowned item carries a non-null seed price. At the terminal state the bubble stops and the shop reads 모두 모았어요 · 새 아이템이 나오면 알려드릴게요. The predicate is data-driven, so a content pack revives the loop with **no migration and no code change**. The long-run sink shape is **D-54**, with the tempting option named and refused. |

ADDENDUM-01/02 rules R-1 (`LAYOUT_VERSION`), R-3 (no number in two files), R-4 (single writer for `plotIndex`), R-5 (the pool is what is on screen) and R-6 (no silent randomness) are unchanged and still binding. R-2 is **narrowed** (§7.5). This addendum adds **R-7…R-16**, all grep- or test-checkable (§9.4).

---

## 4. F25 · 광고 말풍선 (the ad bubble)

### 4.1 Which buildings are eligible — **the director's call (D-48)**

The director said **"지어진 건물"**. Read literally that includes a 무지출 공원 and a 기념비, both of which are built buildings that stand on plots. Narrowing it is a **tone** decision about where an ad may sit, and tone in this app is his. So the eligibility set ships as one constant read by one pure predicate:

```ts
// src/economy/selectors.ts — pure, no randomness, no clock
export function isEligibleForBubble(b: Building, allow: readonly BuildingSourceKind[]): boolean {
  return allow.includes(b.source.kind);
}
```

`bubbleEligibleSources` is a **director value** (D-48), landing in `balance.approved.ts` like every other. My recommendation, with the reasoning he is owed:

| Candidate | Recommendation | Why |
|---|---|---|
| `source.kind === "entry"` (지출/수입 buildings) | **include** | The literal core of the ask, and the only class with no ceremonial meaning attached. |
| `source.kind === "nospend"` (무지출 공원) | **exclude — recommended, his call** | F15 makes the park "the rarest and most attractive asset in the set", the reward for the *best financial day*. Turning it into an ad button cheapens the one tile that celebrates not spending. |
| `source.kind === "monument"` (기념비) | **exclude — recommended, his call** | A dated permanent record of a month the player lived through. An ad bubble on it works against the object's whole purpose. |
| 저축 structures | **not eligible, and this one is not a tone call** | They are not in `buildings[]` at all (ADDENDUM-01 §2.1) — they own *cells*, not plot indices, and have no `source`. Including them is not a constant change but a new code path. Monetising the 저축 surface is also the worst available optics in a finance app. If the director wants it, that is a separate ask, not a value. |

**Consequence worth stating plainly under my recommended set:** a player with zero expense/income buildings has **no ad inventory** — a brand-new town or a pure-saver has nothing to tap. That is accepted, and it doubles as the natural first-session guard: no bubble can interrupt a session before the player's first building exists. That is why an explicit `firstBubbleAfterBuildings` dial is **not** proposed — it would add an unset constant in front of the headline mechanic to buy a property the eligibility rule already gives for free. If the director later wants a higher floor, it is one constant, added then.

### 4.2 The invariants (E-1…E-6)

1. **E-1** — 씨앗 can be obtained by exactly one means: a completed rewarded ad. No login gift, no purchase of 씨앗 for cash, no streak payout, no refund path. (Selling 씨앗 for cash is Later-3, D-53.)
2. **E-2** — **At most one bubble exists in the town at any moment.** No stacking, no per-building bubbles, no unclaimed-bubble queue.
3. **E-3** — A bubble **never expires.** It waits until tapped or until its building is deleted.
4. **E-4** — The interval starts **when the previous bubble is consumed**, not when it appeared. Inventory is therefore bounded by elapsed time since the last reward, and an absent player accrues exactly one bubble, not N.
5. **E-5** — 씨앗 are granted **once per bubble id**, on a real reward signal. A duplicated SDK event, a double tap, or a re-mount cannot double-pay.
6. **E-6 (new, closes DE-16)** — **No bubble arms while there is nothing left for 씨앗 to buy.** The arming predicate carries one extra clause: `catalogue.some(i => !owned(i.sku) && i.priceSeeds !== null)`. When it goes false the bubble stops appearing and S8 shows a terminal state (`모두 모았어요 · 새 아이템이 나오면 알려드릴게요`) instead of an empty grid. When a content pack appends SKUs (the id scheme is append-only, §8.3) the predicate flips back on its own — **no migration, no code change, no re-release of the ad logic.** The rule is deliberately about *seed*-priced items only: an item priced in KRW alone is not a sink for the currency the ad pays.

### 4.3 State and lifecycle

```ts
// src/economy/types.ts
export interface AdBubbleState {
  /** nanoid, minted when the bubble becomes ready. THE grant idempotency key (E-5). */
  id: string | null;
  /** Which building it sits on. null = no bubble present. */
  buildingId: string | null;
  /** clock.now()-based epoch ms. Present iff clock.now() >= readyAtMs && buildingId !== null. */
  readyAtMs: number;
  /** Bubble ids already paid out — bounded ring (last 8). E-5 across reloads. */
  paidBubbleIds: string[];
}
```

Lifecycle — four transitions, **all of them writes, never render-time computation** (R-11):

| From | Trigger | To |
|---|---|---|
| no bubble, `readyAtMs` in the future | the repaint timer fires, or boot, or any store action, and `clock.now() >= readyAtMs` **and E-6's predicate holds** | **arm**: draw a target with `random.pick(eligibleBuildings)`, mint `id`, push a `{ kind: "adBubble" }` Notice into the existing FIFO notice queue (`useTownStore.ts:124-134`) |
| bubble present | player taps it, confirms in the pre-ad sheet, ad returns `{kind:"rewarded"}` | **consume**: grant 씨앗, push `id` into `paidBubbleIds`, clear the bubble, set `readyAtMs = clock.now() + adBubbleIntervalMs` |
| bubble present | its building is deleted (F9) | **re-arm immediately** on an eligible building if one exists; otherwise clear to "no bubble" with `readyAtMs` unchanged |
| bubble present | move mode is entered (ADDENDUM-02 §4) | **hide, not clear** — the tile is a move target while the gesture runs; the bubble reappears on exit |
| bubble present | the last seed-priced item is purchased (E-6 goes false) | **clear.** A bubble already on screen when the catalogue is completed is dismissed silently, not left as a dead button. |

**R-11 — bubble targeting is a write, never a render-time draw.** `random.pick` is called only inside store actions (boot, post-build, post-consume, post-delete), mirroring R-4/R-6's existing discipline. A render-time draw would move the bubble on every re-render and would be unreproducible in a bug report.

### 4.4 The tap path — a confirm sheet before any ad, and one gesture layer

The town has **one** delegated listener (`useTileGestures`, attached once to `.town-grid`, `:181-189`). The bubble is a node inside its building's `.town-tile` carrying `data-ad-bubble="1"` and `data-bubble-id`. The composition layer's tap handler checks `target.closest("[data-ad-bubble]")` **before** `closest("[data-plot-index]")` (`useTileGestures.ts:42`): if present it is a bubble tap and the move-mode commit path is skipped; otherwise behaviour is byte-identical to today. A long-press starting on a bubble is a bubble tap on release, **never** a move grab — a 500 ms hold must not become an ad.

```
tap bubble
   ▼
[A] PRE-AD CONFIRM SHEET  ← no ad ever starts on a single tap
    "광고를 보면 씨앗을 받아요.  영상이 재생돼요."
    [나중에]  (costs nothing; the bubble stays exactly where it was)
    [광고 보기]
   ▼
[B] ads.showRewarded()
    ├─ rewarded    → 씨앗 granted (once per bubble id), bubble consumed, toast
    ├─ dismissed   → no 씨앗, bubble STAYS, toast "광고를 끝까지 보면 씨앗을 받을 수 있어요"
    └─ unavailable → no 씨앗, bubble STAYS, toast "지금은 광고를 불러올 수 없어요"
                     never a retry loop, never an error dialog
```

Why the sheet is MUST and not polish, and it now carries a second load: inside a bank's super-app, an ad that starts from a single mis-tap on a decorative-looking speech bubble is the single worst tonal outcome available to this feature, and it is the one a user would screenshot. The sheet also makes E-5's double-tap case trivial — the second tap lands on a sheet backdrop, not on `showRewarded()`. And per §7.3 slot D1, the bubble's hit area at a 320 px viewport is **below the 44 px accessibility ideal in height**; the sheet is what makes that shortfall harmless, because a mis-tap costs a dismiss, not an ad.

**AC-B7:** with 5,400 tiles rendered (dense fixture) the grid still has exactly one listener set and one tab stop; the bubble adds **zero** per-tile handlers.

### 4.5 The timer, the clock port, and MVP-SPEC F4's "no timers" sentence

```
present(now) := bubble.buildingId !== null && now >= bubble.readyAtMs        // pure, testable
```

- The **truth** is that expression, evaluated with `clock.now()`. No timer participates in it.
- One `setTimeout(max(0, readyAtMs - clock.now()))` lives in `useAdBubbleTick` purely to force a re-render at the right moment; it re-arms after firing and clears on unmount. If it never fires (backgrounded tab, throttled timer), the next render, the existing `visibilitychange` effect, or any store action produces the same result.
- **MVP-SPEC §5 F4 (`:248`) says "no timers, no background jobs."** That sentence is about slots and it stays true of slots, but F25 introduces the app's first timer and the spec must say so rather than be quietly contradicted. §10 amends it.
- **Backward clock safety.** `clock.now()` can move *backward* — TimeTravel to an earlier date sets `now()` to that date's midnight (`clock.ts:57-60,68-75`), and clearing travel jumps it again. So on every read: **if `readyAtMs - clock.now() > adBubbleIntervalMs`, re-arm `readyAtMs = clock.now() + adBubbleIntervalMs`.** Without this clamp, one backward jump can strand a player's bubble for years. This is a *derived clamp*, not a new constant.
- **AC-B1 (QA, no wall-clock waiting):** with a fake clock injected, `present()` is false at `t`, true at `t + adBubbleIntervalMs`, and no timer is required to observe either.
- **AC-B2:** `git grep -nE "Date\.now|new Date|setInterval" src/economy/` returns nothing.

### 4.6 What the reward feels like, and what it may never touch

- On success: the bubble pops, 씨앗 fly toward the 꾸미기 mini-FAB, one toast (`씨앗 N개를 받았어요`). No full-screen celebration — that beat belongs to tier-ups.
- **R-12 — money and ads never touch the mood layer.** No purchased item and no ad reward may alter the sky gradient, the mood status line, or the budget-pace bar. Ground, street, props and signage are the only paintable surfaces. Test: rendering S2 with every catalog item owned and applied leaves the sky class a pure function of `moodTier(ym)` (AC-S2).

---

## 5. F24 · 씨앗 — the currency, and the confusion risk stated head-on

### 5.1 What money and 씨앗 may each buy (the amended invariant)

MVP-SPEC §7 invariant 1 (`:400`) currently reads: *"The only sources of a building are: a real ledger entry, a claimed no-spend day, and a lived month. No login gift, no ad reward, no purchase, no achievement payout."*

Mechanic 2 makes the literal wording false. It is amended so the **property it was protecting survives exactly**, and the amendment needs the director's sign-off (**D-49**):

> **Invariant 1 (amended).** The only sources of a building are: a real ledger entry, a claimed no-spend day, and a lived month. **No login gift, no ad reward, no achievement payout, and no purchase can create a building.** Money may buy **build capacity** (one slot, F26) for an entry the player has already recorded; it can never produce a building where no real ledger entry exists.
>
> **Invariant 6 (new).** 씨앗 buy **cosmetics only**. 씨앗 can never buy a slot, a build, a streak day, a no-spend claim, a monument, a 저축 level, or any change to town size, tier, mood or pace. **No purchase may change what a building says about your spending** (see R-14).

**R-8** makes this structural rather than a promise: every construction of a `Building` with `source.kind === "entry"` requires an existing `LedgerEntry` id (already true of `entryActions.ts` and `queueActions.ts:52`), and F26's paid path takes an `entryId` argument and cannot be called without one. `git grep -n "source: { kind:" src/ | grep -v test` returns only the known writers.

### 5.2 The name, the display, and why it cannot read as money

**Name (content, not balance — the director may overturn for free, D-40): 씨앗.** The reasoning is risk-shaped, not aesthetic:

1. It cannot be misread as money. There is no currency called seeds.
2. It cannot be misread as **build materials** either. `자재` is already taken by F14's queue ("어제 남긴 자재로 3채가 지어졌어요"), and a currency named 벽돌/자재 would *promise* that it builds houses — a promise invariant 6 forbids forever. **씨앗 → 꾸미기, 자재 → 건물** encodes the invariant in the vocabulary, so the wrong expectation never forms.
3. It fits the village fiction without the app inventing a bank.

**The display contract — the concrete answer to the confusion risk, not an acknowledgement of it:**

| # | Rule | Enforcement |
|---|---|---|
| 1 | 씨앗 render as `<seed icon> N개`. **Never** a thousands separator, **never** `원`, **never** `₩`. `1234개`, not `1,234`. | `formatSeeds(n: SeedCount): string` returns `` `${n}개` ``; unit test asserts `/^\d+개$/` for n ∈ {0, 1, 999, 1000, 123456}. |
| 2 | `SeedCount` is a **branded type** (`number & { readonly __seeds: unique symbol }`). A seed value cannot be passed where a KRW amount is expected without an explicit, greppable cast. | `tsc --noEmit` (Gate 1). |
| 3 | **R-7 — `src/economy/**` may not import `../format` and may not contain the character `원`.** | `git grep -n "원" src/economy/ \| grep -v "\.test\."` empty; eslint `no-restricted-imports`. |
| 4 | **R-9a — no UI, ever, renders a 씨앗↔KRW conversion.** No "120 씨앗 = 1,000원", no "≈", no seed-per-won hint. Two independent director numbers. | Shop DOM test (AC-S4): no node contains both units, and the two price nodes share no ancestor below the item card. |
| 5 | **R-9b — the two prices are never typographically parallel.** The KRW price is a **filled** button with money type style and a bare price grammar (`1,200원`). The 씨앗 price is an **outlined chip** with body type style and a **verb** grammar (`🌱 12개로 심기`). Different component, different weight, different grammar, different position in the card. | AC-S4 asserts the two nodes carry different `data-price-kind` values and different class roots; visual review by `ui-ux` against §7.3. |
| 6 | The balance appears on **exactly two surfaces**: the 꾸미기 상점 sheet header, and the transient reward toast. **Not** in the town header, **not** on 기록, **not** on S1/S5/S6. The 꾸미기 mini-FAB carries a **non-numeric dot** when something is newly affordable — never a count (§7.4). | AC-S5: rendering 기록 with a non-zero balance produces zero nodes with `data-unit="seed"`. |

Rule 5 and rule 6 do the most work. R-9a alone forbids a *rendered rate*; R-9b forbids the actual confusable case, which is two numbers sitting side by side in matching buttons. And MVP-SPEC's original worry (`:401`) was that a mini-app inside a bank would look like it holds a balance: a balance that exists only inside a shop the player deliberately opened is a shop's stock counter; a balance pinned to the home header is a wallet. **We ship the former.**

### 5.3 What 씨앗 are worth

`seedsPerRewardedAd` and every catalog seed price are **gameplay constants — the director's call** (D-41, D-46), and under §9.3's null-dial rule they ship as `null`, which means the corresponding feature is disabled and invisible until he answers. This document invents none of them and names them all.

One **design** constraint offered as a recommendation rather than a value: prices and rewards chosen so a normal player's balance stays in three digits keep the display trivially un-money-like. If he prefers a scale where balances routinely exceed four digits, rules 1–6 still hold — the design does not depend on the magnitude.

---

## 6. F26 · 추가 건축 구매 (paid extra build)

### 6.1 The exact trigger

Reachable **only** when a 지출/수입 entry has just been saved with `slotsRemainingToday === 0`. Not from the shop, not from settings, never proactively offered, never shown when slots remain. The player must have hit the cap **today, with a real entry**, for the option to exist at all. `dailyBuildSlots` is **10** as of T016 (director-approved 2026-08-05); this addendum does not change it, and the purchase never alters the free cap.

### 6.2 The flow, ordered so no failure can lose data

```
[1] SAVE (over cap) ──► entry persisted + material queued (F14, unchanged)
                        toast: "오늘 슬롯을 다 썼어요. 내일 아침에 지어드릴게요 (대기 N개)"
                        NEW secondary action: [지금 바로 짓기 · 1,000원]
                                │  (hidden when paidBuildsMaxPerDay is null (D-44 unanswered)
                                │   or already reached today)
                                ▼
[2] CONFIRM DIALOG  ── mandatory, never skippable, never remembered
     "방금 기록한 건물 1채를 지금 바로 지어요.  1,000원이 결제돼요."
     [취소] (default focus)      [1,000원 결제]
                                │
                                ▼
[3] payment.purchase("build.extra.v1", grant)
      ├─ cancelled     → nothing happens. Entry still saved, still queued. Quiet dismiss.
      ├─ unavailable   → toast "지금은 결제를 사용할 수 없어요". Entry still saved and queued.
      ├─ failed        → toast "결제가 완료되지 않았어요". Entry still saved and queued.
      ├─ alreadyOwned  → cannot occur for a CONSUMABLE; if the SDK reports it anyway,
      │                  treated as `failed` with its own analytics tag (§8.2).
      └─ granted(orderId)
                │  grant(orderId) runs INSIDE the SDK's processProductGrant:
                ▼
[4] GRANT: if orderId ∈ economy.grantedOrderIds → return true (already granted, no double build)
           else: build exactly one material via drainQueue (§6.3)
                 → persist buildings chunk + entry patch (buildingId, queued:false) + economy
                 → push orderId onto grantedOrderIds → return true
                ▼
[5] The building rises with the normal animation. Tier/streak/mood recompute exactly as a free build.
```

**Why the entry is queued first and the purchase second — this is the whole design.** Every alternative ordering ("pay to unlock the save", "hold the entry until payment resolves") creates a state where a crash, a backgrounded WebView or a declined card leaves a logged expense in limbo. Here the entry is safe at every instant: the worst outcome of any payment failure is that the building arrives tomorrow morning for free, exactly as it would have without the offer. **There is no code path in which a player can pay and lose data, or lose data by trying to pay.**

`grantedOrderIds` in MVP covers exactly one thing: a `grant` callback invoked more than once within a session (which S7 can force). Cross-boot redelivery of a pending order is an **E7** concern and is not built or claimed here (§11).

### 6.3 The build itself — the exact `drainQueue` call, not "as F14 would"

`src/queueActions.ts:27-84` already does everything needed, and it is parameterised in a way that yields exactly one slot without touching the file:

```ts
// pseudocode at the store level; drainQueue itself is unchanged
const mine  = town.queue.find(m => m.entryId === entryId)
           ?? { entryId, categoryId, variantIndex: random.int(variantsPerCategory), queuedOn: today };
const rest  = town.queue.filter(m => m.entryId !== entryId);

const result = drainQueue(
  { ...town, queue: [mine, ...rest] },   // this entry's material at the head
  existingBuildingCount,
  today,
  town.slotsUsedToday + 1,               // ← yields exactly ONE drainable slot
  tierThresholds, buildingIdFor, clock.now(), allocatePlotIndices,
);
```

Why `dailyBuildSlots := town.slotsUsedToday + 1` gives exactly one, traced through the shipped code: `slotsRemainingToday` (`selectors.ts:93-104`) computes `used = slotsUsedOn < today ? 0 : slotsUsedToday`; in the over-cap case `slotsUsedOn === today`, so `remaining = (slotsUsedToday + 1) - slotsUsedToday = 1`, and `drainCount = min(1, queue.length) = 1` (`queueActions.ts:44`). `usedBeforeDrain = dailyBuildSlots - remaining = slotsUsedToday` (`:73`), so the new `slotsUsedToday` is `slotsUsedToday + 1` (`:78`) — today's real count, not an overwrite. Afterwards `slotsRemainingToday` under the real cap of 10 reads `max(0, 10 - 11) = 0` — already clamped at `selectors.ts:103`, **no new clamp is needed and none should be added.**

Two consequences worth spelling out:

- **The queue-full case needs no second code path.** When the entry overflowed the queue and has no material, one is synthesised (the `?? {...}` branch above) with `variantIndex` rolled by the same `random` call the queue push uses (R-6 — a write, never a render draw), and the same drain runs.
- **The material is moved to the head, so the building that rises is the one the player just logged.** This is a deliberate deviation from strict FIFO. A real-money purchase made in the immediate context of "커피 4,500원" must not raise someone's three-day-old 마트 building; that is a bait-and-switch on a paid action. The FIFO order of everything else is preserved. Strict FIFO is a one-line alternative (drop the reorder) if the director disagrees — listed under assumptions, §13.

### 6.4 Interaction with F14, stated exhaustively — including what the code does *not* guarantee

| Situation | Behaviour |
|---|---|
| Queue has room (normal case) | The entry queues; the purchase builds **that specific material** and removes it. Queue depth −1. |
| Queue is **full** (`materialQueueMax`) | The entry saves as ledger data with no material (F14's overflow branch, unchanged). The purchase synthesises the material and builds it; the entry's `buildingId` is set. |
| Player buys, then deletes the entry (F9) | The building is deleted with it (existing cascade). **The paid slot is not refunded** — identical to D-10's rule for free slots. A refund rule that differs between paid and free slots forks slot accounting forever. **D-47** asks the director to confirm; changing it now is one branch, changing it after launch is a support policy. |
| A queued material drains next morning | Unchanged code, unchanged behaviour. |
| Player buys twice in a day | Allowed iff `paidBuildsBoughtToday < paidBuildsMaxPerDay` (**§6.5, decided by D-44**). Separate order, separate confirm, flat ₩1,000 — no escalating price (D-45). |

**A guarantee F14's AC claims but the code does not enforce.** Rev. 1 of this document claimed F14 has a same-day guard the paid build is exempted from. **There is no such guard.** `drainQueue` (`src/queueActions.ts:39-83`) never reads `material.queuedOn`; the property is **emergent** — a material only exists because slots were exhausted, and slots only refill when the date advances. The paid build changes that premise: it hands out one slot *today*. So:

- The MVP-SPEC F14 AC clause (`:297`, "A queued material never builds on the same calendar day it was queued, even if slots free up (they can't, but the invariant is tested)") is **no longer unconditionally true** — the paid path is now a way slots free up. §10 amends the clause to scope it to the **drain path**, which is what its test actually covers.
- MVP-SPEC §1.3 (`:96`) states the same property in prose — *"banked materials build only on a later day's first open, never immediately"* — and it gets its own supersession row in §10, because it is the sentence that carries §1.3's whole argument for allowing the queue at all.
- **AC-P7** pins the emergent property for the drain path (unchanged behaviour), and **AC-P8** pins that the paid path builds exactly one material, the player's own, on the same day, by design.

### 6.5 Repeatable or capped — the recommendation, the reasoning, and what changes either way

This is the highest-stakes number in the document. The director's brief says "하나 더 지으려면 1,000원" and stops; it does not say whether "하나 더" is available once a day or once per over-cap entry. **The decision is D-44 and stays his.** What follows is the designed recommendation he is owed, in one place.

**Recommendation: capped per day, `paidBuildsMaxPerDay = 1`.**

**Reason 1 — the cap is the retention engine, and this is the only mechanic in the document that can dissolve it.** MVP-SPEC §1.2 names the daily cap as loop-function C, "scarcity that creates a daily appointment", and D-7 itself (`:671`) warns that "paid limit raises would directly weaken the retention mechanic". At `paidBuildsMaxPerDay = 1` the daily ceiling moves from 10 buildings to 11 — a **+10 % ceiling** on a cap that a normal day never reaches anyway, so for almost every player the appointment is untouched and the purchase is a rescue for one unusually heavy day. Unbounded, a player can buy their town: 100 builds for ₩100,000 in one evening, after which the appointment is over **permanently for that player**, because a bought town cannot be un-bought and there is no server-side state to reverse it.

**Reason 2 — and this is the one that decides it — unbounded paid builds re-couple town size to transaction volume, which MVP-SPEC's own guard exists to prevent.** The over-cap offer only appears *after a real entry*. So buying N extra builds requires logging N over-cap entries in one session. MVP-SPEC §1.3 (`:98`) states the guard in as many words: *"Volume of transactions raises the floor, never the ceiling."* A cap of 1 keeps that literally true — the ceiling moves by exactly one, once, regardless of how many entries follow. Unbounded, the ceiling becomes a function of how many entries you log and how much you will pay, which is the perverse farm loop the coins cut removed, re-entering through the payment door. **The single strongest argument for F26 existing at all — that money buys capacity, not buildings — survives only while capacity is bounded.**

**Reason 3 — refund exposure, before E7 exists.** Every paid build is a ₩1,000 order against **local-only** state (DE-9). There is no server, no receipt trail to reconcile against, and no way to prove what a user did or did not receive. At 1/day the worst-case dispute is ₩1,000 per user per day. Unbounded, one confused session is a ₩50,000 dispute that the app has no records to argue with. That asymmetry is a business risk, not a game-balance preference, and it disappears only after E7's `getCompletedOrRefundedOrders` exists.

**Why 1 rather than 2 or 3.** At 1, the offer is legible in one sentence — "하루에 한 번, 1,000원" — and needs no counter anywhere. Any value ≥ 2 forces the confirm dialog to state how many remain today ("오늘 1번 더 살 수 있어요"), which puts a **second money-adjacent counter** on screen next to a KRW figure. That is a new surface for DE-6 to leak through, bought for a marginal revenue gain. 2 or 3 still work and cost one copy line; the recommendation is 1 because it is the only value that costs zero new surface.

**Shape, precisely.** A per-day integer, not a lifetime cap, not a weekly budget, not an escalating price (D-45). It mirrors `dailyBuildSlots` so it resets on the same rule and reads off the same `…On` / `…Today` counter pair (§9.1) — one reset semantics, one TimeTravel behaviour, one mental model.

**If the director chooses unbounded — exactly what changes, so choosing it is cheap:**

1. **`null` is not the encoding for unbounded.** Under §9.3, `null` means "feature off and invisible", and that meaning must stay unique. My recommendation, and it is a design position rather than a value: **there is no honest "unlimited" in a design that must bound refund exposure with no server.** The right encoding is therefore a **large explicit integer the director picks** (e.g. 20), keeping one key, one type, one meaning for `null`, and guaranteeing the worst-case daily charge is always a number a human decided. If he genuinely wants no ceiling, that is `Number.MAX_SAFE_INTEGER` written out in `balance.approved.ts` as a deliberate, greppable act — not an absent value.
2. **The confirm dialog gains a running total** — "오늘 3번째 · 누적 3,000원". That is a **cumulative KRW figure adjacent to game content**, a surface that does not exist under the recommendation, so **R-9b's non-parallelism rule extends to it** and the dialog must be re-reviewed by `ui-ux`.
3. **§10's §1.3 supersession row weakens.** The replacement text claims "the scarce resource is still a day, because the paid path is bounded". Unbounded, that claim goes from true to arguable and the row must be rewritten to say so plainly rather than kept as-is.
4. **AC-P1's "already reached today" branch becomes unreachable** in practice but stays in the code and the test suite — dead code that costs nothing and un-deadens the moment he changes his mind.
5. **Nothing in the data model changes.** `paidBuildsBoughtOn` / `paidBuildsBoughtToday` already count without an upper bound; the cap is read at the call site only. This is why the counter ships from day one regardless of the answer — **a cap added later needs no migration**, which is the whole reason it is in §9.1 before D-44 is answered.

---

## 7. F27/F28 · 꾸미기 상점 (decoration shop)

### 7.1 Rules the catalog obeys

1. **Visual only.** No item changes any number, pacing, selector, tier, streak, slot or level. AC-S1 asserts every derived selector is byte-identical with and without every item applied.
2. **R-12** (§4.6): nothing purchasable touches the sky/mood layer.
3. **No lot-placed items in MVP** (DE-15). `openPlotCount`/`requiredLots` are not opened; ADDENDUM-02's free-lot proof stands unmodified.
4. **Ownership is permanent and separate from application.** Buying grants ownership forever; applying/unapplying is free, instant, unlimited. Deleting a building removes only the *application*.
5. Every item is purchasable with **either** currency, at two independently-set prices (D-46). Buying with either grants the identical, indistinguishable item.
6. **R-14 — no re-skins.** A shop item may never change a building's `categoryId`, its category colour (`PlaceholderBuilding.tsx:34`), or its category icon (`:38-40`). Accessories only. A shop that lets you re-skin a 카페 into a 은행 lets a player launder their own spending picture, which destroys the one thing the town is for (P-a). This is a hard rule on the **art order**, not a style preference (§7.3).

### 7.2 The MVP catalog — 8 items, and an honest word about slots

Placeholder content (the director may rename or replace freely — content, not balance). Every item maps to a **render surface that already exists**, so no new geometry and a bounded art order.

| Family | Surface it paints | Items | Sink shape |
|---|---|---|---|
| **마을 바닥 테마** (town-scoped, **one active**) | ground/street palette tokens on `.town-tile` / `.town-cross-street` / `.town-main-street` | `잔디길`(기본, free, always owned) · `벚꽃길` · `눈길` | **Wardrobe** — owning both paid themes means switching between them, not stacking. |
| **건물 장식** (per-building, re-appliable) | overlay nodes inside a building tile | `차양` · `화단` · `깃발` | **Stacking** — all three can be in use at once, on the same building or across different ones, and one item can be applied to many buildings. |
| **마을 어귀 조형물** (fixed cell, **one active**) | the existing `.savings-signpost` cell (ADDENDUM-01 §2.4a — decoration-only by construction) | `나무 안내판` · `분수대` | **Wardrobe.** |

**The wardrobe problem, addressed rather than left implicit.** Four of seven paid items live in one-active slots, so a second purchase in the same family retires the first from view. That genuinely lowers the marginal value of the second purchase, and three things answer it:

1. **It is disclosed before purchase, not after.** Each wardrobe family's tab header reads `하나만 적용돼요 · 언제든 바꿀 수 있어요`, and each owned-but-inactive item shows `보유 중 · 지금은 꺼짐` rather than being silently invisible. Nobody discovers the slot after paying.
2. **Switching is free, instant and unlimited** (rule 4), so a second theme is a *change of season*, not a wasted purchase. The 눈길/벚꽃길 pair is deliberately seasonal for exactly this reason.
3. **It is a pricing input the director owns.** A wardrobe item is worth less than a stacking one, so **D-46 explicitly asks him to price the two shapes differently** rather than applying one number across the catalogue. Naming which items compete for a slot is the planner's job; deciding what that is worth is his.

The **건물 장식** family is the deliberate counterweight: it is the only one whose value grows with the town, because a player with 40 buildings can apply 화단 to 40 of them. If the director wants the catalogue weighted toward growth, that family is the one to extend first (Later-4, D-54).

That is **8 items, 3 art families, 0 new grid cells, 0 new persisted geometry.** A larger catalogue is a later content pass against the same three surfaces; nothing in the data model changes to grow it, and per **E-6** growing it is what revives the ad loop at the terminal state.

### 7.3 Art order — per-slot contract (this is what `ui-ux` starts from)

**Geometry, re-derived from shipped code.** Rev. 2 of this document said a plot tile is 72 × 72 px. **That was wrong and would have produced art that clips.** The correct facts:

| Fact | Source | Value |
|---|---|---|
| Plot tile **width** | `plotTileWidthPx(vw) = (vw − 2·16 − 6·6 − 22) / 6` (`townLayout.ts:228-232`, constants at `:40-52`) | **fluid**: 38.3 px @320 · 45 px @360 · **50 px @390** · 56.7 px @430 |
| Plot tile **height** | `TILE_HEIGHT_PX` (`townLayout.ts:40`), reaching CSS as `--town-tile-h` (`App.css:245`) | **72 px, fixed** |
| Tile area | product of the two | 2,760 px² @320 · **3,600 px² @390** |
| Cross-check | ADDENDUM-01 `:626`, `:633` already state 50 px and 3,600 px² | agrees |
| Where 72 came from | `grid-auto-rows: 72px`, the **row height** — never the width | — |

Two further facts change the art order beyond the number, and both were found in `App.css` / `PlaceholderBuilding.tsx`, not assumed:

- **The icon is bottom-anchored, not centred.** `.building-tile` is `align-items: flex-end; justify-content: center` (`App.css:619-621`) and `.building-icon` is `font-size: 24px; line-height: 1; padding-bottom: 8px` (`:626-630`). So the reserved icon box is **24 × 24 centred horizontally at y ∈ [40, 64]**, and there is a **free 8 px plinth band at y ∈ [64, 72]** that the icon's own bottom padding leaves open. Rev. 2's "centre 32 × 32 icon zone" was in the wrong place.
- **`.building-roof-peak` is a fixed 36 px triangle** (`App.css:652-654`, two 18 px borders) while dome/flat are `width: 60%` (`:637`). At a 320 px viewport a 36 px roof on a 38.3 px tile is **94 % of the tile width**. Therefore **no top-corner overlay is safe at any viewport** — the flag slot had to move out of the top band entirely.
- **`.building-tile` is `overflow: hidden`** (`App.css:622`). Anything inside it is clipped to the tile, so an overlay physically cannot overhang; conversely the ad bubble, which must overhang, cannot live inside it.

**The three zones every overlay is specified against** (W = `plotTileWidthPx(vw)`, H = 72):

```
 y=0   ┌──────────────────────────────┐  ROOF BAND  y ∈ [0,14]
       │        (roof, reserved)       │  x extent = max(0.6W, 36) centred — the
 y=14  ├──────────────────────────────┤  36px peak variant is NOT fluid
       │                              │
       │        MID BAND — free        │  y ∈ [14,40], full width
 y=40  ├────────┬──────────┬──────────┤
       │  free  │ ICON BOX │   free   │  icon = 24×24 centred, y ∈ [40,64]
 y=64  ├────────┴──────────┴──────────┤  side margins = (W−24)/2 each ≈ 7.2px @320
       │      PLINTH BAND — free      │  y ∈ [64,72], full width
 y=72  └──────────────────────────────┘
```

| Slot | Asset | Box (anchored, width-fluid where noted) | Clearance proof | Placeholder shipped at E3 | Rename cost |
|---|---|---|---|---|---|
| **A1** | 마을 바닥 `벚꽃길` | Not a sprite: **4 palette tokens** — `.town-tile` base fill, `.town-tile` edge, `--town-asphalt` (`App.css:231`, declared "pure paint — no coordinate, stays here", which is exactly why retinting it does not touch R-3), and the cross-street tint | Viewport-independent. May not alter any sky token, any building tile colour, or the 저축 블록 (R-12, R-14) | CSS token set, pink family | Token file rename only; zero art |
| **A2** | 마을 바닥 `눈길` | Same 4 tokens | Same | CSS token set, cool-grey family | Same |
| **B1** | 건물 장식 `차양` (awning) | `left:0; right:0; top:14px; height:8px` — **100 % of the fluid tile width**, so it scales with the viewport by construction | y ∈ [14,22]: clears roof band (≤14) and icon box (≥40). Area = 8W = 306 px² @320 | Flat SVG rect + stripe, colour-neutral | One string in `content.placeholder.ts` |
| **B2** | 건물 장식 `화단` (flower bed) | `left:0; right:0; bottom:0; height:6px` — the plinth band | y ∈ [66,72]: clears icon box (≤64). Area = 6W = 230 px² @320. **This slot replaces rev. 2's corner 화분**, which at W=38.3 would have overlapped the icon box horizontally with only 7.2 px of free margin | SVG rounded strip + dots | Same |
| **B3** | 건물 장식 `깃발` (flag) | Pole `right:2px; top:16px; 3 × 18px`; cloth `right:5px; top:16px; 9 × 7px` — **mid band, right-anchored** | y ∈ [16,34]: clears roof band and icon box at every W. **Deliberately not in the top band**, because `.building-roof-peak`'s fixed 36 px leaves ~1 px of corner clearance at W=38.3. Area = 117 px² | SVG pole + triangle | Same |
| — | **combined budget, all three on one building** | 306 + 230 + 117 = **653 px² = 23.7 % of 2,760 @320**; 400 + 300 + 117 = **817 px² = 22.7 % @390** | Under the 25 % ceiling at the **narrowest** supported viewport, following `PIPS_PER_ROW`'s own precedent of deriving against `MIN_VIEWPORT_PX` (`townLayout.ts:253,266`) | — | — |
| **C1** | 조형물 `나무 안내판` | The `.savings-signpost` cell: `W × 72` (`App.css:503` `height: var(--town-tile-h)`), `align-items: flex-end` — **not 72 × 72**. Contract: bottom-anchored, ≤ 100 % W × 44 px | The cell has no roof and no icon, so no reserved zones. Must stay legible at W = 38.3 px | Rounded rect + plank glyph | Same |
| **C2** | 조형물 `분수대` | Same cell, same contract | Same | Circle + arc glyph | Same |
| **D1** | 말풍선 (ad bubble) | **Sibling of `.building-tile` inside `.town-tile`** — it cannot live inside `.building-tile` (`overflow: hidden`). Visual box 28 × 20 + 5 px tail, `left:50%` translateX(−50%), `top:-6px` (= exactly `GRID_GAP_PX`, `townLayout.ts:43`), z-index above sibling tiles | The **only** overlay permitted to enter the roof band and to overhang the tile box — it is transient, unpurchased, and carries no spending meaning. It may **never** enter the icon box. `top:-6px` is the largest overhang that does not reach past the inter-row gap. Needs its own opaque fill, never a tint of the tile, to stay legible over every category colour | White rounded rect + `▶` glyph | n/a |
| **D2** | 씨앗 아이콘 | 16 × 16 px inline in a shop card; 20 × 20 px in the shop header | Never rendered adjacent to a `원` figure (R-9b) | Emoji 🌱 | Icon swap only |

**The bubble's tap target — a real shortfall, stated rather than papered over.** The accessibility ideal is 44 × 44. The bubble's hit area is clamped to `plotTileWidthPx(vw) + 2 × GRID_GAP_PX` wide and ~32 px tall, because a larger area would extend past the adjacent gap into a neighbouring tile — and since the gesture handler checks `closest("[data-ad-bubble]")` **before** `closest("[data-plot-index]")` (§4.4), an oversized hit area would silently steal taps from the neighbour. At a 320 px viewport that is **50.3 × 32**, under the ideal in height. Mitigation, not elimination: the **pre-ad confirm sheet** (§4.4) means a mis-tap opens a dismissible sheet rather than starting an ad, so the cost of the shortfall is one tap. This is the second independent reason the sheet is a MUST.

**R-16 — overlay geometry lives in `townLayout.ts`, never as px literals in App.css.** Every box above ships as `OVERLAY_BOXES` alongside `TILE_HEIGHT_PX` and `GRID_GAP_PX`, reaching the stylesheet only as custom properties with **no fallback** — the same discipline `App.css:221-228` already imposes (rule R-3). `overlayGeometry.test.ts` asserts, at **320 / 360 / 390 / 430**, that every overlay box is disjoint from `roofBox(W)` and `iconBox(W)`, that no box exceeds the tile box, and that the combined 건물 장식 area is ≤ 25 % of `W × TILE_HEIGHT_PX`. **This converts "ui-ux produces art that clips" from a review problem into a Gate-1 failure** — which is the actual fix, since rev. 2's numbers passed review and were still wrong.

**Three contracts that make this order safe to place before the director's copy lands:**

- **Placeholder-first, same interface.** Every building overlay ships as one component with the prop shape `{ skuId, className }` behind the same swap-in story `PlaceholderBuilding` already uses ("one component and one asset manifest", MVP-SPEC §6.1 `:376`). Real art replaces the component body; no call site moves.
- **Rename cost is one line.** Item names and copy live in `content.placeholder.ts` alongside the existing category/mood content. The director renaming 벚꽃길 requires **no re-art**, exactly as MVP-SPEC §6.1's slot-contract discipline (`:360`) requires.
- **R-14 is an art rule too.** No overlay may occlude the icon box or replace the tile fill. If an art proposal needs to, it is a re-skin and must be rejected at review, not negotiated.

**Total: 8 new asset slots**, of which 2 are pure CSS token sets and 5 are single flat SVGs. This is a deliberately small order because the catalogue is deliberately small (§Trade-offs 2).

### 7.4 Screens, and the entry point specified to the DOM

| # | Name | Route | Purpose | Key elements | Navigation |
|---|---|---|---|---|---|
| **S8** | **꾸미기 상점** (sheet over S2) | sheet | Browse, buy, apply | 씨앗 balance chip (header, one of the two legal surfaces) · 3 family tabs with the wardrobe label (§7.2) · item cards (art, name, outlined `🌱 N개로 심기` chip, filled `N원` button, or `보유 중` + `적용/해제`) · **terminal state `모두 모았어요 · 새 아이템이 나오면 알려드릴게요` when E-6 goes false** · empty-catalogue-safe | back → S2 via the existing `useBackGuard` history entry, same as EntrySheet |
| **D-A** | 추가 건축 확인 dialog | — | Mandatory pre-payment confirm (§6.2 step 2) | amount, what you get, 취소 default-focused. *(Gains a today-count line only if D-44 lands ≥ 2 — §6.5)* | — |
| **D-B** | 아이템 구매 확인 dialog | — | Same for both currencies | item name, price **in the chosen unit only** (never both, R-9a) | — |
| **D-C** | 광고 확인 시트 | — | Pre-ad confirm (§4.4) | reward line, "영상이 재생돼요", 나중에 / 광고 보기 | — |
| **S7** | 개발자 도구 (existing, dev-only) | — | See §12.2 for the full control list, including `데모 값 적용` | — | — |

**The entry point, concretely** (`src/components/TownScreen.tsx`): a **mini-FAB stacked directly above the ⊕ FAB**, rendered as a sibling of `.town-fab` inside the same `move.movingId === null &&` guard that already hides the FAB in move mode (`TownScreen.tsx:149-161`).

```
className="town-decor-fab"   aria-label="꾸미기"   size="large" (one step below the ⊕ FAB's 56px)
position: fixed, same right inset as button.town-fab (right: 20px, App.css:207),
          bottom = calc(var(--tab-bar-h) + 24px + 56px + 12px)
child badge: <span className="town-decor-fab-dot" aria-hidden="true"/> — an 8px dot, NO number,
             rendered only when at least one unowned item is affordable with the current seeds
```

Why here and not the header: the header (`TownHeader.tsx`) already carries town name, tier badge, building count, slot counter, streak, mood line and the queue promise, and MVP-SPEC's dense AC (`:349`) requires it not to wrap. Why a dot and not a count: rule 6 of §5.2 permits the balance on exactly two surfaces, and a number floating over the town is precisely the "wallet in a bank app" read this design exists to prevent. The dot says *there is something for you* without saying *you hold 1,240 of something*.

Applying a 건물 장식: open S8 → 적용 → the sheet dismisses into a lightweight "tap a building" mode reusing ADDENDUM-02's existing highlight + tap path (no new gesture recognizer, no new listener).

### 7.5 ADDENDUM-01 rule R-2, narrowed (not revoked)

R-2 today reads "decoration is never persisted" — true while all decoration was procedural (derived from cell position). Purchased decoration must persist. Replacement wording:

> **R-2 (narrowed).** *Procedural/ambient* decoration (grass, trees, 텃밭, streetlights, ground variants) is derived from cell position and is **never persisted**. *Purchased* decoration is persisted in `economy.decor` **only** — never in `buildings[]`, never with a `plotIndex`, never as a `Building`.

### 7.6 Why ADDENDUM-02's proof is untouched, and what it cost

The cheapest catalogue would have put benches and flowerbeds on empty lots. That forces one of: shrinking the open pool (breaking ADDENDUM-02 §3.2's guarantee that a free lot always exists), or letting a placed building silently destroy a paid decoration. Both are permanent, and that proof is one of the few genuinely load-bearing arguments in this codebase. **The cost of keeping it: no lot-placed decoration in MVP, and a smaller catalogue than the surface area could support.** A scope cost paid on purpose — and, per DE-16, a scope cost that directly shortens the runway before E-6's terminal state is reached.

### 7.7 Ownership and where the record lives

```
boot ──► read ait.v1.economy (optional key)
     ──► payment.listEntitlements()   // dev: mock receipts key · toss (E7): getCompletedOrRefundedOrders
     ──► union into economy.decor.owned
```

- Mock receipts live under a **separate storage key** (`ait.v1.entitlements`) that `clearAll()` does **not** touch — the dev driver holding receipts the way the platform will. 데이터 초기화 (S6) therefore cannot destroy a paid item, and **AC-S8 exercises this today**, against the browser driver, with no accounts.
- **씨앗 and 씨앗-bought items remain local and forgeable.** Named, not hidden: the same acceptance MVP-SPEC Trade-off 3 (`:714`) already makes for unverifiable 저축 entries, with the exposure ceiling being the cosmetic catalogue. It becomes unacceptable the day real money settles at volume; the fix is server-side receipt validation, which is Later-5 and needs a backend that does not exist (D-53).
- **Refunded orders, pending-order redelivery and `IAP.completeProductGrant` are E7**, not MVP (§11). The browser driver mints its own order ids and cannot meaningfully redeliver, so building that path now would ship untestable code — the exact DE-11 failure in reverse.

---

## 8. Platform ports — the pattern this follows, cited

MVP-SPEC §10.2 (`:585-600`) already establishes: every platform touchpoint lives in `src/platform/*`, each with a `browser` driver today and a `toss` driver later, plus two lint rules (`no-restricted-imports` for `@apps-in-toss/*` outside `src/platform/**`; `no-restricted-syntax` for `Date`). `storage`, `clock`, `haptics`, `insets`, `analytics` all ship this way — `src/platform/haptics.ts` is the canonical three-export shape (`browserX`, `tossX`, `X`), and `src/platform/clock.ts` is the canonical "one file may break the rule" case. **This addendum adds two rows to that table and invents no new shape.**

### 8.1 `src/platform/ads.ts`

```ts
export type AdResult =
  | { kind: "rewarded" }                       // a real reward signal fired
  | { kind: "dismissed" }                      // closed early — no reward, no penalty
  | { kind: "unavailable"; reason: string };   // no fill / unsupported / offline

export interface AdsPort {
  isSupported(): boolean;
  preload(): void;                  // browser: no-op
  showRewarded(): Promise<AdResult>;
}
```

- **`browserAds` (today, MVP):** `isSupported() => true`; `showRewarded()` resolves after a short stub delay (`AD_STUB_MS`, a **dev interaction constant, not a balance dial**) with `{ kind: "rewarded" }`. **No ad network is contacted.** The stub panel is labelled `개발용 광고 (실제 광고 아님)` so no screenshot can be mistaken for real inventory — the same discipline as MVP-SPEC §9's `BALANCE_UNSET` banner. The `setTimeout` here is a fake *watch duration*, not the bubble timer; DE-14's rule concerns the interval only.
- **`tossAds` (E7, blocked on console):** `GoogleAdMob.loadAppsInTossAdMob({ options: { adGroupId }, onEvent, onError })` to preload, `GoogleAdMob.showAppsInTossAdMob({...})` to show, `GoogleAdMob.isAppsInTossAdMobLoaded` to gate. Verified against the installed package (`@apps-in-toss/web-bridge` d.ts, `GoogleAdMob` declaration). **`{ kind: "rewarded" }` is returned only for a `userEarnedReward` event** (`AdUserEarnedReward = { type: 'userEarnedReward'; data: { unitType, unitAmount } }`); a `dismissed` with no prior reward maps to `dismissed`; `onError` and `isSupported() === false` map to `unavailable`. **`adGroupId` is a console output and stays `null` until it exists** (D-50) — it is not invented here, and a `null` id disables the toss driver rather than guessing one.

### 8.2 `src/platform/payment.ts`

```ts
export type PurchaseOutcome =
  | { kind: "granted"; orderId: string }
  | { kind: "cancelled" }
  | { kind: "alreadyOwned" }                  // NON_CONSUMABLE re-purchase — the NORMAL case, not an error
  | { kind: "pending" }                       // paid, grant not yet confirmed — E7 reconciliation owns it
  | { kind: "failed"; reason: PaymentFailReason }
  | { kind: "unavailable"; reason: PaymentFailReason };

export interface PaymentPort {
  isSupported(): boolean;
  purchase(sku: string, grant: (orderId: string) => Promise<boolean>): Promise<PurchaseOutcome>;
  listEntitlements(): Promise<string[]>;                        // non-consumable SKUs owned
  /** E7 only. Browser driver: documented no-op. Declared at E0 so the port shape never changes. */
  reconcilePending(grant: (orderId: string) => Promise<boolean>): Promise<void>;
}
```

**The full error-code map — every code the installed d.ts documents, mapped, none left to a default branch.** Source: `node_modules/@apps-in-toss/web-bridge/dist/index.d.ts:292-303` (`IAP.createOneTimePurchaseOrder`'s `@throw` list). Rev. 2 listed four outcome variants and left this contract unstated; `ITEM_ALREADY_OWNED` in particular had no variant at all, which is the ordinary case for a player re-tapping a decoration they already own.

| SDK code | → `PurchaseOutcome` | Player-facing behaviour |
|---|---|---|
| `USER_CANCELED` | `cancelled` | Silent dismiss. Never a toast — cancelling is a legitimate choice, not an error. |
| `ITEM_ALREADY_OWNED` | **`alreadyOwned`** | Treated as **success without a charge**: the SKU is unioned into `decor.owned` and the card flips to `보유 중`. This is the self-healing path when local state lost an entitlement the platform still has. For `build.extra.v1` (CONSUMABLE) it cannot occur; if reported anyway it degrades to `failed` with its own analytics tag. |
| `PAYMENT_PENDING` | **`pending`** | Toast `결제 승인을 기다리고 있어요`. **No grant, no build.** The order is picked up by `reconcilePending` at E7. In MVP this outcome is surfaced and logged but not resolved — stated rather than silently swallowed. |
| `INVALID_PRODUCT_ID` | `failed` | Toast `상품 정보를 불러오지 못했어요`. Always a registration bug, never a user problem — analytics-tagged as such. |
| `NETWORK_ERROR` | `failed` | `결제가 완료되지 않았어요`. Retryable by re-tapping; no automatic retry loop. |
| `INTERNAL_ERROR` | `failed` | Same copy. |
| `PRODUCT_NOT_GRANTED_BY_PARTNER` | `failed` | Same copy. This is **our** grant callback returning false — it must be impossible in practice, because §6.2 step 4's grant is idempotent and cannot fail on a duplicate; a non-zero rate here is a bug alarm, not a user-facing category. |
| `APP_MARKET_VERIFICATION_FAILED` | `failed` | Distinct copy — the d.ts says the user must ask the app store for a refund, so the toast must say `앱스토어에 환불을 문의해주세요`, not a generic failure line. |
| `TOSS_SERVER_VERIFICATION_FAILED` | `failed` | Distinct copy: charged but unrecorded. Same refund-guidance treatment. **D-52** covers the wording, which is a legal/support decision. |
| `INVALID_USER_ENVIRONMENT` | `unavailable` | `이 기기에서는 결제를 사용할 수 없어요`. The paid action hides for the session. |
| `KOREAN_ACCOUNT_ONLY` | `unavailable` | Distinct copy naming the reason (`한국 계정에서만 결제할 수 있어요`) — a generic "unavailable" here reads as a bug to a user whose account simply is not eligible. |

`PaymentFailReason` is a union of exactly those code strings plus `"unknown"`, so an unmapped future code is a typed compile error at the adapter rather than a silent default.

- **`browserPayment` (today):** a dev-only mock that completes locally — a modal reading `개발용 모의 결제 (실제 결제 아님)` with 결제 / 취소, then `grant(mockOrderId)` and a receipt written to `ait.v1.entitlements`. Re-purchasing an owned NON_CONSUMABLE returns `alreadyOwned` **without showing the modal**, mirroring the platform. S7 can force every outcome above by code, including `pending` and each distinct-copy failure — which is how the eleven-row table gets tested with no accounts.
- **`tossPayment` (E7, blocked on console + business registration):** `IAP.createOneTimePurchaseOrder({ options: { sku, processProductGrant }, onEvent, onError })` — the SDK's `processProductGrant(orderId) => boolean | Promise<boolean>` maps **exactly** onto our `grant` callback, which is why the port is shaped this way rather than as a bare `purchase(): Promise<boolean>`. `listEntitlements` → `IAP.getCompletedOrRefundedOrders`; `reconcilePending` → `IAP.getPendingOrders` + `IAP.completeProductGrant`. All four verified present in the installed d.ts.
- The existing `no-restricted-imports` rule keeps every `@apps-in-toss/*` import inside these two files.

### 8.3 SKU and id scheme, frozen now (DE-10)

`src/economy/skus.ts`, **append-only** — which is also what makes E-6 self-healing — under **R-10** (a snapshot test fails on any change to an existing id):

```
build.extra.v1                  CONSUMABLE      ₩1,000 (director-given)
deco.ground.cherry.v1           NON_CONSUMABLE  D-46
deco.ground.snow.v1             NON_CONSUMABLE  D-46
deco.building.awning.v1         NON_CONSUMABLE  D-46
deco.building.flowerbed.v1      NON_CONSUMABLE  D-46
deco.building.flag.v1           NON_CONSUMABLE  D-46
deco.landmark.signboard.v1      NON_CONSUMABLE  D-46
deco.landmark.fountain.v1       NON_CONSUMABLE  D-46
```

The consumable/non-consumable split must be confirmed against the console's own product types (**D-51**); it is stated here so registration is a lookup, not a design session. `잔디길` has no SKU — it is the free default and is always owned.

---

## 9. Data model deltas

### 9.1 New state — a separate chunk, not `core`

```ts
// src/economy/types.ts
export type SeedCount = number & { readonly __seeds: unique symbol };

export interface DecorState {
  owned: string[];                              // SKU ids; union of local + entitlements
  groundThemeId: string;                        // always set; defaults to the free 잔디길
  landmarkId: string | null;
  byBuildingId: Record<string, string[]>;       // buildingId -> SKUs (건물 장식 stacks, §7.2); pruned on delete
}

export interface EconomyState {
  seeds: SeedCount;                             // >= 0, integer
  adBubble: AdBubbleState;                      // §4.3
  adsWatchedOn: string;                         // 'YYYY-MM-DD' — mirrors slotsUsedOn exactly
  adsWatchedToday: number;                      // vs adsPerDayMax (D-43)
  paidBuildsBoughtOn: string;                   // 'YYYY-MM-DD'
  paidBuildsBoughtToday: number;                // vs paidBuildsMaxPerDay (§6.5 / D-44)
  grantedOrderIds: string[];                    // idempotency, bounded ring (last 32)
  decor: DecorState;
}
```

- `adsWatchedOn` / `paidBuildsBoughtOn` **deliberately copy `slotsUsedOn`'s daily-counter pattern** (`types.ts`, `selectors.ts:93-104`) rather than inventing a second way to say "today's count". One reset rule, one mental model, one set of TimeTravel semantics. `paidBuildsBoughtToday` ships **before D-44 is answered** precisely so that adding a cap later is a read at one call site and never a migration (§6.5, point 5).
- No field is added to `Building` or `LedgerEntry`. Building-attached decor is keyed **by building id inside `decor`**, so applying a 화단 never writes a buildings chunk, and the year-two "we must migrate 5,400 buildings" scenario does not exist.
- **The economy is not derived state.** Nothing in `selectors.ts` reads it; AC-S1 pins that.

### 9.2 Storage — the `LAYOUT_VERSION` precedent, not a schema bump

| Key | Contents | Written when |
|---|---|---|
| `ait.v1.economy` | `EconomyState` | on any economy change (ad grant, purchase, apply) |
| `ait.v1.entitlements` | **dev driver only** — mock receipts | mock purchase; **not removed by `clearAll()`** |

- **`SCHEMA_VERSION` stays `1`.** `ait.v1.economy` is an **optional** key: absent means "pre-economy town" and reads as `emptyEconomy()`. `StorageExport` gains an **optional** `economy` field. This is exactly how `layoutVersion` was introduced (`storage.ts:35-43`, `:63-77`, and the `parseStorageExport` guard at `:113` that accepts `undefined`): absent-means-old, defaulted on read, no version gate. Bumping instead would make `parseStorageExport` (`storage.ts:102`) reject **every export file that already exists**, including the director's demo states and every QA bug report attachment (DE-13).
- **R-15 — `rebuildDerived` must never touch the economy chunk.** Stated precisely: today `rebuildDerived` (`src/selectors.ts:64-76`) returns `Pick<TownState, "cumulativeSavingsKrw" | "lastSettledPeriod">` and therefore *cannot* clobber the economy — the type is the current guard. The hazard is the obvious future edit: it runs on F12 import and on corrupt-core recovery (MVP-SPEC §8.3 `:515`), and it is the function anyone would extend when asked to "rebuild everything derived from the ledger". Seeds, owned items and applications are **not derivable from entries**, so that extension would silently zero a player's paid items with no error and no way to notice. R-15 makes the current type a rule, and **AC-S11** is the regression test that fails the day someone widens it.
- **Corruption:** an unparseable `ait.v1.economy` is quarantined like any other chunk — boot with `emptyEconomy()`, push the existing `{ kind: "corruption" }` Notice (`useTownStore.ts:432`), then let `payment.listEntitlements()` restore owned items from the receipts key. Seeds are lost; the town is not. **The town can never be taken down by economy data.**
- **`clearAll()`** removes `ait.v1.economy` (game state) and **not** `ait.v1.entitlements` (receipts) — §7.7.
- **R-13 — F12 import may never *reduce* `decor.owned`.** A file with no `economy` leaves the existing economy untouched; a file with one replaces it, then unions `owned` with entitlements at the next boot. F12's byte-identical round-trip AC still holds for export→wipe→import, because a wiped profile has nothing to union.

### 9.3 New balance keys — the null-dial rule

Every key below lands in `balance.approved.ts` as a signed diff (MVP-SPEC §9 rule 3: placeholders are never edited in place). **No value is proposed except the two the director gave.** And instead of shipping arbitrary placeholders:

> **Null-dial rule.** Where a new economy value is `null`, the feature it drives is **disabled and invisible** — no UI surface, no entry point, no toast. The machine ships; the dial does not. A null dial cannot be screenshotted and quoted back as a design decision, which a plausible-looking placeholder can. It is also stricter than a `[TBD]` marker: `[TBD]` is a convention in a document that no code enforces and that a build ignores silently, whereas `null` is enforced at the call site — the feature physically cannot render until the director answers, so an unanswered dial fails loudly as a missing feature rather than quietly as a wrong number. `BALANCE_UNSET`'s banner still applies to the app as a whole; this is the per-feature version.

| Key | Status | What `null` means concretely |
|---|---|---|
| `adBubbleIntervalMs` | director said "~10분" — confirm exact value (**D-42**) | No bubble ever arms. F25 is invisible. |
| `seedsPerRewardedAd` | **director's — D-41** | No bubble arms either (a reward of unknown size may not be offered). |
| `adsPerDayMax` | **director's — D-43** | Treated as unlimited **only if he says so**; `null` disables F25 with the others. |
| `bubbleEligibleSources` | **director's — D-48** | No bubble arms. |
| `paidBuildPriceKrw` | **1,000** — director-given, verbatim | n/a |
| `paidBuildsMaxPerDay` | **director's — D-44**; **recommendation and full reasoning in §6.5** (recommended: `1`) | The `지금 바로 짓기` action never renders. F26 invisible. **`null` never means "unlimited"** — §6.5 point 1. |
| `decoPricesKrw` (per SKU, within 100–5,000) | **director's — D-46** | Items with a null KRW price show no 원 button. |
| `decoPricesSeeds` (per SKU) | **director's — D-46** | Items with a null seed price show no 씨앗 chip, and do not count toward E-6's arming predicate. An item with both null does not appear in the catalogue at all. |

### 9.3a Demo values — how the demo works without the dials being decided

The null-dial rule is correct and stays. But taken alone it makes the feature **undemoable** until six questions are answered: no bubble arms, no seed chip renders, no paid action appears. Rev. 2's demo script claimed "no director values needed" and was simply wrong about at least three of its steps. The fix is a design addition, not a weakening of either side:

> **`데모 값 적용` (S7, dev-only).** One toggle loads `src/devtools/balance.demo.dev.ts` — a **dev-only** module, stripped from the production bundle by `import.meta.env.DEV` and covered by the existing Gate-1 "no fixture module in the production bundle" grep — over the null dials. While it is active, the app paints a **persistent, non-dismissible ribbon** reading `개발용 임시 수치 (승인 전)` across the top of every economy surface, and every seed figure carries `data-demo-values="1"`.

Why this preserves the rule rather than working around it: the rule's *purpose* is that no placeholder can be screenshotted and quoted back as a design decision. A ribbon that is physically in every screenshot achieves that more strongly than absence does, because absence is invisible in a screenshot and a ribbon is not. And unlike a placeholder in `balance.approved.ts`, these values live in a file the approved-balance diff never touches, so there is no path by which they become the shipped numbers by inattention.

**Default state:** demo values **off**. The director's own build defaults are D-50, alongside `ECONOMY_ENABLED`.

### 9.4 New rules, all machine-checkable

| Rule | Check |
|---|---|
| **R-7** no `원` / no `format.ts` import inside `src/economy/**` | `git grep -n "원" src/economy/ \| grep -v "\.test\."` empty; eslint `no-restricted-imports` |
| **R-8** money never creates a building | every `source: { kind: "entry"` writer takes an `entryId`; grep returns the known set only |
| **R-9a** no seed↔KRW conversion rendered | shop DOM test AC-S4 |
| **R-9b** the two prices are never typographically parallel | AC-S4 (`data-price-kind` differs, class roots differ) + `ui-ux` review against §7.3 |
| **R-10** SKU ids append-only | snapshot test on `skus.ts` |
| **R-11** bubble targeting is a write, never a render draw | `random.` appears in `src/economy/` only inside action functions |
| **R-12** purchases never touch the mood/sky layer | sky-class test with every item applied (AC-S2) |
| **R-13** import never reduces `decor.owned` | storage unit test (AC-S9) |
| **R-14** no re-skins: decor never changes `categoryId`, category colour or icon | overlay components receive no `categoryId` prop; DOM test asserts tile fill + icon unchanged with every overlay applied (AC-S12) |
| **R-15** `rebuildDerived` never touches the economy chunk | AC-S11 |
| **R-16** overlay geometry lives in `townLayout.ts`, disjoint from roof/icon boxes at 320/360/390/430 | `overlayGeometry.test.ts` (AC-S13); `git grep -nE "top:\s*[0-9]+px" src/App.css` finds no overlay literal |

---

## 10. Explicit supersession map

| Location | Current text | Replacement |
|---|---|---|
| `MVP-SPEC.md:96` §1.3 | `The queue does not break the appointment, because banked materials build only on a later day's first open, never immediately. The scarce resource is still "a day", not "an entry."` | `The queue does not break the appointment, because banked materials build only on a later day's first open — with exactly one exception: ADDENDUM-03 F26, where ₩1,000 releases one slot **today** for an entry the player has already logged, capped per day (§6.5 / D-44). The scarce resource is still "a day": the paid path moves the daily ceiling by a bounded amount, cannot be used without a real entry, and cannot be used at all when free slots remain.` **If D-44 lands unbounded, this row must be rewritten to drop the "still a day" claim** (§6.5 point 3). |
| `MVP-SPEC.md:112` §2 | `Coins as currency — CUT entirely — Removing currency removes the perverse farm loop by construction` | **씨앗 exist, and the farm loop is closed by a different construction:** 씨앗 come only from ad bubbles (E-1) and buy only cosmetics (invariant 6). No amount of logging or spending produces 씨앗; town size stays uncoupled from 원 (invariant 3, unchanged). |
| `MVP-SPEC.md:108` §2 | `FC-3 daily build cap — Borrowed; the paid/upgrade escape hatch cut … No way to raise it in MVP — not by paying, not by upgrading.` | **Borrowed; a bounded paid escape hatch restored.** ₩1,000 buys one slot for one already-logged entry, capped per day (§6.5, D-44). The free cap itself is never raised; no upgrade ladder. |
| `MVP-SPEC.md:121` §2 | `FC-8 subscription / paid limit raises / themes — DEFERRED` | **Partly shipped:** cosmetic themes (F27) and a bounded paid extra build (F26). **Subscription remains out** and is not proposed. |
| `MVP-SPEC.md:132` §3 | pillar-table P-a row: `No daily-login gift, no ad reward, no purchase.` | Follows invariant 1's amendment: `No daily-login gift, no ad reward, no purchase creates a building; a purchase may only release capacity for an entry already logged.` |
| `MVP-SPEC.md:248` §5 F4 | `Evaluated on app open and on every save — no timers, no background jobs.` | `Evaluated on app open and on every save — no timers, no background jobs. The one timer in the app (F25's bubble repaint tick, ADDENDUM-03 §4.5) is a render trigger only: no state derives from it, and removing it changes when the UI notices a change, never what the state is.` |
| `MVP-SPEC.md:297` §5 F14 AC | `A queued material never builds on the same calendar day it was queued, even if slots free up (they can't, but the invariant is tested).` | `A queued material never builds on the same calendar day it was queued **via the drain path** (`drainQueue`), which is what this test covers — the property is emergent from slot exhaustion, not a guard in code. ADDENDUM-03 §6.3's paid path deliberately builds one material the same day, by purchase; AC-P8 covers it.` |
| `MVP-SPEC.md:334` §5 WON'T | `Toss Login, IAP, Toss Pay, ads, analytics, push, leaderboards, share/referral rewards` | Remove `IAP`, `Toss Pay`, `ads` (now ports, §8). **Everything else stays**, with its reason. |
| `MVP-SPEC.md:400` §7 invariant 1 | `…No login gift, no ad reward, no purchase, no achievement payout.` | §5.1's amended invariant 1 + new invariant 6. **Needs director sign-off (D-49).** |
| `MVP-SPEC.md:401` §7 invariant 2 | game quantities never rendered as money | **Strengthened**: §5.2's six display rules, the `SeedCount` brand, R-7, R-9a, R-9b. The invariant now has enforcement, which it did not have when it was written. |
| `MVP-SPEC.md:406` §7 | `Deliberately excluded from MVP: currency, shops, cosmetic purchases, leaderboards, achievements/badges, daily-login rewards, ads.` | `Deliberately excluded from MVP: leaderboards, achievements/badges, daily-login rewards, and any reward not earned by logging real money or by watching a rewarded ad the player chose to start.` |
| `MVP-SPEC.md:589-596` §10.2 | port table | + `ads` (browser: stub reward · later: GoogleAdMob) + `payment` (browser: mock purchase + local receipts · later: IAP). |
| `MVP-SPEC.md:604` §10.3 | IAP / Toss Pay / in-app ads listed as deferred | **Port shipped; `toss` driver blocked on console + business registration (D-50).** Banner/interstitial ads stay permanently out by design, not by blockage. |
| `MVP-SPEC.md:671` §13 D-7 | open | **Answered** 2026-08-05 (§0). Remaining monetization questions are D-40…D-54 below. |
| ADDENDUM-01 §3.5/§3.6 R-2 | `decoration is never persisted` | §7.5's narrowed wording. |

---

## 11. Build order — and exactly what is blocked on accounts

| Step | Deliverable | Demoable today? | Blocked by |
|---|---|---|---|
| **E0** | `src/platform/ads.ts` + `payment.ts` (browser drivers, full port interfaces, the §8.2 eleven-code map) · `src/economy/types.ts`, `skus.ts`, pure selectors (`present()`, `isEligibleForBubble()`, `canBuyExtraBuild()`, E-6's predicate) · `ait.v1.economy` optional chunk + export/import handling + **R-15 regression test** · unit tests. **No UI.** | yes | — |
| **E1** | F25 bubble: arm/consume/re-arm actions, `useAdBubbleTick` + backward-clock clamp, tile-gesture integration, `{ kind: "adBubble" }` Notice, **pre-ad confirm sheet**, reward toast, S7 controls incl. `데모 값 적용` | yes | E0 |
| **E2** | F24 씨앗 surfaces: `formatSeeds`, `SeedCount` brand, balance chip, R-7/R-9a/R-9b tests | yes | E1 |
| **E3** | F27/F28 shop: S8 sheet, `.town-decor-fab` entry point, catalogue, dual pricing, wardrobe labelling, **E-6 terminal state**, apply/unapply, ground/landmark/overlay rendering, `OVERLAY_BOXES` + R-16 test, R-12/R-14 tests | yes | E2 |
| **E4** | F26 paid extra build: secondary action, confirm dialog, the §6.3 grant path, queue interaction | yes (mock payment) | E3 |
| **E5** | Art pass against §7.3's eight slots (placeholder-first, same swap-in contract as `PlaceholderBuilding`) | parallel | `ui-ux` |
| **E6** | Balance pass: D-41/42/43/44/46/48 land in `balance.approved.ts`; the null dials come alive; `데모 값 적용` becomes redundant | — | **director** |
| **E7** | `tossAds` + `tossPayment` drivers · SKU + ad-group registration · **boot-time `reconcilePending` wiring** · **`paidSlotsCredited`** (an order redelivered for a vanished entry becomes one unused paid slot) · refunded-order handling · real settlement | **no** | **console access + business registration** |

**Why three items sit at E7.** None can be exercised against the browser driver: it mints its own order ids inside a single call and never redelivers, so a boot-time reconciliation path and a "recover an order whose entry is gone" credit would ship as MVP code with no honest test behind it. That is DE-11's failure mode with the polarity flipped — untested real-money code, written early instead of late. The port *interface* still declares `reconcilePending` and the `pending` outcome at E0 (a few lines, no-op) so their arrival at E7 changes no shape.

**If time runs out, cut in this order** (each independently removable): F28 building-attached decor → the 조형물 family → F26 → F27 entirely → F25/F24. **E0 is not on the cut list**: the ports and the optional storage field are what make every later step non-migratory.

**Feature flag:** `ECONOMY_ENABLED` gates every economy surface at once, so Gate 3 can run with the economy on or off and a demo build can hide it entirely. This is coarser than the null-dial rule and complements it: null dials disable one mechanic each; the flag hides the whole subsystem. Default: on in dev (D-50).

---

## 12. QA enablement

### 12.1 Fixtures (extending `src/devtools/fixtures.ts`, same seeded/deterministic contract)

| Fixture | Shape | What it proves |
|---|---|---|
| `adReady` | eligible buildings present, `readyAtMs` in the past | F25 arm + tap + reward, AC-B3/B5/B6 without waiting |
| `adCooling` | bubble consumed moments ago, `readyAtMs` far ahead | AC-B1's "false at t" half; the no-bubble town screen |
| `seedsRich` | a large balance, nothing owned | Shop purchase paths, AC-S3, AC-S4's dual-price card |
| `seedsBroke` | balance 0 | Disabled seed chip, affordability dot absent, no dead-end copy |
| `shopOwned` | every catalog item owned and applied | AC-S1 (selectors byte-identical), AC-S2 (sky pure), R-14, **AC-B12 (E-6 terminal state)** |
| `paidBuildReady` | today at the cap with 2 queued, one of them "just saved" | AC-P1…P8 without logging 10 entries by hand |

These make AC-B4's 1,000 seeded draws and AC-S8's clear-then-restore cheap for `qa` to drive, instead of manual setup.

### 12.2 TimeTravel — what it can and cannot do here

`setTimeTravelDate` takes a **`'YYYY-MM-DD'` string** (`src/platform/clock.ts:68-75`), and `now()` during travel is `travelMidnight + realElapsed` (`:57-60`). Therefore:

- **It can** jump a whole day forward, which makes a pending bubble ready instantly and exercises the daily counters (`adsWatchedOn`, `paidBuildsBoughtOn`) exactly as it already does for `slotsUsedOn`. The store already re-renders on `subscribeTimeTravel` (`clock.ts:88-91`).
- **It cannot advance ten minutes inside a day.** There is no sub-day granularity. So **S7's `말풍선 즉시 띄우기` is not a convenience — it is the only way to test the interval within one day**, and it is a required E1 deliverable, not a nice-to-have.
- **It can move `now()` backward** (travel to an earlier date, or clear travel mid-session), which is why §4.5's clamp exists. **AC-B10** covers it.

**S7 additions (all dev-only, stripped by `import.meta.env.DEV`, covered by the existing Gate-1 "no fixture module in the production bundle" grep):** `데모 값 적용` (§9.3a) · `말풍선 즉시 띄우기` · `씨앗 +N` · `광고 실패 모드` (forces `dismissed` / `unavailable`) · `결제 결과 강제` (each of the eleven §8.2 codes, plus `pending` and `alreadyOwned`) · `grant 두 번 호출` · `구매 기록 초기화` · `이코노미 상태 덤프`.

### 12.3 Demo script (90 seconds, no accounts — **requires S7 `데모 값 적용`**)

**Honest precondition, corrected from rev. 2:** with the null dials unset (the default, §9.3), **no bubble arms, no 씨앗 chip renders and no paid action appears** — three of the steps below are impossible by design. The demo therefore begins by turning on `데모 값 적용` (§9.3a), and the `개발용 임시 수치 (승인 전)` ribbon is visible in every frame that follows. Nothing in this script needs a Toss account, a business registration or a director decision; it needs one dev toggle whose whole job is to be visible.

1. S7 → `데모 값 적용` → ribbon appears.
2. Load the `paidBuildReady` fixture.
3. S7 → `말풍선 즉시 띄우기` → a bubble pops on a built building.
4. Tap → 확인 시트 → 광고 보기 → `개발용 광고 (실제 광고 아님)` → 씨앗 toast.
5. 꾸미기 mini-FAB → buy 벚꽃길 with 씨앗 → **ground turns pink, sky unchanged** (R-12).
6. Apply 차양 + 화단 + 깃발 to one building → note the category colour and icon are untouched (R-14) and nothing clips at any width (R-16).
7. Log an 11th expense → queue promise, then `지금 바로 짓기 · 1,000원` → confirm → mock payment → **the building you just logged** rises (AC-P8).
8. S7 → `결제 결과 강제: ITEM_ALREADY_OWNED` on an owned decoration → card flips to `보유 중`, no charge (§8.2).
9. 데이터 초기화 → paid item returns on the next boot, seeds do not (AC-S8).
10. Hard reload → everything persists.

---

## 13. Open decisions — director's call, not filled in

| # | Decision | Why it isn't mine | Blocks |
|---|---|---|---|
| **D-40** | **Currency name.** 씨앗 is a marked assumption (content). Reasoning in §5.2 — any name works provided it reads as neither money nor build material. | Branding/content. | Copy, one icon |
| **D-41** | **`seedsPerRewardedAd`.** | Gameplay constant. | F24/F25 |
| **D-42** | **`adBubbleIntervalMs`** — confirm "~10분" as an exact number; and confirm E-3/E-4 (never expires, never stacks, at most one waiting after an absence). | Balance constant + a tone decision about FOMO. | F25 |
| **D-43** | **`adsPerDayMax`** — the daily rewarded-ad cap. | Balance constant, and an ad-network policy question. | F25 |
| **D-44** | **Is the ₩1,000 extra build repeatable without limit, or capped?** **§6.5 is the full recommendation: capped, `paidBuildsMaxPerDay = 1`,** with three reasons, why 1 rather than 2–3, and the five things that change if he chooses unbounded (including that `null` may not mean unlimited). One constant either way. | Business model vs the retention mechanic — the highest-stakes number in this document. | F26 |
| **D-45** | Confirm the price is **flat ₩1,000 per additional build**, no escalating ladder. | Business model. | F26 |
| **D-46** | **Per-item prices**: KRW (within his 100–5,000) and 씨앗, for all 7 paid SKUs — **priced with §7.2's wardrobe/stacking distinction in view**, not one number across the catalogue. Note the E-6 consequence: an item with a `null` seed price is not a seed sink and shortens the runway to the terminal state. | Balance constants ×2. | F27 |
| **D-47** | **Deleting an entry whose build was paid for.** §6.4 recommends consistency with D-10 (no refund). Alternative: refund the paid slot for that day. Sharper if D-44 lands unbounded. | A money-adjacent support policy. | F26/F9 |
| **D-48** | **Which buildings may show an ad bubble** (`bubbleEligibleSources`). He said "지어진 건물", which literally includes the 무지출 공원 and the 기념비. §4.1 recommends excluding both, with reasons, and shows why 저축 structures are a separate ask rather than a value. **His decision, not mine.** | It is a tone call about where an ad may sit — the same class of decision as D-4's "how harsh should the app be". | F25 |
| **D-49** | **Amendment to MVP-SPEC §7 invariant 1 + new invariant 6** (§5.1). | §7's own header requires director sign-off. It is the app's constitutional rule about what money may buy. | Everything |
| **D-50** | **Console/registration**: Apps-in-Toss console app, business registration, IAP product registration, AdMob ad-group id. Also the build defaults: `ECONOMY_ENABLED`, and whether `데모 값 적용` may be on in a build sent to him. | Accounts he holds; `app_in_toss/VISION.md` records them as not yet provided. | **E7 only — E0–E6 are not blocked** |
| **D-51** | **Product types**: `build.extra.v1` as CONSUMABLE, decorations as NON_CONSUMABLE (§8.3) — confirm against the console's actual product model. Note §8.2: the `alreadyOwned` path exists *because* decorations are non-consumable. | Platform fact + a registration decision. | E7 |
| **D-52** | **Legal/consent**: rewarded ads and IAP inside a financial super-app — age policy (the SDK exposes `DeclaredAgeRange`), consent copy, refund policy, VAT-inclusive price display, and the exact wording for `APP_MARKET_VERIFICATION_FAILED` / `TOSS_SERVER_VERIFICATION_FAILED` (both mean "charged, possibly not delivered"). | Legal/business, outside a planner's authority. | E7 |
| **D-53** | **Later scope**: selling 씨앗 for cash (forbidden today by E-1), server-side receipt validation, lot-placed decoration (Later-2, blocker in §7.6). | Roadmap + a backend that does not exist. | Later |
| **D-54** | **The long-run 씨앗 sink** (DE-16 / E-6). Once the catalogue is owned, the ad loop stops by design. Three shapes, with my read: **(a) content packs** — append SKUs, the id scheme and E-6 already support it with no code change; the honest cost is that it is recurring content work, and if no pack ships the loop stays stopped. **(b) Seasonal rotation** — items available only in a window; cheap, but it introduces FOMO, which E-3 deliberately kept out of the bubble. **(c) 씨앗 buy build capacity** — the natural pull, and the one I recommend **against**: unlike money-for-capacity (bounded by real cost, §6.5), ad-watching-for-capacity is free and unbounded, so watching ads becomes the optimal way to grow a town and the farm loop the coins cut removed returns through the ad door. It would also need invariant 6 reopened. | Roadmap and business model. Which sink the product commits to is his; naming the end state and refusing the dangerous option is mine. | Later — but the answer shapes D-46's pricing |

**Assumptions I did make** (cheap to overturn, all content or interaction rather than balance): the name 씨앗 (D-40); the 8-item catalogue's names and families; the shop as a sheet reached from a mini-FAB above the ⊕ FAB (§7.4); the pre-ad confirm sheet's existence (§4.4 — I consider it a MUST and argue for it twice, but it is one component to remove); **the paid build raising the player's own just-logged material rather than the FIFO head** (§6.3, one line either way); all Korean copy strings; the SKU id scheme's *shape* (§8.3); the bounded ring sizes for `grantedOrderIds`/`paidBubbleIds`; the overlay box dimensions in §7.3 (derived, but the specific 8 px / 6 px / 3 × 18 px choices are mine within the proven zones); and the build-step ordering.

---

## 14. Acceptance criteria (QA-writable)

**F25 말풍선**
- **AC-B1** With a fake clock, `present()` is false at `t` and true at `t + adBubbleIntervalMs`, with no timer running.
- **AC-B2** `git grep -nE "Date\.now|new Date|setInterval" src/economy/` returns nothing.
- **AC-B3** With 50 eligible buildings and a day of TimeTravel, `document.querySelectorAll("[data-ad-bubble]").length <= 1` at every observation. Never 2.
- **AC-B4** Across 1,000 seeded draws, a bubble is only ever placed on a building whose `source.kind` is in `bubbleEligibleSources`, and never on a savings structure (which has no `source` at all).
- **AC-B5** Tapping a bubble twice before the ad resolves grants seeds **once** (`paidBubbleIds` contains one entry). The second tap lands on the confirm sheet's backdrop.
- **AC-B6** Ad `dismissed` → seeds unchanged, bubble still present. Ad `unavailable` → seeds unchanged, bubble still present, one toast. Confirm sheet `나중에` → nothing happens at all, bubble untouched.
- **AC-B7** Adding the bubble adds zero per-tile listeners on the dense fixture; the grid keeps one tab stop.
- **AC-B8** Close with no bubble due, TimeTravel +3 days, reopen → exactly **one** bubble, not three.
- **AC-B9** Long-press starting on a bubble never enters move mode; entering move mode hides the bubble and exiting restores it.
- **AC-B10** Set `readyAtMs`, TimeTravel **backward** one month, reopen → `readyAtMs` is clamped to `now + adBubbleIntervalMs`; the player is never stranded (§4.5).
- **AC-B11** With `adBubbleIntervalMs`, `seedsPerRewardedAd` or `bubbleEligibleSources` `null`, no bubble ever arms and no F25 surface renders (null-dial rule).
- **AC-B12** (E-6) On the `shopOwned` fixture, no bubble arms at any elapsed time; S8 renders the `모두 모았어요` terminal state; a bubble already on screen when the last seed-priced item is bought is cleared in the same action. Appending one SKU with a non-null seed price re-enables arming **with no other change**.

**F24 씨앗 display**
- **AC-S4** In S8, no DOM node contains both a 씨앗 value and a 원 value; no node with `data-unit="seed"` contains `,` or `원`; no node anywhere renders a conversion; the two price nodes in a card carry different `data-price-kind` values and different class roots (R-9b).
- **AC-S5** Rendering 기록 with a non-zero balance produces zero `data-unit="seed"` nodes. The town header produces none either; the mini-FAB dot contains no text node.
- **AC-S6** `formatSeeds` matches `/^\d+개$/` for 0, 1, 999, 1000, 123456.

**F26 추가 건축**
- **AC-P1** The paid option is invisible whenever `slotsRemainingToday > 0`, and whenever `paidBuildsMaxPerDay` is null or reached.
- **AC-P2** Cancel at the confirm dialog → zero storage writes; entry still saved and still queued.
- **AC-P3** Payment failure at any step → entry still saved and still queued; TimeTravel +1 day → it builds free, as normal.
- **AC-P4** Successful purchase → building count +1, queue depth −1, entry's `buildingId` set, `slotsUsedToday` +1, `slotsRemainingToday` still 0 (clamped) — all surviving a hard reload.
- **AC-P5** S7 forcing `grant` to run twice with the same `orderId` builds **nothing** the second time.
- **AC-P6** Purchase with a full queue (`materialQueueMax`) synthesises the material and builds from the entry, same placement path.
- **AC-P7** Unchanged drain behaviour: no queued material builds on the same calendar day it was queued **via `drainQueue`'s normal boot path**.
- **AC-P8** With two materials queued, the paid build raises **the one belonging to the entry just saved**, not the FIFO head; the remaining material keeps its position.
- **AC-P9** Each of the eleven §8.2 SDK codes, forced from S7, produces its mapped `PurchaseOutcome`, its specified copy, and — for every non-`granted` outcome — **zero** change to buildings, queue, slots and seeds. `PaymentFailReason` has no default branch (an unmapped code is a `tsc` error, asserted by a type-level test).

**F27/F28 상점**
- **AC-S1** Every derived selector (`tier`, `budgetPace`, `moodTier`, `slotsRemainingToday`, `towerSegments`, `grownStructures`) is byte-identical with all 8 items owned and applied versus none.
- **AC-S2** With every item applied, the sky class is a pure function of `moodTier(ym)` (R-12).
- **AC-S3** Buy with 씨앗 → balance decreases by exactly the price, item owned, card shows `보유 중`.
- **AC-S7** Apply a 건물 장식, delete that building → the item is still owned, the application is gone, no orphan key in `byBuildingId`.
- **AC-S8** 데이터 초기화 → seeds 0, applications cleared, **paid items return on the next boot** from the mock receipts key.
- **AC-S9** Export a pre-economy file and import it → existing owned items are not reduced (R-13).
- **AC-S10** A corrupted `ait.v1.economy` boots the town normally with one corruption notice and restored entitlements.
- **AC-S11** (R-15) Import a file, and separately corrupt the core chunk to force recovery: in both cases `rebuildDerived` runs and the economy chunk's `seeds`, `decor.owned` and `decor.byBuildingId` come through **untouched**. A type-level assertion pins `rebuildDerived`'s return to exactly the two existing keys, so widening it fails the build.
- **AC-S12** With every overlay applied, each building tile's background colour and icon glyph are identical to the un-decorated render (R-14).
- **AC-S13** (R-16) At viewport widths **320 / 360 / 390 / 430**, every box in `OVERLAY_BOXES` is disjoint from `roofBox(W)` and `iconBox(W)`, lies entirely within `W × TILE_HEIGHT_PX`, and the combined 건물 장식 area is ≤ 25 % of the tile area. `App.css` contains no px literal for any overlay metric.
- **AC-S14** The ad bubble's hit area never exceeds `plotTileWidthPx(vw) + 2 × GRID_GAP_PX` in width; a tap in an adjacent tile's own area is never routed to the bubble handler.
- **AC-S15** With `데모 값 적용` active, the `개발용 임시 수치 (승인 전)` ribbon is present on every economy surface and every seed figure carries `data-demo-values="1"`. `balance.demo.dev.ts` does not appear in the production bundle.

---

## Trade-offs the author admits

1. **The revenue ceiling is set by design, twice, and §6.5 argues for the lower of the two settings.** One bubble town-wide with no stacking caps ad inventory at roughly one impression per interval of active session; the recommended 1/day extra build caps the highest-intent purchase at ₩1,000 per user per day. Both are single constants if the director disagrees, and §6.5 states exactly what he gets and gives up by raising the second one.
2. **The catalogue is small (8), four of the seven paid items compete for two wardrobe slots, and per DE-16 the small catalogue is also a short runway.** §7.2 answers the value problem with disclosure, free switching and a pricing input, and E-6 makes the end state graceful rather than broken — but the shop still looks thin at launch, and the growth path (more 건물 장식, D-54 option a) is recurring content work that nobody has committed to.
3. **씨앗 are forgeable.** Local-only storage cannot be secured. Exposure is bounded to the cosmetic catalogue and named rather than hidden; the real-money half is protected differently (receipts outside `clearAll`, entitlements at E7), which is an asymmetry a reader could reasonably call inelegant.
4. **The confusion guards cost real code**: a branded type, a formatter, two grep rules, four DOM tests, a screen-separation rule, and a typographic rule that constrains `ui-ux`. A cheaper design prints a number with a coin icon. The cheaper design is exactly what MVP-SPEC §7 rule 2 was written to prevent, so the cost is accepted.
5. **No lot-placed decorations**, purely to keep ADDENDUM-02's free-lot proof unmodified. The prettiest, most obvious cosmetic — a bench on an empty lot — is the one this document refuses to ship (§7.6), and that refusal is part of why the catalogue is small.
6. **The paid extra build weakens the daily appointment. There is no version of mechanic 2 that does not.** §6.5 argues for the smallest residue rather than pretending there is none, and states plainly that if D-44 lands unbounded, one of §10's supersession rows must be rewritten to withdraw a claim it currently makes. It also breaks, for the paid path only, a property F14's AC and MVP-SPEC §1.3 both asserted unconditionally — which is why both are being amended rather than quietly falsified.
7. **Ads inside a budgeting app are a tonal risk** no engineering can remove. One opt-in bubble, behind a confirm sheet, on a building the player built, with the eligibility set chosen by the director, is the strongest available mitigation — not an elimination.
8. **The bubble's tap target is smaller than the accessibility ideal at a 320 px viewport** (~50 × 32 vs 44 × 44 in height), because the tile itself is only 38 px wide and a larger hit area would steal taps from neighbouring tiles. The pre-ad sheet makes the shortfall cost one dismissal rather than an unwanted ad. That is a mitigation, and it is stated here rather than buried in §7.3.
9. **E7 cannot be tested until the accounts exist**, and this revision deliberately makes that gap *wider* by moving reconciliation and refund recovery there while also expanding what the `toss` adapter must map (eleven error codes, §8.2). Everything up to E6 is real and demoable; the `toss` drivers plus the pending-order path will be written against documentation and verified for the first time on a real device with a real order. The port boundary keeps that surface to two files plus one boot hook, which is the point of the pattern — but it is still the least-tested code in the app on the day it ships, and there is now slightly more of it.
10. **The null-dial rule still costs the demo something, just not what rev. 2 claimed.** With §9.3a the feature is demoable today, but every demo frame carries a `개발용 임시 수치 (승인 전)` ribbon, which is uglier than a clean screenshot and is meant to be. The alternative — a plausible interval and a plausible reward, screenshotted into a Discord thread and quoted back six weeks later as the agreed design — is the failure mode this project is named after.