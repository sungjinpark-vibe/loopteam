# Life Town — PROGRESS snapshot (paused 2026-08-02)

> Second pause. First pause was 2026-07-17 → resumed 2026-07-19; this file was overwritten with the
> fuller history at this second pause (git history has the earlier version if ever needed). The engine's
> `state/PROGRESS.md` no longer carries Life Town detail while paused — this file is the source until
> resumed. Backlog archived alongside this file in `backlog/` (T001-T012).

## Where it stood at this pause

- **T001-T011: all done, gate-passed.** Spec, Economy.Core, Platform, design system, building asset
  strategy, ProBuilder building spikes, all 7 category buildings, work-building polish, the playable
  tap→timer→growth gameplay slice, and APK delivery (v0.0.9) are complete and were accepted by the
  director along the way. This is a real, playable prototype — not a stub.
- **T012 (art resource upgrade — Blender-modeled village landmark) is UNFINISHED, paused mid-decision.**
  Full detail in `backlog/T012.md` (archived). Summary:
  - **4 full quality-loop attempts, 20 rounds, ~8.8M subagent tokens spent. Never cleared a pass bar.**
    Attempt 1 (hand-scripted PBR-lit primitives): 44/95. Attempt 2 (same approach, resumed after a
    tooling fix): 66/95 — the best score reached in any attempt. Attempt 3 (flat/toon "Fortune City
    genre" style, invented from general genre research, no real screenshots): 60/95, trajectory
    66→56→53→53→60 — declining/plateaued, not converging. Attempt 4 (same flat/toon style + a
    PolyHaven-sourced real mesh to break the "just primitives" ceiling, bar lowered to 90 by the
    director): 65/90, trajectory 60→60→63→68→65 — real progress on originality, but a new structural
    finding (palette drifted outside the design system's own tokens into "neon-dark" territory the
    system explicitly warns against).
  - **Root causes identified** (given to the director on request): a self-fooling/tautological
    verification script recurred three separate times across attempts (the builder's own "proof" was
    broken and only the independent lead review caught it each time); the flat/toon rendering approach
    kept partially reverting to lit-PBR shader behavior; fixing one visible bug reliably exposed the next
    layer of previously-masked problems (real progress that reads as no progress); A5 originality was a
    structural ceiling for hand-scripted primitives specifically (only broken once a real downloaded mesh
    was used); 90-95 is a very demanding bar for a single hand-produced 3D prop.
  - **The actual breakthrough, found in this session's final turns**: the director shared real Fortune
    City screenshots. They show the game's buildings are **flat 2D illustrated card/icon art** (like
    postcard vignettes on isometric island tiles), not 3D-modeled objects at all. All 20 rounds had been
    3D-modeling a building in Blender to chase a look that was never a 3D-modeling problem — a real
    mismatch between the approach and the reference the whole time.
  - **Director's decision, right before pausing**: switch to flat 2D illustrated art for the landmark
    (scope: landmark only, not retroactively redoing the 7 already-accepted 3D buildings), keep Life
    Town's existing walkable 3D village scene/camera as-is (buildings become 2D art within that 3D world,
    not a Fortune-City-style card-grid UI). **This pivot was decided but not yet started** — paused
    immediately after the decision, before any implementation.
  - Tooling state: `mcp__blender` + Bash/PowerShell live on `ui-ux`; PolyHaven enabled (free); Sketchfab
    enabled (director-supplied API key, live, unused so far); Hyper3D declined by the director (paid).
  - A security note was raised and resolved during this task (an evidence-gathering subagent ran
    `git checkout --` on out-of-scope files; investigated, confirmed no data was actually lost) — full
    detail in the archived `backlog/T012.md` and engine `state/PROGRESS.md` Do Not Repeat.

## To resume

1. Read `lifetown/VISION.md`'s resume banner and this file first.
2. Restore the backlog: copy `backlog/` (this folder) back to the engine root `backlog/`.
3. T012's next step is already decided: build the landmark as flat 2D illustrated art (not a 3D Blender
   model), landmark-only scope, inside the existing 3D village scene. Do not restart 3D Blender attempts.
4. Everything else (T001-T011) needs no further action — it's done and accepted.
