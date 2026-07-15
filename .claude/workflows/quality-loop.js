export const meta = {
  name: 'quality-loop',
  description: 'Run one backlog task until it passes the two gates: mechanical signal, then a 95-point rubric',
  whenToUse:
    'The inner loop of the loop engine. The PM calls this for a single backlog task. ' +
    'mode:"build" = implement -> mechanical gate -> evidence -> 95-point rubric -> revise, until it passes. ' +
    'mode:"explore" = generate N independent proposals from different angles, judge them, return the winner.',
  phases: [
    { title: 'Implement' },
    { title: 'Gate' },
    { title: 'Evidence' },
    { title: 'Score' },
    { title: 'Explore' },
    { title: 'Judge' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// The loop's contract lives in VISION.md. This file only ENFORCES it.
//
//   12장: 검증은 실제로 실패할 수 있어야 한다. 늘 통과하는 검증은 장식이다.
//   14장: 멈춤 조건은 에이전트의 주장 "밖"에 있어야 한다.
//   29장: Loop는 의견이 아니라 신호를 기준으로 멈춰야 한다.
//
// So a task is done ONLY when both gates pass, in this order:
//   관문 1  mechanical  — gate/gate.ps1 returns 0. No LLM involved. Runs FIRST.
//   관문 2  rubric      — evaluator scores observable behavior >= 95 against a
//                         PRE-WRITTEN rubric, without seeing the implementer's reasoning.
//
// A broken build is never scored. Scoring a build that does not run is the
// easiest way to fool a grader, and the fastest route back to a Nodding Loop.
// ─────────────────────────────────────────────────────────────────────────────

// ── args contract (passed by the PM) ─────────────────────────────────────────
//   title      string   short task name, used for labels
//   brief      string   the task brief: what to do + acceptance criteria
//   mode       string   'build' (default) | 'explore'
//   agent      string   implementer: client-dev | server-dev | ui-ux | planner | qa
//   appDir     string   absolute path to the app folder (REQUIRED for build mode)
//   rubric     array    [{ id, name, max, checks }] — MUST be pre-written. build mode only.
//   passMark   number   rubric pass threshold (default 95)
//   maxRounds  number   hard limit (default 5, per VISION.md)
//   angles     string[] explore mode: the distinct angles to attempt from
//   context    string   extra context (file paths, spec excerpts)

const a = args ?? {}
const MODE = a.mode ?? 'build'
const TITLE = a.title ?? 'untitled task'
const BRIEF = a.brief ?? ''
const CONTEXT = a.context ? `\n\n## Context\n${a.context}` : ''
const MAX_ROUNDS = a.maxRounds ?? 5
const PASS_MARK = a.passMark ?? 95

if (!BRIEF) return { ok: false, error: 'quality-loop requires args.brief (the task brief + acceptance criteria)' }

// ── Schemas ──────────────────────────────────────────────────────────────────
const IMPL_SCHEMA = {
  type: 'object',
  required: ['summary', 'filesTouched', 'howToVerify'],
  properties: {
    summary: { type: 'string', description: 'What you implemented and the key decisions' },
    filesTouched: { type: 'array', items: { type: 'string' } },
    howToVerify: { type: 'string', description: 'Exact steps to drive the changed flow in the running app' },
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
    failed: { type: 'array', items: { type: 'string' }, description: 'Names of failed checks' },
  },
}

const EVIDENCE_SCHEMA = {
  type: 'object',
  required: ['ran', 'observations'],
  properties: {
    ran: { type: 'boolean', description: 'true ONLY if you actually launched the app and drove the flow' },
    observations: {
      type: 'array',
      description: 'What you SAW, per step. Facts only — no judgment, no scoring.',
      items: {
        type: 'object',
        required: ['step', 'observed'],
        properties: {
          step: { type: 'string', description: 'What you did' },
          observed: { type: 'string', description: 'What actually happened on screen' },
          matchedExpectation: { type: 'boolean' },
        },
      },
    },
    screenshots: { type: 'array', items: { type: 'string' }, description: 'Absolute paths to captured screenshots' },
    runtimeErrors: { type: 'array', items: { type: 'string' }, description: 'Errors/exceptions seen in logs while driving it' },
    couldNotVerify: { type: 'array', items: { type: 'string' }, description: 'Anything you could not exercise, and why' },
  },
}

const SCORE_SCHEMA = {
  type: 'object',
  required: ['score', 'verdict', 'perCriterion', 'deductions', 'topFix'],
  properties: {
    score: { type: 'number', description: 'Integer total 0-100' },
    verdict: { type: 'string', enum: ['pass', 'fail', 'cannot-score'], description: 'pass ONLY if score >= passMark' },
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
          what: { type: 'string', description: 'The specific gap' },
          where: { type: 'string', description: 'Where you OBSERVED it (screen/flow/log)' },
          points: { type: 'number' },
        },
      },
    },
    topFix: { type: 'string', description: 'The single highest-value fix — what moves the score most' },
    cannotScoreReason: { type: 'string' },
  },
}

