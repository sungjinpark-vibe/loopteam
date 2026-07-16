# Life Town (Unity) — SHIP-FIRST Rebuild Spec & MVP Scope

**Author:** planner · **Date:** 2026-07-16 · **Angle:** Ship-first · **Revision:** 2 (post-panel)
**Target:** `C:\Users\user\loop_engine\lifetown` (Unity 6000.5.1f1, empty)
**Source (read-only):** `C:\Users\user\app-dev-team\lifetown\`

---

## 1. Thesis

The brief says rebuild Life Town so it *better achieves its purpose*. Every instinct will read that as "add what was missing." I want to argue the opposite.

Life Town does not have a feature problem. It has this scoreboard:

| Built | Reached |
|---|---|
| 34,344 lines, 210 Dart files | 0 players |
| 27 screens | 0 players |
| 61 test files | 0 players |
| 711 i18n keys × 4 languages (ko/en/ja/zh) | 0 players in any language |
| 5 mini-games | 0 players |
| Firestore social layer (leaderboard, likes, visits, warmth garden) | 0 players |
| ~52 weeks | 0 players |

`v0.0.5` is an internal label. Debug signing. Test AdMob IDs. No developer account. Privacy policy unhosted. After a year, the app was not *nearly* shipped — it had not started shipping.

**The purpose — '보이지 않는 노력을 가시적 성취로 전환해 습관 형성을 돕는다' — is a claim about a human being's behavior.** It cannot be validated by a codebase. It is validated only when a person logs a real session, comes back tomorrow, and does it again. Every line written before that moment is a bet placed with no evidence. The original placed 34,344 of them.

So the rebuild's binding constraint is not fidelity, not completeness, not even quality. It is **contact with a real player.** Everything in this spec is subordinated to that.

**What ship-first does *not* mean** (the panel was right to press here): it does not mean cut everything. It means cut everything that does not serve the loop, and spend freely on the few things that do. This revision therefore *adds* three items — timed construction, day/night lighting, and the report-as-village (§6) — because each costs about a day, each reuses a renderer we are already paying for, and each repairs a beat that was measurably weak. Cheap things that make the loop pull are the most ship-first purchases available.

### 1.1 The indictment that proves it was scope discipline, not effort

This is not "the team was lazy." The team was extraordinarily productive. It was aimed wrong, and the locked decisions prove it precisely:

- `07-decisions-locked.md` #4 (director-approved 2026-07-05): **"MVP 범위 = 완전 솔로. 친구·마을 방문·랭킹 등 소셜은 전부 확장(2차)."**
  → The team then built **9 social screens** (`leaderboard`, `village_visit`, `warmth_garden`, `favorites`, `recent_visits`, `social_footprint`, `social_home`, `comment_compose`, `profile_edit`) plus a Firestore social layer. **Explicitly locked out of MVP. Built anyway.**
- `07-decisions-locked.md` #2 and the recommended values (line 31-32): daily caps and focus-enforcement, specced **Must**.
  → `app/lib/core/economy/economy.dart` lines 9-13 admit, in writing: *"일일 인정 상한… 이번 버전에서 적용하지 않는다 / 집중형 이탈 감지·무효화는 이번 버전 범위 밖 / 랜드마크 축은 이번 버전 범위 밖."* Only `minSessionSeconds = 60` survives. **Locked in as Must. Not built.**

Counting the screens: **14 of 27 (52%) are social + mini-games** — neither in MVP scope. The core loop is ~6 screens. The team built the half that was locked *out*, skipped the half that was locked *in*, and shipped neither.

**A rebuild that does not fix this fixes nothing.** Unity will happily host 34,000 lines of C# that no one plays.

### 1.2 The wall nobody measured

I verified this because my whole timeline claim rests on it. Google Play requires personal developer accounts created after 2023-11-13 to run **12 opted-in testers for 14 *continuous* days** before production access. Testers must actually install and stay opted in; dropping below 12 resets the streak. Organization accounts are exempt.

The original never created a developer account. So at every moment of that year, Life Town was — at absolute best — *a developer account + 12 recruited humans + 14 wall-clock days* away from a player. That gate cannot be compressed by working harder, and no amount of code shortens it. It was never on anyone's plan.

**This single fact restructures the project**: shipping is not the last step, it is the *longest-lead* step. It must start in week 1, before the product exists.

---

## 2. What we are actually fixing

| The original's real failure | This rebuild's answer |
|---|---|
| Never touched a store pipeline | **Ship Rehearsal in week 1** — release-signed empty app on an internal track before any feature exists |
| Built what was locked out, skipped what was locked in | MVP scope written into `VISION.md` as a **boundary**, so the gate rejects out-of-scope work |
| "Done" meant "the code works" | **Done = a stranger installed it from a store link and logged a session** — a stop condition outside the team's own claims |
| Specced a server so large it was never built | Integrity that **fits the actual threat model** (§5) and ships |
| Integrity math tangled into UI code, untestable | **`LifeTown.Economy.Core`** — a pure C# assembly with no `UnityEngine` reference (§7.4) |
| 27 screens | **7 screens** |

---

## 3. MVP scope — explicit IN / OUT

### 3.1 IN (all of it, nothing more)

| # | Item | Why it survives the cut |
|---|---|---|
| 1 | **Timer** — single, monotonic, background-safe, crash-recoverable, presence-checked | This *is* the input to the purpose. Nothing works without it. |
| 2 | **7 fixed categories** — growth×5 / leisure×2, reused verbatim from `category_catalog.dart` | The locked life-logging identity. Free — the design already exists and is proven. |
| 3 | **Session result / receipt** — EXP/coin payout, every adjustment itemized honestly | The moment invisible effort becomes visible. The purpose's hinge. |
| 4 | **Village** — 8×8 isometric grid, build / place / auto-level (Lv5) / merge → Tier2 (Lv10) | The "가시적 성취." The full Tier1→Tier2 arc, because it is provable inside a 2-week test. |
| 5 | **Timed construction** — new buildings finish over real wall-clock time (`14-timed-construction.md`, **DECIDED 2026-07-10**) | **NEW in rev 2.** ~1 field + 1 notification + a scaffold sprite. Repairs the return beat (§4.3). Director already decided the constants. |
| 6 | **Balance report = the village re-lit** (S6) | `07` #1: *"성장 리포트에서 '생산 vs 여가' 밸런스를 시각화한다 ← 라이프로깅 정체성의 핵심 기능."* Locked, core, and **cheaper as the village than as a chart** (§6.3). |
| 7 | **Day/night village lighting** — one Global Light 2D keyed to device local time | **NEW in rev 2.** ~40 lines + a gradient. A return hook that needs no notification, no streak, and no shaming copy (§6.2). |
| 8 | **Return hook** — 1 local notification + construction-complete notice + cumulative days-recorded | Without it there is no loop, only a session. |
| 9 | **Onboarding** — ≤4 taps, ends on a live "지금 25분" CTA | First session in the first minute or there is no data. |
| 10 | **Settings** — notification time, data export/import, privacy link | Export is the price of cutting cloud (D1). Privacy link is a store requirement. |
| 11 | **Release pipeline** — dev account, release signing, hosted privacy policy, store listing, 12 testers | **A first-class deliverable, not a chore.** The thing that killed the original. |

### 3.2 OUT — deliberately, explicitly, with the reason

Nothing below is "later, if there's time." Each is a decision to not build, now.

| Cut | Size | Why |
|---|---|---|
| **Entire social layer** — leaderboard, likes, village visits, warmth garden, favorites, recent visits, social footprint, social home, comments, profile edit | **9 of 27 screens** + Firestore | Locked OUT by `07` #4. Also: social is what *forces* the server (§5.5). Cutting it is what makes a serverless MVP defensible. |
| **All 5 mini-games** + idle care loop | 5 screens | The original's own design says payouts are "deliberately tiny so they do not replace focusing" — **engineering built to not matter.** The purest possible cut. |
| **Mongsil mascot** — bond XP, outfit slots, keepsake box | 1+ screens, deep systems | Charm, not loop. Cut with real regret — see D6 and §14. |
| **i18n ko/en/ja/zh** (711 keys × 4) | ~2,844 strings | **Korean only.** The director is Korean, the target user is Korean, the 12 testers will be Korean. Three languages served zero people. Keep string IDs so re-adding is mechanical. |
| **Accounts / cloud sync / auth** | Large | ⚠️ See **D1** — contradicts locked `07` #4. Director's call. Local-first + export instead. |
| **Ads, IAP, gems, shop** | Medium | Zero revenue signal at 12 testers. Test AdMob IDs were already a shipping blocker. `10-stats-shop-missions.md` §2-0 already made coin the single currency, so this cut is consistent with the source. |
| **Focus-enforcement / away-intervals** | Medium | ⚠️ See **D2** — contradicts locked `07` #2. Replaced by the presence check (§5.3). |
| **Landmarks (Tier3)** | Medium | ⚠️ **Contradicts locked `07` #3 line 22: "Tier2(max10) 동종 2개 → 랜드마크… MVP는 1~2종 최소."** Not a silent cut — see **D11** for the arithmetic and the director's call. |
| **Construction skip-for-coin** (`14` §3) | Small | The skip mechanic exists to sell time. With no IAP there is nothing to sell, and it lets a player delete the return hook we just added. Ship the wait, not the escape. |
| **Land expansion beyond 8×8** (`11-land-expansion.md` 22×22) | Medium | 8×8 = 64 lots is not filled inside a 2-week test. Locked value `07` line 33 is 8×8 anyway. |
| **Daily missions** | Medium | Content treadmill: definitions, rotation, reward tables. Days-recorded + construction gives the return hook for ~2% of the cost. |
| **Custom categories** | Small | 7 covers a life. Custom adds naming, colors, icons, building visuals, balance ambiguity. |
| **Streak (breaking)** | Small | See **D4** — a punishment mechanic aimed at a user defined as "무거운 생산성 앱(엄격한 룰)엔 지친 사람." |
| **Weekly mood, deep stats** | Medium | The balance view is the locked one. The rest is analytics for users we do not have. |

**Score:** 27 screens → **7**. 4 languages → **1**. Firestore + Functions → **0**.

---

## 4. The core loop

Concrete enough for client-dev to start today. All numbers from `07-decisions-locked.md` line 33, `economy.dart`, and `14-timed-construction.md` §1-2.

```
        ┌────────────────────────────────────────────────────────────┐
        │                                                            │
        ▼                                                            │
  ① OPEN → S2 마을                                                   │
     Your village, lit for the current hour of the real day.        │
     Coin/EXP in the header. One primary button: 시작.               │
        │                                                            │
        ▼                                                            │
  ② S3 카테고리 (7 tiles, 성장/여가 badge — same size, same weight)   │
        │                                                            │
        ▼                                                            │
  ③ S4 타이머 실행                                                    │
     Monotonic clock starts (§7.3). EXP/coin counter ticks +1/sec.   │
     Presence ping at 60min, then every 30min (§5.3).                │
        │  [끝내기]                                                  │
        ▼                                                            │
  ④ S5 세션 결과 — THE RECEIPT                                        │
     "25분 = 1,500 EXP + 1,500 코인"                                  │
     An honest session shows NO deduction rows at all (§5.6).        │
     → pick which building receives the EXP (appliedTo)              │
        │                                                            │
        ▼                                                            │
  ⑤ S2 마을 — THE PAYOFF                                             │
     Coin counter visibly counts up. If ≥100, 건설 button PULSES.     │
     Build (100 coin) → place on 8×8 → a construction site appears   │
     and finishes over real time (1 min at 100 coin — see §4.3).     │
     EXP auto-levels it. Merge 2×Lv5 (5,000 coin) → Tier2, max Lv10. │
        │                                                            │
        ▼                                                            │
  ⑥ S6 밸런스 리포트 = 마을을 다시 비추기 (weekly, or anytime)          │
     Buildings that grew this week light up; the rest dim to         │
     silhouette. Nobody tells you you played 9 hours of games —      │
     the 게임 아케이드 is just the brightest building in town.         │
     THIS is '내 시간과 노력을 눈에 보이게'.                            │
        │                                                            │
        ▼                                                            │
  ⑦ RETURN — three pulls, none of them punitive ────────────────────┘
     a. "도서관 공사가 끝났어요." (construction complete)
     b. the village is a different colour at dusk than it was at 2pm
     c. daily notification: "어제까지 12일 기록했어요."
