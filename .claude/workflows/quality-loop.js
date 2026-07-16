// NOTE: `meta` must be a PURE LITERAL. No string concatenation, no variables,
// no template interpolation — the loader parses it statically and rejects even
// `'a' + 'b'` (a BinaryExpression). Keep every value a single literal.
export const meta = {
  name: 'quality-loop',
  description: 'Run one task until it clears Gate 1 (mechanical) and Gate 2 (team lead, 90 points)',
  whenToUse: 'The inner loop of the loop engine. The PM calls this for a single backlog task. mode:"build" = implement -> mechanical gate -> evidence -> team lead scores 90 -> revise. mode:"explore" = N proposals from different angles -> the team lead scores them all -> winner. The app-completion gate (5 expert playtest) is a separate workflow: playtest.',
  phases: [
    { title: 'Implement' },
    { title: 'Gate' },
    { title: 'Evidence' },
    { title: 'Lead Review' },
    { title: 'Explore' },
    { title: 'Revise' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// The contract lives in VISION.md. This file only ENFORCES it.
//
//   ch.12: verification must be able to fail; verification that always passes is decoration.
//   ch.14: the stop condition must live OUTSIDE the agent's claim.
//   ch.26: the one who builds never grades.
//   ch.29: a loop stops on a signal, not an opinion.
//
// A task is done ONLY when both gates pass, in this order:
//   Gate 1  mechanical  — gate/gate.ps1 returns 0. No LLM. Runs FIRST.
//   Gate 2  team lead   — the team's own lead scores >= 90 against a PRE-WRITTEN
//                         rubric (VISION.md 3.2), seeing the deliverable and the
//                         rubric but NOT the member's reasoning.
//
// A broken build is never scored. That is the easiest way to fool a grader and
// the shortest road back to a Nodding Loop.
// ─────────────────────────────────────────────────────────────────────────────

// ── args contract (passed by the PM) ─────────────────────────────────────────
//   title      string   short task name
//   brief      string   the task brief: what to do + acceptance criteria
//   mode       string   'build' (default) | 'explore'
//   agent      string   the team MEMBER who produces: planner|ui-ux|server-dev|client-dev|qa
//   team       string   human label for the lead, e.g. '클라이언트팀장' (used in prompts/labels)
//   rubric     array    [{ id, name, max, checks }] — from VISION.md 3.2. REQUIRED.
//   appDir     string   absolute Unity project path. REQUIRED for build mode.
//   passMark   number   default 90 (VISION.md 3.2)
//   maxRounds  number   default 5
//   angles     string[] explore mode: the distinct angles to attempt from
//   context    string   extra context (file paths, spec excerpts)

// `args` arrives as a JSON STRING in this environment, not an object — verified
// 2026-07-16 with both a large and a minimal payload; both landed as strings and
// died on `args.brief` being undefined before a single agent ran. The tool docs
// say to pass an object; the runtime disagrees. Accept either rather than
// depending on which one is true today.
function coerceArgs(x) {
  if (typeof x === 'string') {
    try { return JSON.parse(x) } catch (e) { return { __parseError: e.message, __raw: x } }
  }
  return x ?? {}
}
const a = coerceArgs(args)
if (a.__parseError) return { ok: false, error: `args was a string but not valid JSON: ${a.__parseError}` }

const MODE = a.mode ?? 'build'
const TITLE = a.title ?? 'untitled task'
const BRIEF = a.brief ?? ''
const CONTEXT = a.context ? `\n\n## Context\n${a.context}` : ''
const MAX_ROUNDS = a.maxRounds ?? 5
const PASS_MARK = a.passMark ?? 90
const TEAM = a.team ?? 'team lead'
const RUBRIC = a.rubric

if (!BRIEF) return { ok: false, error: 'quality-loop requires args.brief (task brief + acceptance criteria)' }

// The rubric must be PRE-WRITTEN (VISION.md 3.2). A rubric invented during
// grading bends to fit the result, which makes it not a gate. Refuse instead.
if (!Array.isArray(RUBRIC) || RUBRIC.length === 0) {
  return {
    ok: false,
    error:
      'quality-loop requires args.rubric — the team rubric from VISION.md 3.2. ' +
      'Inventing one at grading time is not a gate.',
  }
}
const RUBRIC_TOTAL = RUBRIC.reduce((s, r) => s + (r.max ?? 0), 0)
if (RUBRIC_TOTAL !== 100) {
  log(`WARNING: rubric weights sum to ${RUBRIC_TOTAL}, not 100 — pass mark ${PASS_MARK} may not mean what you think`)
}
const rubricText = RUBRIC.map((r) => `- [${r.id}] ${r.name} (max ${r.max}) — examines: ${r.checks ?? '(unspecified)'}`).join('\n')

// ── Schemas ──────────────────────────────────────────────────────────────────
const IMPL_SCHEMA = {
  type: 'object',
  required: ['summary', 'filesTouched', 'howToVerify'],
  properties: {
    summary: { type: 'string', description: 'What you produced and the key decisions' },
    filesTouched: { type: 'array', items: { type: 'string' } },
    howToVerify: { type: 'string', description: 'Exact steps to exercise the changed behavior' },
    blockers: { type: 'array', items: { type: 'string' } },
  },
}

const GATE_SCHEMA = {
  type: 'object',
  required: ['pass', 'checks', 'failed'],
  properties: {
    pass: { type: 'boolean', description: 'true ONLY if the gate script exited 0' },
    exitCode: { type: 'number' },
    checks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'pass', 'detail'],
        properties: { name: { type: 'string' }, pass: { type: 'boolean' }, detail: { type: 'string' } },
      },
    },
    failed: { type: 'array', items: { type: 'string' } },
  },
}

