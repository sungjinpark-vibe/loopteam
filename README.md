# touchRPG

New game project. Started 2026-07-17.

Built by the Life Town loop-engine team and system, **unchanged** (director's instruction):
Unity 6000.5.1f1 · the three gates (mechanical → team lead ≥90 → 5-expert playtest) · same agents,
rubrics, boundaries and failure policy. The contract lives in `../VISION.md`.

## Status: P0 in progress

Working title **람팡**. Touch-first online hunting action + persistent growth (**not** an MMORPG).
Portrait fixed, party 1-4, one hunt 10-15 min. *"탭 하나로 즐기는 타이밍 패링 협동 헌팅."*

**The spec is the director's own GDD — `docs/spec/00-gdd-v0.4.md` — and it is the single source of
truth** (its §0: when anything conflicts with it, the doc wins). v0.1/v0.2/v0.3 are kept as history.
There was no planner spec task; the team implements the GDD directly.

Current focus: **P0 vertical slice** (GDD §10) — its one validation question is *"터치 패링이 손맛이
있는가."* T001 (parry core) is **done** (Gate 1 green, Gate 2 = 97/100). T002 (remaining input +
람팡 P2-P7) in progress. The GDD's `[TBD]` items are deliberately the director's — the team **must not**
fill them in.

## Layout

| Path | Holds |
|---|---|
| `docs/spec/` | **The GDD (source of truth)** + any later specs |
| `docs/design/` | Design system, screen design, art-order specs (`ui-ux`) |
| `docs/design/references/` | Director-supplied reference images |
| `docs/api/` | API contracts, DB, backend (`server-dev`) |
| `docs/qa/` | Test cases and QA evidence (`qa`) |
| `Assets/` | Unity 6000.5.1f1 project (created 2026-07-17) |

## Git

Own repo, local only — no remote yet (same as `lifetown`). Gitignored from the engine repo, per the
one-app-one-repo rule.