```

### 4.1 Why it pulls — and on which numbers

The panel was right that the previous draft's pull argument stood on numbers the same document called probably wrong. Fixed. Here is the arithmetic, stated honestly.

**Two reward axes exist: COIN (drives build + merge) and EXP (drives level).** They are independent — `economy.dart` line 55 says so explicitly ("두 축은 완전히 독립"). The coin axis works identically under every curve. The EXP axis does not:

| Tier1 curve | Source | What ONE 25-min session (1,500 EXP) does | Verdict |
|---|---|---|---|
| `[0, 300, 1200, 3600, 9600]` | original | Lv1 → **Lv3** | Matches `06-open-issues.md` A's documented intent ("첫 세션에 Lv3") |
| `[0, 60, 240, 720, 2000]` | director, 2026-07-10 | Lv1 → **Lv4**, headroom to Lv5 | Both axes stay alive |
| `[0, 30, 120, 360, 1000]` | **director, 2026-07-11 — current** | Lv1 → **Lv5 (MAX)** | **The EXP axis dies after one session per building** |

**The sharp version of the problem** (this is a loop-design finding, not a tuning nitpick): at the current curve, every building is maxed by the first session that touches it. Levelling — one of the two reward beats — is spent in a single sitting, permanently, per building. Every subsequent session pours EXP into a building that is already capped (`Economy.applyExp` lines 128-130 literally clamp it away). **The game silently becomes a pure coin economy, and the entire EXP number in the header stops meaning anything after day 1.** That is not a fast curve; that is a dead axis.

**So §4.1's tension is stated against the MVP default — the intermediate curve** `[0, 60, 240, 720, 2000]` (D5 pending):

- **Seconds scale:** the counter ticks +1/sec, visible. Effort → number, zero latency.
- **Session scale (~25 min):** 1,500 coin lands and 건설 *pulses*. The reward is not a number going up — it is **a building site you did not have 25 minutes ago**, which then finishes while you live your life (§4.3). Levelling has headroom: session 1 → Lv4, session 2 → Lv5 and merge-ready.
- **Day scale:** the grid has holes. Holes are a request. And a construction finishes in 4–20 minutes, which is a reason to glance back today rather than tomorrow.
- **Week scale:** the merge (5,000 coin ≈ 83 min logged) is visible from day one and reachable in ~2 days. A long goal you can *see* is a loop; a long goal you can only read about is a roadmap.
- **The mirror:** S6 closes it. You did not just build — you *learned something about your week.* No other tile-merger can do this, and it is the only thing that makes Life Town not a worse Fortune City.

**If the director keeps the 07-11 curve** (his call, D5), the loop still ships and still pulls — but on coin alone. Client-dev should then treat level as a *first-session flourish*, not a progression axis, and ui-ux should not spend art on level-badge escalation. **The pull argument above degrades gracefully; it does not collapse.** One constant, one EditMode test (§10, Q07), no redesign either way.

### 4.2 Economy (locked values, carried verbatim)

| Value | Setting | Source |
|---|---|---|
| EXP / coin | 1 + 1 per credited second | `economy.dart` 17-18 |
| 25 min | 1,500 EXP + 1,500 coin | `07` line 33 |
| Min session | 60s | `economy.dart` 19 |
| Build cost | 100 → 400 → 1,000 → 2,500 (×2.5 after) | `economy.dart` 48-49 |
| Merge | 5,000 coin, 2× Lv5 same category → Tier2 Lv1 | `economy.dart` 51 |
| Tier1 / Tier2 max | Lv5 / Lv10 | `07` #3 |
| Grid | 8×8 | `07` line 33 |
| **Tier1 EXP curve** | **`[0, 60, 240, 720, 2000]` — MVP default, D5 pending** | `economy.dart` 26 (2026-07-10 value) |
| Tier2 EXP curve | `[0, 600, 1500, 2850, 4875, 7913, 12469, 19303, 29555, 44933]` | `economy.dart` 34-45 |
| Leisure multiplier | **×1.0 — identical to growth** | `07` #1 line 13; the ×1.0 is a **decision**, see **D9** |

### 4.3 Timed construction (`14-timed-construction.md`, DECIDED 2026-07-10)

**This is the find that repairs the return beat, and it costs almost nothing because the director already designed and approved it.**

New buildings do not pop in finished. They appear as a construction site and complete over real wall-clock time:

| Build cost | Duration | Which building |
|---|---|---|
| 100 | **1 min** | the very first one — effectively instant, onboarding untouched |
| 400 | 4 min | |
| 1,000 | 10 min | |
| 2,500 | 20 min | |
| 6,250 | 40 min | |
| > 6,250 | capped 90 min | |
| **merge → Tier2** | **fixed 2 h** | the biggest project |

*(`economy.dart` lines 61-73 — the brackets already exist as constants.)*

**Why this is identity-safe, in the spec's own words** (`14` §0, §1-1):
- **"Construction delays the reveal, never the reward."** Coins and EXP are granted immediately at settlement; `applyExp` still runs, so the building can already be Lv4 the moment it is founded — it just stays behind scaffolding until it finishes, then reveals at its earned level.
- **Level-ups stay instant.** Only *new structures* take time. Existing buildings still grow the moment you log a session, preserving `00-overview.md` §8's fast dopamine.
- **Nothing is lost by not returning.** No decay, no expiry, no FOMO. `14` §0: *"Waiting must never feel like nagging, loss, or FOMO."* It finishes whether you watch or not; you just get to see it.

**Why it is the right ship-first purchase:** one `constructionEndsAtMs` field, one scheduled local notification, one scaffold sprite state on a tile we are already rendering. And the curve *scales the hook with progression* — the first build is 1 minute so onboarding never waits, while the week-2 merge is a 2-hour anticipation. That is a return hook that grows on its own, for about a day of work.

**Cut from it:** the skip-for-coin mechanic (`14` §3). See §3.2.

---

## 5. Integrity — an argued position

**This is where a ship-first angle is most tempted to cut, and I am not going to.** But I am going to reject the specced solution.

### 5.1 The premise: for a life-logging app, integrity *is* the product

The brief's warning is exactly right: *if the timer can be cheated, the village stops mirroring a real life and becomes decoration — the purpose collapses.*

I want to sharpen it. Life Town's locked identity is **a neutral mirror of your life** (`07` ★). **A mirror that lies is not a mirror.** It is not a feature that degrades — it is a category error. So integrity cannot be scoped out; it is the thing being built.

But that argument tells us integrity must **exist**. It does not tell us it must be a **server**. Those got conflated, and the conflation is why neither shipped.

### 5.2 Who is actually cheating, and why the specced server does not stop them

MVP has **no social layer** (locked #4). No leaderboard, no ranking, no visits, no one to beat. **The only person a cheater defeats is themselves.**

So the threat model is not an adversary. It is two other things:

| Threat | Frequency | Malicious? | What it does to the purpose |
|---|---|---|---|
| **Accident** — app killed, phone died, timer left running overnight, forgot to stop | **The overwhelming majority of bad data** | No | **Catastrophic.** You wake to a 9-hour "독서" session. The village now lies to you *about you*, and you did not even choose it. The purpose collapses — exactly as the brief warns — with no villain anywhere. |
| **Self-deception** — nudging your own record | Occasional | Semi | Corrosive but self-limiting: the user is the only audience. |
| **Adversarial farming** | Rare, solo | Yes | Defeats nobody. No prize exists. |

Now read what the never-built server actually promised, in its own words (`03-sync-and-integrity.md` §5-3):

> *"완전한 위조(이탈 자체를 숨김)까지 막지는 못한다는 한계를 인지하고 있다 — 앱의 '정직 신뢰 기반' 철학과 일치하는 **의도된 트레이드오프**다."*

**The server spec openly admits it does not stop the determined cheater it exists to stop.** And §5-1 concedes the same for offline sessions (`offline_full_session` → trust the client's monotonic clock and hope). And §5-5 states every integrity flag is soft — no bans, no penalties, "관측·튜닝용."

So the specced server — `commitSession`, idempotency keys, `dailyStats` transactions, `overlapDeductedSeconds`, `staleSessionSweeper`, monotonic↔server-clock reconciliation, append-only audit fields — was, by its own account, **weeks of work that defends against the rare threat, admits it fails against it anyway, punishes nobody when it fires, and does not address the accident at all.**

That is why it was never built. It was not laziness. **It was too big to build before shipping, and the team was right.**

### 5.3 What we build instead: the Confirmed-Presence Rule — and what it costs the user

One mechanism, client-side, ~1 screen of work, that attacks the *actual* threat.

**Rule: you are only ever credited up to your last confirmed presence.**

| Parameter | Value | Status |
|---|---|---|
| First presence ping | at T+60 min elapsed | **[assumption]** tunable |
| Subsequent pings | every 30 min | **[assumption]** tunable |
| Response window | 10 min | **[assumption]** tunable |
| No response | session auto-commits at `lastConfirmedAtMs` | rule |
| Ping delivery | local notification + in-app state | rule |
| Confirm action | one tap: "네, 하고 있어요" | rule |
| **Auto-confirm** | **any foreground interaction with the app counts as a confirm; no ping is sent if one occurred inside the window** | rule |

**What it does:**
- **Kills the accident.** Unconfirmed time can never exceed ~70 min. The overnight 9-hour session becomes a 70-minute session, automatically. The mirror stays honest *without the user having to be vigilant.*
- **Doubles as crash recovery.** The presence log *is* the recovery record. App killed at 3am → on relaunch, commit at last confirmed presence. **One mechanism, two jobs** — `03` §6 needed a whole separate recovery dialog for this.
- **Taxes farming as a byproduct.** Farming now requires actively tapping a button every 30 minutes, all day. That converts passive farming into *labor*. It is not airtight; it does not need to be. It is free.

#### 5.3.1 The interruption cost — argued, not asserted

The panel's objection is the sharpest one in the review and it deserves a real answer rather than the previous draft's assertion. Stated plainly: **the presence ping is an active interruption of the very focus session the app exists to record, aimed at a user defined as "무거운 생산성 앱(엄격한 룰)엔 지친 사람." That is a genuine cost and I am not going to minimize it.**

Here is the honest accounting:

| Session length | Pings the user sees | Assessment |
|---|---|---|
| 25 min (the canonical session, `07` line 33) | **0** | The app's own designed session shape is *never* touched |
| 50 min (two pomodoros) | **0** | |
| 90 min | 1 | |
| 3 h (a long study block) | **5** | The real cost lives here |
| 9 h (asleep) | 1, unanswered → commits at ~70 min | Working as intended |

So: **the mechanism is invisible for every session the product was designed around, and becomes noticeable only past the hour** — precisely where the accident risk starts. That asymmetry is not a coincidence; the 60-minute first ping was chosen for it.

**Four design choices that keep it a question, not a rule:**
1. **Auto-confirm on any interaction.** If you glance at the timer, you have confirmed. The ping only fires for a session with *no human contact for an hour* — which is the definition of the accident case.
2. **Missing it is not a failure.** You keep every second up to your last confirm. There is no zeroed session, no broken streak, no Forest-style dead tree. `07` #2 is explicit: *"Forest식 전면 실패 아님."*
3. **It never accuses.** Copy: "확인이 없어서 마지막 확인 시각까지 기록했어요. (2시간 10분)" — a statement about the record, not about you.
4. **It is one tap with a 10-minute window.** Not a modal, not a timer, not a quiz.

**Is it "more policing" than the away-detection it replaces?** No — and this is the part the previous draft asserted and should have argued:

| | Locked focus-enforcement (`07` #2) | Confirmed-Presence Rule |
|---|---|---|
| What it monitors | whether the app is in the foreground, **continuously** | whether a human is there, **once an hour** |
| Applies to | **only** 집중형 (공부·독서·일) — leisure exempt | **all 7 categories identically** |
| What it does on failure | **silently voids the seconds you were away** | credits everything up to your last confirm, and says so |
| The user's model of it | "the app is watching my screen" | "the app asked me a question" |
| Effect on 게임 3h | none — exempt, so a 9h game session is a permanent lie | same rule as 공부, and the 9h lie is capped |

The locked mechanism watches you constantly and tells you nothing; this one asks you once an hour and shows you the arithmetic. **Continuous silent surveillance of a subset of categories is more policing than an hourly question asked of everyone** — and it is *less* effective, because it exempts exactly the leisure categories where the overnight accident is most likely.

**And there is an identity argument the locked rule cannot answer.** Foreground-enforcement is *structurally* wrong for this app: the 'game' category is leisure and ON by default (`07` #1). If you are gaming, exercising, or reading a paper book, the app is *backgrounded* — that is **normal, not suspicious.** `07` #2 already concedes this ("활동형·여가형은 화면 이탈이 정상이라 미적용") and its answer is to *exempt* those categories — which means the mirror is strict about 공부 and credulous about 게임. **A mirror that checks your studying but not your gaming is not neutral. It is a productivity app wearing a life-logging costume.** The presence check applies identically to all 7. That is what a neutral mirror does.

**The cost stands regardless of that argument, so the director gets a real choice, not a rubber stamp — see D2, which offers three options including "no ping ever."**

### 5.4 The full MVP integrity stack

| # | Mechanism | Cost | Stops |
|---|---|---|---|
| I1 | **Monotonic clock is the only time source.** `SystemClock.elapsedRealtime` (§7.3). Wall clock used solely to bucket "which day," and cross-checked against monotonic. | Small | Clock tampering |
| I2 | **Confirmed-Presence Rule** (§5.3) | ~1 screen | **The accident** + crash recovery + passive farming |
| I3 | **Flat daily cap** — 12h total, 6h/category. Excess = 0. **No diminishing integral.** | ~10 lines | Gross farming |
| I4 | **Min session 60s** | Trivial | Misclicks |
| I5 | **Clamps** — negative → 0; single session ceiling 12h | Trivial | Absurd claims |
| I6 | **Reboot detection** — `bootTimeMs = wallNow − elapsedRealtime`; drift > 5s ⇒ elapsed is untrustworthy ⇒ commit at `lastConfirmedAtMs` (§7.3.2) | ~15 lines | The one real hole in `elapsedRealtime` |
| I7 | **Transparency** — every adjustment itemized; **zero-deduction rows are hidden entirely** (§5.6) | Copy | Distrust |

**I3 is a deliberate ship-first simplification.** `02-functions-contract.md` specs a diminishing-returns *integral* over the category's daily total. Flat caps deliver ~95% of the protection for ~2% of the code, and the curve can be restored later behind the same interface. `07` line 15 already marks these as soft-launch tuning targets.

**All of I1–I7 live in `LifeTown.Economy.Core` with no `UnityEngine` reference** (§7.4), which is what makes them testable headlessly in seconds — and therefore what makes 관문 1 able to *fail* on an integrity regression instead of being decoration.

### 5.5 The honest cost — and the expiry date on this position

**What this does not stop:** a rooted device, or a user editing the local save file. Nothing here even slows that down. I am not going to pretend otherwise.

**Why that is acceptable — precisely and conditionally:**
- No server → no shared scoreboard → **a cheater's reward is a lie they told themselves.** The blast radius is one person who chose it.
- No cloud sync (D1) → single device → **the multi-device double-count exploit that `03` §5-4 needed `overlapDeductedSeconds` for does not exist.** An entire subsystem deleted by a scope decision rather than solved by code.

**And here is the coupling that is the heart of this proposal:**

> **Social is what makes the server mandatory. MVP has no social. Therefore MVP does not need the server.**
> **The day a leaderboard ships, a cheater beats *real people*, the threat model flips from self-deception to adversary, and this entire position expires.**

These are one decision, not two. Which explains the original's failure with unusual precision: **it built the social layer (which demands a server) while having no server and no integrity at all.** That is the one combination that is genuinely indefensible — and it is exactly what a year produced.

**So the rule goes in `VISION.md` as a boundary:** *no social feature ships before the server does.* Not a guideline. A gate.

### 5.6 The receipt: what an honest session looks like

**The single most important sentence in this section: an honest 25-minute session shows nothing in between raw and payout. The honest user literally never sees the integrity system.**

S5's receipt is itemized, and **rows with zero deduction are not rendered.**

```
Honest 25-min session:          Overnight accident:
┌──────────────────────┐        ┌──────────────────────────────────┐
│  25분                 │        │  2시간 10분                       │
│  +1,500 EXP          │        │  기록된 시간      9시간 12분        │
│  +1,500 코인          │        │  확인까지        − 7시간 2분       │
└──────────────────────┘        │  ─────────────────────────────    │
   (no deduction rows —         │  +7,800 EXP · +7,800 코인         │
    there were none)            │                                   │
                                │  확인이 없어서 마지막 확인 시각까지   │
                                │  기록했어요.                       │
                                └──────────────────────────────────┘