const EVIDENCE_SCHEMA = {
  type: 'object',
  required: ['ran', 'observations'],
  properties: {
    ran: { type: 'boolean', description: 'true ONLY if you actually ran it and drove the flow' },
    observations: {
      type: 'array',
      items: {
        type: 'object',
        required: ['step', 'observed'],
        properties: {
          step: { type: 'string' },
          observed: { type: 'string', description: 'What actually happened. Facts only.' },
          matchedExpectation: { type: 'boolean' },
        },
      },
    },
    screenshots: { type: 'array', items: { type: 'string' } },
    runtimeErrors: { type: 'array', items: { type: 'string' } },
    couldNotVerify: { type: 'array', items: { type: 'string' } },
  },
}

const SCORE_SCHEMA = {
  type: 'object',
  required: ['score', 'verdict', 'perCriterion', 'deductions', 'topFix'],
  properties: {
    score: { type: 'number', description: 'Integer total 0-100' },
    verdict: { type: 'string', enum: ['pass', 'fail', 'cannot-score'] },
    perCriterion: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'awarded', 'max'],
        properties: {
          id: { type: 'string' }, name: { type: 'string' },
          awarded: { type: 'number' }, max: { type: 'number' }, note: { type: 'string' },
        },
      },
    },
    deductions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['criterion', 'what', 'where', 'points'],
        properties: {
          criterion: { type: 'string' },
          what: { type: 'string' },
          where: { type: 'string', description: 'Where you OBSERVED it' },
          points: { type: 'number' },
        },
      },
    },
    topFix: { type: 'string', description: 'The single change that moves the score most' },
    cannotScoreReason: { type: 'string' },
  },
}

