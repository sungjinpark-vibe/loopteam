export const meta = {
  name: 'playtest',
  description: 'Gate 3 — five game experts playtest the build and score it; avg >= 90 with an 80 floor ends app development',
  whenToUse:
    'The app-completion gate (VISION.md 3.3). The PM runs this when a meaningful slice is playable — ' +
    'NOT after every task. QA drives the real build once, then five experts with different lenses score ' +
    'that evidence independently. Below the bar, the team fixes and it re-runs.',
  phases: [
    { title: 'Evidence' },
    { title: 'Panel' },
    { title: 'Fix' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// VISION.md 3.3. This is the gate that says the app is FINISHED.
//
// Pass = average >= 90 AND nobody below 80.
//
// The floor is the whole point. `95, 94, 92, 90, 79` averages to exactly 90 —
// but that 79 is one expert saying something is badly wrong, and an average
// would ship it. The floor does not. A killer finding must not be outvoted by
// four generous scores.
//
// HONEST LIMIT (do not let this drift): these experts are LLM agents. They
// cannot play a game or feel fun. QA drives the REAL build and records observed
// facts; the experts score that evidence through their lenses. Better than one
// grader guessing from code — but never report it to the director as a human
// playtest.
// ─────────────────────────────────────────────────────────────────────────────

// ── args contract ────────────────────────────────────────────────────────────
//   appDir      string   absolute Unity project path. REQUIRED.
//   brief       string   what the game is meant to be — the director's intent
//   targetPlayer string  who this is for (VISION.md 2). REQUIRED — target-player scores against it.
//   flows       string   the flows QA must drive (from the spec)
//   experts     array    [{ id, name, lens, catches }] — from VISION.md 3.3. REQUIRED.
//   rubric      array    [{ id, name, max }] — from VISION.md 3.3. REQUIRED.
//   passMark    number   default 90 (average)
//   floor       number   default 80 (no expert may be below this)
//   maxRounds   number   default 5
//   context     string   extra context

const a = args ?? {}
const APP_DIR = a.appDir
const BRIEF = a.brief ?? ''
const TARGET = a.targetPlayer ?? ''
const FLOWS = a.flows ?? ''
const EXPERTS = a.experts
const RUBRIC = a.rubric
const PASS_MARK = a.passMark ?? 90
const FLOOR = a.floor ?? 80
const MAX_ROUNDS = a.maxRounds ?? 5
const CONTEXT = a.context ? `\n\n## Context\n${a.context}` : ''

if (!APP_DIR) return { ok: false, error: 'playtest requires args.appDir (the Unity project to play)' }
if (!BRIEF) return { ok: false, error: "playtest requires args.brief (the director's intent to judge against)" }
// The target player is not optional: one whole expert scores "would the real
// target enjoy this", and without a concrete target that expert is guessing.
if (!TARGET) return { ok: false, error: 'playtest requires args.targetPlayer — VISION.md 2. The target-player expert cannot score against a blank.' }
if (!Array.isArray(EXPERTS) || EXPERTS.length === 0) return { ok: false, error: 'playtest requires args.experts — the panel from VISION.md 3.3' }
if (!Array.isArray(RUBRIC) || RUBRIC.length === 0) return { ok: false, error: 'playtest requires args.rubric — from VISION.md 3.3. Inventing one at grading time is not a gate.' }

const rubricText = RUBRIC.map((r) => `- [${r.id}] ${r.name} (max ${r.max})`).join('\n')
const rubricTotal = RUBRIC.reduce((s, r) => s + (r.max ?? 0), 0)
if (rubricTotal !== 100) log(`WARNING: rubric sums to ${rubricTotal}, not 100 — the ${PASS_MARK} bar may not mean what you think`)

const EVIDENCE_SCHEMA = {
  type: 'object',
  required: ['ran', 'observations'],
  properties: {
    ran: { type: 'boolean', description: 'true ONLY if you actually ran the build and played through it' },
    observations: {
      type: 'array',
      items: {
        type: 'object',
        required: ['step', 'observed'],
        properties: {
          step: { type: 'string', description: 'What you did' },
          observed: { type: 'string', description: 'What actually happened. Facts only.' },
          timingNote: { type: 'string', description: 'How long it took / where it stalled, if notable' },
        },
      },
    },
    firstThirtySeconds: { type: 'string', description: 'Blow-by-blow of the first 30s from a cold start — what a new player sees, in order' },
    screenshots: { type: 'array', items: { type: 'string' } },
    runtimeErrors: { type: 'array', items: { type: 'string' } },
    abuseResults: { type: 'array', items: { type: 'string' }, description: 'What happened under mashing, empty data, interruption, resume' },
    couldNotVerify: { type: 'array', items: { type: 'string' } },
  },
}

const EXPERT_SCHEMA = {
  type: 'object',
  required: ['score', 'perCriterion', 'deductions', 'topFix'],
  properties: {
    score: { type: 'number', description: 'Integer total 0-100' },
    verdict: { type: 'string', enum: ['pass', 'fail', 'cannot-score'] },
    perCriterion: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'awarded', 'max'],
        properties: { id: { type: 'string' }, awarded: { type: 'number' }, max: { type: 'number' }, note: { type: 'string' } },
      },
    },
    deductions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['criterion', 'what', 'where', 'points'],
        properties: { criterion: { type: 'string' }, what: { type: 'string' }, where: { type: 'string' }, points: { type: 'number' } },
      },
    },
    topFix: { type: 'string', description: 'The single change that most improves the game through YOUR lens' },
    unverified: { type: 'array', items: { type: 'string' }, description: 'What your lens needed that the evidence did not cover' },
    cannotScoreReason: { type: 'string' },
  },
}

