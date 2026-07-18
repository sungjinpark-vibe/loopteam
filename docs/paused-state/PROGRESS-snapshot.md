# PROGRESS snapshot — touchRPG (paused 2026-07-19)

> **READ THIS FIRST on resume.** Verbatim copy of the engine cockpit's touchRPG sections as they stood
> at pause. Restore the "rules this project lives or dies by" + "Locked by the director" sections into
> `state/PROGRESS.md`, restore `VISION.md` §2 from `VISION-s2-snapshot.md` (same folder), then pick up
> at "Open at pause" below. Companion: `backlog/BACKLOG.md` keeps the done T001-T004 rows.

## State at pause
- **Source of truth**: **GDD v0.4** → `touchRPG/docs/spec/00-gdd-v0.4.md` (v0.1/v0.2/v0.3 kept as
  history). Its §0: if code/conversation/convention conflicts with it, *the doc wins*.
- **T001 P0-A parry core**: **DONE** — Gate 1 green (compile 0 errors, EditMode 19/19), **Gate 2 =
  97/100** (클라이언트팀장), scored 2026-07-18 against fresh QA evidence (rendered-pixel captures,
  PlayMode tests with graphics enabled, a live config-edit demonstration). Minor deductions (−3, C2):
  mobile touch-dispatch path and the auto-miss-on-timeout path were never directly exercised — noted as
  hardening for later, not a blocker. **TBD discipline called exemplary**: TBD-1/TBD-2 externalized +
  labeled; 5 additional gameplay-affecting numbers absent from the GDD entirely (monster/player HP,
  basic attack damage, P1/medium failure damage) were surfaced as open questions in
  `touchRPG/docs/qa/P0-provisional-gameplay-numbers-REPORT.md` rather than invented — **still awaiting
  director/planner confirmation.**
- **T002 P0-B — remaining input + 람팡 P2-P7**: **DONE** — Gate 1 green (compile 0, EditMode 30/30,
  PlayMode 31/31 manual), **Gate 2 = 94/100** after 2 rounds (89→94; round 1 fixed invisible gauges,
  missing P3 knockback/telegraph, hardcoded pattern-ID switch, SRP, unpooled allocation). One
  undocumented gameplay literal found in round 2 (`dissolveLead` formula, P4's counter-hit risk window)
  — fixed separately as a frugal follow-up (externalized + documented, no re-score needed since no
  observable behavior changed). Two minor deductions left as noted hardening, not blockers (see
  `backlog/tasks/T002.md` log).
- **T003 P0-C — 3-phase session + solo run to completion**: **DONE** — Gate 1 green (compile 0, EditMode
  50/50, PlayMode 39/39 manual), **Gate 2 = 90/100** (1 round, exactly at the bar). Real HP-driven phase
  transitions, phase-gated weighted pattern selection, guaranteed groggy rush per phase (forced injection
  + pity counter), clean hunt-complete/restart. One MUST violation found (balance weights hardcoded in
  code, not externalized) — fixed separately as a frugal follow-up (moved to a new `PhasePatternWeights`
  ScriptableObject, values unchanged, no re-score needed). **P0's core loop is now solo-completable
  start to finish** — the precondition GDD §10's 손맛 question needs.
- **T004 P0-D — combat UI §6.1-6.2 completion**: **DONE** — Gate 1 green (compile 0, EditMode 50/50,
  PlayMode 44/44 manual), **Gate 2 = 97/100** (1 round). Relay marker got its own §6.2 visual (red ring +
  sequence badge + opaque/pulse/haptic triple signal) + a relay-success light beam; two real rendering
  bugs found and fixed while verifying with actual screenshots. Audit confirmed no other §6.2 drift.
  Minor deductions (presentation-only, not gameplay-affecting — left as noted hardening, not fixed).
  **🎉 P0 IS FEATURE-COMPLETE** — all four tasks (T001 97, T002 94, T003 90, T004 97) done. This is the
  prototype the director's 2026-07-18 standing grant was building toward.
- **Security finding, investigated and closed (2026-07-19)**: a QA subagent `rm -rf`'d a stray untracked
  `touchRPG/touchRPG/` directory without being told to. Independently verified (not just trusting the
  subagent) — genuinely a duplicate log dir from a `gate/gate.ps1` bug (relative `-AppDir` caused Unity
  to nest `-logFile`/`-testResults` output one level too deep), nothing real was lost. **Fixed the root
  cause**: `gate.ps1` now resolves `$AppDir` to an absolute path immediately; reproduced and confirmed
  fixed. **Fixed the process gap**: added a `VISION.md` §4 "Never" rule — agents must not delete
  anything they didn't create in-task, even obvious-looking garbage; report it to the PM instead.
  `qa.md`/`client-dev.md` now point at this rule.
- **Figma MCP connected** (2026-07-19, director-requested for the art team): verified via `whoami` —
  director's own account, team "Avaritia" (`planKey: team::1054599000081459261`, Starter tier, ~6 MCP
  read calls/month). Recorded in `ui-ux.md` so the art team doesn't need to rediscover it. No touchRPG
  Figma file created yet — none of P0's UI needed real design-tool work (client-dev built it directly
  with placeholder primitives); create one when an actual ui-ux task needs it.
- **Team/system**: unchanged by director's instruction — same agents, same three gates, same rubrics
  (`VISION.md` §3.2), same expert panel (§3.3), same boundaries/failure policy (§4/§5).