```

In a life-logging app the integrity system is **a feature, not a police force**. It is quiet when you are honest and explanatory when it acts. That is not the app catching you — **that is the app being an honest mirror, which is the entire purpose.** Integrity and identity are the same axis here, not opposing ones. This is why cutting integrity was never on the table for me, even from a ship-first angle.

**Binding on QA:** Q11 (§10) asserts that an honest session renders **zero** deduction rows. If that test fails, the integrity system has become visible to the wrong person.

---

## 6. The 보이게 half — what makes effort visible

The panel's sharpest structural criticism: the purpose is '내 시간과 노력을 **눈에 보이게**', and the previous draft served the 시간/노력 half and deferred the 보이게 half to a director decision. Correct, and this section is the answer. **보이게 is not a polish pass. It is half the purpose statement, and it gets its own budget.**

### 6.1 ui-ux is not blocked — the art direction already exists and is locked

This is the finding that dissolves most of the problem. **The previous draft treated art style as an open question. It is not.**

`docs/design/00-design-system.md` §1-1 — **"기준 팔레트 (Board A 원본 — 절대 유지)"**:

| Name | HEX | Role |
|---|---|---|
| Pink 500 | `#FF9EC4` | brand primary, CTA |
| Mint 500 | `#8AD3B4` | growth signal |
| Lavender 500 | `#B6A0EF` | secondary, EXP |
| Yellow 500 | `#FFD066` | coin/gold |
| Blue 500 | `#6FD0E8` | info |
| Deep Purple 900 | `#5A4A6A` | text primary |

