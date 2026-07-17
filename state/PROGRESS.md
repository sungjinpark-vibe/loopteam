# Loop Progress — Cockpit

> **ch.13**: agents forget, files remember. Without this file every tick starts from a blank page.
> **ch.18**: PROGRESS.md is a **cockpit, not a warehouse**. Keep only what is needed to choose the next
> action. Bulk history goes to `state/journal.md`. Once this file sprawls it stops being useful.
>
> English per director rule 3. The director never needs to read this — the PM reports in Korean.

Updated by the PM at the end of every tick. Direction lives in `VISION.md`, the work queue in
`backlog/BACKLOG.md`. This file is **current state**.

---

## Current State
- **Status**: Running (`paused: false`), tick 35. **LIBRARY APPROVED + LOCKED** at v5 (director "좋아.
  다음 진행해줘" 12:48). The **cottage-of-category-objects** is the locked building archetype: each
  building is a cozy cottage BUILT of its category's objects (Library = books: spine walls + open-book
  roof). **Gym cottage v1 building now** (`spike-gym-cottage-v1.png`) — sibling cottage built of gym
  equipment (weight-plate/dumbbell walls, barbell roof ridge). On landing → view → gate → show director.
- Building archetype reference (director's): `docs/design/references/library-cottage-ref.png`. Renders
  of the Library evolution: v1/v2/v3 (stack attempts) → v4 (cottage) → **v5 (locked)** =
  `docs/design/spike-library-cottage-v5.png`.
- **Main objective**: Build Life Town (Unity) to the point the 5-expert playtest gate passes (avg ≥90,
  floor 80). Shipping to a store is **deferred** (D7 — director said "일단 만들기만"), so completion is
  the playtest gate, not a store install.
- **Progress**: T001 spec (93) · T002 Economy.Core (99) · T003 Platform (99) · T004 art system (92) ·
  T007 Library building (93) · T008 Gym building — all gate-passed. Now iterating the **building art
  direction**: whole silhouette must express category (director rule, tick 27). Library v2 (stack-of-
  books monument) reads clearly as books; pastel tone preserved. Gym reshape (barbell/weight form) is
  the next building once the director OKs the direction.
- **Last updated**: 2026-07-17 08:08 (Tick 29)

## Last Run
- **Date**: 2026-07-17 08:08 (Tick 29)
- **Summary**: Director resumed the loop in a fresh session + asked to turn the listener on (done —
  daemon pid 8976). Rebuilt the Library so its whole form is a **stack of books** (page striations =
  the key readability cue), fixing v1's weak book-roof-on-a-house. Frugal path (one client-dev agent),
  gate green, 81 tests intact. Sent v2 render to the director for go/no-go.
- **Output**: `spike-library-form-v2.png`; reusable BuildingKit primitives (CreateBookVolume,
  CreateOpenBookCrown); task now `awaiting-approval`.

## Open Items
- **Library v2 direction** awaiting the director's go/no-go. If YES → apply the form-expresses-meaning
  archetype to the remaining buildings (Gym=barbell first). If NO → iterate the Library form.
- **Detail pass flagged**: v2 dropped the door/window/lantern (they competed with the page striations).
  Told the director; add them back only if he wants them once the form is locked.
- **lifetown has NO git remote.** Local commits only. Director said 2026-07-16 20:18 he'll provide the
  repo URL later. A disk failure loses the app until then. Not blocking the build.
- **Unity MCP not connected** (see the Do Not Repeat note on its gate conflict). Connect when the App
  layer actually needs live editor introspection; not yet.

## Blockers
- None hard. T005 is mid-revision (not blocked, in flight). Everything downstream (App-layer Unity
  screens) waits on the director approving the village visual direction — a taste gate, correct to wait on.

## Needs Human Review
- ~~app-dev-team cursor bug~~ → **Director ruled "건드리지 마" 2026-07-16. Closed.** See Do Not Repeat.
- **The home folder (`C:\Users\user`) is an accidental git repo** (0 commits, 0 tracked, 41MB `.git`).
  loop_engine sidesteps it by being its own repo, but the home repo itself was left untouched. A
  `git add -A` from any other project there would swallow the whole home directory. Director's call.
- **Bot token was pasted into chat** (2026-07-16). Low risk for a personal bot, but if it matters:
  Reset Token in the Developer Portal and edit `.discord/config.json` directly.
- **Nature of every score gate (90 lead, 90 panel)**: an LLM's score is an opinion. It is paired with a
  mechanical gate and pre-fixed rubrics, but that limit does not disappear. `VISION.md` §3.
- **The 5 experts cannot actually play.** They score QA's recorded evidence of a real run. Better than
  one grader guessing from code, but **not a human playtest** — never report it as one. `VISION.md` §3.3.

## Next Run Should
1. **If the director says YES to the Library v2 form**: apply the form-expresses-meaning archetype to
   the next building on the **frugal path** (one client-dev agent reusing BuildingKit → PM render +
   gate.ps1 → PM visual check → show director). Gym first = a barbell/weight/dumbbell silhouette, pastel
   tone, page-striation-equivalent readability cue, one coquette touch. Do NOT run a full workflow per
   building (token directive, tick 23).
2. **If the director says NO / wants changes**: iterate the Library form only (same frugal path); don't
   start new buildings until the direction is locked.
3. **If the director asks to restore door/window/lantern**: fold it into the Library builder as a detail
   pass; keep the page striations dominant.
4. **When the building direction is locked** and enough buildings + the village layout are playable:
   open the App-layer village screen (client-dev, build mode) consuming Core (T002) + Platform (T003) +
   design system (T004), then run Gate 3 (5-expert playtest) — NOT before a meaningful slice is playable.
5. **If nothing ready**: idle. Do not manufacture work; do not nudge every tick (`VISION.md` §6).
6. Commit on any change. **Push the engine repo** (has a remote); lifetown is local-only until the
   director provides its remote — commit it locally every time regardless.

## Decisions Made
- 2026-07-17 **Token economy, THIRD directive 00:05 "토큰 소모가 너무 심해... 천천히... 하나씩 제작".**
  Building look APPROVED. But the cadence must change. **The quality-loop workflow (200-540k each) is the
  cost driver.** For the remaining 6 buildings + village fill, DO NOT run a full workflow per building —
  the BuildingKit is proven + parameterized (CategoryPalette.Get + archetype params), so build them
  **one at a time via a LIGHTWEIGHT process**: a single `client-dev` Agent call reusing the kit → PM
  renders + runs gate.ps1 (cheap) → ONE `team-lead`(아트팀장) screenshot check → show director. That is
  ~2 substantive agents vs a workflow's 4-8 × multiple rounds. Reserve full workflows for genuinely
  risky/novel work, not proven-pattern repetition. Go slowly; one building per beat; report and pace.
- 2026-07-16 **Token economy — director directive 22:56 "토큰 많이 사용하지 말아줘".** Concrete levers,
  in priority order: (1) **Do NOT spawn `loop-scout` for an obvious single message** — the message is
  already in the notification; read and act inline. Reserve the scout for a genuinely full/ambiguous
  inbox. A scout tick is ~30k tokens; most director replies are one line. (2) **Cap workflow rounds** —
  pass a lower `maxRounds` where the answer is fairly determined; don't run 3 explore angles for a
  near-decided question. (3) **Tighter journal/Discord/commit prose.** (4) Verify only what matters
  (a wrong result is costlier than a light check, but don't re-verify everything). Workflows (200-500k
  each) and scout ticks are the big costs — spend them deliberately.
- 2026-07-16 **Visual deliverables get art-lead-gated BEFORE the director sees them** (director
  instruction 21:22: "아트팀장 기준 점수 넘기면 나에게 보여줘"). Round-1 mockups were sent to the
  director ungated — the director overruled that. Now: ui-ux produces → render to PNG → 아트팀장 scores
  A1-A5 ≥90 (it must SEE the render) → only then send to the director. Catches problems like "buildings
  don't read as buildings" before spending the director's attention. Applies to mockups too, not just
  the design system doc.
- 2026-07-16 **Roles restructured (director rules 6-8).** Every team is member + lead; the lead gates
  at **90** against that team's fixed rubric (`VISION.md` §3.2). App completion moved to a **5-expert
  playtest panel: avg ≥90 AND nobody <80** (§3.3). The floor matters more than the average —
  `95·94·92·90·79` averages to exactly 90, and that 79 is one expert saying something is badly broken.
  An average alone would ship it.
- 2026-07-16 **`evaluator` (95) and `judge` retired.** Superseded by team leads + the expert panel.
  `explore` proposals are now scored by that team's own lead against the same rubric, so **every
  deliverable is judged by one consistent standard** instead of an ad-hoc panel.
- 2026-07-16 **Leads/experts are 2 generic agents, not 10 files.** `team-lead` and `game-expert` receive
  their rubric/persona per call; the rubrics and the panel live in `VISION.md` §3.2/§3.3. The director
  tunes the bar by editing one file, and ten near-duplicate agent files cannot drift apart.
- 2026-07-16 **Agents do NOT talk over Discord.** The director allowed per-member bots but flagged the
  token cost. Rejected: agents already exchange structured data inside the workflow, and Discord
  chatter would refill the listener's 100-message window — re-creating the exact cursor bug fixed the
  same day, where the director's next brief stops being read. Discord is director ↔ PM only.
- 2026-07-16 **Director rules 1-5 adopted** (`VISION.md` §7): parent `.claude/settings.json` governs
  permissions; rtk always (hook already active); English except director reports; token-efficient;
  **Unity only**.
- 2026-07-16 **Gate 1 rewritten for Unity.** Flutter version deleted — the stack is fixed to Unity now.
  Compile is judged by **exit code AND an `error CS####` log scan**, because Unity batchmode can exit 0
  with compile errors. Verified: healthy project → exit 0; injected compile error → exit 1 with the
  exact file/line. It discriminates.
- 2026-07-16 **Unity editor version is matched to the project.** The gate refuses to open a project
  with a different editor version rather than silently upgrading it — a destructive side effect a gate
  must never cause.
- 2026-07-16 **Discord cursor bug fixed** (`le-daemon.ps1`): advance `$lastId` for every message
  *before* skipping our own. Original code let the bot's own sends never move the cursor, and
  `?after=<id>&limit=100` returns the OLDEST 100 after it — so a loop that reports more than the
  director replies would fill the window with its own reports and never read the next brief.
- 2026-07-16 **One implementer, many checkers.** Racing parallel implementers would need worktree
  isolation plus a merge step; for code the cost exceeds the benefit. The leverage is in the gates,
  not in competing builders. (ch.24 Tangled Loop only applies with parallel implementers.)
- 2026-07-16 **`explore` mode writes no files.** Design/spec work generates 3 proposals in parallel but
  returns them as text; the PM records the winner. No worktree needed, no conflicts.
- 2026-07-16 **Awaiting-approval never stops the team.** It stops that *task*; the loop moves to the
  next `ready` one. The single rule that lets an approval gate coexist with an autonomous loop.
- 2026-07-16 **Gate order.** Rubric scoring happens only after the mechanical gate is green. Broken
  builds are never scored — ch.29's Nodding Loop defense. (Superseded on bars only: it is now three
  gates, team lead at 90 and the expert panel at 90/floor-80. See the rules-6-8 entry above.)
