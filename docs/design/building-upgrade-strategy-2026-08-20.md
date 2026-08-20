# Building system upgrade strategy — 2026-08-20

Status: **proposal only. Nothing applied.** Director picks an option; implementation is a
separate task.

Inputs: the Sparkful/Fortune-City reference analysis (raw notes: scratchpad
`sparkful-reference.md`), a full read of the current building code, and the two existing art
documents (`art-ai-upgrade-review.md`, `ai-prototypes/`).

---

## 0. The one rule that shapes every option below

**Buildings are a parametric SVG generator, not pictures.** `buildingArt.tsx` (~1160 lines)
draws 14 archetypes × 4 footprints × 3 colour variants × 5 EXP levels × 5 fuse tiers at render
time; zero building bitmaps ship. Raster art is *fatal* here — a PNG cannot grow floors, and it
blurs under the live pinch-zoom (`MAX_PINCH_SCALE = 2.5` plus a sub-1× fit floor) that is
lossless today precisely because nothing in that path is a bitmap.

So, for the whole of this document:

> **The FLUX images in `ai-prototypes/building-upgrade-2026-08-20/` are CONCEPT ART — a target
> look, not shippable assets.** Implementation is Path A from `art-ai-upgrade-review.md`:
> hand-restyle the SVG generator toward the concept. This is the same rule already written down
> in `path-b-integration.md` ("AI output is a style/shape reference that gets hand-traced into
> the app's own vector primitives, never imported as a raster asset") and the same rule the
> shipped rare-savings buildings already followed.

### Frozen baselines every option must respect

| Frozen thing | Source |
|---|---|
| Map look — 20×20, park/lake terrain, current visuals (commit `afc7cd6`) | user approval 2026-08-11 |
| Building footprint fills its own cell, never exceeds it, ≥90% fill (commit `d8ce379`) | user approval 2026-08-12, guarded by `PlaceholderBuilding.test.tsx` |
| Height grows with level + roof signboard shows the category | user directive 2026-08-13 (revoked the older "no bigger, only fancier" rule) |
| grey800 keyline, ≥5.15:1 contrast against every terrain colour | 2026-08-15, guarded by `buildingArt.contrast.test.tsx` (35 tests) |
| EXP dials — `expPerLevel 3`, `maxLevel 5`, `expAmountTiers`, `tierThresholds` | director-approved, `balance.approved.ts`, untouchable |
| 5 rare savings structures, one per saving category, grown by KRW balance (not RNG) | shipped, `savingsArt.tsx`, guarded by `SavingsRow.test.tsx` |
| Tile geometry — `GRID_SIZE 20`, `MIN_TILE_WIDTH_PX 40`, `TILE_HEIGHT_PX 40`, `GRID_GAP_PX 6` | `townLayout.ts`, guarded by `townLayout.test.ts` |
| Bundle: 1.78 MB `dist/web`, exactly one shipped bitmap (the logo) | measured |

**No option below changes an EXP number, a footprint, a terrain colour, or the map.** They
change what a level *looks* like, and what the player can *look at*.

---

## 1. What the reference actually does (Sparkful / Fortune City)

Sparkful's "universe/buildings" is the Fourdesire Fortune City building system. Verified
mechanics, mapped against ours:

| Reference mechanic | Theirs | Ours today | Gap |
|---|---|---|---|
| Growth chain | **8 stages per category, each stage a full redesign** — the Lv.8 building is a different drawing from the Lv.1, not a taller copy | 5 visual levels; a level adds one floor, +5 px height, one window row, one belt line. Same drawing throughout | **Big.** Progression is quantitative, not qualitative |
| Progression trigger | the core habit act (logging spending) | the core habit act (logging an entry / saving) | none — already aligned |
| Rarity | **no true rarity system.** Prestige is conveyed by *vocabulary and palette escalation* — "Golden…", "…Palace", earth tones → gold tones | fuse tiers exist (`MAX_FUSE_TIER 5`) and the 5 savings buildings share one gold cornice band | **Medium.** We have the tier, not the escalation language |
| Collection axes | **three parallel** — buildings, vehicles, residents | one (buildings) + NPCs that are decoration, not collectibles | Medium |
| Completion drive | per-category independent tracks make a natural catalogue to complete | none — the player cannot see what exists or what they are missing | **Big. We have no 도감 at all** (grepped: zero hits outside the shop SKU list) |
| Building detail | **card page — scene image + flavour text + lineage** | tap gives a `Lv.N` badge on the tile | Big |
| Social | prosperity leaderboard, resident happiness stat | none | out of scope here |

Unverified, flagged honestly: the exact category count, the unlock presentation, and whether
completion badges exist. Nothing below depends on those.

**The transferable insight**: Fortune City's retention does not come from a rarity lottery. It
comes from (a) each stage being visibly a *different building*, and (b) an always-visible list
of what you have and have not built. We are weakest on exactly those two.

---

## 2. The measured problem with our growth today

Level currently moves geometry by `GROW_PER_LEVEL_PX = 5` in art units. A 1×1 building measures
~16.8 px on screen at fit-to-map zoom on the 20×20 map (measured,
`docs/qa/art-footprint-survey/survey.json`) against a 40 px art tile — an effective scale of
~0.42.

> **One level ≈ 2 px of on-screen height at fit zoom.**

The full Lv.1 → Lv.5 climb is ~8 px on screen, and the player only sees it if they happen to
remember what the building looked like last week. The growth mechanic is real in code and
nearly invisible in play. This is the single highest-leverage finding in this document, and
options A and B both target it.

---

## 3. Option A — Growth milestones: three silhouettes per building **(RECOMMENDED)**

**What.** Keep all five levels and every EXP number exactly as they are. Group them into three
*visual milestones*, and make each milestone a visibly different building — the Fortune City
"each stage is a redesign" idea, compressed to fit our 5-level ladder.

| Milestone | Levels | Silhouette change (inside the frozen footprint) |
|---|---|---|
| M1 새싹 | Lv.1–2 | today's building. Flat/simple roof, small signboard plate, no trim |
| M2 성장 | Lv.3–4 | second storey + belt line (already exists) **plus**: a material step — a trim band in the archetype hue, larger lit windows, one ground-floor prop (planter/parasol/bench) from the existing `decor` vocabulary |
| M3 랜드마크 | Lv.5 and fuse tiers | a **crown**: cupola / spire / roof-terrace railing per archetype, a cornice band, illuminated signboard. `isLandmark` already fires at `level >= 4` and swaps proportions — this gives that promotion something to actually show |

Height keeps growing exactly as it does now (5 px/level, capped at 45 px < the 46 px row+gap, so
a maxed tower still never swallows the tile behind it). The change is that height is no longer
carrying the signal alone.

- **Art**: 3 concept images (generated, §6) → hand-traced into the generator. Only two new
  shared helpers are needed — a trim/cornice band and a crown, both parameterised by archetype
  — because roof shape (`flat`/`pyramid`), `decor` flags, and `roofTone` are already per-archetype
  fields in `ARCHETYPES`.
- **Code**: `buildingArt.tsx` only. Add `milestoneFor(level)` next to the existing
  `floorsFor(level)`, and branch the two new helpers off it. 0 KB bundle cost — it is generated
  code. 14 archetypes need a crown each, which is the bulk of the work.
- **Guards to re-run**: `PlaceholderBuilding.test.tsx` fill-rate (a crown adds height, not
  width — footprint fill is unaffected), `buildingArt.contrast.test.tsx` (new fills need the
  keyline and the 5.15:1 check), `scripts/evidence-art-fill.mjs`, and a fresh 48 px readability
  survey. Golden snapshots will change and must be re-approved by the director, since they
  encode the `d8ce379` baseline.
- **Effort**: ~4–6 engineer-days (shared helpers ~1.5 days, then 14 archetypes). Path A's own
  estimate for a full restyle was 8.5 days; this is a narrower change on top of an
  already-restyled generator.
- **Expected effect**: the growth loop becomes legible at a glance. This is the reason the
  player saves — "내 카페가 달라졌다" beats "내 카페가 2픽셀 자랐다". Directly answers Gate 3's
  standing complaint that progression is hard to feel.
- **Risk**: touches the frozen `d8ce379` snapshot. Mitigated by the fill-rate test staying green
  (footprint untouched) and by shipping archetype-by-archetype behind the existing gates.

**Also fixes, for free**: the flagged latent bug where `roofSignboard()` renders after `decor`,
so the cafe's parasol currently hides its own signboard. The crown/signboard work goes through
that code anyway.

---

## 4. Option B — Building codex (도감) + card detail

**What.** The reference's completion engine, which we have zero of. A catalogue screen listing
all 14 archetypes × 5 levels (+ the 5 rare savings structures), showing which the player has
built, which milestone each has reached, and a card detail page per building — large art,
flavour text, and lineage ("우리 동네 첫 카페 · Lv.3 · 2026-08-14 설립 · 누적 저축 42만원").

- **Art**: **zero new art.** The codex renders `<BuildingArt>` at a large size — the same
  generator, just not squeezed into 40 px. Silhouettes the player has never seen at readable
  size suddenly become the reward for opening the screen.
- **Code**: one new screen + one card component + a derived selector over the existing town
  store (built/not-built, max level reached per category). No new state to persist — everything
  needed is already in the save. ~2–3 engineer-days.
- **Guards**: nothing existing breaks; it is additive and read-only. Needs its own small test.
- **Expected effect**: retention through completion pressure and a reason to return that is not
  a new entry. The cheapest option here by a wide margin.
- **Risk**: low. The honest caveat is that a codex over a *count* of 14 is thinner than one over
  Fortune City's hundreds of drawings — it gets much stronger once Option A gives each entry
  three distinct looks. **B is a natural second step after A, not a substitute for it.**

---

## 5. Option C — Rarity vocabulary + acquisition highlight

**What.** Adopt the reference's palette-and-vocabulary escalation, applied where we already have
a tier: the 5 rare savings structures and the fuse tiers. Three prestige looks — stone/grey →
marble/silver → gold/domed — with names escalating alongside ("동네 금고 → 은빛 금고 → 황금
금고"). Plus the highlight moment we do not have: when a savings structure crosses a segment,
a spotlight + card reveal, instead of today's plain toast.

- **Art**: 3 concept images (generated, §6) → hand-traced into `savingsArt.tsx`, which already
  has a shared gold cornice band and per-structure `capShape`, so the tier ladder is an
  extension of an existing axis rather than a new one.
- **Code**: `savingsArt.tsx` + a reveal component reusing the existing `TierCelebration.tsx`
  pattern. `savingsTowerSegments` (8 segments) already exists as the trigger — no balance
  change. ~3–4 engineer-days.
- **Guards**: `SavingsRow.test.tsx` asserts each of the 5 renders distinct art with no visible
  text; a tier ladder must keep all 5 distinguishable *at every tier*, which the test should be
  extended to cover.
- **Expected effect**: sharper savings motivation specifically (these 5 are the savings-linked
  buildings), and a real celebration beat. Narrower than A — it touches 5 buildings, not 14.
- **Risk**: gold-on-gold. If every top tier converges on gold the 5 stop being distinguishable.
  The concept art keeps the unique feature (portico / spire / vault / pennant / sawtooth) as the
  identity channel and uses gold only as the tier channel.

---

## Recommendation

**A first, then B.** A fixes a measured defect — a level is worth about 2 px on screen, so the
core loop's reward is invisible — and it is the mechanic the reference actually leans on. B is
cheap, additive, breaks nothing, and gets much better *after* A exists to fill it with distinct
silhouettes. C is genuinely good but narrower (5 buildings) and can wait; it also carries the
one real design risk in this document.

Sequenced: A (~4–6 days) → B (~2–3 days) → C (~3–4 days). Each ships independently behind the
existing gates. Doing only B is defensible if the priority is a fast retention win with zero
risk to the frozen art baseline.

---

## 6. Concept art

Folder: `docs/design/ai-prototypes/building-upgrade-2026-08-20/`

Generated with `C:\Users\user\tools\flux.py` (FLUX.2-klein-4B, local, 1024², 4 steps, seed 7),
multi-reference off the project's own established style anchors:
`proto-building-cafe.png`, `proto-building-shop.png`, `rare-savings/rare-deposit.png`.

| File | Shows | For |
|---|---|---|
| `growth-M1-sprout-cafe.png` | cafe, milestone 1 — one storey, plain | Option A |
| `growth-M2-growing-cafe.png` | same cafe, milestone 2 — two storeys, trim band, prop | Option A |
| `growth-M3-landmark-cafe.png` | same cafe, milestone 3 — three storeys, cupola crown, cornice | Option A |
| `rarity-T1-stone-bank.png` | savings bank, tier 1 — grey stone, no gold | Option C |
| `rarity-T2-silver-bank.png` | same bank, tier 2 — marble, silver cornice, low dome | Option C |
| `rarity-T3-gold-bank.png` | same bank, tier 3 — gold dome, spire, pennant | Option C |
| `sheet-growth-3stages.png` | all three milestones side by side on grass tiles | Option A, size sense |
| `sheet-town-vignette.png` | a mixed-height block — how it reads as a town | Options A + C |
| `tile-scale-check.png` | every image above downscaled to ~48 px, the real in-game footprint | readability check |

`tile-scale-check.png` is the one that matters for the "does this survive at game size"
question — every concept downscaled to 48 px (true in-game footprint) next to a 6× nearest-
neighbour blow-up of that same 48 px.

**Result, and it settles the design question**: at 48 px the three growth milestones are
instantly distinguishable — short / two-storey / tall-with-a-crown — and the three rarity tiers
are distinguishable by dome and gold. Everything else is mush: window rows, belt lines, trim
bands, and signboard glyphs all dissolve into noise at that size. So:

> **Silhouette (height + crown + dome) is the only channel that survives at game scale.**
> Interior detail is a pinch-zoom reward, not a progression signal.

This is exactly why Option A puts the milestone crown, not extra window rows, on the critical
path — and it is a caution for Option C: the tier ladder must move the roof shape, not just the
palette, or the tiers will be invisible unzoomed.

**Again: these are the target look. The implementation is SVG.**