> *"이 6색은 변경 불가. 아래 모든 토큰은 이 6색을 확장·보정해 만든다."*

And the 7 category colours are already shipped constants in `category_catalog.dart` lines 46-110:

| Category | Type | HEX |
|---|---|---|
| 독서 reading | Growth | `#B6A0EF` |
| 공부 study | Growth | `#6FD0E8` |
| 일 work | Growth | `#FFD066` |
| 운동 exercise | Growth | `#8AD3B4` |
| 취미창작 hobby | Growth `[assumption — source marks it 가정]` | `#6FBFA6` |
| 마음챙김 mind | **Leisure** | `#FFB37A` |
| 게임 game | **Leisure** | `#FF8FA3` |

Plus `00-design-system.md` §1-4 records the **contrast ratios as already verified**, §2 fixes the type scale, §3–5 fix spacing/radius/elevation, §10 fixes motion principles, and `08-art-target-direction.md` §0 already picked a direction: **"B안 코지 파스텔 + 코케트 디테일."**

**So D6 is not "what should the art be?" It is "who draws it?"** — commission vs in-house. ui-ux can produce the S2 art order **today**, under either answer, because the palette, the tokens, the category colours, the mood, and the accessibility floor are all already decided and none of them are mine to reopen. That is a full deduction's worth of blockage removed by reading the source instead of asking the director.

**Carried forward as binding, not re-derived.** This is the same principle as §4.2's economy constants: the original's *design* was mostly right; its *scope* was fatal. Rebuild the scope, keep the design.

### 6.2 Day/night lighting — the return hook that asks for nothing

**One `Light2D` (Global) whose colour and intensity are keyed to the device's local clock.** ~40 lines, one gradient, zero content.

| Local time | Colour | Intensity | Feel |
|---|---|---|---|
| 05:30 | `#FFD9C7` | 0.80 | dawn |
| 09:00 | `#FFFFFF` | 1.00 | plain day |
| 17:00 | `#FFC98A` | 0.95 | golden hour |
| 19:30 | `#B6A0EF` (Lavender 500) | 0.72 | dusk |
| 21:30 | `#5A4A6A` (Deep Purple 900) | 0.55 | night, windows warm |
| 03:00 | `#3E3350` | 0.45 | deep night |

*(Keyframes **[assumption]** — tunable; colours deliberately drawn from the locked Board A palette (§6.1) so the village cannot drift out of the brand.)*

Interpolate the gradient by `DateTime.Now.TimeOfDay`. Building windows get an emissive sprite that cross-fades in below 0.7 intensity.

**Why this is the best return hook available to us:** it requires no notification, no streak, no mission, no shaming copy, and no content pipeline. Your village at 9am and your village at 9pm are *different places*, and you did not have to be told to look. It is the only retention mechanism in this document that **costs the identity argument literally nothing** — there is no version of "the light changed" that punishes you. Which makes D4's streak sacrifice much cheaper than the previous draft admitted.

### 6.3 S6 is the village re-lit, not a bar chart

**The previous draft's S6 was a split bar and per-category hour bars with a neutral caption. That is competent — and it is exactly the productivity-app output shape the identity is trying to escape.** A chart that ranks your categories is a report card no matter how neutral the caption is.

So: **S6 renders the same village, re-lit by the week.**

- Buildings that received EXP this week **light up**, brightness ∝ hours logged.
- Everything else **dims to silhouette**.
- One neutral line underneath. No axes, no ranking, no goal.

If you played 9 hours of games this week, **the 게임 아케이드 is simply the brightest building in town.** Nobody tells you. You look at your own village and you see it. That is `07` #1's *"균형을 스스로 인식"* rendered literally — the user notices, the app does not tell.

**And it is cheaper than the chart**, because it reuses the Tilemap, the camera, the sprites and the Light2D rig that §6.2 already paid for. A chart screen would have been new uGUI layout work — the exact thing §6.5 says Unity is bad at. **The identity-correct answer and the ship-first answer are the same answer.**

*(Growth/leisure totals still exist as text for the accessibility fallback and as `DailyStat` fields — see §9. `00-design-system.md` §1-2 already defines `color.type.growth` `#8AD3B4` / `color.type.leisure` for the small type badges; the report does not use red or any goal line.)*

### 6.4 Copy: the banned list (binding on ui-ux and QA)

The previous draft had this as prose — *"no word in this screen may imply that growth is better than leisure."* Unenforceable. **Enumerated, it is checkable:**

**Banned anywhere in S6, S5, or any notification:**
`충분히` · `부족` · `잘했어요` · `아쉬워요` · `목표 대비` · `-했어야` · `그래도` · any red hue · any goal line · any ↑/↓ arrow on a category · any ranking numeral next to a category name · any comparison to a previous week framed as better/worse.

**Binding art constraint (not a sentiment — an art-order requirement):**
> **Leisure buildings must be as beautiful as growth buildings.** The 게임 아케이드 and the 도서관 get the same sprite budget, the same number of tier stages, the same window-light treatment, and the same merge silhouette quality. If the arcade looks cheaper than the library, the app has taken a position on how you should live — and the identity is gone at the art layer, where no copy rule can save it.

QA asserts this as Q12 (§10).

### 6.5 The 보이게 budget, summarized

| Beat | Mechanism | Cost |
|---|---|---|
| The second | +1/sec counter tick | trivial |
| The session | count-up animation, coin fly, 건설 pulse | Unity built-ins (§6.6) |
| The hour | construction site → completion pop | §4.3, ~1 day |
| The day | day/night gradient | §6.2, ~40 lines |
| The week | the village re-lit | §6.3, reuses the renderer |
| The month | Tier2 skyline silhouette | free — it is the same buildings |

**Six timescales of visible effort. Five of them cost under a day each, because Unity gives them away (§7) and because the palette was already decided (§6.1).**

---

## 7. Unity — honest accounting, then the technical baseline

Stack is fixed (director rule, 2026-07-16). Not re-litigating. But we should exploit what it gives and be honest about what it does not.

### 7.1 Real wins

| Win | Detail |
|---|---|
| **Isometric is built in** | Every spec says isometric (`00` §5). The original hand-rolled `CustomPainter` + `flutter_svg` on a **flat** grid, never added Flame as a dependency, and **deleted the isometric diamond** (commit `0e51871`). Unity's Tilemap has **Isometric / Isometric Z-as-Y as a first-class Cell Layout** — no library, no custom painter, no math. The village the specs kept asking for and Flutter kept refusing is a dropdown here. |
| **Lighting is free** | §6.2's entire return hook is one `Light2D` component in URP's 2D renderer. In `CustomPainter` a day/night pass would be a bespoke shader or a full-screen blend hack. **The 보이게 half of the purpose is materially cheaper on this stack** — that is the strongest single argument for the rebuild. |
| **Merge/build juice is nearly free** | The economy is explicitly "도파민형." Particles, sprite sorting, animation curves, tweens, screen shake, object pooling — all shipped. The pulse-and-pop when 1,500 coins land is *the* payoff moment, and Unity makes it cheap. |
| **2D pipeline** | Sprite atlas, camera pan/zoom (Cinemachine), layer sorting — all default. The original built pan/zoom by hand. |

### 7.2 Where Unity buys **nothing** — say it plainly