- 2026-07-16 **The gates are real — proven, not asserted.** T001 scored 83 and was refused. Not
  "basically there", not nudged to 90. It was revised against the itemized deductions and passed at 93.
  If a future tick is tempted to soften a bar, this is the entry that says the bar works.

## Do Not Repeat
> ch.18: if a failed attempt is not written down, the next run repeats it.

- **Never `git add` from the home folder (`C:\Users\user`)** — it is a git repo, so `git add -A` there
  indexes the entire home directory. (2026-07-16: the first commit attempt hit exactly this.)
  Inside `loop_engine/` it is safe; that is its own repo now.
- **Do not call agents/skills in the same session that created them.** Claude Code registers
  `.claude/agents/` and `.claude/skills/` at session start; until a restart, calls fail with
  "Agent type not found". (Confirmed 2026-07-16; loaded fine after restart in Tick 1.)
- **A workflow whose `meta` fails to parse is INVISIBLE, not loudly broken.** It silently does not
  register, so `Workflow({name:'x'})` reports "not found. Available: deep-research, code-review" — which
  looks like `.claude/workflows/` isn't discoverable at all. It is. The real cause was the `meta` bug
  below. Once fixed, both workflows appeared by name immediately.
  **Diagnose "workflow not found" as a meta/parse error first**, not as a discovery limitation.
  (2026-07-16, Tick 3 — this nearly got written down as the wrong lesson.)
  `scriptPath` works either way and is what our docs use, since it fails loudly instead of silently.
