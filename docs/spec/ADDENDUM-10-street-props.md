# ADDENDUM-10 — Street props

Phase 2 of the 2026-08-11 art/UX work (Phase 1 building art -> **Phase 2 street props** ->
Phase 3 pinch zoom). Written after code recon; every claim below was verified at source by the
PM, not accepted from a report.

**Invariant:** map design baseline (commit `afc7cd6` — 20x20 grid, park/lake terrain, multi-tile
buildings) is frozen. Props decorate; they never move a cell, resize a tile, or alter layout.

---

## 1. Verified current state

| Fact | Evidence |
|---|---|
| Explicit `road` terrain exists — roadsides are directly addressable | `townLayout.ts:31` (`TerrainKind`), `:72` (`"#": "road"`) |
| `TOWN_MAP` is the single source of truth for terrain | `townLayout.ts:3,47` |
| `isBuildable` is structural, per terrain kind | `townLayout.ts:109` |
| `decorVariant(row, col, kinds)` — the existing seeded, deterministic variant helper | `townLayout.ts:217` |
| `TownTerrain` is `memo()` taking **NO PROPS** — so it never re-renders on building change | `TownGrid.tsx:11,208` |
| Per-cell decoration slots already exist: `glyph`, `ripple` | `TownGrid.tsx:128-131`, rendered `:223-224` |
| Park glyphs are already scattered by `decorVariant`, sparse not per-cell | `TownGrid.tsx:175` |
| Lake ripples are capped at 1-2 for the whole body, not per cell | `TownGrid.tsx:179-185` |

### 1.1 The trap (most important constraint)

`TownTerrain` returns a **bare fragment** (`TownGrid.tsx:210`). A fragment adds no DOM wrapper, so
every cell it renders is a **direct child of `.town-grid`**. `TownGrid.test.tsx:208` asserts the
exact direct-child count of `.town-grid` via a formula.

Consequence: adding a props layer as a **sibling inside that fragment breaks the invariant test.**
Props MUST go **inside the existing per-cell `div`**, in the same slot position as `glyph` and
`ripple` (`TownGrid.tsx:223-224`). This is the single most likely way to get this wrong.

---

## 2. Design

### 2.1 Placement

- Props are chosen **per cell, from terrain**, inside the existing `TERRAIN_CELLS` build
  (`TownGrid.tsx:~149-185`) — the same pass that already computes `glyph` and `ripple`.
- Anchor kinds:
  - **road cells** -> streetlamp, bench, cart. Prefer road cells *adjacent to a ground cell*, so
    props read as street furniture facing buildings rather than floating mid-road.
  - **park cells** -> tree, bench, fountain (fountain rare — at most one or two per park body,
    mirroring the existing ripple-capping trick at `:179-185`).
  - **lake cells** -> nothing new; ripples already own that.
- **Sparse, not per-cell.** Reuse the existing sparse pattern (`decorVariant(row, col, N) === 0`)
  so props scatter. A prop on every road cell would read as clutter and bury the buildings.

### 2.2 Determinism

Use **`decorVariant(row, col, kinds)`** (`townLayout.ts:217`) for both "does this cell get a prop"
and "which prop". `Math.random` is forbidden in this codebase and would also break the memo's
stability across remounts.

### 2.3 Rendering

- **Inline SVG / glyph spans inside the per-cell div** — same slot as `glyph`/`ripple` (§1.1).
- **No sprite sheet, no background-image.** `TownTerrain` never re-renders, so the per-element
  cost is paid once; a sprite buys nothing and adds an asset pipeline.
- Props must fit **entirely within the 40x40 cell**. The 6px grid gap is already consumed by
  terrain bleed — a prop overflowing its cell would collide with neighbouring terrain art.
- Pastel tone, `@toss/tds-colors` tokens only — consistent with the building art rule.

### 2.4 Safety

- Props never occupy buildable cells: they render only on `road`/`park` cells, and `isBuildable`
  is structural per terrain kind (`townLayout.ts:109`), so a prop cannot sit where a building
  can go. No extra guard needed — but assert it in a test (§3.4).
- Props are decorative only: no pointer handlers, no hit targets. They must not interfere with
  tile tap/long-press (`useTileGestures.ts` delegates from `.town-grid` via `closestPlotIndex`;
  a prop inside a terrain cell resolves to no plot, which is already the correct no-op).

### 2.5 Out of scope

Animation, day/night lamp states, prop interaction/tapping, user-placeable decorations,
props on lake or void cells.

---

## 3. Acceptance

1. Streetlamps/benches/carts appear along roads; trees/benches/fountains in parks.
2. `.town-grid` direct-child count **unchanged** — `TownGrid.test.tsx:208` passes untouched.
3. `TownTerrain` still takes no props and does not re-render when buildings change.
4. A test asserts no prop is emitted on any cell where `isBuildable(row, col)` is true.
5. Placement is deterministic: same map renders identically across reloads (no `Math.random`).
6. No prop overflows its 40x40 cell.
7. Props survive Phase 3 zoom without desync (they live inside `.town-grid`, which carries the
   transform — free by construction, but verify at 2.5x).
8. Full-scale browser screenshot, compared against the Fortune City reference bar.

## 4. Notes for the implementer

- Extend the existing `TERRAIN_CELLS` cell object with a `prop` field beside `glyph`/`ripple`.
  Do **not** add a parallel layer or a second pass over the map.
- Keep the sparse-scatter and body-capping idioms already in the file rather than inventing new
  distribution logic — they exist and are tuned.
- Query the `code-review-graph` MCP for blast radius before editing (project `CLAUDE.md` rule).
