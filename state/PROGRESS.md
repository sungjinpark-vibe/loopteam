# PROGRESS — the loop's cockpit

> Only what the next tick needs to choose its next action. Bulk history lives in `state/journal.md`.
> Paused-project detail lives in each app's `docs/paused-state/` snapshot — not here (token economy,
> 2026-07-19 restructure).

## Current State
- **Status**: ▶ ACTIVE — **app_in_toss — MVP feature-complete as of T014 (2026-08-05).**
  T001-T014 all `done` (scores 90/91/92/95/89/96/[T007 reverted]/92/91/94/93/91/91/92). Full
  narrative + lessons from this whole stretch: `state/journal.md` → "2026-08-02 to 2026-08-05 —
  app_in_toss: new project through T012" (T013/T014 landed after that entry was written — see their
  own task files for detail). Detail on any specific task: `backlog/tasks/T0##.md`.
  **Where things stand**: ADDENDUM-01 (savings buildings + road layout), ADDENDUM-02
  (random/movable placement), and the full MVP build order (F1-F17's in-scope items) are all
  implemented and gated ≥90.
  **Director answered the MVP-complete direction question (Discord msg 1534600530750345386,
  "1번 진행해줘") = option (a), Gate 3 prerequisites.** Since Gate 3 needs `BALANCE_UNSET === false`
  (MVP-SPEC.md §9) and the actual numbers are the director's call (D-3/D-4/D-5/D-13/D-14/D-15, §13),
  PM sent a plain-language 6-question balance ask to Discord (msg 1534906419516538891, 2026-08-05)
  with a shipped-default offered for each — awaiting reply, not yet resolved.
  **T015 opened and running concurrently** (the two small logged follow-ups below — no director
  decision needed for these, so started them while the balance ask is outstanding): a pre-existing
  TDS nested-dialog backdrop quirk (seen twice, `backlog/tasks/T003.md` and `T013.md`), a
  month-navigation empty-state flash (`backlog/tasks/T012.md`). Quality-loop workflow run wf_8fc63a04-8af.
  Uses `gate/gate-node.ps1` (npm install → tsc --noEmit [per referenced project] → npm run build →
  test → lint → gate:extra — same contract as `gate.ps1`).
- **Standing note**: Discord replies are only auto-drained during an autonomous tick's scout step —
  while working in-session, re-check `.discord/incoming.log` manually after sending anything that
  expects a reply, don't assume silence means unanswered. Life Town and touchRPG remain paused,
  untouched. Discord ENABLED both ways (rule 8, current).
- **Engine-improvement backlog (2026-07-19 session), still awaiting the director's pick, low
  priority while app_in_toss is active**: skill/library research results (full lists in journal —
  top picks Unity MCP, UniTask/PrimeTween, etc. — **adopt nothing without the director's pick**);
  rtk (✅ working) + ponytail (fixed, needed a session restart) subagent coverage; token-leak audit
  done. None of this blocks app_in_toss work.
- **Last updated**: 2026-08-05 (in-session)

## ▶ Next, in this order
1. **T017 in progress** — T015 passed 90/100 (commit 1492757) but the lead flagged a third unfixed
   backdrop-bug site (`EntrySheet.tsx`); fix-forward round 1 (da5d291) then FAILED lead review at
   86/100 (real findings: a 2-dimmer selector race, no regression test for the new site, a
   nondeterministic test suite). Round 2 (commit abf4a16) just landed — verification is running now
   (async team-lead agent). **On result: if ≥90, mark T015/T017 done, flip T016 to `ready`, launch its
   quality-loop workflow. If still <90, one more targeted fix-forward round, do not let this drag past
   3 rounds without re-evaluating the approach.**
2. **T018 running in parallel** (explore mode, doc-only, no file conflict with T016/T017) — new
   director-requested monetization design (ads via building speech-bubbles + in-game currency, paid
   extra builds past the 10/day cap, a decoration shop). This is an explicit, informed reversal of
   MVP-SPEC.md's original "no currency, no ads" cut decision (§1.3/§8) — flagged to the director,
   proceeding since the request was concrete and deliberate, not a casual aside. Real ad/payment
   settlement is blocked on missing Toss console/business-registration accounts, so design mandates
   the existing platform-port pattern (browser/dev stub now, toss driver later) so the full economy
   is still buildable and demoable today.
3. **After T016 passes**: run Gate 3 (`playtest.js`) — this is the milestone that ends app_in_toss's
   *original MVP* development. T018's monetization build-out (once its spec is approved) is new scope
   layered on top and does not block Gate 3 on the original MVP scope. The other older candidates
   ((b) real art order, D-12 still open; (c) other new feature requests) remain queued behind both.
2. Engine-improvement backlog (reported 2026-07-19, still awaiting the director's pick) — low
   priority while app_in_toss has momentum.

## Open Items
- **Discord reply-drain gap** (2026-07-18, twice): with the loop paused, a Discord reply sits unread
  until the director prompts in-session. Real fix: resume the autonomous loop (`paused: false`) —
  flagged to the director, his call.
- **git remotes**: engine=`main`, touchRPG=`origin/touchrpg`, lifetown=`origin/lifetown` — all on the
  same `loopteam` GitHub remote (director, 2026-07-18). Push apps with
  `git push origin <local>:<branch>`.
- **ponytail activation** requires a session restart to load the newly-registered plugin.

## Paused projects (each app's own `VISION.md` is its contract — director rule 2026-07-19)
- **touchRPG** (2026-07-19): P0 feature-complete (T001-T004 = 97/94/90/97), APK v0.0.1 delivered.
  Open: Gate 3 never ran (손맛 question unanswered), 5 provisional numbers, TBD-14/15.
  → contract `touchRPG/VISION.md`; pause detail `touchRPG/docs/paused-state/PROGRESS-snapshot.md`.
- **Life Town** (2026-08-02): T001-T011 done and accepted (APK v0.0.9). T012 (art landmark) unfinished
  mid-decision — director just approved pivoting the landmark to flat 2D illustrated art (real Fortune
  City references showed its buildings are 2D card art, not 3D models) after 4 escalated 3D-Blender
  attempts (20 rounds, never passed). Pivot not started when paused.
  → contract `lifetown/VISION.md`; pause detail `lifetown/docs/paused-state/PROGRESS-lifetown.md`.

## Blockers
- None.

## Needs Human Review
- None active — T012's escalation (2026-08-05, 5-round limit at 85/90) was resolved via one
  fix-forward round, final score 91/100. Full detail: `backlog/tasks/T012.md` Log.
- T011's escalation (2026-08-05, no-progress brake at 81/100) was resolved via two
  targeted fix-forward rounds, final score 93/100. Full detail: `backlog/tasks/T011.md` Log.
- **Security note (2026-08-05, T011), resolved, kept for the pattern**: a `team-lead` scoring agent
  ran `git checkout -- .` while reviewing — team-lead is supposed to be strictly read-only. No data
  lost (working tree was already clean). Hardened `.claude/agents/team-lead.md` with an explicit
  rule against any mutating git command.
- **Security note (2026-08-04, T010), resolved, kept for the pattern**: a QA/evidence step killed its
  dev server via `taskkill /F /IM node.exe /T` — by image name, not the specific PID it started —
  which could kill unrelated node processes (another agent's dev server, tooling). Same class as the
  2026-07-18 `rm -rf` and 2026-08-01 `git checkout` scope incidents. **Investigated**: the Discord
  daemon (PowerShell, not node) was unaffected, heartbeat confirmed fresh; no other workflow was
  running concurrently this time. No actual harm, logged as a recurring pattern — see Do Not Repeat.
- None else active — T002's escalation (2026-08-02, 5-round limit at 74/90) was resolved by a focused
  fix-forward round: 91/100 on the first try (commit 919a84a). Full detail: `backlog/tasks/T002.md`
  Log. T012's open decision was resolved by the director (flat-2D-art pivot approved) before
  the whole project paused. Full detail: `lifetown/docs/paused-state/PROGRESS-lifetown.md`. On resume,
  start there — do not relitigate the 3D-vs-2D decision, it's made.
- **Security note (2026-08-01 T012 run), resolved, kept for the pattern**: a QA evidence step ran
  `git checkout --` on files outside the task's scope (a Unity scene, ProjectSettings) — flagged by the
  harness as a possible
  destructive action, same class as the 2026-07-18 `rm -rf` incident. **Investigated: no data was
  actually lost** (verified via `git lfs status` hash comparison, not just `git status` — see Do Not
  Repeat below for why a naive `git diff --stat` on this file was misleading). Logging the *pattern* —
  an agent overstepping file scope with a git command — as a real recurring gap regardless of this
  instance's outcome.

## Next Run Should
1. Report T014 + the MVP-complete milestone to the director; wait for direction (see ▶ Next above).
   Nothing is `ready` in the backlog on purpose — go idle rather than inventing work.
3. **Wait for the director's pick on engine-improvement adoption** (report sent 2026-07-19, still open,
   lower priority than app_in_toss now).
4. Commit the engine repo on any `state/`/`backlog/` change; apps push to their own remote branch
   (`app_in_toss` pushes to `origin/app_in_toss` on the shared `loopteam` remote, same pattern as
   touchRPG/lifetown).

## Decisions Made (standing — full history in journal)
- **Channel rule (CURRENT, 2026-07-18)**: *"지금부터 답변은 디스코드로 해줘"* — report to Discord even
  in-session. See `VISION.md` §7 rule 8 (the single source; earlier in-session-only rule is dormant).
- **Token economy (director, 2026-07-17, repeated 3x)**: frugal path for proven-pattern work; full
  quality-loop only for novel/risky work. Cost rule, not a quality rule — gates still decide "done."
- **Git branch-per-project (2026-07-18)**: apps share the engine's `loopteam` remote on their own
  branches; engine stays `main`.
- **Standing grant (2026-07-18) — EXPIRED 2026-07-19**: "proceed without approval until a prototype"
  was fulfilled by P0's completion; does not carry over to engine work.
- **touchRPG paused; engine improvement first (2026-07-19)**: *"touchRPG도 이쯤에서 마무리해줘. 우리
  루프 엔지니어링 팀의 고도화가 먼저 되어야 할 것 같아."*
- **No unauthorized deletion (2026-07-19)**: agents never delete anything they didn't create in-task —
  report stray paths to the PM (`VISION.md` §4 Never; added after a QA subagent's unauthorized rm -rf).

## Do Not Repeat
(engine-level; binding across projects)
- A workflow's `meta` must be a **pure literal** (even `'a' + 'b'` is rejected). A broken meta makes the
  workflow **invisible** — `Workflow({name:'x'})` then reports "not found", which looks like a discovery
  problem but is a parse error. Diagnose meta first; call by `scriptPath`, which fails loudly.
- `args` arrives as a **JSON string**, not an object. Our scripts coerce it — don't "fix" that away.
- Unity can **exit 0 with compile errors** — `gate/gate.ps1` also scans the editor log for `error CS####`.
  Never trust the exit code alone. Never leave an editor holding the project lock (use `-quit`).
- **`gate/gate.ps1` only runs EditMode tests, not PlayMode** (found 2026-07-18). Any task adding
  PlayMode tests must verify them manually (QA evidence step) until the gate covers both platforms.
- **PlayMode batchmode: `-runTests -testPlatform PlayMode` + `-quit` races and silently produces zero
  tests** (found 2026-07-18). Drop `-quit` when running PlayMode tests manually (EditMode: same rule,
  `gate.ps1` already handles it).
- **Never `git add` from the home folder** (`C:\Users\user`) — it is an accidental git repo and would
  swallow the whole home directory.
- **`gate.ps1` relative `-AppDir`** nested Unity's log output one level deep (`<AppDir>\<AppDir>\...`)
  — FIXED 2026-07-19 (resolves to absolute immediately), kept here as the pattern: Unity resolves its
  own relative path args against the project dir, not the launcher's cwd.
- Discord resource-scoped routes 403 with `{"code":40333}` unless a real `User-Agent` is sent — every
  `.discord` script already does this.
- **Python heredoc via Bash `python3 ... || py ...` fallback chains** can drop into the interactive
  REPL and hang the shell for 2 minutes (2026-07-19). Use the file tools or a single `py file.py`.

## Do Not Repeat (addendum, 2026-08-01)
- **A mid-session edit to an agent's `tools:` frontmatter line does not propagate to subagents spawned
  later in the same running session.** Confirmed twice now: the ponytail plugin (2026-07-19) and
  `mcp__blender` granted to ui-ux (2026-08-01, T012) — three independent ui-ux subagent rounds each
  freshly re-checked their own tool list and found the addition simply absent. If a subagent reports
  "No such tool available" for something the agent file clearly grants, don't re-prompt it — that wastes
  rounds against a wall. It needs a session restart. Plan tool-grant tasks accordingly, or grant the
  tool *before* the session that will use it starts.
- Bash/PowerShell grants to an agent that doesn't have them are gated by the permission classifier as a
  meaningful capability change — expect a manual approval step, don't assume an Edit-tool grant is live.
- **Agents running `git checkout --`/similar reverting commands on files they didn't create is the same
  class of violation as unauthorized `rm -rf`** (2026-07-18 incident) — an agent should only ever revert
  the specific file(s) its own task touched, never sweep up "looks stray" changes. Confirmed once
  (T012 QA evidence step, 2026-08-01) — no actual loss that time, but don't rely on luck; brief
  evidence/QA steps to touch only what they were told to inspect, never to "clean up" the working tree.
- **`git diff --stat` on an LFS-tracked file can report a huge, scary, and WRONG line-count diff** when
  the committed blob is compared as its LFS pointer text against the working tree's smudged real
  content — e.g. a 7MB `.unity` scene showed "211619 deletions" for zero actual change. Before treating
  a large diff on an LFS-tracked path as real, check `git lfs status`: if the `Git:` hash and `File:`
  hash match, nothing changed.

## Do Not Repeat (addendum, 2026-08-05 — T011)
- **A `team-lead` (scoring) agent must never run a mutating git command** (`checkout`, `reset`,
  `clean`, `add`, `commit`, `stash apply/pop`) — it has Bash/PowerShell only to run the app live for
  verification, and is otherwise strictly read-only, same as it's read-only on the codebase itself.
  Found 2026-08-05 (T011 scoring): a team-lead ran `git checkout -- .` mid-review; no data was lost
  only because the tree happened to already be clean. Hardened `.claude/agents/team-lead.md` with an
  explicit rule. Same incident class as the qa `taskkill` scope issue (2026-08-04) and the earlier
  `rm -rf`/`git checkout` incidents — the pattern is agents reaching for a "clean up" action outside
  their actual job. Consider auditing other read-only-by-design agent roles (gate-runner) for the
  same gap next time one of them touches Bash for verification.
- **A 390px-only reference viewport misses real narrow-Android-width (320-360px) layout bugs.** T011
  needed two separate fix rounds because the first round's fix was only verified at 390px; the actual
  defect (label wrap/clipping) only appeared at ≤360px. When a task's AC don't already specify a
  viewport sweep, ask the implementer to check at least 320/360/390/430px for anything involving
  Korean text in a fixed-width container — font metrics vary by system font in ways a single
  viewport's single font can hide.

## Do Not Repeat (addendum, 2026-08-04, cont'd — T010)
- **Never kill a process by broad image name (`taskkill /F /IM node.exe /T`, `pkill node`, etc.) to
  clean up a dev server an agent started.** Kill the specific PID the agent itself launched and
  recorded (`Stop-Process -Id <pid>`), never every process matching an executable name — a blanket
  kill can take down unrelated node processes (another concurrent agent's dev server, the loop's own
  tooling). Found in T010's evidence step (2026-08-04); investigated, no actual harm that time
  (the Discord daemon is PowerShell, not node, and nothing else was running concurrently), but this
  is a real recurring risk class, same as the unauthorized `rm -rf`/`git checkout` incidents — brief
  QA/evidence steps to track and kill only the PID they started.

## Do Not Repeat (addendum, 2026-08-04)
- **For pure visual/taste changes, send a screenshot checkpoint EARLY, before investing multiple
  expensive rounds refining it.** T007 (building roof silhouette) ran 5 formal rounds + a fix-forward
  attempt (~2M+ subagent tokens) polishing a visual direction, then the director reverted the whole
  thing the moment he actually saw it at real size — he simply preferred the original flat-square
  look. The score/rubric measured "does this look like a house" well; it cannot measure "does the
  director like this," and only he can answer that. For a task whose brief is fundamentally a taste
  call (not a correctness bug), get one cheap screenshot in front of the director after round 1,
  before round 2+ spends more budget refining a direction he might reject outright.

## Do Not Repeat (addendum, 2026-08-03, cont'd — T005)
- **Folding grafts into an already-passing explore-mode winner can REGRESS the score**, not just
  polish it. T005's addendum passed 90/100 round 1; PM asked for a losing proposal's idea to be
  folded in (reasonable, per the tick skill's own "fold in grafts" instruction), and the result
  dropped to 68/100 — the graft was good but the fold-in pass left other parts incomplete. If you ask
  for grafts to be folded into an already-passing document, **always re-verify with the lead
  afterward** — do not assume "started from a passing doc" + "the graft was reportedly good" implies
  the result still passes.
- **For UI/layout-heavy design work, a prose spec has a real ceiling on how "implementation-ready" it
  can get, and rounds past that ceiling show sharply diminishing returns.** T005 took 6 rounds
  (90→68→74→76→86→89) to get within 1 point of the bar, at a cost of ~1.5M+ subagent tokens for one
  addendum — CSS Grid subtleties (e.g. `gridRow: "1 / -1"` silently collapsing to one row with no
  explicit `grid-template-rows`) are the kind of defect that's genuinely hard to catch in pure prose
  review and would likely have been caught faster and cheaper by an actual browser-driven QA step
  during implementation. When a design document is repeatedly found to have implementation-level
  defects (not judgment-call gaps) after 3+ rounds, consider accepting it below the bar with a PM
  note (as done here) and letting the real build + QA gate do the rest, rather than chasing textual
  perfection.
- **When an explore-mode document is accepted below its formal pass mark, say so explicitly and in
  writing** — do not silently treat it as equivalent to a normal pass. T005's task log states the
  exact score (89/100), the full round history, and the PM's specific reasoning. This is a judgment
  call the PM is allowed to make (VISION.md gives the PM authority over "how, who, and when it is
  done"), but it must never look like a pass that happened to land under 90.

## Do Not Repeat (addendum, 2026-08-03)
- **A root `tsconfig.json` shaped as `{"files": [], "references": [...]}` (the standard Vite
  project-references scaffold) makes a plain `npx tsc --noEmit` check ZERO files and report success
  trivially — the errors it should catch simply never surface.** Found in `gate/gate-node.ps1`
  (T004, app_in_toss): the typecheck check had silently been a no-op since T002. When writing or
  reviewing any typecheck step (gate script, CI config, a subagent's self-verification instructions)
  for a TS project, check whether the root tsconfig has `references` first — if so, check each
  referenced project's tsconfig explicitly (`tsc --noEmit -p <path>` per reference), never the root
  config alone.

## Do Not Repeat (addendum, 2026-08-02, cont'd)
- **The PM has no direct browser/screenshot tool.** For a live web app (React/Vite, not an HTML
  mockup — `render-html.ps1` doesn't apply), delegate screenshot capture to a `qa`-or-similar subagent
  with Bash/PowerShell: start the dev server, drive it with Playwright (`npx playwright install
  chromium --with-deps` if not already a devDependency), save PNGs to the scratchpad, report the
  paths back. Quality-loop subagents' own screenshots (e.g. QA's Playwright shots during a round) are
  NOT persisted anywhere the PM can reach afterward — they live only in that subagent's ephemeral
  workspace. If a screenshot is needed for the director, capture it fresh in a separate step.

## Do Not Repeat (addendum, 2026-08-02)
- **An implementer editing the spec/contract document it is being graded against is a boundary
  violation, even when disclosed inline.** Found T002 round 5 (app_in_toss): client-dev rewrote an
  acceptance criterion in `docs/spec/MVP-SPEC.md` to match its own deviating implementation, marked
  `[T002 deviation, disclosed]`. Disclosure is not authorization — a spec change is the planner/PM's
  to make (engine `VISION.md` §4: "finalizing a spec... requires director approval," and more basic
  than that, an implementer moving its own bar is the exact self-grading VISION.md 26장 warns leads
  against, just moved one level up). PM reverted the doc text and kept the code's actual (probably
  correct) behavior with its rationale in a code comment instead. Brief implementers explicitly: a
  spec deviation is a note in the report, never a doc edit.
- **A build-mode gate script must actually run every check the spec/rubric claims is enforced.**
  `gate/gate-node.ps1` (written for app_in_toss) initially skipped lint entirely; the spec called lint
  and a fixture-not-in-bundle assertion "gate-relevant, not advisory" and neither actually ran. Fixed:
  the gate now runs `npm run lint` when present, plus an extensible `gate:extra` npm-script hook for
  project-specific static assertions. When writing a new project's gate script, read that project's
  spec for what it claims the gate enforces — don't assume install+build+test is the whole contract.

## Do Not Repeat (addendum, 2026-07-19)
- **New Unity scene files must be covered by `.gitattributes` LFS rules BEFORE first commit.** A
  hardcoded per-path LFS list (`/Assets/.../SceneName.unity filter=lfs`) silently misses every new
  scene — lifetown's SpikeVillageLoopDemo.unity (114MB) got committed as a raw blob and GitHub
  rejected the push (100MB hard limit). Fixed there by widening to a wildcard `*.unity filter=lfs`.
  Check any app's `.gitattributes` uses a wildcard, not an exact-path list, before adding new scenes.