- **Last updated**: 2026-07-19 (in-session)


## Locked by the director 2026-07-17 (GDD v0.3 — do not re-open without him)
- **No active skills at all.** Growth is passive-centric. Chosen to *remove* the P-2 collision rather
  than compromise it: activatable skills need a trigger input, and §4.1/§6.3 forbid new buttons.
  **In-combat input remains exactly §4.1 — nothing else.**
- **Passive cards = 장식주 socketed into the 탈리스만 slots** (MH gear→decoration structure). Not a new
  growth axis — §8.1's 60/30/10 stands unchanged. Set in the pre-hunt 대기실; **locked at hunt start**.
- **Weapons = 3**: 총(원거리) / 창(중거리) / 검과 방패(근접) — they split the engagement-distance axis
  cleanly (대검 dropped; it overlapped 검과 방패). **Judgment windows ±0.15/±0.35 are weapon-common —
  per-weapon judgment is MUST NOT.** Weapons differ by rhythm/speed, distance, part-break affinity, and
  (v0.4) **검과 방패 gets damage reduction on a timed defense** — exact % is TBD-14, not decided.
- **A weapon that structurally dodges patterns is as wrong as one that out-damages them** (§4.6 MUST) —
  still the live constraint on 총; the range axis is confirmed (v0.4) but the mechanism that enforces
  this MUST is TBD-15, not decided. **Do not add distance behavior to any §7 pattern sheet before it is.**

## The rules this project lives or dies by (re-read before briefing any agent)
1. **The GDD wins.** `touchRPG/docs/spec/00-gdd-v0.4.md`. This cockpit and `VISION.md` §2 are pointers,
   not replacements.
2. **The 9 live TBDs (GDD §13) MUST NOT be filled in by the team** — they are deliberately the
   director's. Live: TBD-1..7, **14** (shield's exact reduction % + trigger), **15** (range axis's exact
   mechanism). TBD-8/9/10 resolved 2026-07-17; TBD-11/12/13 resolved 2026-07-18 (their leftover specifics
   became TBD-14/15).
   The GDD names its most-guarded failure mode in its own words: *"그럴듯한 보간(hallucinated design)"*.
   That is our **Nodding Loop** by another name. An agent that invents a TBD has failed the task
   however good the result looks. Combo cap / damage curve stay provisional + labelled until the
   director sets them **after** the P0 playtest (his plan, §13).
3. **Gameplay constants MUST be externalized** (config/ScriptableObject), never hardcoded (GDD §0/§12).
4. **P0's question is the only question**: *"터치 패링이 손맛이 있는가."* GDD §10 forbids starting P1
   (party, talismans, daily loop) before it is answered. Do not broaden scope.
5. **Director approval required** for: input vocabulary, judgment-window system, growth axes,
   monetization, pattern classification, screen orientation, anything on the §11 non-goal list.

## Open Items
- **Director confirmation still needed** on the 5 provisional numbers in
  `touchRPG/docs/qa/P0-provisional-gameplay-numbers-REPORT.md` (explained in plain terms 2026-07-18),
  and on the new TBD-14 (shield %) / TBD-15 (range mechanism).
- **Discord reply-drain gap** (found twice 2026-07-18): with the loop paused and replies routed through
  Discord (rule 8, current), a Discord reply only gets read when the director happens to prompt again
  in-session — nothing here automatically re-checks the inbox. Two of his replies sat unread until he
  asked "리스너 꺼졌나" both times (the listener itself was fine both times). Real fix: resume the
  autonomous loop (`paused: false`), since ticks drain the inbox on their own schedule. Flagged to the
  director; his call whether/when to switch back on.
- **git remotes**: touchRPG and lifetown now both push to `origin` = the `loopteam` GitHub remote (same
  URL as the engine), each on its **own branch** (`touchrpg`, `lifetown`) rather than a separate repo —
  set up 2026-07-18 per director instruction ("브랜치를 프로젝트 이름별로 나눠서"). Engine stays on
  `main`. Push touchRPG/lifetown work with `git push origin <local-branch>:<touchrpg|lifetown>`.

## Paused: touchRPG
Paused 2026-07-19 by the director (*"touchRPG도 이쯤에서 마무리해줘"*), **not cancelled** — fully
resumable. Everything committed and pushed (`origin/touchrpg` @ a1b254e).

**State at pause**: P0 feature-complete — T001-T004 all done (Gate 2: 97/94/90/97), Gate 1 green
throughout (EditMode 50/50, PlayMode 44/44 manual). APK v0.0.1 built and delivered to
`OneDrive\바탕 화면\app build\touchRPG\` for the director's own hands-on play (his request, before
pausing). Source of truth: GDD v0.4 (`touchRPG/docs/spec/00-gdd-v0.4.md`).

**Open at pause (carry into resume, do not lose):**
1. **Gate 3 (5-expert playtest) never ran** — P0's question *"터치 패링이 손맛이 있는가"* is unanswered.
   GDD §10 forbids starting P1 before it is. The director was about to play the APK himself.
2. **5 provisional gameplay numbers unconfirmed** —
   `touchRPG/docs/qa/P0-provisional-gameplay-numbers-REPORT.md`.
3. **TBD-14/15 open** (shield's exact reduction %/trigger; range-axis mechanism). 9 live TBDs total
   (TBD-1..7, 14, 15) — team must never fill them in.
4. The "Locked by the director" section below and the GDD §0/§13 rules stay binding on resume.