- **The 7 category hex colors are NOT in Core yet.** T002 built only economy math (EconomyConfig,
  Settlement, …) — there is no `CategoryDef`/color ScriptableObject. `lifetown/docs/design/00-art-design-system.md`
  (T004) is the color source of truth; bake those hex into `CategoryDef.color` when the App layer builds
  that ScriptableObject. (Do not assume Core has colors — my T004 brief wrongly claimed it did; ui-ux
  caught it. 2026-07-16.)
- **build mode requires `rubric` too — not just explore.** Easy to forget because explore is where the
  rubric feels central; build refuses just as hard (`requires args.rubric`, 0 agents, 5ms). The
  client rubric is C1-C5 in `VISION.md` §3.2. (2026-07-16, T002 — one wasted launch.)
- **Pass `args` to Workflow as a real JSON OBJECT, not a JSON-encoded string.** A stringified object
  arrives as one string, so `args.brief` is undefined and the workflow dies instantly with 0 agents
  run. (2026-07-16, Tick 3 — cost one failed launch.)
- **A workflow's `meta` must be a PURE LITERAL.** Even `'a' + 'b'` string concatenation fails with
  "meta must be a pure literal: non-literal node type in meta: BinaryExpression". No variables, no
  template interpolation, no concatenation — every value a single literal. (2026-07-16, Tick 3: both
  workflows had multi-line concatenated `whenToUse` strings and neither would load.)