const PROPOSAL_SCHEMA = {
  type: 'object',
  required: ['angle', 'proposal', 'tradeoffs'],
  properties: {
    angle: { type: 'string' },
    proposal: { type: 'string', description: 'Full proposal in markdown, ready to become a doc' },
    tradeoffs: { type: 'string' },
  },
}

// ═══ EXPLORE MODE ════════════════════════════════════════════════════════════
// For specs/design/architecture: wide solution space, output is a DOCUMENT.
// No mechanical gate applies (there is nothing to build yet), so the gate here
// is a comparative judge panel. Safe to run in parallel because proposals are
// returned as text — nobody writes files, so there is nothing to conflict over.
if (MODE === 'explore') {
  const ANGLES = a.angles ?? [
    'MVP-first: the smallest thing that delivers the core value, ruthlessly cutting scope',
    "User-first: optimize for the end user's motivation and delight, even at higher build cost",
    'Risk-first: assume this ships and is maintained for years — optimize against dead ends',
  ]

  phase('Explore')
  log(`Explore: ${ANGLES.length} independent proposals for "${TITLE}"`)

  const proposals = (
    await parallel(
      ANGLES.map((angle, i) => () =>
        agent(
          `Produce a proposal for this task, argued from ONE specific angle.

## Task brief
${BRIEF}${CONTEXT}

## YOUR ANGLE (commit to it — do not hedge toward the middle)
${angle}

A proposal that tries to be all three angles at once is useless here; the panel needs distinct options
to choose between. Be concrete enough to implement from.

IMPORTANT: Do NOT write any files. Return the proposal as markdown in your structured output.`,
          { label: `explore:${i + 1}`, phase: 'Explore', agentType: a.agent ?? 'planner', schema: PROPOSAL_SCHEMA },
        ),
      ),
    )
  ).filter(Boolean)

  if (proposals.length === 0) return { ok: false, mode: 'explore', error: 'all explorers failed' }

  // Barrier is correct: each judge scores the proposals COMPARATIVELY, so it needs the whole set.
  phase('Judge')
  const JUDGE_LENSES = [
    'feasibility: can a small team actually build this well, and is the estimate honest?',
    "user value: will the target user care, and does it serve the director's stated intent?",
    'durability: what does this cost in 6 months — coupling, rework, dead ends?',
  ]

  const scoreSets = (
    await parallel(
      JUDGE_LENSES.map((lens) => () =>
        agent(
          `You are judging ${proposals.length} competing proposals for the same task.

## Task brief
${BRIEF}${CONTEXT}

## YOUR LENS
${lens}

## Proposals
${proposals.map((p, i) => `### Proposal ${i + 1} — angle: ${p.angle}\n${p.proposal}\n\nTrade-offs the author admits: ${p.tradeoffs}`).join('\n\n---\n\n')}

Score EVERY proposal 1-10 on your lens ONLY. Return ${proposals.length} scores in proposal order.
Be discriminating — if they all get 8, your scores are useless and the panel has done nothing.`,
          {
            label: `judge:${lens.split(':')[0]}`,
            phase: 'Judge',
            agentType: 'judge',
            schema: {
              type: 'object',
              required: ['scores'],
              properties: {
                scores: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['score', 'reasoning', 'bestIdea'],
                    properties: {
                      score: { type: 'number' },
                      reasoning: { type: 'string' },
                      bestIdea: { type: 'string', description: 'Best idea here, worth grafting even if it loses' },
                    },
                  },
                },
              },
            },
          },
        ),
      ),
    )
  ).filter(Boolean)

  const totals = proposals.map((p, i) => {
    const got = scoreSets.map((s) => s.scores?.[i]).filter(Boolean)
    return { index: i, ...p, total: got.reduce((sum, s) => sum + (s.score ?? 0), 0), notes: got }
  })
  totals.sort((x, y) => y.total - x.total)
  const winner = totals[0]
  log(`Winner: proposal ${winner.index + 1} (${winner.angle.split(':')[0]}) — ${winner.total} points`)

  return {
    ok: true,
    mode: 'explore',
    title: TITLE,
    winner: { angle: winner.angle, proposal: winner.proposal, tradeoffs: winner.tradeoffs, total: winner.total },
    // Runners-up matter: graft their best ideas rather than discarding them.
    grafts: totals.slice(1).flatMap((t) => t.notes.map((n) => n.bestIdea).filter(Boolean)),
    ranking: totals.map((t) => ({ angle: t.angle, total: t.total })),
  }
}

// ═══ BUILD MODE ══════════════════════════════════════════════════════════════
const APP_DIR = a.appDir
const RUBRIC = a.rubric

// The rubric must be PRE-WRITTEN (VISION.md 3절). A rubric invented during
// grading bends to fit the result. Refuse rather than improvise one.
if (!APP_DIR) return { ok: false, mode: 'build', error: 'build mode requires args.appDir (the app folder to gate)' }
if (!Array.isArray(RUBRIC) || RUBRIC.length === 0) {
  return {
    ok: false,
    mode: 'build',
    error:
      'build mode requires args.rubric — a pre-written rubric from VISION.md 3절. ' +
      'Inventing one at grading time is not a gate.',
  }
}
const RUBRIC_TOTAL = RUBRIC.reduce((s, r) => s + (r.max ?? 0), 0)
if (RUBRIC_TOTAL !== 100) log(`WARNING: rubric weights sum to ${RUBRIC_TOTAL}, not 100 — pass mark ${PASS_MARK} may not mean what you think`)

const rubricText = RUBRIC.map((r) => `- [${r.id}] ${r.name} (max ${r.max}) — 확인 대상: ${r.checks ?? '(미기재)'}`).join('\n')

function implementPrompt(round, feedback) {
  if (round === 1) {
    return `Implement this task end to end.

## Task brief
${BRIEF}${CONTEXT}

## How this will be judged (know it up front — this is not a surprise exam)
1. A mechanical gate runs first: static analysis, tests, build. If it fails, your work is not even scored.
2. Then the planning team drives the app and scores what they OBSERVE against this fixed rubric,
   needing ${PASS_MARK}/100 to pass:
${rubricText}

They will not read your explanation and they will not grade intent. They grade what happens on screen.
So: finish the flow, remove placeholders, and make sure it actually runs.

Work in English (code, comments, report). Follow the repo's existing conventions. Read the relevant
spec/design docs first. Verify it builds and runs before reporting.`
  }
  return `Your previous attempt did not pass. Fix it.

## Task brief
${BRIEF}${CONTEXT}

## What blocked it (round ${round - 1})
${feedback}

## The rubric you must clear (${PASS_MARK}/100)
${rubricText}

Fix every item above. Start with the "highest-value fix" if one was named — it moves the score most.
Do not re-litigate the findings; the gate is mechanical and the grader watched the app run. If a
finding is genuinely wrong, show evidence from the actual code or a run, not reasoning.
Then re-verify the WHOLE task, not just what you touched.`
}

let feedback = null
let round = 0
let lastImpl = null
const history = []
const scores = []

while (round < MAX_ROUNDS) {
  round++

  // ── 1. Implement / revise ────────────────────────────────────────────────
  phase('Implement')
  log(`Round ${round}/${MAX_ROUNDS}: ${round === 1 ? 'implementing' : 'revising'} "${TITLE}"`)

  const impl = await agent(implementPrompt(round, feedback), {
    label: `${round === 1 ? 'implement' : 'revise'} r${round}`,
    phase: 'Implement',
    agentType: a.agent ?? 'client-dev',
    schema: IMPL_SCHEMA,
  })
  if (!impl) return { ok: false, mode: 'build', title: TITLE, rounds: round, error: 'implementer failed or was skipped', history }
  lastImpl = impl

  // ── 2. 관문 1: mechanical gate ───────────────────────────────────────────
  // Runs FIRST and is the only thing that can let scoring happen. A broken
  // build is never graded.
  phase('Gate')
  const gate = await agent(
    `Run the mechanical gate. Do not fix anything. Do not run it twice.

Command (run exactly this, from any directory):
  powershell -NoProfile -File "C:\\Users\\user\\loop_engine\\gate\\gate.ps1" -AppDir "${APP_DIR}" -JsonOut "C:\\Users\\user\\loop_engine\\state\\gate-result.json"

Then read C:\\Users\\user\\loop_engine\\state\\gate-result.json and report its contents verbatim,
plus the exit code. pass = (exit code was 0). Copy the detail strings as-is.`,
    { label: `gate r${round}`, phase: 'Gate', agentType: 'gate-runner', schema: GATE_SCHEMA },
  )

  if (!gate || !gate.pass) {
    const failed = gate?.failed?.length ? gate.failed.join(', ') : 'gate did not report'
    const detail = gate?.checks?.filter((c) => !c.pass).map((c) => `- [${c.name}] ${c.detail}`).join('\n') || '(no detail)'
    log(`Round ${round}: 관문 1 FAIL (${failed}) — not scoring a broken build`)
    history.push({ round, stage: 'gate', pass: false, failed: gate?.failed ?? [], summary: impl.summary })
    feedback = `기계 Gate(관문 1) 실패 — 채점조차 하지 못했다. 아래를 먼저 고쳐라:\n${detail}\n\n` +
      `이건 의견이 아니라 명령 종료 코드다. "환경 탓"으로 넘기지 말 것.`
    continue // straight back to implement — no evidence, no scoring
  }
  log(`Round ${round}: 관문 1 PASS — ${gate.checks.length} checks green`)

  // ── 3. Evidence: QA drives the app and reports FACTS ─────────────────────
  // The grader must score observable behavior, not code. Someone has to go
  // look. That someone is not the implementer.
  phase('Evidence')
  const evidence = await agent(
    `Drive the app and report ONLY what you observe. You are gathering evidence for a grader — you are
not the grader. Do not score, do not judge, do not fix.

## App
${APP_DIR}

## The task that was implemented
${BRIEF}${CONTEXT}

## Steps the implementer says will exercise it
${impl.howToVerify}

## Your job
1. Run the game. Unity is the stack (see CLAUDE.md) — drive it via PlayMode/EditMode or a player
   build, whichever actually exercises the flow. The mechanical gate already confirmed it compiles;
   your job is to confirm it *behaves*.
2. Drive the flow above, step by step.
3. For each step record: what you did, and what ACTUALLY happened on screen.
4. Capture screenshots of the changed screens. Report absolute paths.
5. Watch the logs. Report any errors/exceptions, even if the screen looked fine.
6. Anything you could not exercise — say so and why. Do NOT quietly skip it.

Report facts, not verdicts. "진행바가 0%로 표시됨" is a fact. "진행바가 잘못됨" is a verdict — not yours to make.
Set ran:false if you could not launch it at all.`,
    { label: `evidence r${round}`, phase: 'Evidence', agentType: 'qa', schema: EVIDENCE_SCHEMA },
  )

  if (!evidence || !evidence.ran) {
    log(`Round ${round}: could not run the app — treating as gate failure, not scoring`)
    history.push({ round, stage: 'evidence', pass: false, summary: impl.summary })
    feedback = `앱을 실제로 실행하지 못했다: ${evidence?.couldNotVerify?.join('; ') || '실행 실패'}\n` +
      `빌드가 통과해도 실행되지 않으면 완료가 아니다. 실행 가능하게 만들어라.`
    continue
  }

  // ── 4. 관문 2: rubric score ──────────────────────────────────────────────
  // The grader sees the rubric and the evidence. It does NOT see the
  // implementer's summary or reasoning — that is what makes it generous.
  phase('Score')
  const evidenceText =
    evidence.observations.map((o) => `- ${o.step}\n  관찰: ${o.observed}${o.matchedExpectation === false ? '  [기대와 불일치]' : ''}`).join('\n') +
    (evidence.runtimeErrors?.length ? `\n\n런타임 오류:\n${evidence.runtimeErrors.map((e) => `- ${e}`).join('\n')}` : '') +
    (evidence.screenshots?.length ? `\n\n스크린샷:\n${evidence.screenshots.map((s) => `- ${s}`).join('\n')}` : '') +
    (evidence.couldNotVerify?.length ? `\n\n확인 불가:\n${evidence.couldNotVerify.map((s) => `- ${s}`).join('\n')}` : '')

  const scored = await agent(
    `Score this prototype against the rubric. You are the planning team's grader.

## 기획 의도 (the brief this was built from)
${BRIEF}${CONTEXT}

## 기준표 (FIXED — do not extend, reweight, or reinterpret)
${rubricText}

합격선: ${PASS_MARK}/100

## 증거 (QA가 실제로 앱을 돌려 관찰한 결과 — 당신의 유일한 근거)
${evidenceText}

## 채점 규칙
- 관찰된 동작만 채점한다. 코드도, 구현자의 설명도 당신에게 주어지지 않았다. 그게 의도다.
- 각 항목은 만점에서 시작해 **구체적으로 지목 가능한 결함**만큼 깎는다.
- 지목할 수 없는 감점은 감점이 아니다. 빼라.
- "확인 불가"로 남은 항목은 그 근거만큼만 인정한다. 확인 못 한 것을 통과로 치지 말 것.
- ${PASS_MARK}점 이상만 pass다. ${PASS_MARK - 1}점은 fail이다. "거의 다 됐으니까" 올려주지 말 것 —
  그건 숫자를 쓴 랄프 위검 루프다.
- 기준표가 이 작업에 적용 불가능하면 verdict:'cannot-score'로 하고 이유를 밝혀라. 억지로 채점하지 말 것.
- topFix에는 **점수를 가장 많이 올릴 한 가지**를 적어라. 쉬운 게 아니라 큰 것.`,
    { label: `score r${round}`, phase: 'Score', agentType: 'evaluator', schema: SCORE_SCHEMA },
  )

  if (!scored) {
    log(`Round ${round}: grader failed to report — NOT treating as pass`)
    history.push({ round, stage: 'score', pass: false, summary: impl.summary })
    feedback = '채점관이 보고에 실패했다. 작업을 다시 검토하고 정직하게 보고하라.'
    continue
  }

  const score = scored.score ?? 0
  scores.push(score)
  history.push({
    round, stage: 'score', score, verdict: scored.verdict,
    deductions: scored.deductions, summary: impl.summary,
  })

  if (scored.verdict === 'cannot-score') {
    log(`Round ${round}: grader refused to score — ${scored.cannotScoreReason}`)
    return {
      ok: false, mode: 'build', title: TITLE, rounds: round, escalate: true,
      reason: `채점 불가: ${scored.cannotScoreReason}`,
      outstanding: '기준표가 이 작업에 맞지 않는다. VISION.md 3절의 기준표를 손봐야 한다.',
      summary: impl.summary, filesTouched: impl.filesTouched, history,
    }
  }

  // ── SUCCESS BRAKE (14장: 성공했을 때 멈추는 브레이크) ────────────────────
  if (score >= PASS_MARK) {
    log(`Round ${round}: PASSED — 관문 1 green, 기준표 ${score}/100 (>= ${PASS_MARK})`)
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

  // ── NO-PROGRESS BRAKE (14장: 헛돎 감지) ──────────────────────────────────
  // Same spot, twice over. More rounds will not help; a human has to look.
  if (scores.length >= 3) {
    const [x, y, z] = scores.slice(-3)
    if (Math.abs(y - x) <= 2 && Math.abs(z - y) <= 2) {
      log(`Round ${round}: 무진전 — 점수 ${x} → ${y} → ${z}. 반복 중단, 사람에게 넘긴다.`)
      return {
        ok: false, mode: 'build', title: TITLE, rounds: round, escalate: true,
        reason: `무진전 감지: 3회 연속 점수 변동 ±2 이내 (${scores.join(' → ')}). 반복해도 나아지지 않는다.`,
        score, scoreHistory: scores,
        outstanding: (scored.deductions ?? []).map((d, i) => `${i + 1}. [${d.criterion}] ${d.what} (@ ${d.where}, -${d.points})`).join('\n'),
        topFix: scored.topFix,
        summary: impl.summary, filesTouched: impl.filesTouched, history,
      }
    }
  }

  log(`Round ${round}: ${score}/100 — ${PASS_MARK}점 미달, 재작업 (topFix: ${scored.topFix})`)
  feedback =
    `기준표 채점 ${score}/100 (합격선 ${PASS_MARK}). 감점 내역:\n` +
    (scored.deductions ?? []).map((d, i) => `${i + 1}. [${d.criterion}] ${d.what}\n   관찰 위치: ${d.where}\n   감점: -${d.points}`).join('\n') +
    `\n\n가장 크게 점수를 올릴 수정: ${scored.topFix}`
}

// ── FAILURE BRAKE (14장: 실패가 길어질 때 멈추는 브레이크) ───────────────────
// Hard limit hit. Never report this as done — that is the whole failure mode
// the loop exists to prevent.
log(`${MAX_ROUNDS}회 반복했으나 ${PASS_MARK}점 미달 — 사람에게 넘긴다`)
return {
  ok: false,
  mode: 'build',
  title: TITLE,
  rounds: round,
  escalate: true,
  reason: `최대 반복 ${MAX_ROUNDS}회 도달, 기준표 ${PASS_MARK}점 미달`,
  score: scores[scores.length - 1] ?? null,
  scoreHistory: scores,
  outstanding: feedback,
  summary: lastImpl?.summary ?? null,
  filesTouched: lastImpl?.filesTouched ?? [],
  history,
}