| Non-win | Detail |
|---|---|
| **Integrity: zero.** | Unity does not make the timer trustworthy. Arguably **worse**: Mono builds ship readable assemblies; Dart AOT is a harder target. IL2CPP narrows the gap, does not close it. **The stack change contributes literally nothing to the app's central problem.** Nobody should be told otherwise. |
| **Shipping: zero.** | Unity does not fix scope discipline. A Unity project reaches 34k lines and zero players just as easily. **The failure this rebuild exists to fix is untouched by the stack.** |
| **Forms: worse.** | uGUI is meaningfully worse than Flutter widgets for lists, text, scrolling, i18n, and accessibility. We pay real cost here (§11.2 reconciles it). |
| **App size: worse.** | Unity baseline ~20–30MB+ vs Flutter ~8–15MB **[assumption: verify at first build]**. |
| **Notifications: a wash.** | `com.unity.mobile.notifications` ≈ `flutter_local_notifications`. |

**Honest summary: Unity buys the village and the light, and costs us the forms. It buys nothing for trust and nothing for shipping.** Since the village *is* the product — "내 시간과 노력을 **눈에 보이게**" is a visual promise — that trade is good. But the two things that actually killed the original are things Unity cannot help with, and pretending otherwise is how we spend another year.

### 7.3 The monotonic clock — the load-bearing detail

**§5.4 I1 makes the monotonic clock the foundation of the entire integrity position, and §9's `SessionRecord.monotonicElapsedMs` is the field the economy pays from. It must be specified, not assumed.**

#### 7.3.1 The seam

```csharp
// LifeTown.Economy.Core — NO UnityEngine reference
public interface IMonotonicClock {
    long ElapsedMs { get; }   // monotonic, survives app suspension, immune to wall-clock edits
    long WallMs    { get; }   // Unix ms — display + day-bucketing ONLY, never duration
}
```

```csharp
// LifeTown.Platform — UnityEngine allowed
public sealed class AndroidMonotonicClock : IMonotonicClock {
    readonly AndroidJavaClass _sysClock = new AndroidJavaClass("android.os.SystemClock");
    public long ElapsedMs => _sysClock.CallStatic<long>("elapsedRealtime");
    public long WallMs    => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
}

public sealed class EditorMonotonicClock : IMonotonicClock {   // Editor + Standalone fallback
    readonly System.Diagnostics.Stopwatch _sw = System.Diagnostics.Stopwatch.StartNew();
    readonly long _base = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    public long ElapsedMs => _sw.ElapsedMilliseconds;
    public long WallMs    => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
}

public sealed class FakeClock : IMonotonicClock {              // tests
    public long ElapsedMs { get; set; }
    public long WallMs    { get; set; }
    public void Advance(long ms) { ElapsedMs += ms; WallMs += ms; }
}
```

**Why `SystemClock.elapsedRealtime` specifically — and why the obvious Unity answers are all wrong:**

| Candidate | Why it fails I1 |
|---|---|
| `Time.time` / `Time.unscaledTime` | Frame-based. Stops entirely when the app is not rendering. Useless for a backgrounded timer. |
| `Time.realtimeSinceStartupAsDouble` | Does **not** advance across device deep sleep, and resets to 0 on process death. A 3-hour session with a sleeping phone reads as minutes. |
| `DateTime.UtcNow` | Wall clock. **This is the thing we are defending against.** |
| `Stopwatch` | Process-scoped — dies with the process, so it cannot survive the crash-recovery case I2 depends on. Fine as an Editor fallback where no adversary and no suspension exist. |
| **`SystemClock.elapsedRealtime`** | **Counts milliseconds since boot including deep sleep, and is unaffected by any wall-clock change.** Exactly I1's requirement. |

#### 7.3.2 The one real hole: reboot (I6)

`elapsedRealtime` **resets to 0 on device reboot.** A session spanning a reboot would read as a negative or absurdly small elapsed. So:

```
At session start:  bootTimeMs = clock.WallMs − clock.ElapsedMs   → persisted on RunningSession
On resume/commit:  bootNow    = clock.WallMs − clock.ElapsedMs
                   if (Math.Abs(bootNow − bootTimeMs) > 5_000)
                       → the device rebooted or the wall clock was edited
                       → elapsed is untrustworthy
                       → commit at lastConfirmedAtMs, flag "clock_untrusted"
```

**This is a five-line rule that closes the only structural gap in the mechanism the whole integrity position rests on**, and it is also — not coincidentally — the same fallback path I2 already uses. One recovery path, three triggers (crash, reboot, clock edit).

#### 7.3.3 Why the seam is the point

With `IMonotonicClock` injected, **`FakeClock` lets EditMode tests fast-forward 9 hours in microseconds**, headlessly, with no device and no PlayMode. That is what makes §10's Q01–Q12 runnable inside `gate/gate.ps1` in seconds — and therefore what makes **관문 1 able to genuinely fail on an integrity regression rather than be decoration on the exact subsystem I argued hardest for.** Without this seam, the presence rule, the caps and the clamps are untestable, and the strongest section of this document would be unverifiable prose.

### 7.4 Assembly layout — the graft that makes the gate real

```
Assets/
  LifeTown.Economy.Core/        ← asmdef, NO UnityEngine reference. netstandard2.1.
    IMonotonicClock.cs
    Settlement.cs               ← rawSeconds → creditedSeconds. I2/I3/I4/I5/I6 live here.
    PresenceRule.cs
    DailyCaps.cs
    LevelCurve.cs               ← tier1/tier2 cumulative EXP, applyExp
    BuildCost.cs                ← buildCostForNth, mergeCost
    ConstructionDuration.cs     ← §4.3 brackets
    Models/                     ← SaveFile, SessionRecord, BuildingInstance … (plain POCOs)
  LifeTown.Platform/            ← asmdef, UnityEngine. AndroidMonotonicClock, notifications, file IO.
  LifeTown.App/                 ← asmdef, UnityEngine. MonoBehaviours, Tilemap, uGUI, lighting.
  Tests/
    LifeTown.Economy.Core.Tests/  ← EditMode. References Core ONLY. Runs headless in <2s.
    LifeTown.App.Tests/           ← PlayMode. Smoke only.
```

**The rule, and it is not negotiable: no cap, no clamp, no curve, no settlement arithmetic may exist outside `LifeTown.Economy.Core`.** If a number is computed in a `MonoBehaviour`, it is a bug.

Two things fall out of this for free:
1. **The gate can bite.** Every integrity claim in §5 is an EditMode assertion running in seconds against a `FakeClock`. `gate/gate.ps1` fails on a regression.
2. **The future server stops being a rewrite.** §9's event log is the sync unit and `sessionId` is the idempotency key — but the *math* is already an assembly with no engine dependency, which means the day a Cloud Function needs to re-settle a session authoritatively, it is a **compile target**, not a transliteration. That converts the previous draft's "the log becomes the sync unit" hand-wave into a shipping artifact.

### 7.5 Project baseline (hand this to client-dev verbatim)

**Editor:** Unity 6000.5.1f1. **The gate never opens a project with a mismatched editor version** — `gate/gate.ps1` refuses rather than silently upgrading.