- **Do not trust Unity's batchmode exit code alone.** It can exit 0 with compile errors. Always also
  scan the editor log for `error CS####`. (This is why `gate/gate.ps1` checks both.)
- **Do not install Unity MCP without solving the project-lock conflict first.** Unity MCP needs a
  **running Editor**, and a running Editor **holds the project lock** — which is exactly what stops
  `gate/gate.ps1` from opening the project in batchmode. Naively turning MCP on makes Gate 1 fail every
  time. Decide the sequencing (e.g. QA gathers evidence via MCP with the Editor up, then the Editor
  closes before the gate runs) as part of creating the project — not after Gate 1 starts failing.
  (Found 2026-07-16 while researching; not yet hit because no project exists.)
- **`Start-Process -PassThru` gives an EMPTY `.ExitCode`** unless `$p.Handle` is touched before the
  process exits. (2026-07-16: made every Unity compile look inconclusive until fixed.)
- **Do not use `grep -P` in Git Bash** — this PC's locale fails with "grep: -P supports only unibyte
  and UTF-8 locales". Use node or `Select-String`.
- **Do not pass Git Bash paths (`/c/...`) to node as arguments** — node reads them as `C:\c\...` and
  throws ENOENT. `cd` first and use relative paths, or pass a Windows path.
- **wikidocs article bodies are not reachable via WebFetch (403).** Use `curl` with a browser
  User-Agent. The body is in the static HTML, in the ~12000 chars before `마지막 편집일시`.
- **Do not touch repos outside `loop_engine/`.** On 2026-07-16 the offer to fix app-dev-team's
  identical cursor bug was explicitly refused ("건드리지 마"). Do not propose it again. Problems found
  elsewhere get **recorded and left alone** (`VISION.md` §4).

---

## Rules for maintaining this file
- Keep only what the next tick needs to choose an action. Everything else goes to `state/journal.md`.
- **Never delete** `Do Not Repeat` or `Needs Human Review` entries (mark them resolved; leave them).
- Update every tick. A tick that did not update this file is a failed tick.