// ═══ EXPLORE MODE ════════════════════════════════════════════════════════════
// For specs/design/architecture: wide solution space, output is a DOCUMENT.
// N proposals in parallel, then THAT TEAM'S LEAD scores them all against the
// same fixed rubric and picks a winner. One consistent standard for every
// deliverable — the lead is the gate here too.
//
// Safe to run in parallel because proposals come back as text: nobody writes
// files, so there is nothing to conflict over (no worktree needed).
if (MODE === 'explore') {
  const ANGLES = a.angles ?? [
    'MVP-first: the smallest thing that delivers the core value, ruthlessly cutting scope',
    "User-first: optimize for the target player's motivation and delight, even at higher build cost",
    'Risk-first: assume this ships and is maintained for years — optimize against dead ends',
  ]

  phase('Explore')
  log(`Explore: ${ANGLES.length} proposals for "${TITLE}" (${a.agent ?? 'planner'})`)

  const proposals = (
    await parallel(
      ANGLES.map((angle, i) => () =>
        agent(
          `Produce a proposal for this task, argued from ONE specific angle.

## Task brief
${BRIEF}${CONTEXT}

## YOUR ANGLE (commit to it — do not hedge toward the middle)
${angle}

A proposal trying to be all angles at once is useless here; your lead needs distinct options to choose
between. Be concrete enough to implement from.

## How this will be judged
Your team lead scores every proposal against this fixed rubric, needing ${PASS_MARK}/100:
${rubricText}

IMPORTANT: Do NOT write any files. Return the proposal as markdown in your structured output.`,
          { label: `explore:${i + 1}`, phase: 'Explore', agentType: a.agent ?? 'planner', schema: {
            type: 'object',
            required: ['angle', 'proposal', 'tradeoffs'],
            properties: {
              angle: { type: 'string' },
              proposal: { type: 'string', description: 'Full proposal in markdown, ready to become a doc' },
              tradeoffs: { type: 'string', description: 'What this approach gives up' },
            },
          } },
        ),
      ),
    )
  ).filter(Boolean)

  if (proposals.length === 0) return { ok: false, mode: 'explore', error: 'all explorers failed' }

  // Barrier is correct: the lead scores COMPARATIVELY and needs the whole set.
  phase('Lead Review')
  const verdict = await agent(
    `You are the ${TEAM}. Score ${proposals.length} competing proposals from your own team.

## Task brief
${BRIEF}${CONTEXT}

## Your rubric (FIXED — do not extend, reweight, or reinterpret)
${rubricText}

Pass mark: ${PASS_MARK}/100

## Proposals
${proposals.map((p, i) => `### Proposal ${i + 1} — angle: ${p.angle}\n${p.proposal}\n\nTrade-offs the author admits: ${p.tradeoffs}`).join('\n\n---\n\n')}

Score EVERY proposal against the rubric, independently. Be discriminating — if they all land on 88,
your scores are useless. Name the winner, and name the best idea from each loser worth grafting into
it. The winner still has to clear ${PASS_MARK}: a best-of-three that is still weak is not a pass.`,
    {
      label: 'lead:explore',
      phase: 'Lead Review',
      agentType: 'team-lead',
      schema: {
        type: 'object',
        required: ['scores', 'winnerIndex'],
        properties: {
          scores: {
            type: 'array',
            description: `One entry per proposal, in order (${proposals.length} total)`,
            items: SCORE_SCHEMA,
          },
          winnerIndex: { type: 'number', description: '0-based index of the best proposal' },
          grafts: {
            type: 'array', items: { type: 'string' },
            description: 'Best ideas from the losing proposals, worth folding into the winner',
          },
        },
      },
    },
  )

  if (!verdict) return { ok: false, mode: 'explore', error: 'team lead failed to report' }

  const wi = verdict.winnerIndex ?? 0
  const grafts = verdict.grafts ?? []
  let winner = proposals[wi]
  let scored = verdict.scores?.[wi] ?? { score: 0, deductions: [], topFix: '' }
  const scoreHistory = [scored.score ?? 0]
  let round = 1

  // ── REVISE LOOP ─────────────────────────────────────────────────────────
  // VISION.md §5 failure policy: "Gate 2 below 90 -> take the itemized
  // deductions, fix, re-score." That applies to documents too, and this loop
  // was missing (bug found 2026-07-16 when T001 scored 83 and gave up on the
  // spot, contradicting the contract). Build mode revised; explore did not.
  //
  // Revising the winner is far cheaper than three fresh proposals — the lead's
  // deductions are already a work order, and the losers' grafts are free.
  while ((scored.score ?? 0) < PASS_MARK && round < MAX_ROUNDS) {
    round++
    phase('Revise')
    log(`Explore round ${round}/${MAX_ROUNDS}: winner at ${scored.score}/${PASS_MARK} — revising`)

    const revised = await agent(
      `Your proposal won the panel but did NOT clear the bar. Revise it.

## Task brief
${BRIEF}${CONTEXT}

## Your proposal (the winner — keep its angle and its spine)
${winner.proposal}

## Your lead scored it ${scored.score}/${PASS_MARK}. Deductions:
${(scored.deductions ?? []).map((d, i) => `${i + 1}. [${d.criterion}] ${d.what}\n   observed at: ${d.where}\n   -${d.points}`).join('\n')}

## Highest-value fix (do this first — it moves the score most)
${scored.topFix}

## Best ideas from the proposals that lost — graft these in rather than reinventing
${grafts.length ? grafts.map((g) => `- ${g}`).join('\n') : '(none reported)'}

## Rules
- Fix every deduction. Do not re-litigate them — your lead scored the document, not your reasoning.
  If a finding is genuinely wrong, say so concretely with evidence from the source material.
- **Keep your angle.** You won on it. This is a revision, not a new proposal, and hedging toward the
  middle to dodge criticism will score worse, not better.
- Where a deduction says a decision belongs to the director, do not invent an answer — surface it
  properly instead (that is what P5 rewards).
- Return the FULL revised proposal, not a diff. Do NOT write any files.`,
      { label: `revise r${round}`, phase: 'Revise', agentType: a.agent ?? 'planner', schema: {
        type: 'object',
        required: ['angle', 'proposal', 'tradeoffs'],
        properties: {
          angle: { type: 'string' },
          proposal: { type: 'string', description: 'The FULL revised proposal in markdown' },
          tradeoffs: { type: 'string' },
        },
      } },
    )
    if (!revised) { log(`Round ${round}: reviser failed — stopping`); break }
    winner = revised

    phase('Lead Review')
    const v2 = await agent(
      `You are the ${TEAM}. You scored this proposal ${scored.score}/${PASS_MARK} last round and sent it
back. It has been revised. Score the REVISED version.

## Task brief
${BRIEF}${CONTEXT}

## Your rubric (FIXED — same as last round; do not extend, reweight, or reinterpret)
${rubricText}

Pass mark: ${PASS_MARK}/100

## What you flagged last round
${(scored.deductions ?? []).map((d, i) => `${i + 1}. [${d.criterion}] ${d.what} (@ ${d.where}, -${d.points})`).join('\n')}

## The revised proposal
${revised.proposal}

## Rules
- Score the document in front of you, from scratch, against the rubric. Do not award points for
  "effort" or for having responded to you.
- Check whether your findings were actually fixed — or merely acknowledged in prose. A deduction that
  is discussed but not resolved is still a deduction.
- Do not invent NEW objections at the same weight just to keep the score down; but if the revision
  broke something that previously worked, say so.
- ${PASS_MARK} or above passes. ${PASS_MARK - 1} does not. Do not nudge it up because it improved.`,
      { label: `lead r${round}`, phase: 'Lead Review', agentType: 'team-lead', schema: SCORE_SCHEMA },
    )
    if (!v2) { log(`Round ${round}: lead failed to report — stopping`); break }
    scored = v2
    scoreHistory.push(v2.score ?? 0)

    if (v2.verdict === 'cannot-score') {
      return {
        ok: false, mode: 'explore', title: TITLE, escalate: true, rounds: round,
        reason: `Cannot score: ${v2.cannotScoreReason}`,
        outstanding: 'The rubric does not fit this task. VISION.md §3.2 needs the director.',
        score: scored.score, scoreHistory,
      }
    }

    // No-progress brake (VISION.md §3.4)
    if (scoreHistory.length >= 3) {
      const [x, y, z] = scoreHistory.slice(-3)
      if (Math.abs(y - x) <= 2 && Math.abs(z - y) <= 2) {
        log(`No progress: ${x} -> ${y} -> ${z}. Stopping; a human has to look.`)
        return {
          ok: false, mode: 'explore', title: TITLE, escalate: true, rounds: round,
          reason: `No progress: 3 rounds within ±2 (${scoreHistory.join(' -> ')}). More rounds will not help.`,
          score: scored.score, scoreHistory,
          outstanding: (scored.deductions ?? []).map((d, i) => `${i + 1}. [${d.criterion}] ${d.what} (@ ${d.where}, -${d.points})`).join('\n'),
          topFix: scored.topFix,
          winner: { angle: winner.angle, proposal: winner.proposal },
        }
      }
    }
  }

  const winnerScore = scored.score ?? 0

  if (winnerScore < PASS_MARK) {
    log(`Explore: still ${winnerScore}/${PASS_MARK} after ${round} round(s) — escalating`)
    return {
      ok: false, mode: 'explore', title: TITLE, escalate: true, rounds: round,
      reason: `Best proposal scored ${winnerScore} after ${round} round(s), below the ${PASS_MARK} bar`,
      score: winnerScore, scoreHistory,
      outstanding: (scored.deductions ?? []).map((d, i) => `${i + 1}. [${d.criterion}] ${d.what} (@ ${d.where}, -${d.points})`).join('\n'),
      topFix: scored.topFix,
      winner: { angle: winner?.angle, proposal: winner?.proposal },
    }
  }

  log(`Explore: winner cleared the bar at ${winnerScore}/100 after ${round} round(s)`)
  return {
    ok: true,
    mode: 'explore',
    title: TITLE,
    rounds: round,
    score: winnerScore,
    scoreHistory,
    winner: { angle: winner.angle, proposal: winner.proposal, tradeoffs: winner.tradeoffs },
    // `scored`, not verdict.scores[wi] — after a revise round the first-round
    // scoring is stale, and reporting it would misdescribe what passed.
    perCriterion: scored.perCriterion,
    // Runners-up matter: graft their best ideas rather than discarding them.
    grafts,
    // Round-1 ranking of the original three angles — how the winner was chosen.
    ranking: (verdict.scores ?? []).map((s, i) => ({ proposal: i + 1, angle: proposals[i]?.angle, score: s.score })),
  }
}

// ═══ BUILD MODE ══════════════════════════════════════════════════════════════
const APP_DIR = a.appDir
if (!APP_DIR) return { ok: false, mode: 'build', error: 'build mode requires args.appDir (the Unity project to gate)' }

function implementPrompt(round, feedback) {
  if (round === 1) {
    return `Implement this task end to end.

## Task brief
${BRIEF}${CONTEXT}

## How this will be judged (no surprises — know it up front)
1. A mechanical gate runs first: Unity compile (zero \`error CS####\`) and EditMode tests.
   **If it fails, your work is not even scored.**
2. Then QA drives the real build, and your team lead (${TEAM}) scores what was OBSERVED against this
   fixed rubric, needing ${PASS_MARK}/100:
${rubricText}

Your lead will not read your explanation and will not grade intent — only the artifact and the
evidence. So: finish the flow, remove placeholders, and make sure it actually runs.

Work in English (code, comments, report). Follow the repo's existing conventions and read the relevant
spec/design docs first. Verify it compiles and runs before reporting.`
  }
  return `Your previous attempt did not pass. Fix it.

## Task brief
${BRIEF}${CONTEXT}

## What blocked it (round ${round - 1})
${feedback}

## The rubric you must clear (${PASS_MARK}/100)
${rubricText}

Fix every item above, starting with the named top fix — it moves the score most. Do not re-litigate the
findings: the gate is mechanical and your lead scored observed behavior. If a finding is genuinely
wrong, show evidence from the code or a run, not reasoning. Then re-verify the WHOLE task.`
}

let feedback = null
let round = 0
let lastImpl = null
const history = []
const scores = []

while (round < MAX_ROUNDS) {
  round++

  // ── 1. Member implements / revises ───────────────────────────────────────
  phase('Implement')
  log(`Round ${round}/${MAX_ROUNDS}: ${round === 1 ? 'implementing' : 'revising'} "${TITLE}"`)

  const impl = await agent(implementPrompt(round, feedback), {
    label: `${round === 1 ? 'implement' : 'revise'} r${round}`,
    phase: 'Implement',
    agentType: a.agent ?? 'client-dev',
    schema: IMPL_SCHEMA,
  })
  if (!impl) return { ok: false, mode: 'build', title: TITLE, rounds: round, error: 'member failed or was skipped', history }
  lastImpl = impl

  // ── 2. Gate 1: mechanical ────────────────────────────────────────────────
  phase('Gate')
  const gate = await agent(
    `Run the mechanical gate. Do not fix anything. Do not run it twice.

Command (run exactly this):
  powershell -NoProfile -File "C:\\Users\\user\\loop_engine\\gate\\gate.ps1" -AppDir "${APP_DIR}" -JsonOut "C:\\Users\\user\\loop_engine\\state\\gate-result.json"

Then read C:\\Users\\user\\loop_engine\\state\\gate-result.json and report its contents verbatim, plus
the exit code. pass = (exit code was 0). Copy the detail strings as-is.`,
    // gate-runner is a thin wrapper (run gate.ps1, report its JSON verbatim) — no reasoning needed,
    // so a cheap model handles it fine. Token-economy directive 2026-07-16. The grading agents
    // (team-lead) stay on the strong session model — they must be sharp.
    { label: `gate r${round}`, phase: 'Gate', agentType: 'gate-runner', model: 'haiku', schema: GATE_SCHEMA },
  )

  if (!gate || !gate.pass) {
    const failed = gate?.failed?.length ? gate.failed.join(', ') : 'gate did not report'
    const detail = gate?.checks?.filter((c) => !c.pass).map((c) => `- [${c.name}] ${c.detail}`).join('\n') || '(no detail)'
    log(`Round ${round}: Gate 1 FAIL (${failed}) — not scoring a broken build`)
    history.push({ round, stage: 'gate', pass: false, failed: gate?.failed ?? [] })
    feedback = `Gate 1 (mechanical) FAILED — your work was not even scored. Fix these first:\n${detail}\n\n` +
      `This is a command exit code, not an opinion. Do not write it off as an environment problem.`
    continue // straight back to implement — no evidence, no scoring
  }
  log(`Round ${round}: Gate 1 PASS — ${gate.checks.length} checks green`)

  // ── 3. Evidence: QA drives it and reports FACTS ──────────────────────────
  // The lead scores observed behavior, not code and not claims. Someone has to
  // go look, and it is not the member who built it.
  phase('Evidence')
  const evidence = await agent(
    `Drive the game and report ONLY what you observe. You are gathering evidence for a grader — you are
not the grader. Do not score, do not judge, do not fix.

## Project
${APP_DIR}

## The task that was implemented
${BRIEF}${CONTEXT}

## Steps the member says will exercise it
${impl.howToVerify}

## Your job
1. Run it. Unity is the stack — drive it via PlayMode/EditMode or a player build, whichever actually
   exercises this flow. The mechanical gate already proved it compiles; prove it BEHAVES.
2. Drive the flow above, step by step.
3. For each step record: what you did, and what ACTUALLY happened on screen.
4. Capture screenshots of changed screens. Report absolute paths.
5. Watch the logs. Report errors/exceptions even if the screen looked fine.
6. Anything you could not exercise — say so and why. Do NOT quietly skip it.

Report facts, not verdicts. "진행바가 0%로 표시됨" is a fact. "진행바가 잘못됨" is a verdict — not
yours to make. Set ran:false if you could not run it at all.`,
    { label: `evidence r${round}`, phase: 'Evidence', agentType: 'qa', schema: EVIDENCE_SCHEMA },
  )

  if (!evidence || !evidence.ran) {
    log(`Round ${round}: could not run it — treating as a gate failure, not scoring`)
    history.push({ round, stage: 'evidence', pass: false })
    feedback = `The build could not actually be run: ${evidence?.couldNotVerify?.join('; ') || 'run failed'}\n` +
      `Compiling is not done. Make it runnable.`
    continue
  }

  // ── 4. Gate 2: the team lead scores ─────────────────────────────────────
  // The lead sees the rubric and the evidence. It does NOT see the member's
  // summary or reasoning — that is exactly what would make a lead generous.
  phase('Lead Review')
  const evidenceText =
    evidence.observations.map((o) => `- ${o.step}\n  observed: ${o.observed}${o.matchedExpectation === false ? '  [DID NOT MATCH EXPECTATION]' : ''}`).join('\n') +
    (evidence.runtimeErrors?.length ? `\n\nRuntime errors:\n${evidence.runtimeErrors.map((e) => `- ${e}`).join('\n')}` : '') +
    (evidence.screenshots?.length ? `\n\nScreenshots:\n${evidence.screenshots.map((s) => `- ${s}`).join('\n')}` : '') +
    (evidence.couldNotVerify?.length ? `\n\nCould NOT verify:\n${evidence.couldNotVerify.map((s) => `- ${s}`).join('\n')}` : '')

  const scored = await agent(
    `You are the ${TEAM}. Score your team member's work against your rubric.

## The brief it was built from
${BRIEF}${CONTEXT}

## Your rubric (FIXED — do not extend, reweight, or reinterpret)
${rubricText}

Pass mark: ${PASS_MARK}/100

## Evidence — QA drove the real build and observed this. It is your only basis.
${evidenceText}

## Files the member touched (you may read them)
${(impl.filesTouched ?? []).map((f) => `- ${f}`).join('\n') || '(none reported)'}

## Rules
- Score observed behavior. You were deliberately NOT given the member's explanation. That is the point.
- Each criterion starts at full marks; deduct only for gaps you can point at.
- A deduction you cannot point at is not a deduction. Drop it.
- "Could not verify" is not "passed" — credit only what the evidence supports, and deduct for the rest.
- ${PASS_MARK} or above passes. ${PASS_MARK - 1} does not. Do not nudge it up because it is "basically
  there" — that is the Ralph Wiggum loop wearing a number.
- If the rubric does not fit this work, return verdict:'cannot-score' with the reason. Do not force it.
- topFix = the change that moves the score MOST, not the easiest one.`,
    { label: `lead r${round}`, phase: 'Lead Review', agentType: 'team-lead', schema: SCORE_SCHEMA },
  )

  if (!scored) {
    log(`Round ${round}: lead failed to report — NOT treating as pass`)
    history.push({ round, stage: 'lead', pass: false })
    feedback = 'The team lead failed to report. Re-verify your own work and report honestly.'
    continue
  }

  const score = scored.score ?? 0
  scores.push(score)
  history.push({ round, stage: 'lead', score, verdict: scored.verdict, deductions: scored.deductions })

  if (scored.verdict === 'cannot-score') {
    log(`Round ${round}: lead refused to score — ${scored.cannotScoreReason}`)
    return {
      ok: false, mode: 'build', title: TITLE, rounds: round, escalate: true,
      reason: `Cannot score: ${scored.cannotScoreReason}`,
      outstanding: `The rubric does not fit this task. VISION.md 3.2 needs the director's attention.`,
      summary: impl.summary, filesTouched: impl.filesTouched, history,
    }
  }

  // ── SUCCESS BRAKE (ch.14) ────────────────────────────────────────────────
  if (score >= PASS_MARK) {
    log(`Round ${round}: PASSED — Gate 1 green, ${TEAM} scored ${score}/100 (>= ${PASS_MARK})`)
    return {
      ok: true, mode: 'build', title: TITLE, rounds: round,
      score, scoreHistory: scores,
      gate: { checks: gate.checks },
      perCriterion: scored.perCriterion,
      summary: impl.summary,
      filesTouched: impl.filesTouched,
      evidence: { observations: evidence.observations, screenshots: evidence.screenshots },
      blockers: impl.blockers ?? [],
      history,
    }
  }

  // ── NO-PROGRESS BRAKE (ch.14) ────────────────────────────────────────────
  if (scores.length >= 3) {
    const [x, y, z] = scores.slice(-3)
    if (Math.abs(y - x) <= 2 && Math.abs(z - y) <= 2) {
      log(`Round ${round}: no progress — ${x} -> ${y} -> ${z}. Stopping; a human has to look.`)
      return {
        ok: false, mode: 'build', title: TITLE, rounds: round, escalate: true,
        reason: `No progress: 3 rounds within ±2 (${scores.join(' -> ')}). More rounds will not help.`,
        score, scoreHistory: scores,
        outstanding: (scored.deductions ?? []).map((d, i) => `${i + 1}. [${d.criterion}] ${d.what} (@ ${d.where}, -${d.points})`).join('\n'),
        topFix: scored.topFix,
        summary: impl.summary, filesTouched: impl.filesTouched, history,
      }
    }
  }

  log(`Round ${round}: ${score}/100 — below ${PASS_MARK}, revising (topFix: ${scored.topFix})`)
  feedback =
    `${TEAM} scored ${score}/100 (bar: ${PASS_MARK}). Deductions:\n` +
    (scored.deductions ?? []).map((d, i) => `${i + 1}. [${d.criterion}] ${d.what}\n   observed at: ${d.where}\n   -${d.points}`).join('\n') +
    `\n\nHighest-value fix: ${scored.topFix}`
}

// ── FAILURE BRAKE (ch.14) ───────────────────────────────────────────────────
// Hard limit hit. Never report this as done — that is the exact failure the
// whole loop exists to prevent.
log(`Exhausted ${MAX_ROUNDS} rounds below ${PASS_MARK} — handing to the director`)
return {
  ok: false,
  mode: 'build',
  title: TITLE,
  rounds: round,
  escalate: true,
  reason: `Hit the ${MAX_ROUNDS}-round limit still below ${PASS_MARK}`,
  score: scores[scores.length - 1] ?? null,
  scoreHistory: scores,
  outstanding: feedback,
  summary: lastImpl?.summary ?? null,
  filesTouched: lastImpl?.filesTouched ?? [],
  history,
}