let round = 0
const roundHistory = []
let fixNotes = null

while (round < MAX_ROUNDS) {
  round++

  // ── 1. QA drives the real build, once, for the whole panel ──────────────
  // One evidence pass feeds all five experts. Five agents each launching Unity
  // would be five times the cost for the same facts.
  phase('Evidence')
  log(`Playtest round ${round}/${MAX_ROUNDS}: QA driving the build`)

  const evidence = await agent(
    `Play through the actual build and report ONLY what you observe. Five experts will score your
evidence — they cannot run anything themselves, so what you miss, they cannot judge.

## Project
${APP_DIR}

## What the game is meant to be
${BRIEF}${CONTEXT}

## Target player
${TARGET}

## Flows to drive
${FLOWS || '(none specified — drive the core loop from a cold start through a full cycle)'}

## Your job
1. Run the real build (Unity — PlayMode or a player build; whichever a player would actually get).
2. **Start cold, like a brand new player.** Record the first 30 seconds blow-by-blow: what appears, in
   what order, what is explained, what is not. The UX expert lives on this.
3. Drive the core loop end to end, at least one full cycle. Note where it stalls or drags.
4. **Abuse it**: mash buttons, empty/zero data, interrupt mid-action, quit and resume. Record what happens.
5. Capture screenshots at every meaningful state. Report absolute paths.
6. Watch the logs. Report errors even if the screen looked fine.
7. Anything you could not exercise — say so and why. Do NOT quietly skip it.

Report **facts, not verdicts**. "보상 팝업이 3초 뒤 표시됨" is a fact. "보상이 만족스럽다" is a
verdict — that is the panel's job, not yours. Set ran:false if you could not run it at all.`,
    { label: `evidence r${round}`, phase: 'Evidence', agentType: 'qa', schema: EVIDENCE_SCHEMA },
  )

  if (!evidence || !evidence.ran) {
    // Cannot play it = cannot pass it. Never let this look inconclusive.
    log(`Round ${round}: could not run the build — cannot playtest`)
    return {
      ok: false, escalate: true, rounds: round,
      reason: 'The build could not be run, so the panel could not score it.',
      outstanding: evidence?.couldNotVerify?.join('; ') || 'run failed',
      history: roundHistory,
    }
  }

  const evidenceText = [
    `### First 30 seconds (cold start)\n${evidence.firstThirtySeconds || '(not recorded)'}`,
    `### Step-by-step\n${evidence.observations.map((o) => `- ${o.step}\n  observed: ${o.observed}${o.timingNote ? `\n  timing: ${o.timingNote}` : ''}`).join('\n')}`,
    evidence.abuseResults?.length ? `### Under abuse\n${evidence.abuseResults.map((s) => `- ${s}`).join('\n')}` : '',
    evidence.runtimeErrors?.length ? `### Runtime errors\n${evidence.runtimeErrors.map((s) => `- ${s}`).join('\n')}` : '',
    evidence.screenshots?.length ? `### Screenshots\n${evidence.screenshots.map((s) => `- ${s}`).join('\n')}` : '',
    evidence.couldNotVerify?.length ? `### Could NOT verify\n${evidence.couldNotVerify.map((s) => `- ${s}`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n')

  // ── 2. The panel scores, independently and in parallel ──────────────────
  // Barrier is correct: the pass rule is computed across ALL five scores, so
  // every one must be in before the verdict exists.
  phase('Panel')
  const results = (
    await parallel(
      EXPERTS.map((ex) => () =>
        agent(
          `You are the **${ex.name}** on a five-expert playtest panel.

## YOUR LENS (commit to it — the other four cover the rest)
${ex.lens}

You are here specifically to catch: ${ex.catches}

## What the game is meant to be
${BRIEF}${CONTEXT}

## Target player
${TARGET}

## Rubric (FIXED — score ALL five, but weight your own lens hardest and say so)
${rubricText}

## Evidence — QA drove the real build. This is your ONLY basis.
${evidenceText}

## Rules
- You did not play this. Score the evidence. Never claim an experience you did not have.
- If the evidence does not cover something your lens needs, put it in \`unverified\` and DEDUCT.
  Do not imagine it. "Could not verify" is never "passed".
- Every deduction needs what / where-in-the-evidence / points. Cannot point at it → drop it.
- **Do not soften to be a team player.** The panel passes only if the average is ≥ ${PASS_MARK} AND
  nobody is below ${FLOOR}. That floor exists so one honest low score can stop a release four generous
  scores would wave through. If it is bad, say how bad.
- Equally: do not manufacture severity. A deduction needs a real, observed basis.
- No credit for effort or ambition. A brave idea implemented badly is implemented badly.
- topFix = the single change that most improves the game **through your lens**.`,
          { label: `expert:${ex.id} r${round}`, phase: 'Panel', agentType: 'game-expert', schema: EXPERT_SCHEMA },
        ).then((v) => (v ? { expert: ex.id, name: ex.name, ...v } : null)),
      ),
    )
  ).filter(Boolean)

  if (results.length < EXPERTS.length) {
    // A missing expert is a missing veto. Never compute a pass from a partial panel.
    log(`Round ${round}: only ${results.length}/${EXPERTS.length} experts reported — cannot compute the panel verdict`)
    return {
      ok: false, escalate: true, rounds: round,
      reason: `Panel incomplete: ${results.length}/${EXPERTS.length} experts reported. A missing expert is a missing veto — refusing to score.`,
      partial: results.map((r) => ({ expert: r.expert, score: r.score })),
      history: roundHistory,
    }
  }

  const refused = results.filter((r) => r.verdict === 'cannot-score')
  if (refused.length > 0) {
    return {
      ok: false, escalate: true, rounds: round,
      reason: `Expert(s) refused to score: ${refused.map((r) => `${r.name} (${r.cannotScoreReason})`).join('; ')}`,
      outstanding: 'The rubric or panel in VISION.md 3.3 needs the director.',
      history: roundHistory,
    }
  }

  const total = results.reduce((s, r) => s + (r.score ?? 0), 0)
  const avg = Math.round((total / results.length) * 10) / 10
  const lowest = results.reduce((m, r) => (r.score < m.score ? r : m), results[0])
  const belowFloor = results.filter((r) => (r.score ?? 0) < FLOOR)

  roundHistory.push({
    round, avg, lowest: { expert: lowest.expert, score: lowest.score },
    scores: results.map((r) => ({ expert: r.expert, score: r.score })),
  })

  const scoreLine = results.map((r) => `${r.name} ${r.score}`).join(' · ')
  log(`Round ${round}: ${scoreLine} → avg ${avg}, lowest ${lowest.score} (${lowest.name})`)

  // ── PASS RULE: average AND floor. Both. ─────────────────────────────────
  if (avg >= PASS_MARK && belowFloor.length === 0) {
    log(`PLAYTEST PASSED — avg ${avg} >= ${PASS_MARK}, nobody below ${FLOOR}. App development can end.`)
    return {
      ok: true,
      rounds: round,
      avg,
      passMark: PASS_MARK,
      floor: FLOOR,
      experts: results.map((r) => ({
        expert: r.expert, name: r.name, score: r.score,
        perCriterion: r.perCriterion, topFix: r.topFix,
      })),
      evidence: { screenshots: evidence.screenshots, firstThirtySeconds: evidence.firstThirtySeconds },
      history: roundHistory,
    }
  }

  const why = belowFloor.length > 0
    ? `${belowFloor.map((r) => `${r.name} scored ${r.score}`).join(', ')} — below the ${FLOOR} floor. A single expert this low blocks release regardless of the average (avg was ${avg}).`
    : `average ${avg} is below ${PASS_MARK}.`
  log(`Round ${round}: NOT passed — ${why}`)

  // ── NO-PROGRESS BRAKE ───────────────────────────────────────────────────
  if (roundHistory.length >= 3) {
    const [x, y, z] = roundHistory.slice(-3).map((h) => h.avg)
    if (Math.abs(y - x) <= 2 && Math.abs(z - y) <= 2) {
      log(`No progress across 3 rounds (${x} -> ${y} -> ${z}) — handing to the director`)
      return {
        ok: false, escalate: true, rounds: round, avg,
        reason: `No progress: panel average flat within ±2 across 3 rounds (${x} -> ${y} -> ${z}).`,
        experts: results.map((r) => ({ expert: r.expert, name: r.name, score: r.score, topFix: r.topFix })),
        outstanding: results.flatMap((r) => (r.deductions ?? []).map((d) => `[${r.name}/${d.criterion}] ${d.what} (@ ${d.where}, -${d.points})`)).join('\n'),
        history: roundHistory,
      }
    }
  }

  // ── Fix round: hand every expert's deductions back to the client team ───
  phase('Fix')
  fixNotes = results
    .map((r) => `### ${r.name} — ${r.score}/100\n` +
      (r.deductions ?? []).map((d) => `- [${d.criterion}] ${d.what}\n  observed: ${d.where}  (-${d.points})`).join('\n') +
      `\n  TOP FIX: ${r.topFix}` +
      ((r.unverified ?? []).length ? `\n  UNVERIFIED (QA must capture next round): ${r.unverified.join('; ')}` : ''))
    .join('\n\n')

  const fixed = await agent(
    `The five-expert playtest panel did NOT pass this build. Fix it.

## What the game is meant to be
${BRIEF}${CONTEXT}

## Panel verdict (round ${round})
${why}

## Every expert's findings
${fixNotes}

## Your job
Fix these. **Start with whatever the lowest-scoring expert flagged** — the panel cannot pass while
anyone is below ${FLOOR}, no matter how good the average looks.

The panel scored observed behavior from a real run, not your code and not your reasoning. Do not
re-litigate; fix. If a finding is genuinely wrong, show evidence from an actual run.

Work in English. Make sure it still compiles and runs before you finish.`,
    { label: `fix r${round}`, phase: 'Fix', agentType: 'client-dev', schema: {
      type: 'object',
      required: ['summary', 'filesTouched'],
      properties: {
        summary: { type: 'string' },
        filesTouched: { type: 'array', items: { type: 'string' } },
        notFixed: { type: 'array', items: { type: 'string' }, description: 'Findings you could not address, and why' },
      },
    } },
  )

  if (!fixed) {
    return {
      ok: false, escalate: true, rounds: round, avg,
      reason: 'The fix round failed to run.',
      experts: results.map((r) => ({ expert: r.expert, name: r.name, score: r.score })),
      outstanding: fixNotes,
      history: roundHistory,
    }
  }
  log(`Round ${round}: fixes applied — ${(fixed.filesTouched ?? []).length} files. Re-playtesting.`)
}

// ── FAILURE BRAKE ───────────────────────────────────────────────────────────
// Never report an unpassed playtest as done.
const last = roundHistory[roundHistory.length - 1]
log(`Playtest hit the ${MAX_ROUNDS}-round limit without passing — handing to the director`)
return {
  ok: false,
  escalate: true,
  rounds: round,
  avg: last?.avg ?? null,
  reason: `Hit the ${MAX_ROUNDS}-round playtest limit without clearing avg ${PASS_MARK} / floor ${FLOOR}.`,
  outstanding: fixNotes,
  history: roundHistory,
}
