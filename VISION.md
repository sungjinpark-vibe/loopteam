# VISION — Life Town (project contract)

> **This is the app's own contract** — split out of the engine's `VISION.md` §2 on 2026-07-19 per
> director instruction ("VISION 내용을 각 프로젝트에 분리"). The engine's `VISION.md` still holds
> everything project-independent: the three gates, rubrics, boundaries, failure policy, standing rules.
> When Life Town is the **active** project, the tick reads BOTH files (engine first, then this).
>
> **Status: PAUSED 2026-07-17** (director switched to touchRPG). NOT cancelled. Where it stopped:
> 7 category buildings + village v2, gate-green 81/81. **The next step is already decided** — the
> director approved *"실제 게임 동작 진행해줘"* (2026-07-17): proceed to real gameplay (tap building →
> timer → growth/build; wire Economy.Core T002 + Platform T003 + design system T004 into the village)
> → playable slice → Gate 3. **Do not re-ask polish-vs-gameplay on resume.**
> Full pause state: `docs/paused-state/` (PROGRESS cockpit with resume banner, backlog + task files).
> **To resume**: point the engine's `state/loop.json` `project` here, restore the backlog, run the
> gameplay task.

## The project

| Field | Value |
|---|---|
| Name | **Life Town** |
| Stack | **Unity 6000.5.1f1** (fixed by director rule) |
| One-line concept | Turn the time you actually live into a village. A life-logging sim that mirrors your whole life — **work and leisure alike** — as a place you can see. |
| Target player | Late-teens to 30s students and office workers who want their effort made visible; secondary, casual Forest/Fortune City/merge players with a "collect pretty things" drive. Source spec's psych profile: *"성취를 눈으로 확인하고 싶고, 꾸미기/수집 욕구가 있으며, 무거운 생산성 앱(엄격한 룰)엔 지친 사람."* |
| Project folder | `C:\Users\user\loop_engine\lifetown` (own git repo) |
| Source material | `C:\Users\user\app-dev-team\lifetown\` — **read-only**. Never modify it (§4). |
| Director's brief | 2026-07-16: rebuild the same app in Unity, **but make it better achieve its purpose** — not a straight port. |
| Spec | `lifetown/docs/spec/00-mvp-spec.md` (ship-first, scored 93/90) + `01-decisions-resolved.md` (director's answers — **the newer record wins on conflicts**). |
| Scope | **Approved with overrides (2026-07-16).** Base = the 93-point ship-first spec, MINUS its ship-first thesis: the director kept **cloud sync (D1)** and **landmarks (D11)**, and **deferred shipping — build only (D7)**. So scope is *larger* than the spec proposed, and completion is **Gate 3 (5-expert playtest ≥90)**, not a store install. Decisions D5=`[0,60,240,720,2000]`, D9=leisure ×1.0. |
| Completion | **The 5-expert playtest gate (§3.3).** No store dependency while D7 is deferred. |

### The purpose, in the source's own words
`docs/spec/00-overview.md` §2: *"보이지 않는 노력(집중 시간)을 가시적 성취(마을)로 전환해 습관 형성을
돕는다"* — **"내 시간과 노력을 눈에 보이게."**

`07-decisions-locked.md` (director-approved 2026-07-05, **final over conflicting specs**) supersedes the
identity: Life Town is a **life-logging** app. It mirrors life *neutrally*, **leisure included** — not a
self-improvement app that only counts "productive" hours. Growth and leisure categories both build the
village; the report shows the balance and lets the player notice it themselves.

### What the Flutter original actually is (surveyed 2026-07-16 — read before scoping)
The repo notes claimed it "shipped through v0.0.5". **It did not ship.** That is an internal milestone
label; there is no store release (debug signing, test AdMob IDs, no developer account).

- **34,344 lines, 210 Dart files, 27 screens, 61 test files.** Feature-rich and polished.
- **Built**: timer→EXP/coin→build→level→merge loop; idle care loop + 5 mini-games; Mongsil mascot with
  bond/outfits; daily missions/streak/notifications; a real Firestore-backed social layer
  (leaderboard, likes, visits, warmth); i18n ko/en/ja/zh.
- **NOT built — and this is the important part**:
  - **Integrity/anti-farming does not exist.** `lib/core/economy/economy.dart:10-12` says so outright:
    daily caps and focus-enforcement are "범위 밖". Only a 60-second minimum survives. The spec marks
    these B1-B6 **Must**.
  - **No server at all.** No Cloud Functions directory. The client is fully authoritative — session
    commit, caps, clock-tamper defense, and idempotency are all specced and all absent.
  - Email/password auth only (no Google/Apple/anonymous-link, all specced Must).
  - No gems, no IAP, no landmark tier.

> **This gap is the likeliest answer to the director's brief.** The app's whole purpose is *"내 시간과
> 노력을 눈에 보이게"* — but if the timer can be cheated, the village stops mirroring a real life and
> becomes decoration. **Making the village trustworthy may do more for the purpose than any new
> feature.** That is a proposal for `planner` to argue and the director to approve — **not for the PM
> to assume.**