**Packages** (all first-party — no third-party dependency risk, which is the failure mode that killed the original's "Flame" plan):

| Package | Why |
|---|---|
| `com.unity.render-pipelines.universal` | URP **2D Renderer** — required for `Light2D` (§6.2) |
| `com.unity.2d.tilemap` + `com.unity.2d.sprite` + `com.unity.2d.aseprite` | isometric grid, sprite authoring |
| `com.unity.inputsystem` | touch, pan, pinch |
| `com.unity.ugui` (incl. TextMeshPro) | UI + Korean text |
| `com.unity.mobile.notifications` | §4.3 + §8 return hooks |
| `com.unity.nuget.newtonsoft-json` | §9 save file (`JsonUtility` cannot serialize `Dictionary`) |
| `com.unity.cinemachine` | camera pan/zoom/confine on the 8×8 grid |
| `com.unity.test-framework` | EditMode/PlayMode — the gate |

**Render settings:**
- URP asset with the **2D Renderer**; one **Global Light 2D** (§6.2).
- **Transparency Sort Mode = `Custom Axis`, Custom Axis = `(0, 1, -0.26)`.**
  **Do not hand-roll a depth sorter.** This is the setting the original's `CustomPainter` did not have and could not get, and it is why the isometric diamond was deleted (commit `0e51871`). It is a project setting here, not a subsystem.

**Grid / Tilemap:**
- `Grid.Cell Layout = Isometric` (use **Isometric Z-as-Y** only if buildings need vertical stacking; MVP does not — one building per cell, `occupancyForTier` = 1 for Tier1, 2 for Tier2).
- `Cell Size = (1, 0.5, 1)` — the 2:1 diamond.
- Ground tile art: **128 × 64 px** diamond.
- **PPU = 100** everywhere. One `SpriteAtlas` for the village, one for UI.
- **Pivots: bottom-center** on every building sprite. (Center pivots are the classic isometric sorting bug; with the custom sort axis above, bottom-center is what makes tall buildings sort correctly behind/in front.)
- Buildings render on a separate Tilemap layer above ground, or as pooled `SpriteRenderer` GameObjects parented to a cell anchor — **client-dev's call**; grid coordinates are authoritative in the save file (§9) either way.

**Scene structure:** **one scene, `Main.unity`.** All 7 screens are `GameObject` panels toggled by a `ScreenRouter`. No additive scene loading, no scene-per-screen. With 7 screens, scene management is pure overhead and a source of state bugs — and the village must persist behind S5/S6 anyway (§6.3 literally re-lights it).

**Build:** Android, IL2CPP, ARM64, `.aab`. Min API per Play's current floor.

---

## 8. Screens — MVP only (7)

Navigation: single stack, S2 is home. No tab bar (nothing to tab to — that is the point). All colours from the locked palette (§6.1); all copy obeys the banned list (§6.4).

### S1 · 온보딩 `OnboardingScreen`
- **Purpose:** first session inside 60 seconds. **[assumption]** If they do not log a session on day 1, they never will.
- **Elements:** 3 panels, swipeable, skippable — ① "내 시간이 마을이 됩니다" ② "공부도, 게임도, 똑같이 마을을 키워요" (identity, stated up front) ③ notification time picker. Then a full-width CTA: **"지금 25분 시작하기"**.
- **Nav:** CTA → S4 (pre-selected 독서, changeable) · Skip → S2. Never shown again.

### S2 · 마을 `VillageScreen` — HOME
- **Purpose:** the visible achievement. The reason to open the app.
- **Elements:** isometric 8×8 Tilemap (Cinemachine pan/pinch-zoom, confined to grid); buildings with level badges; **construction sites with a radial progress ring** (§4.3 — the mockup `village-home-gridbuilder.html` §5 already drew this and it finally has state behind it); **Global Light 2D at the current hour** (§6.2); header (coin, EXP-to-next, 기록 12일); primary FAB **시작**; **건설** button (**pulses** when coin ≥ next build cost, greys out otherwise); merge affordance = two Lv5 same-category buildings glow, drag one onto the other; report icon; settings icon.
- **Empty state:** 8×8 of empty lots + one ghost outline where the first building will go. The hole is the ask.
- **Nav:** 시작 → S3 · 건설 → inline place-mode (no screen) · report → S6 · settings → S7.

### S3 · 카테고리 선택 `CategorySelectScreen`
- **Purpose:** pick what you're about to do. **Neutrally.**
- **Elements:** 7 tiles in a grid — 독서/공부/일/운동/취미창작 (성장) · 마음챙김/게임 (여가). Each: icon, name, colour (exact hex from §6.1), type badge (`color.type.growth` / `.leisure`). **Identical size and visual weight — the colour must not imply rank** (`category_catalog.dart` line 6: *"색으로 우열을 암시하지 않는다"*). Last-used floats first.
- **Nav:** tap → S4 immediately (no confirm step) · back → S2.

### S4 · 타이머 실행 `TimerRunningScreen`
- **Purpose:** hold attention; accrue trustworthy time.
- **Elements:** elapsed `HH:MM:SS` (from `IMonotonicClock`, §7.3); live EXP/coin counter ticking +1/sec; the category's building rendered mid-construction; **끝내기** (confirm dialog if <60s: "60초 미만은 기록되지 않아요"); 일시정지; presence-ping overlay ("아직 하고 있어요?" + 네 → dismiss) with the remaining response window visible.
- **Background:** keeps running. Persistent notification shows elapsed. **`elapsedRealtime` only** — never `Time.*`, never `DateTime`.
- **Nav:** 끝내기 → S5 · back = disabled (must end explicitly).

### S5 · 세션 결과 `SessionResultScreen`
- **Purpose:** **the conversion moment.** Invisible effort → visible number.
- **Elements:** big animated count-up "**25분**"; "**+1,500 EXP · +1,500 코인**"; **itemized receipt — zero-deduction rows hidden entirely** (§5.6); **"EXP를 어디에?"** → horizontal list of that category's buildings + "새로 짓기 (100코인)" if affordable (an under-construction building **is** a valid target — `14` §1-1); 확인.
- **Nav:** 확인 → S2 with the coin counter animating up and 건설 pulsing.

### S6 · 밸런스 리포트 `BalanceReportScreen` — **the village re-lit**
- **Purpose:** **the locked identity feature** (`07` #1). The mirror.
- **Elements:** the **same Tilemap and camera as S2**, re-lit for the selected week (§6.3) — buildings that grew light up ∝ hours, everything else dims to silhouette; week selector (this / last); **one neutral line** — "이번 주는 여가가 조금 더 많았어요."; a collapsed text panel with 성장/여가 totals + per-category hours (accessibility fallback and the numbers `07` #1 asks to visualize). **No axes. No advice. No goal. No judgment.**
- **Copy rule (binding on ui-ux, checkable by QA):** the §6.4 banned list.
- **Nav:** back → S2.

### S7 · 설정 `SettingsScreen`
- **Purpose:** the minimum that lets us legally ship and not lose data.
- **Elements:** notification on/off + time; **데이터 내보내기 / 가져오기** (JSON file — the price of cutting cloud, D1); 개인정보처리방침 (hosted link — **store requirement**); version; **[debug only]** reset.
- **Nav:** back → S2.

**Not in this list, on purpose:** 27 − 7 = **20 screens that will not be built.**

---

## 9. Data structures (Unity / C#)

Persistence: **one JSON save file** (Newtonsoft), atomic write (temp → move), `schemaVersion` from day one. No SQLite, no DB, no ORM. **[assumption]** A single player's lifetime session log stays well under a few MB; revisit past ~5,000 sessions.

**Design rule that buys the future cheaply:** `SessionRecord` is an **append-only event log** and is the **source of truth**. `Wallet`, `BuildingInstance`, and `DailyStat` are *derived projections* and must be rebuildable from the log alone. This is the one piece of architecture I am not cutting, because it is what lets cloud sync (D1) be added later **without a redesign** — the log becomes the sync unit, `sessionId` becomes the idempotency key, and `03-sync-and-integrity.md` §2 drops in unchanged. Combined with §7.4's engine-free `Economy.Core`, the server becomes a compile target. Cost today: near zero.

**All types below live in `LifeTown.Economy.Core/Models/` and reference no `UnityEngine` type** (`Color`/`Sprite` live on the ScriptableObject side only).

```csharp
// ─── Append-only event log — SOURCE OF TRUTH ───────────────────────────
public class SessionRecord {
    public string   sessionId;            // GUID, created at session start, immutable → future idempotency key
    public string   categoryId;           // FK → CategoryDef.id
    public long     startWallMs;          // Unix ms. DISPLAY/day-bucketing only — never for duration
    public long     endWallMs;            // Unix ms. display only
    public long     bootTimeMs;           // wallMs − elapsedMs at start (I6 reboot detection, §7.3.2)
    public long     monotonicElapsedMs;   // elapsedRealtime delta — THE time source (I1)
    public long     lastConfirmedAtMs;    // monotonic offset of last presence confirm (I2)
    public int      rawSeconds;           // what the clock said
    public int      creditedSeconds;      // what was paid (after I2/I3/I5/I6)
    public int      expAwarded;
    public int      coinAwarded;
    public string   appliedToBuildingId;  // null = coin only, no EXP target
    public string[] adjustments;          // ["presence_timeout","daily_cap_total","clock_untrusted"] (I7)
    public int      presenceConfirmCount;
    public bool     wasRecovered;         // committed via crash/reboot recovery
}

// ─── Derived projections (rebuildable from the log) ────────────────────
public class Wallet {
    public long coin;
    public long totalExpEarned;           // lifetime, display only
}

public class BuildingInstance {
    public string buildingId;             // GUID
    public string categoryId;             // FK
    public int    tier;                   // 1 | 2
    public int    level;                  // tier1: 1-5, tier2: 1-10
    public int    accumulatedExp;         // vs Tier{n}CumulativeExp
    public int    gridX, gridY;           // 0..7
    public long   createdAtMs;
    // ── Timed construction (§4.3, 14-timed-construction.md) ──
    public long   constructionStartedAtMs;   // wall ms — a wait the user WANTS to pass; wall clock is correct here
    public long   constructionEndsAtMs;      // 0 ⇒ already complete
    public bool   IsConstructing(long nowWallMs) => constructionEndsAtMs > nowWallMs;
    // ── Provenance ──
    public string mergedFromA, mergedFromB;  // null for new builds
}

public class TownState {
    public int    gridWidth  = 8;
    public int    gridHeight = 8;
    public List<BuildingInstance> buildings;
    public string[] occupiedCells;        // len 64, buildingId or null. index = y*8+x
    public int    version;                // local optimistic-concurrency seed for future sync
}

public class DailyStat {
    public string dateKey;                // "2026-07-16", device-local day
    public int    totalCreditedSeconds;   // vs 12h cap (I3)
    public Dictionary<string,int> perCategoryCreditedSeconds;  // vs 6h cap (I3)
    public int    growthSeconds;          // ← the report's numbers (07 #1)
    public int    leisureSeconds;
    public int    rawSecondsBeforeCaps;   // report shows RAW; economy pays CREDITED
    public List<long[]> sessionIntervals; // [startWallMs, endWallMs] per session.
    // ↑ NOTHING READS THIS IN MVP. Maintained anyway: it is the exact input
    //   03-sync-and-integrity.md §5-4's overlapDeductedSeconds needs. Writing it now
    //   costs one line and means the multi-device overlap defense drops in without a
    //   schema migration on the day D1 flips. Same trick as the event log, one level down.
}

public class PlayerProfile {
    public string playerId;               // local GUID (upgrade seat for a future uid)
    public long   firstOpenedAtMs;
    public int    daysRecordedCount;      // cumulative, NEVER resets (D4)
    public string lastRecordedDateKey;
    public bool   onboardingComplete;
    public bool   notificationsEnabled;
    public int    notificationHour, notificationMinute;
}

// ─── Live, non-persisted-except-for-recovery ──────────────────────────
public class RunningSession {          // MUST survive process death (I2 recovery)
    public string sessionId;
    public string categoryId;
    public long   startMonotonicMs;
    public long   startWallMs;
    public long   bootTimeMs;           // I6
    public long   lastConfirmedAtMs;    // monotonic offset
    public long   lastPingSentAtMs;
    public List<long[]> pauseIntervals; // [startOffset, endOffset]
    public int    presenceConfirmCount;
}

// ─── Static config (LifeTown.App side — ScriptableObject) ─────────────
public enum CategoryType { Growth, Leisure }

public class CategoryDef : ScriptableObject {
    public string id;                   // "reading","study","work","exercise","hobby","mind","game"
    public string displayNameKey;
    public Color  color;                // exact hex from §6.1
    public CategoryType type;
    public Sprite icon;
    public Sprite[] tier1StageSprites;  // 3 visual stages
    public Sprite constructionSprite;   // scaffold state (§4.3)
    public Sprite tier2Sprite;
    public string tier2Name;
}

public class SaveFile {
    public int schemaVersion = 1;
    public PlayerProfile       profile;
    public Wallet              wallet;
    public TownState           town;
    public List<SessionRecord> sessions;    // append-only
    public List<DailyStat>     dailyStats;
    public RunningSession      running;     // null when idle
}
```

**Carried verbatim from the original** (no redesign, it was right): the 7 `CategoryDef`s with ids/colours/types from `category_catalog.dart` lines 46-110 — `reading`/`study`/`work`/`exercise`/`hobby` = Growth, `mind`/`game` = Leisure. **`game` stays ON by default** (`07` #1). `hobby`'s Growth assignment is marked `[가정]` in the original source and remains one.

**Critical field-level rule** (`01` §0-#5, preserved): **the report shows `rawSecondsBeforeCaps`; the economy pays `creditedSeconds`.** If you log 14 hours, the mirror says 14 hours — it is your life — but the village is built from 12. The mirror never lies *to flatter the cap*. **This is the identity expressed as a data constraint**, and QA tests it explicitly (Q10).

---

## 10. QA evidence — the cheats that must fail

Framed as **cheats that fail**, not features that work. This is what 관문 2 scores as observed fact rather than as my claim. **Q01–Q08 run in `LifeTown.Economy.Core.Tests` (EditMode, `FakeClock`, headless, <2s) — i.e. inside `gate/gate.ps1`.** Q09–Q12 need the app.

| # | The attempt | Must observe |
|---|---|---|
| Q01 | Start session, `FakeClock.Advance(9h)`, never confirm | credited ≈ 70 min, not 9 h. `adjustments` contains `presence_timeout` |
| Q02 | Set `WallMs` forward 5 h mid-session | credited unchanged — `ElapsedMs` drove it |
| Q03 | Set `WallMs` backward 5 h mid-session | credited unchanged; no negative payout |
| Q04 | Simulate reboot (`ElapsedMs` → 0, `WallMs` continues) | commit at `lastConfirmedAtMs`, `adjustments` contains `clock_untrusted` (I6) |
| Q05 | Log 20 h of 독서 in one day across sessions | credited = 6 h (category cap); `rawSecondsBeforeCaps` still 20 h |
| Q06 | Log 6 h × 3 categories = 18 h | credited = 12 h (total cap) |
| Q07 | One 25-min session → new building | level == **4** under the MVP default curve (§4.1). **This test is the D5 decision made mechanical** — the director's answer changes one constant and this expectation, nothing else |
| Q08 | 59-second session | rejected, zero payout, no building |
| Q09 | Kill the app process mid-session, relaunch | session commits at last confirm; `wasRecovered == true`; village consistent |
| Q10 | Log 14 h in a day, open S6 | **the report reads 14 h; the village was built from 12 h.** The mirror did not flatter the cap |
| Q11 | Log an honest 25-min session, read S5 | **zero deduction rows rendered.** The honest user never sees the integrity system (§5.6) |
| Q12 | Log 게임 3 h and 독서 3 h | **identical EXP and coin.** S6 ranks neither, uses no red, and contains no word from the §6.4 banned list. The 게임 building's sprite budget equals the 독서 building's |

**Q11 and Q12 are the two tests that prove the identity held.** Q12 in particular is the only mechanical check that the app did not quietly become a productivity tracker — which is the exact drift the brief warns against and the exact thing no code review would catch.

---

## 11. The ship plan

### 11.1 Week 1 is not a feature — it is the Ship Rehearsal

**Before a single game feature exists:** an empty Unity app, app icon, one screen reading "Life Town", **release-signed**, uploaded to Play **Internal Testing**, and **installed from the store link by the director on his own phone.**

Zero features. This is the highest-value week of the project, because it de-risks the exact thing that killed the original — and because **it converts shipping from a final step that never arrives into a precondition that is already done.** Every build after week 1 is one upload away from a player.

It also starts the **14-day / 12-tester clock (§1.2) on day 1 instead of day 300.**

### 11.2 Timeline **[assumption — a range with named drivers, not a commitment]**

The panel was right that the previous draft's 8 weeks contradicted its own forms analysis. Reconciled honestly — and the reconciliation is partly *good* news, because two of this revision's own decisions **removed** forms work:

- **Korean-only (D3) deletes the i18n burden entirely** — no locale files, no string tables, no RTL, no font fallback chains, no layout reflow. That was the single largest uGUI cost.
- **S6-as-village (§6.3) deletes a chart screen** — the report is now the Tilemap and Light2D rig that §6.2 already paid for, not new uGUI layout.

Net: the forms surface is S1, S3, S5, S7 plus S2's HUD — small, static, mostly buttons and count-ups. That is uGUI's *best* case, not its worst. **But I am extending to 9 weeks anyway**, because the team has never shipped on this stack and §7.2's honesty cuts both ways.

| Week | Deliverable | Risk driver |
|---|---|---|
| 1 | **Ship Rehearsal.** Dev account, release keystore, privacy policy hosted, internal track live. **Begin recruiting 12 testers.** | D7 — not a coding task |
| 2 | `LifeTown.Economy.Core` + `IMonotonicClock` + Q01–Q08 green in the gate. **Integrity before UI.** | none — pure C#, no engine |
| 3–4 | Timer, presence rule, session receipt, save file, crash/reboot recovery | Android background + notification behavior |
| 5–6 | Village: isometric Tilemap, build, place, auto-level, merge → Tier2, timed construction | **first Unity 2D work — the estimate's weakest point** |
| 7 | Day/night lighting, S6-as-village, onboarding, settings, notifications | uGUI forms cost lands here |
| 8 | QA (Q09–Q12), balance pass, art-coherence pass | |
| 9 | **Closed testing with 12 real players. The 14-day clock runs.** | |

**~9 weeks to a player's hands.** Against 52 and zero. **[assumption]** Range 8–11; the driver is week 5–6, the team's first isometric Tilemap.

### 11.3 The stop rule (the mechanism that prevents the repeat)

Discipline that lives in a document is a wish. This needs a gate:

1. **MVP scope §3 goes into `VISION.md` §4 as a boundary.** A tick that proposes a mini-game gets rejected mechanically, not debated.
2. **The social/server coupling goes in too** (§5.5): *no social feature ships before the server does.*
3. **Feature freeze:** once the 7 screens work, **nothing is added until real players have used it.** New ideas go to `backlog/` marked `post-mvp`, not into the build.
4. **Definition of Done — external, per 14장 (멈춤 조건은 에이전트의 주장 **밖**에 있어야 한다):**
   > **A person who is not on this team installed Life Town from a store link and logged a session.**
   Not "the code works." Not "the gate passed." Not "the team says it's done." **A stranger, a store, a session.** That is a signal, not an opinion — and it is the only one that tells us whether the purpose was achieved.

---

## 12. Open decisions — the director must decide these

Listed separately from assumptions (§13). **D1, D2 and D11 contradict director-approved locked decisions and I am surfacing them rather than drifting.** Every one of them ships with a default so the loop cannot block waiting for an answer.

| # | Decision | My recommendation | What it costs |
|---|---|---|---|
| **D1** | **Cut accounts/cloud sync from MVP?** ⚠️ **Contradicts locked `07` #4** ("MVP는 개인 경험 + 계정/클라우드 동기화만"). | **Cut.** Auth + Firestore + offline queue + conflict resolution ≈ 3 weeks and protects against one risk: device loss. Local-first + file export ≈ 2 days. The event log (§9) + engine-free `Economy.Core` (§7.4) make cloud a later addition, not a rewrite. | Lose your phone → lose your village. Acceptable for 12 seeded testers; not at scale. **Director's call — this is his locked decision.** |
| **D2** | **The presence mechanism.** ⚠️ **Any answer but (c) contradicts locked `07` #2.** A real three-way choice, because §5.3.1 concedes the interruption cost is real: **(a)** Confirmed-Presence Rule — 1 ping at 60 min, then every 30 min. **(b)** Silent auto-commit — no ping ever; any session auto-closes at 90 min unconfirmed; zero interruption, but a genuine 3-hour study block gets truncated to 90 min and the user must restart it. **(c)** Locked focus-enforcement as specced — continuous foreground monitoring, 집중형 categories only, leisure exempt. | **(a).** (b) is kinder but it punishes the app's best user — the person doing a 3-hour deep block is exactly who we want, and truncating them is a worse betrayal than one tap. (c) is the most policing of the three *and* structurally anti-identity (§5.3.1): it watches 공부 and trusts 게임. | (a) costs 5 interruptions on a 3-hour session. **That is a real cost to a user defined as tired of strict rules, and the director should weigh it rather than inherit my judgment.** All three are the same interface in `PresenceRule.cs`; switching is hours, not days. |
| **D3** | **Korean only for MVP?** (drops en/ja/zh, 711 keys × 4) | **Yes.** The 12 testers will be Korean. Keep string IDs so re-adding is mechanical. | No international read. Recoverable at any time. |
| **D4** | **Breaking streak, or cumulative days-recorded?** | **Cumulative.** A streak that resets to 0 is a *punishment* mechanic aimed at "무거운 생산성 앱(엄격한 룰)엔 지친 사람" — and a mirror that punishes is not neutral. `14` §0 and `15` §D both already ban FOMO. | **Honest cost: a cumulative counter pulls back weaker than a streak.** Rev 2 makes this sacrifice much cheaper — timed construction (§4.3) and day/night (§6.2) now carry the return beat without punishing anyone — but a streak would still out-pull it. Real, and the director should weigh it. |
| **D5** | **Tier1 EXP curve.** Current `[0,30,120,360,1000]` (director, 07-11) means **one 25-min session takes a building Lv1→Lv5 max — the EXP axis dies after session 1 and the game becomes a pure coin economy** (§4.1). | **Ship `[0,60,240,720,2000]`** (his own 07-10 value → Lv4, headroom preserved, both axes alive) **as the MVP default, pending one word from him.** Not a silent retune: the director personally requested both accelerations, so this is flagged loudly and defaults to *his own previous value* rather than to mine. | **One constant + one test expectation (Q07).** Reversible in minutes at any point, including after the testers are in. |
| **D6** | **Art: who draws it?** — **not "what style"** (§6.1: the Board A palette is `절대 유지`, the 7 category colours are shipped constants, contrast is verified, and `08-art-target-direction.md` §0 already picked "코지 파스텔 + 코케트"). The open question is only: commission an artist, or in-house geometric-isometric using the locked palette? | **In-house geometric for MVP.** Flat colour, clean shapes, the locked palette, 128×64 diamonds, 3 tier stages — reads as *intentional* rather than unfinished, and Unity's Tilemap + Light2D flatter it. **ui-ux is not blocked either way and should start the S2 art order now**; the §6.4 leisure-parity constraint and banned-copy list bind under both answers. | We will not learn whether the app is *beautiful* — only whether the loop works. See §14.1. |
| **D7** | **Ship logistics — needed in week 1, blocking.** ① Play Console developer account (~$25) — **who creates it?** ② A hosted privacy policy URL. ③ **Personal account ⇒ 12 testers × 14 continuous days** before production. **Organization accounts are exempt** but need a D-U-N-S number and take longer to approve. | **Decide personal vs organization NOW.** If personal: **start recruiting 12 humans in week 1** — it is on the critical path and it is not a coding task. | Nothing ships until this is answered. This is the gate that silently held the original at zero for a year. |
| **D8** | **Confirm the coupling as a `VISION.md` boundary:** *no social feature ships before the server does* (§5.5). | **Adopt.** It is the rule whose violation produced the original's one indefensible state. | Social slips until a server is funded. |
| **D9** | **Leisure reward multiplier.** `07` #1 line 15 explicitly *permits* tuning leisure to pay less: *"(튜닝 옵션) 여가형의 보상 배율·일일 상한을 성장형과 다르게 둘 수 있음."* This spec ships **×1.0 — 게임 3h and 독서 3h pay identically** (Q12). | **Keep ×1.0.** Line 13 is the stronger statement: *"성장형·여가형 둘 다 동일하게 마을을 건설·성장시킨다."* A leisure penalty is the exact mechanism that converts a neutral mirror back into a productivity app — quietly, through a constant, with no document ever saying so. | **I am not exercising the tuning option the spec hands me, and I want that to be a decision he makes rather than one I made by omission. If you want leisure to pay less, say so explicitly — I will not drift there quietly.** |
| **D10** | **Timed construction (§4.3) in MVP?** `14-timed-construction.md` is DECIDED (2026-07-10) but was never built. | **In.** ~1 day, uses his own approved brackets, and it is the strongest non-punitive return hook available — the wait scales with progression (1 min for the first building, 2 h for the merge) while leaving onboarding untouched. Cut the skip-for-coin (§3.2). | Adds a first-run subtlety: the very first building takes 60 seconds to appear. Mitigated by the bracket, but QA should watch it in onboarding. |
| **D11** | **Landmarks cut from MVP?** ⚠️ **Contradicts locked `07` #3 line 22: "Tier2(max10) 동종 2개 → 랜드마크(유니크 건물, 코인 획득/번영도 버프). MVP는 1~2종 최소."** | **Cut — and here is the arithmetic.** A landmark needs 2 × Tier2 Lv10. Tier2 Lv10 = 44,933 cumulative EXP = **44,933 credited seconds ≈ 12.5 h of logged time per building**, ×2 ≈ **25 h**, plus 2 × 5,000 merge coin. A 14-day test at ~1 h/day yields ~14 h. **No tester can reach a landmark.** Building it means building unique art, a buff system, and a prosperity stat that zero humans in this test will see. | We lose the endgame ceiling and the "번영도 buff" axis entirely. If the director wants it, the honest way in is to *lower Tier2's curve*, not to build content behind a 25-hour wall — that is a separate decision I am not making for him. |

---

## 13. Assumptions (marked, mine, not the director's)

- **[assumption]** 12 seeded testers is enough to read D1/D7 retention directionally. It is not statistically meaningful; it is meant to reveal whether the loop is felt at all.
- **[assumption]** Presence-ping timings (60 min → 30 min, 10-min window) — invented, tunable, no data behind them.
- **[assumption]** Flat 12h/6h caps ≈ 95% of the diminishing curve's protection.
- **[assumption]** Day/night keyframes (§6.2) — invented; colours constrained to the locked palette but the times and intensities are guesses.
- **[assumption]** Korean-only is right because the first cohort is Korean.
- **[assumption]** A single player's JSON save stays under a few MB; revisit past ~5,000 sessions.
- **[assumption]** 9-week timeline, range 8–11; an estimate, not a commitment. Driver is week 5–6.
- **[assumption]** Unity APK/AAB baseline ~20–30MB; verify at first build (week 1 tells us for free).
- **[assumption]** Onboarding must reach a live timer in <60s or day-1 conversion collapses.
- **[assumption]** `hobby` = Growth — inherited; the original marks it `[가정]` too (`category_catalog.dart` line 87).
- **[assumption]** First session in the first minute matters more than explaining the concept well.
- **[assumption]** The merge (~2 days of normal use) is visible-and-reachable enough to carry a 2-week test's long-goal tension.
- **[assumption]** Timed construction's 1-minute first build does not hurt onboarding. It is the shortest bracket and the site is animated, but this is a guess about a first-run moment and QA should watch it.
- **[assumption]** One building per cell is sufficient — `Isometric` Cell Layout is enough and `Isometric Z-as-Y` is not needed for MVP.
- **[verified, not assumed]** Google Play's 12-testers × 14-continuous-days rule for post-2023-11-13 personal accounts; organization accounts exempt. (Sources below.)
- **[verified, not assumed]** The Board A palette, the 7 category colours, the type badge tokens, the contrast ratios and the timed-construction brackets are all existing, approved artifacts in the source — read from `docs/design/00-design-system.md` §1-1/§1-2/§1-4, `app/lib/data/category_catalog.dart` 46-110, and `app/lib/core/economy/economy.dart` 61-73. None of them are my invention and none are mine to change.

---

## 14. What this MVP fails to prove — stated up front

A thin MVP buys speed with knowledge. Here is the bill.

### 14.1 The biggest hole: the 꾸미기/수집 half of the target user

The psych profile is explicit: "성취를 눈으로 확인하고 싶고, **꾸미기/수집 욕구가 있으며**…" And `08-art-target-direction.md` §1-2/§1-3 sharpens it into two personas whose stated churn triggers are *"캐릭터가 안 귀여우면 정 안 붙어서 이탈"* and *"꾸밀 게 금방 동나는 것."*

**We cut Mongsil, outfits, decoration, the shop, and the 도감.** Rev 2 partially repairs the *애착* axis — the day/night village is a mood object, and `08` §1-3's persona B explicitly reacts to *"시간대·계절의 분위기(저녁 노을·밤 별)"*, which is precisely what §6.2 ships. But **자기표현 and 수집 are untested.** There is nothing to customize and nothing to collect.

**So if this MVP flops, we will not know whether the concept is wrong or whether we just cut the charm.** That ambiguity is the price of this angle and I will not paper over it. It is the single strongest argument against this proposal, and the director should hear it stated by its author.

### 14.2 The rest of the bill

2. **No D30 read.** Tier2 caps at ~62h with no landmark above it (D11). D1/D7 are readable; D30 is not.
3. **No growth read.** Cutting social removes every acquisition path. Installs = people we hand the link to. We test retention, not discovery.
4. **No monetization read.** No ads, no IAP.
5. **No adversarial-integrity read.** A solo app has no adversary to test against. Q01–Q08 prove the presence rule stops the *accident* — the threat that actually matters now — and nothing about farming under competitive pressure. §5.5 says exactly when that changes.
6. **The art promise stays open.** See D6 and §14.1.

**What it does prove — and what a year of building proved nothing about:** whether a real human being converts real hours into a village, watches it light up at dusk, opens the report, sees their own life in it, and comes back tomorrow.

That is the purpose. It is the only question that matters. And it has never once been asked.

---

**Sources**
- [App testing requirements for new personal developer accounts — Play Console Help](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [Google Play – 12 Testers for 14 Days | Testers Community](https://www.testerscommunity.com/blog/google-play-12-testers-policy)
- [20 to 12 Testers: Google Play New Rules 2026 | PrimeTestLab](https://primetestlab.com/blog/google-play-changed-20-to-12-testers)