# touchRPG

New game project. Started 2026-07-17.

Built by the Life Town loop-engine team and system, **unchanged** (director's instruction):
Unity 6000.5.1f1 · the three gates (mechanical → team lead ≥90 → 5-expert playtest) · same agents,
rubrics, boundaries and failure policy. The contract lives in `../VISION.md`.

## Status: scaffolding — concept brief pending

The folder, git repo and docs skeleton are ready. **The game concept has not been given yet.**
The name "touchRPG" is not a brief, and per `../VISION.md` §2/§4 the team must **not invent** the
concept, genre, or target player. The PM has asked the director on Discord for:

1. What kind of game (touch-based RPG? idle? clicker? action?)
2. The one-line concept / core fun
3. The target player
4. Any reference games or images

When the brief lands: `../VISION.md` §2 gets filled in, then `T001` (spec · `explore` · `planner`)
opens and its output goes to the director for approval.

## Layout

| Path | Holds |
|---|---|
| `docs/spec/` | Feature specs, user flows, gamification design (`planner`) |
| `docs/design/` | Design system, screen design, art-order specs (`ui-ux`) |
| `docs/design/references/` | Director-supplied reference images |
| `docs/api/` | API contracts, DB, backend (`server-dev`) |
| `docs/qa/` | Test cases and QA evidence (`qa`) |

Unity project + game code get created here once the spec justifies it.

## Git

Own repo, local only — no remote yet (same as `lifetown`). Gitignored from the engine repo, per the
one-app-one-repo rule.
