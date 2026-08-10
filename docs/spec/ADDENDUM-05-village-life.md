# ADDENDUM-05 — village life (town expansion · animal NPCs · building art · BGM · seed economy)

> Status: **approved for build**, director sign-off on all six items (PM decision brief, 2026-08-10).
> This document is a work contract for five parallel implementers — it transcribes decisions already
> made by the PM, does not re-argue them, and closes any gap the PM brief left, saying so inline.

## 0. What the director asked

1. More animal NPCs walking the town, and unlock more species over time.
2. The town should feel bigger — more space, wider tiles.
3. Buildings should look like actual buildings (식당, 병원, 정류장, 은행…), not coloured boxes.
4. Background music while using the app — must be copyright-clean.
5. A currency + shop so players can buy cosmetics with something earned in-app.
6. (folds into 1) More NPC species should be unlockable through the same shop.

Six asks. Nothing else is in scope: no ad bubbles, no real payments, no leaderboards, no achievements.

## 1. Port vs. build new

Source of truth: `C:\Users\user\app-dev-team\lifetown` (Flutter, READ-ONLY, never write to it). Its art
was authored first as in-repo HTML/JS SVG-generator prototypes under `docs/design/`, then ported to
Dart — the JS originals are a near-1:1 port target for TS. Provenance: repo-wide grep for
freepik/flaticon/kenney/itch.io/unsplash/pixabay/shutterstock/opengameart returns **zero hits**; the
only confirmed third-party asset is the Gaegu font (OFL) — **not ported**, not needed.

| Target | Port source | Format | Verdict |
|---|---|---|---|
| NPC art, 6 base species | `docs/design/npcs/npcs.html` (78 lines) | plain JS SVG-string functions (`el`, `eyes`, `cheeks`, `smile`, `animal`) | port, JS→TS, emit JSX not strings |
| NPC art, 6 shop species | `docs/design/shop/new_npcs.html` (193 lines) | same pattern | port |
| Species recipe table (12) | `app/lib/data/npc_visual_defs.dart:54-182` | Dart const records (body/dark/inner/belly colour, ear tag, optional eye-patch/beak/arm/scarf) | transcribe to a TS const table |
| NPC movement | `app/lib/features/village/npc/npc_controller.dart` (316 lines) | Dart random walk, idle/walk timers, `extraRestChance = 0.25`, no pathfinding (verified: zero astar/bfs hits) | reimplement in TS, copy the numbers not the code |
| Building art | `docs/design/building-props/building-props.html` (92 lines) | plain JS, pastel isometric cube (roof plane + 2 side faces + windows + door + roof sign) | port, JS→TS/JSX |
| Building shape vocabulary | `app/lib/data/building_visual_defs.dart` (442 lines) | 8 body-shape tags, 8 roof-shape tags, window shapes, colours, cupola variants | transcribe the tag vocabulary |
| Shop catalog shape | `app/lib/data/shop_catalog.dart` (777 lines) | 3 purchasable classes: colour presets / skins (rarity) / NPC species | adopt the **shape** only — earn rules are ours, §6 |
| BGM | `app/assets/audio/soundscape_forest.wav` (861 KB) + `soundscape_fireplace.wav` (775 KB) | WAV, declared "stdlib-generated" but the generator script does not exist in the repo — **unverifiable** | **NOT ported** — see §5 |
| Category→art mapping | none (lifetown's 7 categories are reading/study/work/exercise/hobby/mind/game) | — | **redesigned from scratch**, §4 |
| Map/grid, shop UI, currency | lifetown versions are Flutter Canvas / time-based-focus-session domain | — | **rebuild**, does not transfer |

Every ported file carries a header comment naming the exact lifetown source path. Commits say "port
from lifetown" plainly. Do not port lifetown's `assets/icons/*.svg` or `assets/avatars/*.svg`
(UNKNOWN provenance, not needed).

## 2. F-EXP — town expansion (director ask 2)

Wider town in tiles; tiles stop shrinking to fit the phone.

- `TOWN_COLUMNS` 6 → 8 (`selectors.ts`). `GRID_COLUMNS = TOWN_COLUMNS + 1` follows automatically (9).
- **`ROAD_COLUMN`/`SERPENTINE_COLUMNS` are literal constants, not derived from `TOWN_COLUMNS`**
  (`townLayout.ts:36,55`) — bumping `TOWN_COLUMNS` does NOT recentre them. W1 recomputes both by
  hand, same pattern as today (`ROAD_COLUMN=3` = exact middle of 7, `SERPENTINE_COLUMNS` = every
  column but the road): for 9 columns, `ROAD_COLUMN = 4`, `SERPENTINE_COLUMNS = [0,1,2,3,5,6,7,8]`.
- `SAVINGS_COLUMN_RANK` (currently `[2,4,1,5,0,6]`, exactly `TOWN_COLUMNS` entries) must be
  re-derived for 8 columns using the same rule that produced today's array: sort
  `SERPENTINE_COLUMNS` by ascending distance from `ROAD_COLUMN`, so the columns nearest the street
  rank first — this is what keeps 예적금/주식 on the street front.
- New `MIN_TILE_WIDTH_PX = 52` in `townLayout.ts`. Tile width becomes
  `max(MIN_TILE_WIDTH_PX, plotTileWidthPx(viewportPx))`. At 390px/8 columns the derived width is
  ~35px, so 52px wins — tiles end up wider than today's 50px, not smaller.
- `PIPS_PER_ROW` and the 저축 블록 geometry both call `plotTileWidthPx` already — re-derive by
  calling the same function with the new constants, do not hand-patch either. Confirm the block
  still lays out at 320/360/390/430px viewports.
- New `.town-viewport` wrapper: `overflow-x: auto; overscroll-behavior-x: contain;` around
  `.town-grid`. No pinch-zoom, no custom pan code, no gesture library. On a viewport wide enough
  that the world fits, nothing scrolls.
- `LAYOUT_VERSION` 1 → 2 (rule R-1 — this relocates every building; the existing `relayout` notice
  already covers it, no new notice kind needed).

**Gesture safety (read before touching `touch-action`).** `useTileGestures.ts` binds its listeners to
`.town-grid`, which deliberately carries `touch-action: pan-y` so long-press doesn't fight vertical
scroll. `touch-action` is the intersection of the touch-target's value and every ancestor's up to the
nearest scroll container — so a touch starting on any tile is clamped to `pan-y` regardless of what
`.town-viewport` declares: **native touch-driven horizontal scroll will not fire for a touch starting
on a tile.** Real, unavoidable conflict, not a bug — loosening `pan-y` reintroduces the
long-press-vs-scroll ambiguity `useMoveMode.ts` assumes doesn't exist. Per the PM's priority, **the
move gesture wins**: ship `.town-viewport` anyway, leave `.town-grid`'s `touch-action` untouched;
horizontal pan on touch works only from the viewport's own edge padding, with mouse-drag/trackpad and
the arrow-key roving cursor (`onCursorMove`/`stepCursor`) as full fallbacks. Do not add
`preventDefault()` to compensate — none exists today, and one breaks scroll-through-a-building.
Rejected: pinch-to-zoom, virtualised canvas town (both solve what 8 columns already solves).

## 3. F-NPC — animal NPCs (director asks 1 and 6)

**Count.** `npcCount = min(1 + buildings.length + purchasedNpcSlots, NPC_MAX_VISIBLE)`,
`NPC_MAX_VISIBLE = 12` — a performance ceiling, not a game rule (the dense fixture has 5,400
buildings; 5,401 sprites would blow the frame budget). Mark it
`// ponytail: fixed NPC ceiling, raise/virtualize NpcLayer if a future target needs >12 visible.`

**Species.** 8 inline SVG components ported from `npcs.html` + `new_npcs.html` (§1): one shared
`<NpcBody>` rig + a per-species head, ~24×32 viewBox each. Chibi, big glossy eyes, pink blush, soft
pastel fills, matching `docs/refs/npc-animal-reference.jpg` — study it, author original SVGs, never
trace/embed/ship the reference file. `speciesIndex = npcIndex % availableSpeciesCount` — pure
function of NPC index, deterministic, **never persisted** (R-2's spirit).

**Movement.** NPCs walk road cells only (`isRoadCell(row, col)` from `townLayout.ts`).
- One `setInterval` for the whole `NpcLayer`, not one per sprite, ~2.5s per step. Each step, each NPC
  picks a random adjacent road cell via `random.next()` (never `Math.random`, rule R-6), preferring
  not to reverse direction.
- Sprite moves via `transition: transform 2.4s linear`, flips on X by direction. No rAF loop, physics,
  or pathfinding. `@media (prefers-reduced-motion: reduce)` → NPCs render in place, don't move.
- The interval is a repaint trigger only — NPC position is never persisted or derived state.

**Placement.** New `NpcLayer` as the LAST child of `.town-grid`,
`style={{ gridColumn: "1 / -1", gridRow: "1 / -1" }}`, `pointer-events: none` (must never eat a tile
tap or long-press), sprites absolutely positioned inside it. Never a `.town-tile` child (AC-M7,
direct-children guard).

## 4. F-BLD — building illustrations (director ask 3)

Replace `PlaceholderBuilding`'s CSS-shape drawing with inline SVG archetypes chosen by category.
**`BuildingVisualProps` stays byte-identical** — the component's own file header already promises
this swap is "one new component, same prop shape, one import change at `TownGrid.tsx`".

| Category | Archetype |
|---|---|
| food 식비 | restaurant — awning, bowl/chopsticks sign |
| cafe 카페 | café — cup sign, terrace parasol |
| transport 교통 | bus stop / small garage — shelter, route sign |
| shopping 쇼핑 | shop — display window, striped awning, bag sign |
| living 생활 | townhouse — plain house, chimney, window boxes |
| health 의료 | clinic/pharmacy — cross sign, white façade |
| culture 문화 | small cinema/theatre — marquee, ticket window |
| education 교육 | school — clock gable, flag |
| social 경조사 | hall — bunting, wide door |
| etc 기타 | generic cottage |
| salary 급여 | office block |
| sidejob 부업 | workshop — tools sign, side chimney |
| bonus 보너스 | gift-wrapped building — ribbon |
| other_income 기타수입 | generic cottage, income palette |
| park (F15) | SVG trees/bench — must stay visually the rarest tile |
| monument (F16) | SVG obelisk/plaque — **do not change F16 behaviour** |

Style: cartoon, front-facing with a slight isometric hint (visible roof plane + one side face), flat
fills from `theme.ts` tokens, 2-3 tone shading, no gradients, no external fonts. `variantIndex` keeps
selecting a roof/colour variant so two 식비 buildings still differ.

Constraints:
- Fixed viewBox, scale with `width:100%; height:100%` inside the 52×72px (post-F-EXP) minimum tile.
  **Nothing may clip** — the old `.building-roof-peak` was a fixed 36px triangle, 94% of the tile at
  320px; do not repeat that.
- `level` (stacked-floors signal, ADDENDUM-04) and the `Lv.N` badge must survive — express floors
  inside the SVG or keep the existing floors div, but the visual must still grow with level; the
  `justBuilt` rise-in animation must still play.
- `PlaceholderBuilding.test.tsx` pins the old CSS shapes — rewrite those assertions to pin the new
  archetype-per-category contract; do not drop the file.

## 5. F-BGM — background music (director ask 4)

lifetown's two ambience WAVs are **not** ported: the director's condition is "저작권 문제 없어야 함", and
the in-repo "stdlib-generated" claim has no generator script to verify it — unverifiable fails that
bar (secondarily, 1.6MB of WAV is real bundle weight). Director-reversible: if he can source those
files' origin, swapping them in is a one-commit change.

**Decision: runtime-synthesised loop, Web Audio API. Zero audio files, zero copyright exposure.**

- New `src/platform/audio.ts`: `AudioPort { start(): void; stop(): void; setMuted(b: boolean): void; }`
  — `browserAudio` driver (Web Audio) + a no-op driver for tests (jsdom has no `AudioContext`, stub
  it exactly like `haptics`/`analytics`).
- `src/bgm.ts`, under ~80 lines: slow pentatonic arpeggio, 2 detuned triangle/sine oscillators through
  a lowpass + short feedback delay, gentle gain envelope, ~30s loop, scheduled ahead on the
  `AudioContext` clock. Calm, not a ringtone.
- **Autoplay**: `AudioContext` cannot start before a user gesture on mobile — boot `suspended`,
  resume on the first user interaction anywhere in the app. Do not fight the browser.
- **Default: ON** (`bgmMuted: false`) — silent-by-default would read as broken for a feature the
  director explicitly asked for, and it's inaudible until the first tap regardless.
- Mute toggle in two places, both driving the same persisted `bgmMuted` flag: a speaker icon in
  `TownHeader` (one tap) and a labelled switch row in `SettingsSheet`.
- Respect page visibility (suspend on hidden, resume on visible) — **not** `prefers-reduced-motion`
  (that's a motion preference, not audio).

## 6. F-ECON — currency + shop (director ask 5)

**Currency: 씨앗** (seeds). `SeedCount` branded type. `formatSeeds(n)` → `` `${n}개` `` — never a
thousands separator, never `원`, never `₩`. `src/economy/**` may not import `../format.ts` and may
not contain the character `원` outside test files (rule R-7). Balance renders on exactly two
surfaces: the shop sheet header and the transient reward toast — never the town header, never 기록.

**Earn loop** (supersedes ADDENDUM-03 E-1 — 씨앗 come from the habit, not from ads):

| Event | Award |
|---|---|
| A building is built (any entry-sourced build, incl. queue drain, F2/F14) | small, per build |
| A no-spend day is claimed (F15) | larger than a build |
| A streak milestone is crossed (existing tier thresholds) | bonus |
| Monthly settlement completes (F16), scaled by the outcome bucket frozen in `MonthSummary` | bonus |

**Balance dials — tunable, live in `balance.approved.ts`** (same file the existing dials live in;
do not invent a second balance file):

| Dial | Starting value |
|---|---|
| `seedsPerBuild` | 3 |
| `seedsPerNoSpendDay` | 8 |
| `seedsPerStreakMilestone` | 15 |
| `seedsPerSettlement` (× outcome-bucket multiplier, worst→best) | base 20, ×0.5 / ×1 / ×1.5 |
| `cheapestShopSku` price | 150 |
| `mostExpensiveShopSku` price | 1200 |

Pacing intent: a normal user affords their first cosmetic within roughly a week of real use; the
catalogue is not exhaustible in under about two months.

**Shop (S8).** One bottom sheet, three sections: (1) **건물 꾸미기** — a cosmetic applied to one chosen
building (화단/간판/풍선/고양이…); ownership is permanent and separate from application, so deleting a
building never destroys a purchase. (2) **마을 꾸미기** — town-wide ground/street skins
(벚꽃길/눈 내린 마을/야시장…); **the sky is off limits** (R-12) — ground/street/props/signage only.
(3) **NPC** — extra NPC slots + species unlocks, feeding `purchasedNpcSlots` (§3).
Entry point: a 꾸미기 mini-FAB above the existing ⊕ FAB. Never a nag, never a numeric badge (a
non-numeric dot for "something newly affordable" is fine).

**캐시 충전 — STUB ONLY.** A 충전소 sheet lists packages (씨앗 for KRW) with a disabled-looking primary
action; tapping it shows exactly one message — **"토스 결제 연동은 추후 지원됩니다"** — and does nothing
else. Must NOT call `checkoutPayment`/`requestTossPayPaysBilling`/any bridge payment API, must NOT
add anything to `granite.config.ts`'s `permissions` array, and no mock receipts/fake balances/
"purchase succeeded" path.

**Invariant (non-negotiable).** 씨앗 buy cosmetics and NPC slots only. Never a build slot, never a
streak day, never a tier, never a monument, never a 저축 level. No purchase changes what a building
says about your spending.

## 7. Data model & persistence

New optional storage key, `ait.v1.economy`. Absent = a pre-economy town (no migration; every read
site defaults via `?? DEFAULT_ECONOMY_STATE`, same pattern as `savingsByCategoryKrw`).

```ts
// src/economy/economyState.ts (NEW)
/** `${n}개` only — never a thousands separator, never 원/₩ (rule R-7). */
export type SeedCount = number & { readonly __brand: "SeedCount" };

export function formatSeeds(n: SeedCount): string {
  return `${n}개`;
}

export interface EconomyState {
  seeds: SeedCount;
  /** Owned SKU ids, `deco.<family>.<slug>.v1` scheme (ADDENDUM-03 §8.3, adopted verbatim). */
  ownedSkus: string[];
  /** Currently-applied town-wide skin SKU, or null (default look). */
  appliedTownSku: string | null;
  /** Per-building applied cosmetic SKU, keyed by Building.id. */
  appliedByBuildingId: Record<string, string>;
  /** Extra NPC slots purchased in the shop — feeds F-NPC's count formula. */
  purchasedNpcSlots: number;
  /** Idempotency ledger for seed grants (ring buffer — bounded so it cannot grow forever). */
  grantedEventKeys: string[];
}

export const GRANTED_EVENT_KEYS_MAX = 500; // ring-buffer cap, engineering constant, not a balance dial

export const DEFAULT_ECONOMY_STATE: EconomyState = {
  seeds: 0 as SeedCount,
  ownedSkus: [],
  appliedTownSku: null,
  appliedByBuildingId: {},
  purchasedNpcSlots: 0,
  grantedEventKeys: [],
};

export const ECONOMY_STORAGE_KEY = "ait.v1.economy";
```

Grants are idempotent (`grantedEventKeys.includes(key)` guard before crediting) so a re-boot or a
double render cannot double-pay; past `GRANTED_EVENT_KEYS_MAX`, drop from the front before pushing.

```ts
// src/types.ts — CoreState gains one field (existing `ait.v1.core` key, via saveCore()
// — NOT a new key, same mechanism as onboarded/budget).
export interface CoreState {
  // ...existing fields (town, budget, onboarded) unchanged
  bgmMuted: boolean; // NEW — F-BGM mute flag. Default false (BGM is ON by default).
}
```

`freshCore()` (`useTownStore.ts`) and every corrupt-recovery/default-state path must set
`bgmMuted: false`. Every read site defaults via `?? false` for state written before this ships.

## 8. Supersession vs. ADDENDUM-03

ADDENDUM-03 is a proposal, never approved, never implemented. This document takes only what the
director has now actually asked for and supersedes the rest:

| ADDENDUM-03 item | Fate here |
|---|---|
| 씨앗 name, `SeedCount`, `formatSeeds`, display rules R-7/R-9a/R-9b (§5.2) | **ADOPTED verbatim** |
| R-12 — no purchase/reward may alter the sky gradient/mood line/pace bar | **ADOPTED** |
| Invariant 6 — 씨앗 buy cosmetics only, never a building/slot/streak/tier | **ADOPTED** |
| E-1 — "씨앗 come from rewarded ads and nothing else" | **SUPERSEDED** — earn rules are §6 above |
| F25 ad bubble | **OUT OF SCOPE** — not built, not stubbed, not referenced |
| F26 paid extra build (₩1,000 real money) | **OUT OF SCOPE** — not built |
| `ait.v1.economy` optional storage key (§9.2) | **ADOPTED** as the persistence shape, §7 |
| `deco.<family>.<slug>.v1` SKU id scheme + snapshot test (§8.3) | **ADOPTED** |

ADDENDUM-03's file is left on disk untouched, with a one-line status banner pointing here.

## 9. Acceptance criteria

1. `TOWN_COLUMNS === 8`, `GRID_COLUMNS === 9`, `SERPENTINE_COLUMNS.length === 8` and excludes
   `ROAD_COLUMN` — `townLayout.test.ts`.
2. `plotTileWidthPx(390)` clamps to `>= MIN_TILE_WIDTH_PX` (52) — unit test on `plotTileWidthPx`.
3. Long-press-to-move still fires inside `.town-viewport` — existing `useMoveMode`/`useTileGestures`
   suite passes unmodified against the new wrapper (pointerdown+timer DOM assertion).
4. `LAYOUT_VERSION === 2`; a pre-v2 index triggers exactly one `relayout` notice on boot —
   `storage.test.ts`.
5. **NPC count rule**: `npcCount === Math.min(1 + buildings.length + purchasedNpcSlots, 12)` for
   buildings.length ∈ {0, 5, 20}, purchasedNpcSlots ∈ {0, 3} — `npc.test.ts` on the count function.
6. `NpcLayer` root has `pointer-events: none` and is the LAST child of `.town-grid` —
   `grid.lastElementChild === npcLayerRoot` in `NpcLayer.test.tsx`; NPC species/position never appear
   in any storage key's serialized JSON — grep/scan in `storage.test.ts` (R-2 pattern).
7. `PlaceholderBuilding` renders a distinct archetype hook per the §4 table for all 16 category ids
   incl. `park`/monument — `PlaceholderBuilding.test.tsx`, one assertion per category.
8. **F16 monument behaviour unchanged**: `settlementActions.test.ts`'s existing placement/idempotency/
   outcome-bucket tests pass with zero diff to that file.
9. `AudioPort`'s no-op driver runs under vitest, no `AudioContext` construction in jsdom —
   `audio.test.ts`. `bgmMuted` defaults `false` and round-trips through `ait.v1.core` —
   `useTownStore.test.ts`.
10. **No `원`/`₩` inside `src/economy/`**: `grep -rn '[원₩]' src/economy --include=*.ts | grep -v .test.ts` returns empty.
11. **No payment-bridge import anywhere under `src/`**: grep for `checkoutPayment`/
    `requestTossPayPaysBilling` across `src/**/*.ts(x)` returns zero hits outside a comment (standing
    test `noPaymentBridge.test.ts`); `granite.config.ts`'s `permissions` array stays `[]`.
12. Tapping the 충전소 primary action shows the literal string "토스 결제 연동은 추후 지원됩니다" and
    produces no state change — `ChargeSheet.test.tsx`.
13. **Sky unaffected by any owned cosmetic**: applying every catalog SKU in sequence leaves the
    mood/sky-gradient selector's output identical to the unowned baseline — `economy.test.ts`.
14. Deleting a building with an applied cosmetic leaves its SKU in `ownedSkus`; a grant for a given
    `eventKey` is credited at most once even if called twice; `grantedEventKeys.length` never exceeds
    `GRANTED_EVENT_KEYS_MAX` after 600 grants — all three in `economy.test.ts`.
15. **Test count >= 493**: `npx vitest run --reporter=dot` Tests total `>= 493`; no existing test
    file deleted without a replacement pinning the same behaviour — CI gate.

## 10. File ownership / work split

**Phase 2 (foundation, alone first):** `src/types.ts`, `src/storage.ts`, `src/useTownStore.ts` — adds
`bgmMuted` to `CoreState`, the `EconomyState` slice + `ait.v1.economy` key, and the store
actions/selectors every other worker consumes. Ships with tests. Nobody else edits these three files.

**Phase 3 (parallel):**

| Worker | Owns |
|---|---|
| W1 layout | `src/selectors.ts`, `src/townLayout.ts`, `src/components/TownGrid.tsx`, `src/App.css` (grid section only) |
| W2 building art | `src/components/PlaceholderBuilding.tsx`, `src/components/buildingArt.tsx` (new), `src/content.placeholder.ts`, `src/buildings.css` (new) |
| W3 NPC | `src/npc/**` (new), `src/components/NpcLayer.tsx` (new), `src/npc.css` (new) |
| W4 BGM | `src/platform/audio.ts` (new), `src/bgm.ts` (new), `src/components/SettingsSheet.tsx`, `src/components/TownHeader.tsx` |
| W5 shop | `src/economy/**` (new), `src/components/ShopSheet.tsx` (new), `src/components/ChargeSheet.tsx` (new), `src/shop.css` (new) |

**CSS ownership:** only W1 touches `App.css`. Every other worker owns its own stylesheet, imported
from its own component — this is purely so five workers never merge-conflict one 1,365-line file.

`src/App.tsx` and `src/components/TownScreen.tsx` are integration files owned by the PM. Workers
export their components and state in their report exactly what wiring is needed; they do not edit
those two files.
