# ADDENDUM-01 — 저축 하위 건물 & 도로 기반 마을 레이아웃

> Proposed target path: `app_in_toss/docs/spec/ADDENDUM-01-savings-and-roads.md`
> Status: **proposal, not approved.** `MVP-SPEC.md` is untouched; the PM merges this into the spec after the director approves.
> Author: `planner` · 2026-08-03 (rev. 6) · Angle: **user-first** (optimize for the player's motivation and delight, accept higher build cost)
> Supersedes, if approved: MVP-SPEC §5 F3 (grid description **and its empty state**), §5 F13 (single 저축탑), §6 S2 (town screen elements + empty state), §6.1 art items 1/3/4/6, §8.1 `SavingCategoryId` + `TownState`, §8.2's `towerSegments` **row** (its meaning, not the function — §4.7), §13 D-2 (saving half) and D-13.
> **Also amends, and therefore requires sign-off for:**
> - **MVP-SPEC §7 invariant 3**, plus the four other places that restate it — **D-27**, full location list in **§2.8a**.
>
> **No longer amends MVP-SPEC §5 F2.** Rev. 5 left the `COLUMN_ORDER` question open (D-30) and rev. 6 answers it: the shipped column mapping is the one that **keeps "index 6 is directly below index 5" true on screen** (§3.9). F2's AC survives verbatim; it gains one clause about the cross street between blocks, listed in §2.8a. `plotFromIndex` itself was never at stake and is still byte-identical (§3.1).

**What changed in rev. 6** — the director answered the two questions rev. 4/5 refused to answer, so this revision **ships decisions instead of branches**:

1. **The five savings buildings stand ON THE STREET, on real village plots (D-32 answered: "일반 건물처럼 도로변에 실제로 배치").** The reserved band above the town is **deleted, not kept as an option.** They now occupy a fixed **저축 블록 at the head of the main street** — grid row 1, bounded by a cross street above and below, with 예적금 and 주식 투자 on the two lots that flank the main street (§2.4, §3.2, §3.3).
   **F13's core invariant survives as a structural guarantee, not as a rule anyone must remember** — and that is the part of this change worth the most scrutiny, so §2.1 proves it: savings cells live at grid row `1 .. TOWN_HEAD_ROWS-1`, and `cellFromIndex`'s row formula cannot return a row below `TOWN_HEAD_ROWS + 1` for **any** plot index. The two cell sets are disjoint by arithmetic. No reserved plot indices, no `nextPlotIndex` skipping, no deletion special case — exactly the machinery D-32 warned about, and none of it is needed.
2. **D-30 answered: screen adjacency is preserved.** `SERPENTINE_COLUMNS` ships; `COLUMN_ORDER`, `STREET_FIRST_COLUMNS` and the whole swappable-constant apparatus are deleted (§3.3, §3.9). The street-front-first *fill order* is gone with them — and the ask it was answering is now answered **better and literally**, because the buildings the director actually named are the ones standing on the street front (§0).
3. **D-31 answered: placement stays automatic.** The app chooses the plot; every plot it can choose has road frontage, proven by test. Player-chosen placement is not shipped and is not an option in this document (§3.1, §7 note).
4. **The pip row can no longer overflow at any ladder length (§2.5).** Rev. 5 had no width guard, and the on-street cell is *narrower* than the band column was (50px vs 65.2px), which would have overflowed at the placeholder ladder length of 8 rather than at 9. Pips now **wrap** into `pipRowCount(n)` rows at a derived `PIPS_PER_ROW`, the plot's height grows to fit, and `pipRowWidthPx(PIPS_PER_ROW) <= plotTileWidthPx(MIN_VIEWPORT_PX)` is an assertion (AC-F13-16). Same "container is sized from the ladder, never clamped" discipline the structure box already had.
5. **The reserved-structure-box height had two contradictory definitions; §2.5 is now authoritative and the contradiction is deleted.** Rev. 5's §2.5 said each structure's box uses *its own* ladder (`structureHeightPx(ladderFor(id).length)`) while §2.4a and §4.6 sized the box from the *longest* ladder (`districtLadderLength`). They cannot both be true. **The shared-longest rule wins** — the five plots share one grid row, and unequal boxes would misalign five labels and five pip rows across it. §2.4a and §4.6 now quote §2.5's function names and hold no numbers of their own.
6. **§2.8a is new: the complete list of every MVP-SPEC location this addendum's wording touches** — including the four a prior review found missing (MVP-SPEC:95, :693, and the diagram mentions at :135/:157/:170).

Everything rev. 5 fixed (the street's row span, the district's DOM/class contract, the R-3 stylesheet guard) still stands; §2.4a, §3.4 and §3.8 carry it forward against the new geometry.

---

## 0. What the director asked, and what this delivers

Verbatim (Discord, 2026-08-03), plus the follow-up answer:

> 1. 예적금, 주식 투자에 대한 건물도 만들어줘.
> 2. 포춘시티 처럼 배경은 마을 이었으면 해. 도로가 있고 도로 근처에 건물을 지을 수 있게 해줘
>
> (2026-08-03, answering D-32) 저축 건물은 **일반 건물처럼 도로변에 실제로 배치**.

| Ask | Delivered by | Not watered down because |
|---|---|---|
| 예적금 building | Structure `deposit` — a bank on **grid cell (row 1, col 2), the lot immediately left of the main street**, gaining a floor per level | It is a real building on a real village lot, on the best corner in town, not a strip above the town |
| 주식 투자 building | Structure `stock` — a 증권거래소 on **(row 1, col 4), the lot immediately right of the main street**, its signboard a candle chart that gains one candle per level | Same. The two buildings he named face each other across the street at the village entrance |
| 마을 배경 | The town renders as a **village block plan**: one continuous main street down the centre, a cross street above and below every block, buildings facing the road, grass/tree/텃밭 ground on unbuilt lots | The road is structural — a hard invariant of the layout function (§3.3), enforced by a test, not a background image |
| 도로 근처에 건물 | **Every rendered cell — plot *and* savings — is orthogonally adjacent to a road cell**, provably, by unit test. The 저축 블록 is the strongest case: its row has a cross street directly above *and* directly below, and the main street runs through it | This is the actual placement rule and a test assertion, not a visual hint |

**Both readings that rev. 4/5 refused to pick are now picked, by the director for D-32 and as engineering defaults for D-30/D-31** (§7 records which is which). Nothing in this document is a swappable branch any more: `COLUMN_ORDER` is gone, the band is gone, and player-chosen placement is out of scope.

**Rendering stays CSS grid + SVG.** The MVP-SPEC WON'T-list entry "Canvas / WebGL / isometric rendering" **stands** — this proposal does not overturn it and does not need it. Cost of overturning it is estimated in §5.6 for reference only; I am not asking for it.

---

## 1. How this serves the pillars (`app_in_toss/VISION.md` §2)

| Pillar | Effect of this addendum |
|---|---|
| **P-a** real habits → visible town | Strengthened, and more than in rev. 5. Savings behaviour was one undifferentiated bar of height; now the town shows *what kind* of saver you are — and it shows it **inside the town**, on the first block you see, instead of on a strip that reads as a HUD. A person who does 예적금 has a different village entrance from a person who does 주식. |
| **P-b** budgeting less like a chore | Neutral to positive. No new input step; the entry sheet gains 5 저축 categories where it currently has 0 wired (`CATEGORIES_BY_TYPE.saving` is `[]`, content.placeholder.ts:57). |
| **P-c** casual "watch something grow" | The biggest win. Today's F13 gives one growth curve. Five structures give **five independent growth curves plus five empty lots that visibly ask to be filled** — and now they are *lots in the village*, indistinguishable in kind from the lots a real building will land on, which is exactly what makes an empty one nag pleasantly. |
| **P-d** Toss-native | Unchanged. Still CSS grid, still TDS, still portrait, still no canvas, still no SDK call. Money is still never rendered on the town screen (invariant 2 preserved — levels are pips, not 원). |

A fifth line the pillars don't name but the project's failure policy does: **it is now cheaper to be honest.** The road layout is a pure rendering concern, so the director can accept, reject, or re-tune it without any of it reaching stored data — and §2.8 below reports an unflattering arithmetic result rather than restating a claim that no longer holds.

---

## 2. 저축 하위 건물 — the 마을 어귀 저축 블록 (entrance savings block)

### 2.1 The invariant, stated first — and why on-street placement did NOT weaken it

**F13's core invariant is preserved exactly, and it is still enforced structurally rather than by a rule:**

> A 저축 entry consumes **no build slot**, is **never capped**, is **never queued**, and creates **no plot building**. The app can never tell a user they saved too much today.

Rev. 5's §2.1 got this guarantee from the savings structures living *outside the grid entirely*. D-32's answer moves them **into** the grid — and the guarantee survives intact, because what it actually rests on is not "outside the grid" but **"outside plot-index space"**, and those are two different things.

**The mechanism, stated as arithmetic rather than as a promise.** Savings structures still **do not live in `buildings[]` and are never allocated a `plotIndex`.** They render from the derived aggregate `savingsByCategoryKrw` onto **fixed grid cells that no plot index can ever map to**:

```
savings cells:      row ∈ [1, TOWN_HEAD_ROWS - 1]          (today: exactly row 1)
plot cells:         row  =  plotRow + ⌊plotRow / BLOCK_ROWS⌋ + 1 + TOWN_HEAD_ROWS
                         ≥  0       + 0                    + 1 + TOWN_HEAD_ROWS
                         =  TOWN_HEAD_ROWS + 1
```

`plotRow ≥ 0` for every `i ≥ 0`, so **the smallest grid row `cellFromIndex` can return is `TOWN_HEAD_ROWS + 1`, which is strictly greater than the largest savings row, `TOWN_HEAD_ROWS - 1`.** The two cell sets are disjoint for all inputs, for any value of `TOWN_HEAD_ROWS`, forever. This is asserted (§3.8) rather than argued.

**What that buys, itemised against the cost D-32 warned about:**

| The cost rev. 5 predicted if savings went on plots | What actually happens |
|---|---|
| "Reserved indices that `nextPlotIndex` must skip, identically on every boot, on import, and during a queue drain" | **Not needed.** No index is reserved. `nextPlotIndex` allocation, `entryActions.ts`, the F14 drain and F12 import are **untouched** — they never learn that the savings block exists. |
| "A deletion path that must not free them" | **Not needed.** Savings structures are not in `buildings[]`, so `F9` deletion cannot reach them. |
| "A 저축-entry save that must touch plot allocation without touching slots" | **Not needed.** The 저축 branch of `entryActions.ts` (§4.5a) touches exactly two fields, both savings aggregates, and returns. It is byte-for-byte the branch rev. 5 specified. |
| "It collides with D-25 (monuments at intersections) over the same reserved-plot machinery" | **No collision.** It in fact *provides the pattern* D-25 would reuse: a fixed cell outside the image of `cellFromIndex`. See D-25. |

So the honest summary of the D-32 answer's engineering cost is: **it is a rendering change, not a data change.** What it does cost is listed plainly in §5.2 (three new breaks, B13–B15, all in the rendering layer) and in the trade-offs — chiefly that the entrance block seats `TOWN_COLUMNS` structures per row, which the 1fr band did not (D-17).

**Correction carried from rev. 2, still true:** `entryActions.ts`'s 저축 short-circuit (lines 106–117) currently returns `town` **by reference**, and `entryActions.test.ts:108` asserts exactly that (`expect(result.town).toBe(town); // untouched`). Accumulating `savingsByCategoryKrw` necessarily returns a new object. The *decision logic* (no slot, no build, no queue, no streak) is untouched; the *return* is not. See §5.2 break B2 and AC-F13-1, which replaces the identity assertion with a strictly stronger one.

### 2.2 Category set (content decision — director may edit freely, see D-17)

Five sub-types, replacing today's four (`types.ts:26`):

| id | Label (ko) | Structure | Lot | Visual identity | Growth reads as |
|---|---|---|---|---|---|
| `deposit` | **예적금** | 은행 | **street-front, left of the road** | Square, symmetrical, stone-coloured; a brass 도장 seal stamps down on each new floor | "차곡차곡 쌓인다" — steady, blocky floors |
| `stock` | **주식 투자** | 증권거래소 | **street-front, right of the road** | Narrow glass tower; the signboard is a candle chart that gains one candle per level; idle green/red ticker blink | "차트가 올라간다" |
| `emergency` | **비상금** | 금고 | second lot, left | Low, thick, rounded; the door gets a heavier dial and more bolts per level | "든든해진다" — grows wide, not tall |
| `goal` | **목표 저축** | 꿈의 집 | second lot, right | A house under construction that finishes progressively — scaffolding falls away at higher levels | "집이 완성되어 간다" |
| `other_saving` | **기타 저축** | 창고 | back lot, left | Plain warehouse, gains bays | Neutral catch-all |

Change vs today's set: `invest` is retired and replaced by the two the director named (`deposit`, `stock`); `emergency`, `goal`, `other_saving` are unchanged ids with unchanged meaning. Legacy handling in §4.4.

Why five and not two: the director named two, but the app already has four 저축 categories, and dropping the others to satisfy the request would make the entry sheet worse. Five is the honest reconciliation. Whether the list should be exactly this five is D-17 — and on-street placement gives D-17 a geometric consequence it did not have under the band (§7 D-17).

**The lot assignment is a prominence ranking, not a data order.** `SAVING_CATEGORY_IDS` (§4.5) is the canonical *rank* order; `SAVINGS_COLUMN_RANK` (§3.3) maps rank → grid column as `[2, 4, 1, 5, 0, 6]` — street-front pair, then the middle pair, then the back pair. Rank 0 and rank 1 are the two ids the director named, which is why they are the ones facing the street. That is a **content assumption** (one array to overturn), not a mechanic.

### 2.3 `SAVINGS_STRUCTURE` — the per-structure visual contract, in full

Unchanged from rev. 5: the physical move from a band to a village lot changes where a structure is drawn, not what it is. This is the district's equivalent of `CATEGORY_CONTENT`, and it lives in the same file (`src/content.placeholder.ts`) for the same reason: it is content the director may overturn for free, kept in one place so a rename never touches a component. Same swap-in story as `PlaceholderBuilding` — real art replaces one component, not this data.

**Every field is a closed union or a plain string; no field is left as prose.** `label`, `icon` and `color` are deliberately **not** repeated here — they already exist per id in `CATEGORY_CONTENT` (content.placeholder.ts:39-52), and duplicating them would create two sources of truth for one label. `SavingsRow` reads `CATEGORY_CONTENT[id]` for those three and `SAVINGS_STRUCTURE[id]` for everything structure-specific.

```ts
// src/content.placeholder.ts — ADDENDUM-01 §2.3
import type { SavingCategoryId } from "./types";

/** Structure family. One art family per member; adding one is an art-order line (D-22). */
export type StructureKind = "bank" | "exchange" | "vault" | "house" | "warehouse";

/** Roof/cap silhouette. Closed on purpose: the art order is one cap sprite per member (§6.1 item 4). */
export type CapShape = "gable" | "spire" | "dome" | "pitched" | "sawtooth";

/** The always-running, zero-input ambient loop. "none" is a legal value — SHOULD-tier, cuttable per structure. */
export type IdleAnim = "none" | "seal-glint" | "ticker-blink" | "dial-tick" | "scaffold-sway" | "bay-creak";

/** The one-shot animation when this structure gains a level (§2.6 step 2). */
export type RiseAnim = "seal-stamp" | "candle-add" | "bolt-add" | "scaffold-drop" | "bay-open";

export interface SavingsStructureContent {
  /** Same id as the SavingCategoryId it renders — kept so an array iteration keeps its key. */
  id: SavingCategoryId;
  kind: StructureKind;
  capShape: CapShape;
  /** Signboard text, ko. Rendered as text on the structure's board; never a 원 figure (invariant 2). */
  signboard: string;
  /** Shown on the level-0 empty lot, under the signboard (§2.4). */
  emptyHint: string;
  idleAnim: IdleAnim;
  riseAnim: RiseAnim;
  /** Toast copy on a level-up. `{label}` is substituted from CATEGORY_CONTENT[id].label; never an amount. */
  levelUpToast: string;
}

/**
 * PLACEHOLDER CONTENT — not balance, not a design decision the director is bound by (D-17).
 * Total over SavingCategoryId by construction: adding a 6th sub-type is a compile error until
 * its structure is written here, which is the point.
 */
export const SAVINGS_STRUCTURE: Record<SavingCategoryId, SavingsStructureContent> = {
  deposit: {
    id: "deposit",
    kind: "bank",
    capShape: "gable",
    signboard: "예적금 은행",
    emptyHint: "아직 비어있어요",
    idleAnim: "seal-glint",
    riseAnim: "seal-stamp",
    levelUpToast: "{label} 은행이 한 층 올라갔어요",
  },
  stock: {
    id: "stock",
    kind: "exchange",
    capShape: "spire",
    signboard: "증권거래소",
    emptyHint: "아직 비어있어요",
    idleAnim: "ticker-blink",
    riseAnim: "candle-add",
    levelUpToast: "{label} 차트에 봉이 하나 늘었어요",
  },
  emergency: {
    id: "emergency",
    kind: "vault",
    capShape: "dome",
    signboard: "비상금 금고",
    emptyHint: "아직 비어있어요",
    idleAnim: "dial-tick",
    riseAnim: "bolt-add",
    levelUpToast: "{label} 금고가 더 든든해졌어요",
  },
  goal: {
    id: "goal",
    kind: "house",
    capShape: "pitched",
    signboard: "꿈의 집",
    emptyHint: "아직 비어있어요",
    idleAnim: "scaffold-sway",
    riseAnim: "scaffold-drop",
    levelUpToast: "{label} 집이 조금 더 지어졌어요",
  },
  other_saving: {
    id: "other_saving",
    kind: "warehouse",
    capShape: "sawtooth",
    signboard: "저축 창고",
    emptyHint: "아직 비어있어요",
    idleAnim: "none",
    riseAnim: "bay-open",
    levelUpToast: "{label} 창고에 칸이 하나 늘었어요",
  },
};
```

Notes for `ui-ux` and `client-dev`:

- `CapShape` reuses the naming discipline `PlaceholderBuilding`'s `ROOF_SHAPES` already uses (`components/PlaceholderBuilding.tsx:22`) — a closed tuple of shape names, each mapping to one CSS class. The placeholder structure renders `capShape` as a CSS class exactly the way `building-roof-${roof}` does today, so no art blocks the build.
- **The footprint changed and the art order must know it (§6.1 / D-22).** A savings structure is now **one plot column wide** (`plotTileWidthPx(390) = 50px`, the same width as an ordinary building tile) and up to `structureHeightPx(8) = 128px` tall — a 1×1.78-tile column, not a band cell. The asset *count* is unchanged (base + repeatable segment + cap per family); the *aspect ratio* of the order is not.
- `idleAnim: "none"` exists so a structure can ship with no idle loop without inventing a null-object. Idle animation is SHOULD-tier (§2.7); every structure is legal at `"none"`.
- `levelUpToast` carries `{label}`, not a hardcoded 한글 name, so D-17 renaming a category never touches a toast string.
- **`SavingsRow.tsx` must import no `@toss/tds-mobile` component.** Not style preference: TDS components pull a runtime emotion stylesheet and portal behaviour, and it has to stay mountable in the bare `createRoot` + `act` harness this repo already uses (§2.9) — and it is now mounted *inside* `TownGrid`, so a TDS import would also drag that runtime into `TownGrid.test.tsx`. This is also why it does **not** own its own toast — see §2.6a, where `useTownStore`'s existing Notice FIFO does.
- **`@toss/tds-colors` under Vitest: currently unproven, and rev. 3 claimed otherwise.** Rev. 3 wrote "`PlaceholderBuilding.tsx:11` already imports them and is mounted in tests today." **That is false, and the correction matters.** Verified against the real repo:
  - No test mounts any application component. The only things ever rendered are test-local probes that return `null` — `useTownStore.test.tsx:29-32`'s `Harness`, and the equivalent in `hooks/useBackGuard.test.tsx`. Nothing under `src/components/` is imported by any of the 14 test files.
  - `@toss/tds-colors` is in **no test's module graph**. Its only importers are `content.placeholder.ts:9`, `components/PlaceholderBuilding.tsx:11`, and `theme.ts`; `content.placeholder.ts` is imported only by `EntrySheet.tsx:39` and `PlaceholderBuilding.tsx:12`; `theme.ts` is imported only by `main.tsx:8`. None of those five files is reachable from a test.
  - **So the honest status is: nothing today proves `@toss/tds-colors` even resolves under `vitest` + jsdom.** It is a `"latest"` dependency (`package.json:18`) that has only ever been loaded by Vite's dev server.
  - **What should test it, and does, one task earlier than the savings work:** the road task's `TownGrid.test.tsx` (§4.6) mounts `TownGrid` → `PlaceholderBuilding` → `content.placeholder.ts` → `@toss/tds-colors`. §3.8 adds the assertion that fails if the token module does not load or exports no value (a tile's inline `style.backgroundColor` is non-empty). The savings task therefore inherits a *proven* import rather than an assumed one.
  - **If it does not resolve** (an ESM/CJS or `exports`-map problem is the realistic failure), the mitigation is a `test.server.deps.inline` entry in `vitest.config.ts` — a config line, not a design change. Discovered by the harness task, which is where it costs least. Flagged here because rev. 3 hid it.

### 2.4 Where the structures live — exact render position

**In the town's block plan** the five structures occupy the **저축 블록: the first plot-bearing row of the town (grid row 1)**, bounded by the entrance cross street above (grid row 0) and a cross street below (grid row 2), with the main street running straight through it between 예적금 and 주식 투자.

```
grid col:   0        1        2      [3]      4        5        6
          ═══════════════════════════╪═══════════════════════════   r0  마을 어귀 (cross street)
          ┌────────┬────────┬───────┬─┬───────┬────────┬────────┐
   r1     │  🏭    │  🔒    │  🏦   │▓│  📈   │  🎯    │  🪧    │   저축 블록
          │ 기타   │ 비상금 │ 예적금 │▓│ 주식  │ 목표   │ 안내판 │   (5 structures + signpost)
          │ ●○○○○ │ ●●○○○ │ ●●●○○ │▓│ ●●○○○ │ ○○○○○ │        │   ← level pips (wrap, §2.5)
          │       │       │       │▓│       │       │        │
          ═══════════════════════════╪═══════════════════════════   r2  cross street
          │  p0   │  p1   │  p2   │▓│  p3   │  p4   │  p5    │   r3  plot row 0
          │  p11  │  p10  │  p9   │▓│  p8   │  p7   │  p6    │   r4  plot row 1
          ═══════════════════════════╪═══════════════════════════   r5  cross street
          │  p12  │  p13  │  p14  │▓│  p15  │  p16  │  p17   │   r6  plot row 2
```

Three properties of this picture are load-bearing and each is a test in §3.8:

1. **Every savings cell has road frontage on two sides** (cross street above at r0, cross street below at r2) and the two street-front lots also touch the main street. No ordinary plot in the town has three road neighbours; the savings block does. It is the best-sited block in the village, which is the point.
2. **No plot index can ever land on row 1** (§2.1's arithmetic). The block is inside the grid's *visual* space and outside its *index* space.
3. **The main street runs between `deposit` (col 2) and `stock` (col 4)** — the two buildings the director named face each other across the road at the entrance to the village.

**In `App.tsx`, exactly.** The file today (`src/App.tsx:89-98`) reads:

```tsx
      {store.buildingCount === 0 ? (                           // 89-98
        <div className="town-empty-state">
          <p>첫 지출을 기록하면 첫 건물이 생겨요</p>
          <div className="town-empty-arrow" aria-hidden="true">↘</div>
        </div>
      ) : (
        <TownGrid nextPlotIndex={…} buildings={…} justBuiltId={…} />
      )}
```

**That ternary must go, and this is break B13 (§5.2).** Under the band, the savings structures rendered outside the grid, so hiding the grid at 0 buildings was harmless. Now they *are* grid items: keeping the ternary would hide the whole 저축 블록 on a fresh install, which deletes the single strongest motivational element in this proposal (D-28). The grid therefore **always renders**, and the empty-state copy renders **in addition to it, above it**:

```tsx
      {store.canClaimNoSpend && ( … )}                         {/* 81-87, unchanged */}

      {/* ADDENDUM-01 §2.4 (break B13) — the town grid now always renders: the
          저축 블록 is a row of it, and it must exist on a fresh install. The
          empty-state copy is no longer an ALTERNATIVE to the grid, it is a
          banner above it, and it keeps F3's AC (message + ↘ arrow at 0 buildings). */}
      {store.buildingCount === 0 && (
        <div className="town-empty-state town-empty-state--with-grid">
          <p>첫 지출을 기록하면 첫 건물이 생겨요</p>
          <div className="town-empty-arrow" aria-hidden="true">↘</div>
        </div>
      )}

      <TownGrid
        nextPlotIndex={store.nextPlotIndex}
        buildings={store.buildings}
        justBuiltId={store.justBuiltId}
        savingsByCategoryKrw={store.savingsByCategoryKrw}     {/* NEW — break B14 */}
        ladder={BALANCE.savingsTowerSegments}
        ladderOverrides={BALANCE.savingsStructureSegments}
        justGrew={store.justGrew}
      />
```

`.town-empty-state--with-grid` is a compact modifier (`padding: 16px 24px` instead of `64px 24px`) so the copy, the entrance cross street and the whole 저축 블록 all sit above the fold on the 390×844 reference viewport — the arithmetic is in the fresh-install list below. The `↘` arrow is `position: fixed` (App.css:103-109) and still points at the FAB from wherever the copy sits.

**`TownGridProps` gains four props (break B14).** Rev. 5 said they were unchanged; on-street placement changes that, and the alternative is worse:

```ts
// src/components/TownGrid.tsx
export interface TownGridProps {
  nextPlotIndex: number;                                              // unchanged
  buildings: readonly Building[];                                     // unchanged
  justBuiltId: string | null;                                         // unchanged
  savingsByCategoryKrw: Partial<Record<SavingCategoryId, number>> | undefined;  // NEW
  /** The shared default ladder — BALANCE.savingsTowerSegments (D-13). */
  ladder: readonly number[];                                          // NEW
  /** Per-structure overrides — BALANCE.savingsStructureSegments (D-13a). Ships `{}`. */
  ladderOverrides: Partial<Record<SavingCategoryId, readonly number[]>>; // NEW
  /** The structure that just gained a level, and a per-event sequence number (§2.6a). */
  justGrew: { id: SavingCategoryId; seq: number } | null;             // NEW
}
```

**Rejected alternative, and why it is rejected:** passing the savings row down as a `ReactNode` prop (`savings: ReactNode`) built in `App.tsx` would keep `TownGrid` ignorant of savings — but a fresh element is created on every `App` render, so `React.memo` (`TownGrid.tsx:84`) would miss **every time** and rebuild the whole tile subtree on any unrelated state change. On the `dense` fixture that is 5,400 tiles per keystroke. The four data props are all stable references (`savingsByCategoryKrw` changes only on a 저축 save; the two ladders are module constants; `justGrew` changes only on a level-up), so memo keeps working. `tiles`' own `useMemo` deps (`TownGrid.tsx:69`) do **not** include any of them, so a level-up re-renders the five savings plots and zero tiles.

**Why both ladders arrive as props rather than being read from `BALANCE` inside the component:** the component then has no module-level dependency on the balance file, so `TownGrid.test.tsx` / `SavingsRow.test.tsx` can mount at two different ladder lengths and with a real override in the same file, with no module mocking. `App.tsx` is the only place that names `BALANCE`, which is already the pattern (`App.tsx:61`, `:65`, `:75` all read `BALANCE` and pass values down). AC-F13-7 and AC-F13-11 both depend on this being a prop.

**What a fresh install actually shows (0 buildings AND 0 savings) — the decision, stated:**

- **All five structures render. Unconditionally. There is no zero-savings hiding rule.** They render as level-0 empty fenced lots with their signboard and `emptyHint` ("아직 비어있어요"). This is the single strongest motivational element in the proposal, and on-street placement sharpens it: the user *sees the 주식 투자 lot, on the main street, before they have ever logged a 주식 투자 entry.* Fortune City's collection itch, pointed at saving.
- The fresh-install screen, top to bottom: balance banner (`.balance-banner`, App.tsx:65-69, ~33px) → `<TownHeader>` (~76px) → 무지출 button (`canClaimNoSpend` is true on a fresh town, App.tsx:81, ~60px with margins) → compact empty-state copy (~72px) → `.town-grid` top padding (8px) → **entrance cross street (22px) → 저축 블록 (170px at the placeholder ladder length, §2.5)** → cross street → the first block of empty village lots → FAB. That is **≈441px before the savings block ends**, on an 844px-tall reference viewport: the whole block, and the first ordinary plot row after it, are above the fold.
- `renderedTileCount(0) = 12`, so a fresh town also paints one full block of decorated empty lots below the savings block. That is `TownGrid`'s existing documented behaviour (`TownGrid.tsx:40-44`, "plots [nextPlotIndex, tileCount) are 'not built yet' empty lots") carried onto the block plan, and with §3.7's ground variants it reads as fields around a village rather than as vacancy.
- **The risk, named:** a fresh install now shows five "you haven't done this yet" markers *on the best lots in town*, where F13 showed one small tower. I argue that is invitation, not nagging, but it is a taste call and the alternative (hide level-0 structures until the first 저축 entry) leaves five holes in the village entrance, which is worse than the band's version of the same alternative. **D-28.**
- **[SHOULD]** When the town is scrolled past it, a 44px sticky silhouette strip (five miniature silhouettes + level pips) pins to the top; tapping it smooth-scrolls back to the entrance. Cuttable without touching the data model. Under the band this was about keeping a HUD; now it is about the village entrance scrolling away like any other block, which is arguably correct. **D-23.**

### 2.4a The savings block's DOM and class contract

The road layout names `.town-main-street`, `.town-cross-street` and `.town-tile--left/right`; the savings block names the following. **This section holds no numbers.** Every metric named here is produced by a §2.5 function and arrives inline; §2.5 is authoritative and §4.6 quotes function names only. (Rev. 5 had the reserved-box height defined twice, in two incompatible ways — that is the contradiction rev. 6 deletes.)

```html
<!-- Emitted by <SavingsRow> as a FRAGMENT — see the trap below. Each of these
     divs is a DIRECT grid item of .town-grid, placed inline (R-3, §3.5). -->
<div class="savings-plot savings-plot--bank savings-plot--cap-gable savings-plot--empty"
     data-structure-id="deposit"
     style="grid-column:3; grid-row:2;                     /* savingsCellFor('deposit') + 1 */
            height:170px;                                  /* savingsPlotHeightPx(len) */
            grid-template-rows:128px 16px 14px">           /* savingsPlotTemplateRows(len) */
  <div class="savings-structure" style="height:32px">      <!-- structureLevelHeightPx(level) -->
    <div class="savings-structure-board">예적금 은행</div>   <!-- SAVINGS_STRUCTURE[id].signboard -->
    <div class="savings-structure-hint">아직 비어있어요</div> <!-- emptyHint; level 0 only -->
  </div>
  <div class="savings-structure-label">예적금</div>          <!-- CATEGORY_CONTENT[id].label -->
  <div class="savings-structure-pips">
    <span class="savings-pip savings-pip--on"></span>       <!-- one node per ladder step; wraps -->
    <span class="savings-pip"></span> …
  </div>
</div>
<!-- × 5, emitted in SAVINGS_ROW_ORDER (left→right on screen, §3.3) -->
<div class="savings-signpost" style="grid-column:7; grid-row:2"></div>
```

⚠️ **The trap, named because it is silent: `SavingsRow` must return a `<>…</>` fragment, never a wrapping element.** A wrapper `<div>` becomes a *single* grid item, so all five structures would be laid out inside one 50px cell — a plausible-looking screenshot with a squashed pile at column 1, and nothing would fail. §3.8's direct-children-count AC is the guard.

| Class | Node | Count | Carries | Read by |
|---|---|---|---|---|
| `.savings-plot` | one village lot | 5 | `data-structure-id`; inline `gridColumn`/`gridRow` from `savingsCellFor(id)`; inline `height` = `savingsPlotHeightPx(…)`; inline `gridTemplateRows` = `savingsPlotTemplateRows(…)` | AC-F13-7, -17, -18 |
| `.savings-plot--<kind>` | same node | 5 | `StructureKind` as a paint class — the discipline `building-roof-${roof}` already uses (`PlaceholderBuilding.tsx:22`) | `ui-ux` |
| `.savings-plot--cap-<capShape>` | same node | 5 | `CapShape`, same reason | `ui-ux` |
| `.savings-plot--empty` | same node | 0-5 | present iff `level === 0`; drives the fenced-lot look and shows `emptyHint` | AC-F13-8 |
| **`.savings-plot--rise`** | same node | 0 or 1 | **the class AC-F13-10(c) asserts.** Added while `justGrew?.id === id`, keyed on `justGrew.seq` (§2.6a) so a repeat level-up of the same structure re-plays | AC-F13-10(c) |
| `.savings-structure` | the drawn structure / empty lot, row 1 of the plot's internal grid | 5 | inline `height` = `structureLevelHeightPx(level)`; bottom-aligned in its reserved row (`align-self: end`) | AC-F13-7/-8 |
| `.savings-structure-board` | signboard inside the structure | 5 | `SAVINGS_STRUCTURE[id].signboard`, text only — never an amount (invariant 2) | AC-F13-8/-9 |
| `.savings-structure-hint` | inside the structure | 0-5 | `emptyHint`, rendered only at level 0 | AC-F13-8 |
| `.savings-structure-label` | row 2 of the plot | 5 | `CATEGORY_CONTENT[id].label` | AC-F13-8 |
| `.savings-structure-pips` | row 3 of the plot | 5 | wrapping flex row of pips | AC-F13-11(b), -16 |
| `.savings-pip` / `.savings-pip--on` | one per ladder step | `ladderFor(id, …).length` each | `--on` for earned levels. **Pips, never 원** | AC-F13-11(b), AC-F13-9 |
| `.savings-signpost` | 마을 안내판 | 0-1 | decoration only (R-2): the first free cell of the savings rows in column-rank order. With today's five ids that is exactly grid col 6 | AC-F13-18 |

Three properties this buys, each of which is an AC that was previously unanchored: AC-F13-8 counts `.savings-plot` nodes rather than "structure nodes"; AC-F13-10(c) has a selector (`querySelectorAll(".savings-plot--rise").length === 1`); AC-F13-11(b) compares `.savings-pip` counts per `data-structure-id` instead of relying on DOM order. The class names themselves are an **assumption** (naming, not behaviour) and cost one rename to overturn.

**DOM order equals screen order.** `SavingsRow` emits in `SAVINGS_ROW_ORDER` — `SAVING_CATEGORY_IDS` sorted by grid column, i.e. `["other_saving", "emergency", "deposit", "stock", "goal"]` — so a screen reader walks the entrance block left to right and does not read a prominence ranking the sighted user cannot see. The order is **derived** from `SAVINGS_COLUMN_RANK`, never hand-written twice (§3.3).

### 2.5 Growth / tiering per structure — **the authoritative geometry section**

> **Authority rule, added in rev. 6.** Every district metric — the reserved box height, the plot height, the row template, the pip wrap — is defined **here and only here**, as a function in `src/townLayout.ts`. §2.4a and §4.6 may name those functions; they may not restate a number. Rev. 5 defined the reserved box twice (per-structure in §2.5, shared-longest in §2.4a/§4.6) and the two definitions disagreed.

Each structure has its own level, derived from its own cumulative amount, using the **existing** `towerSegments` selector unchanged (§4.7):

```
level(id) = towerSegments(savingsByCategoryKrw[id] ?? 0, ladderFor(id, ladder, ladderOverrides))
```

**`ladderFor` is a real function, not shorthand.**

```ts
// src/selectors.ts — APPEND. Takes both ladders as arguments, so selectors.ts
// keeps importing only ./calendar and ./types (its header rule, lines 10-11) —
// same injection discipline `towerSegments` and `canClaimNoSpend` already use.
export function ladderFor(
  id: SavingCategoryId,
  defaultLadder: readonly number[],
  overrides: Partial<Record<SavingCategoryId, readonly number[]>>,
): readonly number[] {
  return overrides[id] ?? defaultLadder;
}
```

`selectors.ts`'s existing type import (line 11) gains `SavingCategoryId`. That is a type-only addition; nothing else in the file is opened. Every level read in the app goes through `ladderFor` — there is no second place that decides which ladder a structure uses, which is what makes AC-F13-11 a real assertion instead of a description.

- Default ladder = `BALANCE.savingsTowerSegments` (`balance.placeholder.ts:25-28`), **unchanged and still a flagged placeholder**. No new balance numbers are invented by this addendum.
- Per-sub-type ladders are supported by the data shape (`savingsStructureSegments`, §4.3) and reach the component, but ship **empty**, meaning every structure resolves to the default. Whether 예적금 and 주식 투자 deserve different curves is **D-13a**.
- **Level is displayed as pips, never as 원** (invariant 2 preserved). The KRW figure lives in 기록 only.
- A structure never shrinks except by deleting the underlying entries (F13's rule, unchanged, now per-structure).

**Heights are derived from the ladder and never clamped.** Sizing segments to fit a fixed box is a silent-failure design: the day the director's balance pass lengthens `savingsTowerSegments`, a clamp wins and the block either squashes segments below legibility or overflows, and nothing tells anyone. The ladder is a director-owned constant (D-13); the layout must survive any value it takes. So the dependency is inverted — **the cell is sized from the ladder**, and in rev. 6 that now also covers the pip row, which rev. 5 left unguarded.

```ts
// src/townLayout.ts — layout px, not balance dials (assumption: pixel values, director may retune)
export const SEG_BASE_PX = 18;            // plinth / ground floor
export const SEG_STEP_PX = 12;            // one level
export const SEG_CAP_PX = 14;             // roof / signboard cap
export const LABEL_ROW_PX = 16;           // 예적금 / 주식투자 … label row
export const DISTRICT_ROW_GAP_PX = 6;     // between the plot's three internal rows

/**
 * Pip metrics. These three were `App.css` literals through rev. 5 ("paint, not
 * measurement"). They stop being paint the moment the wrap arithmetic below
 * computes with them, so R-3 moves them here and the stylesheet reads them as
 * --pip-size / --pip-gap / --pip-row-gap with no fallback (§3.5).
 */
export const PIP_SIZE_PX = 5;
export const PIP_GAP_PX = 3;              // between pips on one line
export const PIP_ROW_GAP_PX = 4;          // between wrapped pip lines (NEW constant)

/**
 * The narrowest viewport the town is laid out for. Used ONLY to derive
 * PIPS_PER_ROW, so the guard is evaluated at the width where it is tightest.
 * (Assumption: 320px, the small-Android / iPhone-SE floor. Director may retune.)
 */
export const MIN_VIEWPORT_PX = 320;

/** Width of one line of `count` pips. The number rev. 5 never computed. */
export function pipRowWidthPx(count: number): number {
  return count <= 0 ? 0 : PIP_SIZE_PX * count + PIP_GAP_PX * (count - 1);
}

/**
 * How many pips fit on one line of a savings plot at the NARROWEST supported
 * viewport — derived, never typed in. `plotTileWidthPx` is the same function
 * the tile width comes from (§3.3), so a change to GRID_GAP_PX / ROAD_WIDTH_PX /
 * GRID_PADDING_X_PX moves this with it instead of silently overflowing.
 * Today: floor((38.33 + 3) / (5 + 3)) = 5.
 */
export const PIPS_PER_ROW = Math.max(
  1,
  Math.floor((plotTileWidthPx(MIN_VIEWPORT_PX) + PIP_GAP_PX) / (PIP_SIZE_PX + PIP_GAP_PX)),
);

/** Pip lines needed for a ladder of `ladderLength` steps. Always >= 1. */
export function pipRowCount(ladderLength: number): number {
  return Math.max(1, Math.ceil(ladderLength / PIPS_PER_ROW));
}

/** Height of the whole (wrapping) pip block. */
export function pipBlockHeightPx(ladderLength: number): number {
  const rows = pipRowCount(ladderLength);
  return rows * PIP_SIZE_PX + (rows - 1) * PIP_ROW_GAP_PX;
}

/**
 * Height reserved for the structure itself — ALWAYS the full ladder, so a
 * level-up never reflows the row. Called ONCE per render, with
 * `districtLadderLength(...)`: all five plots share one grid row, and unequal
 * boxes would misalign five labels and five pip blocks across it. (This is the
 * rev.-5 contradiction, resolved in favour of the shared-longest rule; the
 * per-structure variant `structureHeightPx(ladderFor(id).length)` is deleted.)
 */
export function structureHeightPx(ladderLength: number): number {
  return SEG_BASE_PX + SEG_STEP_PX * ladderLength + SEG_CAP_PX;
}

/** Rendered height of a structure currently at `level` — bottom-aligned inside the reserved box. */
export function structureLevelHeightPx(level: number): number {
  return SEG_BASE_PX + SEG_STEP_PX * level + SEG_CAP_PX;
}

/** Total height of one savings plot: reserved box + label row + wrapping pip block. */
export function savingsPlotHeightPx(ladderLength: number): number {
  return (
    structureHeightPx(ladderLength) +
    DISTRICT_ROW_GAP_PX + LABEL_ROW_PX +
    DISTRICT_ROW_GAP_PX + pipBlockHeightPx(ladderLength)
  );
}

/**
 * The plot's three internal rows. Generated so App.css holds none of the three
 * numbers, and so `savingsPlotHeightPx` (the inline height) and the template are
 * provably the same arithmetic:
 *   savingsPlotHeightPx(n) === sum(rows) + 2 * DISTRICT_ROW_GAP_PX.
 */
export function savingsPlotTemplateRows(ladderLength: number): string {
  return `${structureHeightPx(ladderLength)}px ${LABEL_ROW_PX}px ${pipBlockHeightPx(ladderLength)}px`;
}

/**
 * The ladder length the BLOCK is sized to: the longest ladder any structure
 * resolves to. With `overrides = {}` this is just `defaultLadder.length`; with a
 * D-13a override longer than the default it is that override's length, so one
 * structure with a longer curve makes the row taller instead of clipping.
 * (Imports `SAVING_CATEGORY_IDS` from ./savingsBuckets — a pure types-only module, §4.5.)
 */
export function districtLadderLength(
  defaultLadder: readonly number[],
  overrides: Partial<Record<SavingCategoryId, readonly number[]>>,
): number {
  return SAVING_CATEGORY_IDS.reduce((max, id) => Math.max(max, ladderFor(id, defaultLadder, overrides).length), 0);
}
```

**What is gone, and why.** `DISTRICT_COLUMNS`, `DISTRICT_COL_GAP_PX`, `DISTRICT_PADDING_X_PX`, `structureWidthPx` and `DISTRICT_TEMPLATE_COLUMNS` are **deleted**. They existed to give the band its own column system; the savings plots are now grid items of `.town-grid`, so **width, column gap and horizontal padding are the town grid's** (`plotTileWidthPx`, `GRID_GAP_PX`, `GRID_PADDING_X_PX`) and there is exactly one column system in the app instead of two. `districtHeightPx` / `districtTemplateRows` are renamed to `savingsPlotHeightPx` / `savingsPlotTemplateRows`, because they now size one lot rather than a band.

**Worked values** at the **placeholder** ladder length of 8 (`balance.placeholder.ts:25-28` — D-13, may change) with `savingsStructureSegments = {}`, on the 390px reference viewport:

| Quantity | Function | Value |
|---|---|---|
| Ladder the block is sized to | `districtLadderLength(ladder, {})` | 8 |
| Reserved structure box | `structureHeightPx(8) = 18 + 96 + 14` | **128px** |
| A level-0 structure | `structureLevelHeightPx(0) = 18 + 0 + 14` | **32px** |
| Pips per line | `PIPS_PER_ROW` (derived at 320px) | **5** |
| Pip lines at 8 steps | `pipRowCount(8) = ⌈8 / 5⌉` | **2** |
| Pip block | `pipBlockHeightPx(8) = 2×5 + 1×4` | **14px** |
| Whole plot | `savingsPlotHeightPx(8) = 128 + 6 + 16 + 6 + 14` | **170px** |
| Internal template | `savingsPlotTemplateRows(8)` | `"128px 16px 14px"` |
| Plot width | `plotTileWidthPx(390)` — the same width as any building tile | **50px** |
| Widest pip line | `pipRowWidthPx(5) = 25 + 12` | **37px** ≤ `plotTileWidthPx(320) = 38.33px` ✔ |

The template's three values plus the two 6px gaps sum back to 170 — asserted (AC-F13-16), so the inline height and the inline row template can never disagree.

`SEG_STEP_PX` is never scaled down to fit and pips are never shrunk to fit; a longer ladder makes a **taller entrance block**, which scrolls with the town, so there is no viewport to overflow. The failure mode this removes is exactly the one the loop's failure policy names: a balance change that quietly degrades a screen instead of loudly resizing it.

### 2.6 The moment of reward

When a 저축 entry crosses a threshold for its sub-type:

1. The town auto-scrolls to that structure's lot (same mechanism as `TownGrid.tsx:72-75`'s `justBuiltId` auto-scroll — a ref + `scrollIntoView`, keyed on `justGrew.seq` instead). The block is at the top of the town, so this is a scroll *up* to the village entrance.
2. That structure's new segment rises with its own `riseAnim` — the bank stamps a seal, the exchange's chart gains a candle, the vault's door gains bolts, the house drops scaffolding.
3. Toast: `SAVINGS_STRUCTURE[id].levelUpToast` with `{label}` substituted (never an amount).

When a sub-type goes from level 0 to level 1, the empty lot is **replaced** by the structure with a longer "터 닦기 → 건물" animation (~900ms). First-time-per-structure only, derived from `level === 1 && justGrew?.id === id`, no extra stored state.

#### 2.6a Who detects the crossing, and who owns the toast

`useToast`/`openToast` live in `@toss/tds-mobile` (`App.tsx:2`, `:23`), which §2.3 forbids `SavingsRow` from importing — and now forbids doubly, since `SavingsRow` mounts inside `TownGrid` and would drag the TDS runtime into `TownGrid.test.tsx` too. **`useTownStore` owns the toast, through the Notice FIFO it already owns.**

**Layer 1 — the detector.** One pure function, appended to `selectors.ts`:

```ts
// src/selectors.ts — APPEND. Ladders injected (same rule as `ladderFor`).
// Iterates the keys of the AFTER map only: a level can rise for an id that is
// absent before, never for one absent after, so no id list is needed here.
export function grownStructures(
  before: Pick<TownState, "savingsByCategoryKrw">,
  after: Pick<TownState, "savingsByCategoryKrw">,
  ladderOf: (id: SavingCategoryId) => readonly number[],
): SavingCategoryId[] {
  const grown: SavingCategoryId[] = [];
  for (const key of Object.keys(after.savingsByCategoryKrw ?? {})) {
    const id = key as SavingCategoryId;
    const ladder = ladderOf(id);
    const was = towerSegments(before.savingsByCategoryKrw?.[id] ?? 0, ladder);
    const now = towerSegments(after.savingsByCategoryKrw?.[id] ?? 0, ladder);
    if (now > was) grown.push(id);
  }
  return grown;
}
```

By construction it returns **at most one id per save** — one entry has one `categoryId`, so `savingsBucketOf` raises exactly one bucket (§4.5a). It returns an array anyway so the import (F12) and corrupt-core recovery paths, which can move several buckets at once, use the same function instead of a second one.

**Layer 2 — the caller.** `useTownStore.addEntry`, immediately after `applyNewEntry` returns, comparing `prev.town` against `result.town` (both already in hand at `useTownStore.ts:289-302`):

```ts
const grown = grownStructures(prev.town, result.town, (id) =>
  ladderFor(id, BALANCE.savingsTowerSegments, BALANCE.savingsStructureSegments));
if (grown.length > 0) {
  setJustGrew({ id: grown[0], seq: growSeqRef.current++ });
  pushNotices(...grown.map((id): Notice => ({ kind: "savings", id })));
}
```

`useTownStore` is the right layer and not an arbitrary one: it is the only place that holds both the pre-save and post-save town, it already imports `BALANCE` (line 32), and it already owns every other one-shot player notification through `pushNotices` (lines 203-206, 336, 379).

**Layer 3 — the renderer.** `App.tsx:30-35`'s existing effect pops every non-`tier` notice as a toast. `Notice` gains one member and `App.tsx:32`'s ternary gains one branch (§3.6 adds a second, for `relayout`; both counted in break **B8**):

```ts
// useTownStore.ts — Notice union (lines 88-91), one added member
  | { kind: "savings"; id: SavingCategoryId };

// content.placeholder.ts — the one place that joins the two content records
export function levelUpToastFor(id: SavingCategoryId): string {
  return SAVINGS_STRUCTURE[id].levelUpToast.replace("{label}", CATEGORY_CONTENT[id].label);
}
```

**`justGrew` carries a sequence number, and that is not decoration.** `justBuiltId` gets away with being a bare id because building ids are unique per build, so the value always changes and the effect always re-runs. A bare `SavingCategoryId` does not: saving into 예적금 twice in a row and crossing a threshold both times sets the same value, React sees no change, and **the second rise animation never plays**. So:

```ts
justGrew: { id: SavingCategoryId; seq: number } | null   // seq monotonic per session
```

The rise-animation effect keys on `justGrew?.seq`. Like `justBuiltId`, it is **never cleared back to `null`** (`useTownStore.ts:196`) — the animation class is driven by `seq` changing, not by the value returning to null.

**[COULD]** When all five structures are at level ≥ 1, a 마을 어귀 아치 lights up over the entrance — and on-street placement gives it an exact home: the signpost cell (§2.4a). A completionist nudge toward diversified saving. Zero data cost (derived), but it is product advice aimed at the user's finances, so it is the director's call — **D-19**.

### 2.7 MoSCoW

| | Item |
|---|---|
| **MUST** | 5 저축 categories wired into the entry sheet (incl. re-enabling the disabled 저축 segment, `EntrySheet.tsx:157`); `savingsByCategoryKrw`; the 저축 블록 at the head of the street with 5 always-visible structures on real village lots; per-structure level from its own ladder; ladder-derived plot height **and pip wrap**; segment-rise animation; the block scrolls with the town |
| **SHOULD** | Sticky collapsed strip when scrolled past the entrance (D-23); per-structure `idleAnim`; per-structure distinct `riseAnim`; the 안내판 signpost tile |
| **COULD** | 마을 어귀 아치 (D-19); 저축 breakdown donut in 기록 |
| **WON'T** | Any savings structure being allocated a `plotIndex`, entering `buildings[]`, consuming a build slot, or entering the F14 queue. (Note the wording change vs rev. 5: a savings structure now *does* occupy a **cell**. What it must never occupy is an **index**.) |

### 2.8 The counterweight, recomputed — and why invariant 3 needs sign-off

MVP-SPEC §7's invariant 3 reads, verbatim:

> **Amount drives exactly one visual, the 저축탑, and only via 저축.** Everywhere else, `amountKrw` is invisible to the town.

That section's own header reads "**Design invariants (violating one needs director sign-off)**". **This addendum makes amount drive five visuals instead of one.** That is a direct violation of invariant 3, in exactly the way D-18 already (correctly) requests sign-off for invariant 1. **D-27** is the sign-off request, and **§2.8a lists every place in MVP-SPEC that restates the old wording** — rev. 5 named two of them and a later review found three more.

**F13's argument, and whether it survives.** F13 (MVP-SPEC:267) claims:

> Here, **the single tallest thing in town can only be built by saving**, and it is the only object in the app whose size responds to an amount.

That is two claims. They do not fare the same. **The arithmetic**, now with on-street geometry (the savings structure is one plot column wide, so the comparison is finally like-for-like):

| Quantity | Source | Value |
|---|---|---|
| One ordinary building tile's height | `App.css:136` `grid-auto-rows: 72px`, kept as `TILE_HEIGHT_PX` (§3.5) | **72px** |
| One ordinary building tile's width, after the street | `plotTileWidthPx(390)` (§3.3) | **50px** |
| A savings structure at level *L* | `structureLevelHeightPx(L) = 32 + 12L` (§2.5) | 32px at L=0 |
| A savings structure at the **placeholder** ladder's max (8 levels, D-13) | `structureHeightPx(8)` | **128px** |
| Savings structure width | `plotTileWidthPx(390)` — the *same function* as a building tile now | **50px** |

1. **A structure only out-tops one ordinary building at level 4 of 8.** `32 + 12L > 72` ⟺ `L > 3.33` ⟺ `L ≥ 4`. At level 3 a structure is 68px — *shorter* than a plain 밥값 building next door. (The 12px/level figure is my assumption and the director may retune it; the *ladder length* is D-13's placeholder, so the "8" moves too. The formula, not the number, is the point.)
2. **At max, one structure is 1.78 ordinary tiles tall** (128 / 72) and exactly one tile wide. Five of them is `5 × plotTileWidthPx(390) × structureHeightPx(8)` = 5 × 50 × 128 = **32,000 px² of amount-driven pixels**. (Rev. 5 read 41,728 px² from the band's wider 65.2px column; on-street lots are narrower, so the number went *down*. Both figures are read from `townLayout.ts` functions, so neither can drift from what is painted.)
3. **The town outgrows that by three orders of magnitude.** The `dense` fixture is ~5,400 buildings (`devtools/fixtures.ts:305`, and `fixtures.test.ts:56` asserts > 5,000) at `plotTileWidthPx(390) × TILE_HEIGHT_PX` = 50 × 72 = 3,600 px² each: **19.44M px²**. The savings block is **0.16%** of a three-year town's painted area.
4. **The split did not cause this.** F13's single tower on the same ladder and the same segment px is also 128px — 1.78 tiles, 0.03% of a dense town. The "single tallest thing in town" claim was **already false at one tower**; going to five exposed it rather than created it.

**Verdict, plainly: the height half of F13's counterweight claim does not hold, and did not hold before this addendum either. It must be struck from the spec, not re-worded.** No arrangement of a bounded-height structure beats an unbounded grid of 72px tiles; a town that grows forever will always dwarf a structure whose height is a bounded ladder.

**What actually carries the counterweight, and it is the half that does survive intact: exclusivity.**

> `amountKrw` is invisible to the town **everywhere except 저축**. Logging a 1,000원 coffee and a 1,000,000원 sofa produce the identical building (`entryActions.test.ts:70-77` asserts exactly this today). Saving more is the *only* input in the entire app that changes the size of anything.

That is the structural anti-perverse-incentive property, it is what MVP-SPEC §1.1's "split the arrow into three" actually rests on, and this addendum **strengthens it** — the surface on which amount is expressed goes from one tower to five buildings on the best block in the village, while the number of amount-driven *spending* visuals stays at exactly zero. Invariant 3's operative clause should therefore become "**and only via 저축**", with the "exactly one visual" count dropped:

> **Proposed invariant 3 (for D-27):** *Amount drives visuals only in the 저축 블록, and only via 저축 entries. No 지출 or 수입 amount, at any magnitude, changes the size, height, count or appearance of anything in the town.*

Note what that costs and what it buys: it is **weaker as a count** (five, and a future sixth sub-type adds another) and **exactly as strong as a rule** (spending still moves nothing). The count was never the load-bearing part; the direction was.

**If the director wants a real size-based counterweight** — something in the town that visibly grows with saving *relative to* the spending town — every candidate is a new gameplay mechanic with new constants (e.g. block height scaling with savings-vs-town-size, a savings-gated town-wide visual state). **I am not picking one and not inventing its numbers.** Surfaced as **D-29**.

### 2.8a Every MVP-SPEC location this addendum's wording touches

Rev. 5 named two restatement sites for invariant 3; a later review found three more, and the on-street move adds two of its own. This is the complete list, so the PM can amend MVP-SPEC in one pass instead of leaving stale sentences behind. **Nothing here is edited by this document — MVP-SPEC.md is untouched until the director approves.**

| MVP-SPEC | What it says today | Amendment | Gate |
|---|---|---|---|
| **:54** (§1.1 bullet 3) | "**One structure — the 저축탑 —** is the only thing in the app whose size is driven by an amount" | Replace with invariant 3's proposed text (§2.8) — five structures, exclusivity unchanged | **D-27** |
| **:95** (§2 mapping table, "(no equivalent) ADDED") | "**저축 as a first-class entry type + 저축탑**, the single structure whose size is amount-driven. Makes the anti-perverse-incentive claim structural instead of ambient." | "저축 as a first-class entry type + **저축 블록** (5 buildings at the head of the street), the **only** visuals whose size is amount-driven." Same edit as :54; **third restatement site, missed by rev. 5** | **D-27** |
| **:135** (§4 core-loop diagram) | "skyline band: 저축탑 (height = 누적 저축)" | "마을 어귀 저축 블록: 5동 (도로변 첫 블록)" — the band no longer exists in any form | Editorial, follows D-32 |
| **:157** (§4 diagram, the 저축 branch) | "저축탑 grows" | "해당 저축 건물이 자란다" | Editorial |
| **:170** (§4 diagram, step [4]) | "저축탑 → maybe a new segment" | "해당 저축 건물 → maybe a new level" | Editorial |
| **:220** (§5 F2 AC, last sentence) | "Building at index 6 is directly below index 5 (serpentine adjacency), verified by unit test on `plotFromIndex` for i = 0..23." | **Survives verbatim** (D-30 answered: screen adjacency preserved, §3.9). Add one clause: *"— and on screen too (`cellFromIndex`, ADDENDUM-01 §3.3), except across a block boundary, where the two plots share a column and a cross street lies between them."* | One added clause |
| **:223** (§5 F3) | "A fixed skyline band above the grid renders the 저축탑" | "The town's first block is the 저축 블록: five savings buildings on village lots at the head of the main street" | Follows D-32 |
| **:224** (§5 F3 AC) | "0 buildings → '첫 지출을 기록하면 첫 건물이 생겨요' with an arrow to the FAB" | **Still true**, plus: *"the town grid also renders (it carries the 저축 블록); the copy is a banner above it, not a replacement for it."* | Break **B13** |
| **:265-268** (§5 F13) | The whole 저축탑 mechanic + its ACs | Superseded by §2 (five structures, per-structure ladders, no tower) | Supersession |
| **:328** (§6 S2 row) | "skyline band with **저축탑**" in Key elements; "**dense:** … full tower" | "저축 블록 (5 buildings, entrance block)"; dense → "full block (all five at max level)" | Supersession |
| **:346** (§6.1 art item 4) | "저축탑 segments — 1 base + 1 repeatable segment + 1 cap" | 5 families × (base + segment + cap) + 5 signboards + 1 안내판 tile, drawn to a **1-plot-column footprint** (§2.3) | **D-22** |
| **:370** (§7 gamification table, 저축탑 row) | "The only amount-driven visual in the app" | "The only amount-driven visuals in the app" + row renamed 저축 블록 | **D-27** |
| **:381** (§7 invariant 3) | "Amount drives exactly one visual, the 저축탑, and only via 저축." | The proposed replacement in §2.8 | **D-27** |
| **:403** (§8.1 `SavingCategoryId`) | `'emergency' \| 'goal' \| 'invest' \| 'other_saving'` | §4.1's five ids + `LegacySavingCategoryId` | Supersession |
| **:464** (§8.1 `TownState`) | `cumulativeSavingsKrw` comment "denormalized for tower height" | + `savingsByCategoryKrw?`; comment → "per-structure levels" | §4.1 |
| **:484** (§8.2 selector table) | "`towerSegments` — count of `savingsTowerSegments` thresholds ≤ `cumulativeSavingsKrw`" | The **function** is unchanged and reused; only its *argument* changes (per-structure amount + per-structure ladder). §4.7 states this in full | §4.7 |
| **:535** (§9 balance file) | `savingsTowerSegments` comment | "the **default** ladder for every savings structure" + new `savingsStructureSegments: {}` | §4.3, D-13a |
| **:693** (Trade-offs, item 3) | "**저축 entries are unverifiable.** The 저축탑 is the one amount-driven visual, so a user can inflate **the tallest thing in town** by logging savings that never happened." | **The reasoning changes, not just the noun.** The inflation surface goes from one structure to five, so the honest restatement is: *"저축 entries are unverifiable, and there are now five things to inflate instead of one — a user can raise any of the five savings buildings by logging savings that never happened, and can do it selectively (all 예적금, no 주식). No fix exists without bank sync (D-6). Accepted because the failure mode is self-deception in a personal tool with no leaderboard and no reward economy, invariant 1 keeps it from unlocking anything, and the five-way split makes the self-deception more specific rather than larger — the same fake 100만원 now has to be attributed to a named savings type the user chose."* **Missed by rev. 5** | Editorial, but it is an argument the spec leans on |
| **:661** (§13 assumptions) | "monuments and 저축 entries consume no slot" | **No change — still true**, and §2.1 proves it more strongly than before | — |

### 2.9 AC, and what can actually test each one

**The problem, checked rather than assumed.** Against the real repo:

- There is **no component test anywhere**: the only `*.test.tsx` files are `src/useTownStore.test.tsx`, `src/useTownStore.retention.test.tsx` and `src/hooks/useBackGuard.test.tsx` — all hook harnesses. **Nothing under `src/components/` has a test.**
- There is **no `@testing-library/react`**, no `@testing-library/jest-dom`, no `@testing-library/user-event` in `package.json` (devDependencies, lines 24-39).
- The existing harness pattern is **bare `createRoot` from `react-dom/client` + `act` from `react`** — `useTownStore.test.tsx:17-18`, `useBackGuard.test.tsx:6-7`. Its own header comment says so: *"No React Testing Library in this project (T002's dependency set) — a minimal `react-dom/client` + `act` harness is enough"* (`useTownStore.test.tsx:11-15`).
- `vitest.config.ts` sets `environment: "jsdom"` (line 5) and includes `src/**/*.test.tsx` (line 6). **jsdom has no layout engine**: `offsetWidth`, `clientWidth`, `clientHeight`, `scrollHeight` and `getBoundingClientRect()` all return 0. A `scrollHeight <= clientHeight` assertion is `0 <= 0` — it passes without testing anything, forever.
- `vitest.config.ts` does **not** set `test.css`, so Vitest's default (`css: false`) applies: **`App.css` is never applied in any test.** Any assertion about a rule in the stylesheet (a class's computed width, a roof's `left` offset) is vacuous. Only **inline** styles are readable, and those the components do set (`TownGrid.tsx:58` sets `gridColumn`/`gridRow` inline).

**So: no new dependency is required, but a new *file* and a shared mount helper are** — the repo's first component test. That is an explicit line item with a cost, in §6. Adding `@testing-library/react` is **not** proposed: the existing 20-line harness covers node counting, class checks, inline-style reads and text scans, which is everything below that is automatable. What it cannot do is geometry, and no library fixes that in jsdom — only a real browser would, and that is `qa`'s job here.

**One consequence of on-street placement worth stating: the savings ACs now run inside `TownGrid.test.tsx`'s mount**, because `SavingsRow` is not independently mountable in a way that proves anything — its children are grid items and their placement is only meaningful inside `.town-grid`. `SavingsRow.test.tsx` still exists for the per-structure content ACs (-8, -9, -11b); the placement ACs (-17, -18) live with the grid.

**Disposition legend:** `[unit]` pure function, no DOM · `[dom]` jsdom mount via `createRoot` + `act`, inline styles / node counts / text only · `[qa]` observed by `qa` driving the real running build, reported as evidence.

| # | AC | How |
|---|---|---|
| **AC-F13-1** | Logging 저축 of any sub-type leaves `slotsUsedToday`, `slotsUsedOn`, `nextPlotIndex`, `queue`, `buildings`, `streakDays`, `longestStreakDays`, `lastActOn`, `highestTierSeen`, `noSpendDays` and `lastSettledPeriod` **all equal to their pre-save values** — assert the whole `TownState` minus the two savings fields. Replaces `entryActions.test.ts:108`'s `toBe(town)` identity check, which the accumulation necessarily invalidates (§5.2 B2). | `[unit]` |
| **AC-F13-2** | `result.building === null`, `result.queuedMaterial === null`, `result.queueOverflow === false`, `result.celebrateTier === null` for every 저축 save, at every slot/queue state. | `[unit]` |
| **AC-F13-3** | **The sharp one.** With `slotsRemainingToday(town, today, dailyBuildSlots) === 0` **AND** `town.queue.length === materialQueueMax`, a 저축 entry **still saves, still increments its `savingsByCategoryKrw` bucket, and still grows its structure when it crosses a threshold** — and **no** refusal/overflow toast appears (`queueOverflow` stays `false`; `App.tsx:51-53`'s "대기열도 가득 찼어요" must not fire). This is the exact state where a 지출 entry is refused a material. | `[unit]` for the state assertion + `[qa]` for the toast: load the `queueFull` fixture, log one 저축 entry of at least `BALANCE.savingsTowerSegments[0]`, observe the structure go 0 → 1 and no overflow toast |
| **AC-F13-4** | `savingsByCategory(entries, savingsBucketOf)` sums only `type === "saving"` entries, buckets legacy `invest` per D-24 (§4.5), and its values sum to `rebuildDerived(entries).cumulativeSavingsKrw`. | `[unit]` |
| **AC-F13-5** | Logging 저축 `deposit` raises only `deposit`'s bucket; the other four are byte-identical. | `[unit]` |
| **AC-F13-6** | `structureLevelHeightPx` / `structureHeightPx` / `savingsPlotHeightPx` are strictly increasing in their argument and are **never clamped**: for the shipped ladder length *n* and for 2*n*, `structureHeightPx(2n) - structureHeightPx(n) === SEG_STEP_PX * n` exactly, and `savingsPlotHeightPx(2n) > savingsPlotHeightPx(n)` (the pip block grows too). This is the real content of rev. 2's "nothing is clipped" AC — rev. 2 wrote it as `container.scrollHeight <= container.clientHeight`, which in jsdom is `0 <= 0` and can never fail. | `[unit]` (replaces the vacuous DOM assertion) |
| **AC-F13-7** | Each `.savings-plot` carries `style.height === savingsPlotHeightPx(districtLadderLength(ladder, ladderOverrides)) + "px"` and `style.gridTemplateRows === savingsPlotTemplateRows(same)`; each `.savings-structure` carries `style.height === structureLevelHeightPx(level) + "px"` — read from the **inline** style, which jsdom does serve. Run at two different `ladder` prop lengths (test-local literals, not balance values), and once more with a `ladderOverrides` entry longer than `ladder` to prove the whole row grows rather than clips. **All five plots must report the same height** — the shared-longest rule (§2.5), and the regression test for rev. 5's contradiction. | `[dom]` |
| **AC-F13-8** | A fresh town (`savingsByCategoryKrw` `{}` or absent) renders exactly **five** `.savings-plot` nodes, all at level 0, all carrying `.savings-plot--empty`, each with its `signboard` text and its `emptyHint`. | `[dom]` |
| **AC-F13-9** | No `원`, `₩`, or thousands separator appears anywhere in the savings block — regex scan of the five plots' `textContent`. Needs no layout, so this one is genuinely automatable. | `[dom]` |
| **AC-F13-10** | Three parts: **(a)** `grownStructures(before, after, ladderOf)` returns `["deposit"]` when only 예적금 crossed, `[]` when the amount rose without crossing, and `[]` when nothing moved — including the case where the id is absent from `before` entirely. **(b)** After `addEntry` of a threshold-crossing 저축 entry, the store's `justGrew.id` is that structure and `justGrew.seq` **differs from its previous value** (the regression test for the same-structure-twice defect §2.6a names: cross 예적금's threshold twice in one session, assert two distinct `seq` values and one `savings` notice each). **(c)** Exactly one plot carries the rise class — `container.querySelectorAll(".savings-plot--rise").length === 1` — and its `data-structure-id` is the grown id. | `[unit]` for (a) · `[dom]` (hook harness) for (b) · `[dom]` for (c) |
| **AC-F13-11** | **(a)** `[unit]`: for all five ids, `ladderFor(id, DEFAULT, {})` returns `DEFAULT` (reference-equal); with `overrides = { stock: OTHER }`, `ladderFor("stock", …) === OTHER` and the other four still return `DEFAULT`. **(b)** `[dom]`: mount twice with identical `savingsByCategoryKrw` — once with `ladderOverrides = {}`, once with `{ stock: <a shorter test-local ladder> }` — and assert only 주식투자's `.savings-pip` count differs; the other four structures' pip counts are identical between the two mounts, **and all five plots still share one height** (the block is sized to the longest ladder, which is unchanged here). All ladder arrays are **test-local literals, never quoted as balance** (D-13/D-13a remain open). | `[unit]` + `[dom]` |
| **AC-F13-12** | Deleting the 저축 entries that raised a structure lowers that structure's level; nothing else changes. | `[unit]` |
| **AC-F13-13** | On a real fresh install (`empty` fixture): the empty-state copy, the entrance cross street and **all five savings lots** are visible without scrolling on the 390×844 reference viewport, the `↘` arrow still points at the FAB, and the first ordinary plot row is at least partly visible below the block. Verified by `qa`, not by a test — mounting `App` itself would pull in `@toss/tds-mobile`'s `useToast`/`BottomSheet` runtime, which this repo has never mounted in jsdom. | `[qa]` |
| **AC-F13-14** | The block, its labels and its pips are legible and unclipped at the shipped ladder length and at 2× that length — specifically, **the pip lines wrap and never overflow the 50px lot**, and the row grows taller instead (paired with AC-F13-16, which proves the number; this proves the pixels). Checked at 320px width as well as 390px. | `[qa]` |
| **AC-F13-15** | The rise animation reads as the structure's own metaphor (seal / candle / bolt / scaffold), not as a generic grow. | `[qa]` — an aesthetic judgement, never an assertion |
| **AC-F13-16** | **The pip-row guard rev. 5 did not have, plus the height/template identity.** (a) `pipRowWidthPx(PIPS_PER_ROW) <= plotTileWidthPx(v)` for v = 320/360/390/430 — the overflow guard. (b) `pipRowWidthPx(PIPS_PER_ROW + 1) > plotTileWidthPx(MIN_VIEWPORT_PX)` — proves `PIPS_PER_ROW` is *maximal*, so the guard is not passing by being needlessly conservative. (c) `pipRowCount(n) * PIPS_PER_ROW >= n` for n = 1..40, and `pipRowCount` is monotone non-decreasing. (d) `savingsPlotTemplateRows(n)`'s three px values plus `2 * DISTRICT_ROW_GAP_PX` sum exactly to `savingsPlotHeightPx(n)` for n = 1, 8 and 20 — the guard that the inline plot height and the inline row template can never disagree. | `[unit]` |
| **AC-F13-17** | **The savings block's DOM contract (§2.4a), asserted as written.** In one `TownGrid` mount: exactly five `.savings-plot` nodes with distinct `data-structure-id` drawn from `SAVING_CATEGORY_IDS`; each one's inline `gridColumn === savingsCellFor(id).col + 1` and inline `gridRow === savingsCellFor(id).row + 1`; **no** savings plot has `gridColumn === ROAD_COLUMN + 1`; DOM order equals ascending `gridColumn` (i.e. `SAVINGS_ROW_ORDER`). | `[dom]` |
| **AC-F13-18** | **The fragment trap (§2.4a) and the signpost.** `.town-grid`'s **direct children count** equals `renderedTileCount(n) + 1 (street) + crossStreetRowCount(n) + 5 (savings) + 1 (signpost)` — at `nextPlotIndex = 0` that is `12 + 1 + 3 + 5 + 1 = 22`. A wrapper element around the savings row makes this 18 and fails. Plus: exactly one `.savings-signpost`, at the first free savings cell in column-rank order (grid column 7 today), and it is never on `ROAD_COLUMN + 1`. | `[dom]` |

---
## 3. Road-based village layout — a rendering-layer transform

### 3.1 The architectural decision

Rev. 1 changed `plotFromIndex`'s semantics: `TOWN_COLUMNS` 6 → 7, cross-street rows inserted into the row space, a new column fill order. That forced a whole break-table — `selectors.test.ts`'s entire `plotFromIndex` block, `entryActions.test.ts:61`, `useTownStore.test.tsx:88`, and every existing demo/fixture town moving house.

**This proposal does none of that.** The rule is:

> **`plotFromIndex` is the *storage* mapping and never changes. The road layout — including the savings block — is a *rendering* mapping applied on top of it.**

`plotFromIndex(i)` (`selectors.ts:19-23`) keeps returning the serpentine `{row, col}` in **plot space** (6 columns, no roads). A new pure function `cellFromIndex(i)` maps a plot index to its **grid cell** in **screen space** (7 columns including the street, plus cross-street rows and the savings rows). Only rendering code calls it.

| | plot space (stored, unchanged) | grid cell space (rendered, new) |
|---|---|---|
| Owner | `selectors.ts` — **byte-identical, not opened by the road task** | `townLayout.ts` — **new file** |
| Width | `TOWN_COLUMNS = 6` (unchanged, `selectors.ts:16`) | `GRID_COLUMNS = 7` (6 plot columns + 1 street column) |
| Rows | one row per 6 plots | savings rows + plot rows + one cross-street row per block |
| Who reads it | everything that already does | `TownGrid.tsx` and friends, only |
| Persisted | `Building.plotIndex` (unchanged) | **nothing, ever** |

Consequences:

- `selectors.ts`, `selectors.test.ts`, `entryActions.test.ts:61`, `useTownStore.test.tsx:88` — **untouched.** Zero geometry test breaks.
- Existing demo towns and every fixture keep every stored byte. `plotIndex` 0 is still `plotIndex` 0.
- The road plan and the savings block can be re-tuned (D-20/D-21) by editing constants in one new file, with no data implication.
- The buildings **do** appear in different screen positions than before the change (both from the roads and from the two rows the savings block adds at the top). That is a pixel change, not a data change, and §3.6's `LAYOUT_VERSION` notice tells the player once.

**D-31 is answered here, and the answer is the cheap one.** Placement stays **automatic**: the app allocates the plot index (`nextPlotIndex`, unchanged), and the layout guarantees every cell it can allocate has road frontage. The alternative reading — the player taps an empty lot to place each new building — is **not shipped and is not an option in this document**. It would void F2's "at `plotFromIndex(n)` **and nowhere else**", retire `nextPlotIndex` as the allocator, give the F14 drain and F16's monuments a placement question they do not have today, and add a placement UI with an undo and a "no legal lot left" state. It is also against the grain of the whole MVP: MVP-SPEC's entry budget is **≤ 3 taps and ≤ 8 seconds** (§3 P-b, F1), and a placement step adds at least one tap and one decision to every single logged coffee. If the director wants it, it is a new feature with its own spec and its own schedule, not a variant of this one.

### 3.2 The block plan

```
grid col:  0      1      2     [3]     4      5      6
         ═══════════════════════╪═══════════════════════   grid r0  마을 어귀 cross street
         ┌─────┬─────┬─────┬───┬─────┬─────┬─────┐
grid r1  │기타 │비상금│예적금│ ▓ │주식 │목표 │안내판│        저축 블록 (no plotIndex, §2.1)
         ═══════════════════════╪═══════════════════════   grid r2  cross street
grid r3  │ p0  │ p1  │ p2  │ ▓ │ p3  │ p4  │ p5  │        plot row 0
grid r4  │ p11 │ p10 │ p9  │ ▓ │ p8  │ p7  │ p6  │        plot row 1
         ═══════════════════════╪═══════════════════════   grid r5  cross street
grid r6  │ p12 │ p13 │ p14 │ ▓ │ p15 │ p16 │ p17 │        plot row 2
grid r7  │ p23 │ p22 │ p21 │ ▓ │ p20 │ p19 │ p18 │        plot row 3
         ═══════════════════════╪═══════════════════════   grid r8  cross street
```

- **Main street** = grid column `ROAD_COLUMN`, one continuous ribbon down the entire town, always on screen while scrolling, **running through the savings block between 예적금 and 주식 투자**.
- **Cross streets** = full-width rows: one at the very top (the village entrance), one closing the savings block, and one closing every block of `BLOCK_ROWS` plot rows.
- **The 저축 블록 is the town's head**, `TOWN_HEAD_ROWS = SAVINGS_ROWS + 1 = 2` grid rows deep (one savings row + its closing cross street). It is a block of depth 1, so both of its road boundaries are directly adjacent — the best-served block in the village.
- **`BLOCK_ROWS = 2` is derived, not chosen.** It is the largest block depth for which the frontage invariant (§3.3) holds with a single vertical street: a plot row is adjacent to a cross street only if it is the first or last row of its block. `BLOCK_ROWS = 3` leaves the middle row's outer four columns with no road neighbour — which is exactly what rev. 1 shipped, undetected, because it had no such test. Any other block depth needs a second vertical street (D-20).
- **Column mapping: `SERPENTINE_COLUMNS = [0, 1, 2, 4, 5, 6]` — the stored serpentine carried onto the screen unchanged (D-30 answered, §3.9).** The town reads as one street winding downward, exactly as MVP-SPEC F2 describes it, and "index 6 is directly below index 5" is true **on screen** as well as in storage. Rev. 5's `street-first` alternative and the `COLUMN_ORDER` switch are deleted; there is one mapping.
- **The ask "도로 근처에 건물" is answered by geometry, not by fill order.** Every plot has road frontage (invariant below, tested), and the buildings the director named by name are the two facing the main street at the entrance. Rev. 5 bought a weaker version of the same thing by reordering the fill and paid for it with an MVP-SPEC AC; that trade is off the table.

### 3.3 The exact rule (`src/townLayout.ts`, NEW file)

```ts
/**
 * Render-time layout — plot index -> grid cell, plus the savings block's fixed
 * cells. Pure, no React, no storage.
 *
 * This module is the ONLY thing that knows the town has roads and a savings
 * block. `plotFromIndex` (selectors.ts) is the storage mapping and is
 * deliberately untouched: nothing here is ever persisted, so any constant below
 * can change with no migration.
 *
 * It is also the single source of truth for every grid COORDINATE and every
 * PIXEL SIZE the TS arithmetic uses — App.css must never restate one (rule R-3, §3.5).
 */
import { TOWN_COLUMNS, plotFromIndex, ladderFor } from "./selectors";
import { SAVING_CATEGORY_IDS } from "./savingsBuckets";
import type { SavingCategoryId } from "./types";

export interface Cell { row: number; col: number }

export const GRID_COLUMNS = TOWN_COLUMNS + 1; // 7 = 6 plot columns + 1 street column
export const ROAD_COLUMN = 3;                 // 0-based grid column of the main street
export const BLOCK_ROWS = 2;                  // plot rows per block — forced by the frontage invariant (§3.2)

// Layout px (assumption; director may retune — none of these is a pacing dial).
export const TILE_HEIGHT_PX = 72;             // unchanged from App.css's current grid-auto-rows
export const ROAD_WIDTH_PX = 22;
export const ROAD_HEIGHT_PX = 22;
export const GRID_GAP_PX = 6;                 // was 8 — recovers the width the street takes
/**
 * .town-grid's horizontal padding. App.css:137 currently hardcodes it inside
 * `padding: 8px 16px 24px`. It reaches the stylesheet ONLY as `--town-grid-pad-x`,
 * set inline from this constant (§3.4/§3.5) — with no CSS fallback value, because
 * a fallback is a second source of truth that silently wins when the property is
 * missing. `plotTileWidthPx` reads the same constant, so the width arithmetic and
 * the painted padding cannot disagree. (R-3; §3.8 has the guard.)
 */
export const GRID_PADDING_X_PX = 16;

/** Plot column (0..5, straight from `plotFromIndex`) -> grid column, skipping the street. */
export const SERPENTINE_COLUMNS = [0, 1, 2, 4, 5, 6] as const;

// ── 저축 블록 (§2.4) — fixed cells, OUTSIDE plot-index space ──

/**
 * Prominence rank -> grid column: street-front pair, middle pair, back pair.
 * Rank 0/1 are the two sub-types the director named, so 예적금 and 주식 투자 are
 * the ones facing the main street. Same six non-road columns as
 * SERPENTINE_COLUMNS, in a different order — a CONTENT assumption (§7), not a
 * mechanic; one array to overturn.
 */
export const SAVINGS_COLUMN_RANK = [2, 4, 1, 5, 0, 6] as const;

/** Savings rows needed for the current sub-type list. 5 ids -> 1 row. Follows D-17 automatically. */
export const SAVINGS_ROWS = Math.max(1, Math.ceil(SAVING_CATEGORY_IDS.length / TOWN_COLUMNS));

/**
 * Grid rows the town's head occupies: the savings rows plus their closing cross
 * street. The entrance cross street is grid row 0, so savings rows are
 * 1 .. TOWN_HEAD_ROWS - 1 and the closing cross street is TOWN_HEAD_ROWS.
 */
export const TOWN_HEAD_ROWS = SAVINGS_ROWS + 1;   // 2 today

/** The fixed cell one savings structure stands on. Injective over SAVING_CATEGORY_IDS. */
export function savingsCellFor(id: SavingCategoryId): Cell {
  const rank = SAVING_CATEGORY_IDS.indexOf(id);
  return {
    row: 1 + Math.floor(rank / TOWN_COLUMNS),
    col: SAVINGS_COLUMN_RANK[rank % TOWN_COLUMNS],
  };
}

/** True for a grid row that carries savings structures (never plots — §2.1). */
export function isSavingsRow(row: number): boolean {
  return row >= 1 && row < TOWN_HEAD_ROWS;
}

/**
 * DOM emission order for the savings block: left -> right on screen, so DOM
 * order equals visual order (§2.4a). DERIVED from SAVINGS_COLUMN_RANK — never a
 * second hand-written list that could drift from the first.
 * Today: ["other_saving", "emergency", "deposit", "stock", "goal"].
 */
export const SAVINGS_ROW_ORDER: readonly SavingCategoryId[] = [...SAVING_CATEGORY_IDS].sort((a, b) => {
  const ca = savingsCellFor(a), cb = savingsCellFor(b);
  return ca.row - cb.row || ca.col - cb.col;
});

/**
 * Savings-row cells with no structure on them. The FIRST (in column-rank order)
 * renders the 마을 안내판 (`.savings-signpost`); any others render an ordinary
 * decorated 빈 터. With five sub-types this is exactly one cell, grid col 6.
 */
export function freeSavingsCells(): Cell[] {
  const taken = new Set(SAVING_CATEGORY_IDS.map((id) => `${savingsCellFor(id).row},${savingsCellFor(id).col}`));
  const cells: Cell[] = [];
  for (let r = 1; r < TOWN_HEAD_ROWS; r++) {
    for (const col of SAVINGS_COLUMN_RANK) {
      if (!taken.has(`${r},${col}`)) cells.push({ row: r, col });
    }
  }
  return cells;
}

// ── plot space -> grid cell ──

/** Inverse of `plotFromIndex` — undoes the serpentine. `indexFromPlot(plotFromIndex(i)) === i`. */
export function indexFromPlot(plot: Cell): number {
  const k = plot.row % 2 === 0 ? plot.col : TOWN_COLUMNS - 1 - plot.col;
  return plot.row * TOWN_COLUMNS + k;
}

/**
 * Plot index -> grid cell. The whole road layout, in four lines.
 *
 * The `+ TOWN_HEAD_ROWS` term is what makes §2.1's invariant STRUCTURAL: the
 * smallest row this can return is `0 + 0 + 1 + TOWN_HEAD_ROWS`, which is
 * strictly greater than the largest savings row, `TOWN_HEAD_ROWS - 1`. No plot
 * index can land on a savings cell, for any input, ever. Do not "simplify" this
 * by folding the constant into the block arithmetic.
 */
export function cellFromIndex(i: number): Cell {
  const { row: plotRow, col: plotCol } = plotFromIndex(i);
  return {
    row: plotRow + Math.floor(plotRow / BLOCK_ROWS) + 1 + TOWN_HEAD_ROWS,
    col: SERPENTINE_COLUMNS[plotCol],
  };
}

/** Same transform from a plot-space cell — composed through the inverse, so there is one source of truth. */
export function cellFromPlot(plot: Cell): Cell {
  return cellFromIndex(indexFromPlot(plot));
}

/** True when this grid row is a cross street (no plots and no savings on it). */
export function isCrossStreetRow(row: number): boolean {
  if (row < TOWN_HEAD_ROWS) return row === 0;                  // r0 entrance; r1.. are savings rows
  return (row - TOWN_HEAD_ROWS) % (BLOCK_ROWS + 1) === 0;      // r2, r5, r8, …
}

/** True for any road cell — used by the frontage test and by decoration. */
export function isRoadCell(row: number, col: number): boolean {
  return row >= 0 && (col === ROAD_COLUMN || isCrossStreetRow(row));
}

/** Whole blocks are always rendered, so the town always closes on a cross street. */
export function blockCount(plotCount: number): number {
  return Math.max(1, Math.ceil(Math.ceil(plotCount / TOWN_COLUMNS) / BLOCK_ROWS));
}

/** Grid rows to render for `plotCount` plots (head rows + blocks + the closing cross street). */
export function gridRowCount(plotCount: number): number {
  return TOWN_HEAD_ROWS + blockCount(plotCount) * (BLOCK_ROWS + 1) + 1;
}

/** Cross-street rows to render: the entrance, the savings block's closer, and one per block. */
export function crossStreetRowCount(plotCount: number): number {
  return blockCount(plotCount) + 2;
}

/** Plot tiles to render — padded out to a whole block, the road-era version of "pad to a full row". */
export function renderedTileCount(plotCount: number): number {
  return blockCount(plotCount) * BLOCK_ROWS * TOWN_COLUMNS;
}

/** Which side of the main street a grid column sits on — drives building facing. */
export function roadSideOf(col: number): "left" | "right" {
  return col < ROAD_COLUMN ? "left" : "right";
}

/**
 * The grid template, GENERATED from the constants above (rule R-3) — the stylesheet
 * must never hardcode "1fr 1fr 1fr 22px 1fr 1fr 1fr", because that string silently
 * encodes both GRID_COLUMNS and ROAD_COLUMN.
 */
export const GRID_TEMPLATE_COLUMNS = Array.from({ length: GRID_COLUMNS }, (_, c) =>
  c === ROAD_COLUMN ? `${ROAD_WIDTH_PX}px` : "1fr",
).join(" ");

/**
 * Plot tile width at a given viewport width. Also the width of one savings lot
 * (§2.5) and the width `PIPS_PER_ROW` is derived against — one width function
 * for the whole town, which is what deleting the band's column system bought.
 */
export function plotTileWidthPx(viewportPx: number): number {
  const inner = viewportPx - GRID_PADDING_X_PX * 2;
  const gaps = (GRID_COLUMNS - 1) * GRID_GAP_PX;
  return (inner - gaps - ROAD_WIDTH_PX) / TOWN_COLUMNS;
}

// … §2.5's savings geometry (SEG_*, PIP_*, structureHeightPx, savingsPlotHeightPx,
//   savingsPlotTemplateRows, districtLadderLength) lives in this same file.
```

Worked check (client-dev can unit-test these verbatim), at `TOWN_HEAD_ROWS = 2`:

`cellFromIndex(0) = {row:3,col:0}` · `(1) = {row:3,col:1}` · `(2) = {row:3,col:2}` · `(3) = {row:3,col:4}` · `(5) = {row:3,col:6}` · **`(6) = {row:4,col:6}` — directly below `(5)`, on screen** · `(11) = {row:4,col:0}` · `(12) = {row:6,col:0}` (same column as `(11)`, one cross street between them) · `(17) = {row:6,col:6}` · `(18) = {row:7,col:6}`.

`savingsCellFor("deposit") = {row:1,col:2}` · `("stock") = {row:1,col:4}` · `("emergency") = {row:1,col:1}` · `("goal") = {row:1,col:5}` · `("other_saving") = {row:1,col:0}` · `freeSavingsCells() = [{row:1,col:6}]`.

`isSavingsRow(1) = true`, `(0|2|3) = false` · `isCrossStreetRow(0|2|5|8) = true`, `(1|3|4|6|7) = false` · `gridRowCount(0) = 6`, `gridRowCount(12) = 6`, `gridRowCount(13) = 9` · `crossStreetRowCount(0) = 3`, `crossStreetRowCount(13) = 4` · `renderedTileCount(13) = 24` · `GRID_TEMPLATE_COLUMNS === "1fr 1fr 1fr 22px 1fr 1fr 1fr"` · `plotTileWidthPx(390) === 50` · `plotTileWidthPx(320) ≈ 38.33`.

**The frontage invariant, as an assertion rather than an intention:**

> Every rendered cell that can hold a structure — **plot cells and savings cells alike** — is orthogonally adjacent to at least one road cell.

It holds for plots because a plot's grid row is always `TOWN_HEAD_ROWS + 3b + 1` or `TOWN_HEAD_ROWS + 3b + 2` for block `b`: the first has the cross street at `TOWN_HEAD_ROWS + 3b` directly above, the second has `TOWN_HEAD_ROWS + 3(b+1)` directly below, and whole blocks are always rendered so that closing row always exists. It holds for savings cells because row 1 has the entrance cross street at row 0 above **and** the closing cross street at row `TOWN_HEAD_ROWS` below. §3.8 turns it into the test that would have caught rev. 1's `BLOCK_ROWS = 3` mistake, and extends it to the savings row.

**The disjointness invariant, also an assertion (§2.1):**

> `cellFromIndex(i).row >= TOWN_HEAD_ROWS + 1 > TOWN_HEAD_ROWS - 1 >= (any savings row)` for every `i >= 0`.

### 3.4 Rendering (`TownGrid.tsx`, CSS grid only)

```tsx
const tileCount = renderedTileCount(nextPlotIndex);
const rowCount  = gridRowCount(nextPlotIndex);   // used by the main-street span, item 2 below
// per tile i:  const { row, col } = cellFromIndex(i);
//              style={{ gridColumn: col + 1, gridRow: row + 1 }}   // same shape as TownGrid.tsx:58 today
```

Five kinds of grid item:

1. **Plot tiles** — `tileCount` of them, positioned by `cellFromIndex(i)` (was `plotFromIndex(i)` at `TownGrid.tsx:50`; the call site changes, the function does not). Wrapper gains `town-tile--left` / `town-tile--right` from `roadSideOf(col)`.
2. **Main street** — **one** DOM node, spanning every rendered row:

   ```tsx
   <div className="town-main-street"
        style={{ gridColumn: ROAD_COLUMN + 1, gridRow: `1 / span ${rowCount}` }} />
   ```

   O(1) regardless of town size, and it stays O(1) after F3's virtualization lands (span the rendered row window instead of the whole town; the expression is the same, the count is the window's).

   ⚠️ **Rev. 4 wrote `gridRow: "1 / -1"` here, and that was broken — the fix stands, and the numbers moved.** `.town-grid` (App.css:133-138) declares `display`, `gap`, `grid-auto-rows` and `padding`, and **no `grid-template-rows`** — §3.5 keeps it that way (`grid-auto-rows: auto`), and the container's inline style below sets `gridTemplateColumns` only. With **no explicit row grid**, a negative line counts backward from the end of the *explicit* grid, so `-1` resolves to the same line as `1`, the end line is dropped, and the item spans a single implicit track. The street would have painted **one row tall at the top of the town** — visible in a screenshot, plausibly "a road", wrong in every town. Two things about the fix are load-bearing:

   - **The column axis is genuinely fine, and `.town-cross-street` keeps `gridColumn: "1 / -1"`.** Columns *do* have an explicit template (`GRID_TEMPLATE_COLUMNS`, §3.3), so `-1` resolves to the last explicit column line. The asymmetry — one axis explicit, the other never was — is exactly what made the bug survive review.
   - **Rejected alternative: give `.town-grid` a `gridTemplateRows`.** A generated `repeat(rowCount, …)` template would restate every row height a second time (plot rows are `TILE_HEIGHT_PX`, road rows `ROAD_HEIGHT_PX`, savings rows `savingsPlotHeightPx(…)` — all three already set on the items) and would then have to stay in sync with `grid-auto-rows`. Spanning from the count that already exists costs one expression and keeps one source of truth per metric.
3. **Cross streets** — one node per cross-street row: `style={{ gridColumn: "1 / -1", gridRow: r + 1 }}`, for `r = 0, TOWN_HEAD_ROWS, TOWN_HEAD_ROWS + 3, …`. Count is `crossStreetRowCount(nextPlotIndex)` — virtualizes with the rows.
4. **Savings plots** — `<SavingsRow …/>`, emitting **a fragment of five `.savings-plot` grid items** (§2.4a), each placed by `savingsCellFor(id)`. **Not wrapped in an element** — see §2.4a's trap and AC-F13-18.
5. **Signpost** — one `.savings-signpost` node per `freeSavingsCells()` head entry (today: exactly one, at grid column 7). Decoration only, R-2.

The grid container's own style becomes:

```tsx
<div
  className="town-grid"
  style={{
    gridTemplateColumns: GRID_TEMPLATE_COLUMNS,   // generated (§3.3), replaces the stale inline template
    "--town-road-w": `${ROAD_WIDTH_PX}px`,
    "--town-road-h": `${ROAD_HEIGHT_PX}px`,
    "--town-tile-h": `${TILE_HEIGHT_PX}px`,
    "--town-gap": `${GRID_GAP_PX}px`,
    "--town-grid-pad-x": `${GRID_PADDING_X_PX}px`, // R-3 fix, §3.5 — App.css must not restate 16px
    "--district-row-gap": `${DISTRICT_ROW_GAP_PX}px`,  // §2.5 — the savings plot's internal row gap
    "--pip-size": `${PIP_SIZE_PX}px`,                  // §2.5 — these three entered TS arithmetic
    "--pip-gap": `${PIP_GAP_PX}px`,                    //         in rev. 6, so R-3 now reaches them
    "--pip-row-gap": `${PIP_ROW_GAP_PX}px`,
  } as React.CSSProperties}                        // the cast is needed for CSS custom properties
>
```

All nine custom properties are set **on the one container**, not per plot — one place to read them in a test, and the savings plots inherit them. `byPlotIndex`, `React.memo`, and the `justBuiltId` auto-scroll are untouched; `TownGridProps` gains the four savings props (§2.4, break B14) and the `tiles` `useMemo` deps are unchanged, so a level-up never rebuilds a tile.

⚠️ **Concrete trap:** `TownGrid.tsx:78` currently sets `style={{ gridTemplateColumns: repeat(${TOWN_COLUMNS}, 1fr) }}` **inline**. An inline style beats the stylesheet, so a 7-column template written *only* in App.css would silently never apply. The fix above **replaces** that inline value with the generated one rather than deleting it, which also satisfies R-3. Listed again in §5.2 (B6).

### 3.5 CSS (`App.css`) — and rule R-3

> **Rule R-3 (no coordinates in the stylesheet).** Every grid coordinate (`grid-column`, `grid-row`, either template), every road pixel size, **and every box metric the TS layout arithmetic also depends on** is owned by `townLayout.ts` and reaches the DOM as an inline style or a CSS custom property set from those constants — **with no CSS fallback value.** **App.css may paint; it may not place or measure.** This is how `grid-column: 4` and `ROAD_COLUMN = 3` are made incapable of drifting apart — not by a comment asking two files to stay in sync, but by there being only one file that knows the number.

Rev. 2 violated R-3 twice (`.town-main-street { grid-column: 4 }` hardcoded against a versioned TS constant, and a hardcoded `1fr 1fr 1fr var(--town-road-w) 1fr 1fr 1fr` template that silently encodes both `GRID_COLUMNS` and `ROAD_COLUMN`). Both are gone.

**Rev. 3 violated its own R-3 once, and it is the worst kind of violation because the AC meant to catch drift kept passing.** Rev. 3 wrote `padding: 8px var(--town-grid-pad-x, 16px) 24px` while `GRID_PADDING_X_PX = 16` also existed in TS and `plotTileWidthPx()` subtracted it. The `, 16px` fallback is a second source of truth that silently wins if the property is ever unset, and §3.8's TS-only assertion could never see it. Fix: **the property is set from the constant and the fallback is deleted**, and §3.8 gains a guard that reads `src/App.css` as **text**.

**Rev. 6 moves three more numbers into TS for exactly the same reason.** The pip's `5px`/`3px` were "paint" in rev. 5 because nothing computed with them. `PIPS_PER_ROW` and `pipBlockHeightPx` now do (§2.5), so they become `--pip-size` / `--pip-gap` (plus the new `--pip-row-gap`) with no fallback. The rule that decides this is stated once, in rev. 5's own words: *the moment a literal enters an arithmetic in `townLayout.ts`, it moves to TS.*

```css
/* Placement, sizes and the column template all arrive from townLayout.ts as
 * inline styles / custom properties (rule R-3, ADDENDUM-01 §3.5). Do NOT add
 * grid-column, grid-row, grid-template-columns, or a px literal for any metric
 * townLayout.ts also computes with, to any rule in this block — and do NOT add
 * a fallback to a var() below. A fallback is a second source of truth. */
.town-grid {
  --town-asphalt: #b9bec6;              /* pure paint — no coordinate, stays here */
  display: grid;
  gap: var(--town-gap);                 /* was 8px, now GRID_GAP_PX from TS */
  grid-auto-rows: auto;                 /* was 72px — road rows are shorter and the
                                         * savings row is taller than a plot row */
  padding: 8px var(--town-grid-pad-x) 24px;  /* the 16 is GRID_PADDING_X_PX, the same 16
                                              * plotTileWidthPx() subtracts. No fallback. */
}
.town-tile         { height: var(--town-tile-h); }
.town-cross-street { height: var(--town-road-h); }

/* The empty-state copy is now a banner ABOVE the grid rather than a replacement
 * for it (§2.4, break B13), so it gets a compact modifier — otherwise the
 * savings block is pushed below the fold on the 390×844 reference viewport. */
.town-empty-state--with-grid { padding: 16px 24px; }
```

The `8px` top and `24px` bottom, and the compact modifier's padding, stay as literals on purpose: no TS function computes with them, so they are paint, not measurement.

Width arithmetic on the 390px reference viewport, expressed as `plotTileWidthPx()` (§3.3) so it is a unit test rather than a claim: 390 − 32 padding = 358; minus 6 gaps × 6px = 36; minus the 22px street = **300 / 6 = 50px per plot**, against 53px today. A 3px tile loss for a full street plan — and the savings lots are the same 50px, which is what makes §2.8's px² comparison like-for-like.

Height arithmetic: one 22px road row per 2 × 72px plot rows. Per block, old = 2 × 72 + 2 × 8 gap = 160px; new = 2 × 72 + 22 + 3 × 6 = 184px → **+15% vertical scroll** for a mature town, plus a **one-time ~204px head** (entrance road 22 + savings row 170 + two 6px gaps) that pushes the first ordinary building down by about two and a half tile rows. That head is the price of the D-32 answer and it is paid once, at the top, not per block.

**Street painting — and the two defects rev. 2 shipped here.**

Rev. 2 wrote `.town-main-street::before { position: absolute; inset: 0; … }` and `.town-cross-street::after { position: absolute; left: calc(50% − 11px); … }`, and both were broken against the real stylesheet:

- **Neither road element establishes a containing block.** `.town-grid` has **no `position` declaration at all** (App.css:133-138, verified) and neither did rev. 2's road rules. The nearest positioned ancestor in the real DOM is `.town-screen`, which *is* `position: relative` (App.css:39-44). So the dashed centre line would have been laid out against **the entire town screen**, and the crosswalk's `50%` would have been the screen's midpoint. It would have rendered *something*, which is the bad kind of bug.
- **The fix is on the road elements themselves, not on `.town-grid`.** Making `.town-grid` relative would move the bug rather than fix it. Each pseudo-element's own parent is the correct positioning context, and both parents are already exactly the shape their pseudo needs.

```css
.town-main-street {
  /* grid-column is set inline from ROAD_COLUMN, and grid-row inline as
   * `1 / span gridRowCount(...)` — NOT `1 / -1`, which spans one row here
   * because this grid has no explicit row template (§3.4). Both are R-3's:
   * do not move either into this rule to "fix" a span. */
  position: relative;                    /* FIX: the ::before below positions against THIS,
                                          * not against .town-screen (App.css:39-44). */
  margin: calc(var(--town-gap) * -1) 0;  /* close the row gaps: one continuous ribbon */
  background: var(--town-asphalt);
  z-index: 1;                            /* paints over the cross street at intersections */
}
.town-main-street::before {              /* dashed centre line */
  content: ""; position: absolute; inset: 0; margin: 0 auto; width: 2px;
  background: repeating-linear-gradient(180deg, #fff 0 10px, transparent 10px 22px);
}

.town-cross-street {
  /* grid-column: 1 / -1 and grid-row are set inline (R-3). */
  position: relative;                    /* FIX: same defect, same fix. */
  margin: 0 calc(var(--town-gap) * -1);  /* close the column gaps */
  background: var(--town-asphalt);
}
.town-cross-street::after {              /* crosswalk stripes at the intersection */
  content: ""; position: absolute; top: 0; bottom: 0;
  width: var(--town-road-w);                        /* was a hardcoded 22px — R-3 */
  left: calc(50% - var(--town-road-w) / 2);         /* was calc(50% - 11px) — R-3 */
  background: repeating-linear-gradient(90deg, #fff 0 3px, transparent 3px 7px);
}
```

Why `50%` is correct **once the containing block is the cross-street element**: the generated template is symmetric about the road column (3 × 1fr, road, 3 × 1fr), and the element's `margin: 0 −gap` extends it equally on both sides. That is a property of `GRID_TEMPLATE_COLUMNS` being generated with `ROAD_COLUMN` at the centre — if D-20 moves the street off-centre, this rule must become `left: calc(<street offset>)`, and no automated AC catches it. Noted in D-20.

**The 저축 블록 — same rule, stated as CSS (§2.4a's classes).** The plots are grid items of `.town-grid`, so they inherit the container's custom properties; every metric `townLayout.ts` computes with arrives inline or as a `var()` with **no fallback**.

```css
/* 저축 블록 (ADDENDUM-01 §2.4a). Each .savings-plot is a DIRECT grid item of
 * .town-grid, placed and sized inline. `align-self` and `flex-wrap` are
 * alignment/flow keywords, not coordinates and not metrics, so R-3 does not
 * reach them. Do NOT add height, width, grid-column, grid-row,
 * grid-template-rows or grid-template-columns to these rules. */
.savings-plot            { display: grid; row-gap: var(--district-row-gap); }
.savings-structure       { align-self: end; position: relative; }   /* bottom-aligned in its reserved row */
.savings-plot--empty .savings-structure { border: 1px dashed var(--town-grey300); border-radius: 8px; }
.savings-structure-board { font-size: 10px; text-align: center; }
.savings-structure-hint  { font-size: 10px; text-align: center; color: var(--town-grey600); }
.savings-structure-label { font-size: 11px; text-align: center; color: var(--town-grey700); }
.savings-structure-pips  { display: flex; flex-wrap: wrap; justify-content: center;
                           gap: var(--pip-row-gap) var(--pip-gap); align-content: start; }
.savings-pip             { width: var(--pip-size); height: var(--pip-size);
                           border-radius: 50%; background: rgba(0, 0, 0, 0.12); }
.savings-pip--on         { background: var(--town-blue500); }
.savings-signpost        { align-self: end; height: var(--town-tile-h); }

@keyframes savings-rise {                  /* the one-shot level-up rise (§2.6 step 2) */
  from { transform: translateY(10px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
.savings-plot--rise .savings-structure { animation: savings-rise 550ms cubic-bezier(0.2, 0.8, 0.2, 1); }
```

`flex-wrap: wrap` + `gap: var(--pip-row-gap) var(--pip-gap)` is what makes `pipBlockHeightPx` true in the browser: a wrapped line is exactly `PIP_SIZE_PX` tall (the pip is the only thing on it) and lines are separated by exactly `PIP_ROW_GAP_PX`. `align-content: start` stops the flex container from redistributing free space between lines, which would break the same arithmetic silently. The font sizes remain **paint** — no TS function computes with them. The per-`RiseAnim` variants (seal / candle / bolt / scaffold, §2.3) layer on top of `.savings-plot--rise` as `ui-ux`'s own keyframes, and `.savings-plot--<kind>` / `--cap-<capShape>` are paint-only by construction (§6.1 item 4).

### 3.6 Layout vs decoration — an architectural boundary, stated as a rule

Two kinds of visual thing live on the town screen, and they have different rights:

> **Rule R-1 (layout).** The mapping from a plot index to a grid cell — `cellFromIndex` and the constants `GRID_COLUMNS`, `ROAD_COLUMN`, `BLOCK_ROWS`, `TOWN_HEAD_ROWS`, `SERPENTINE_COLUMNS`, `SAVINGS_COLUMN_RANK` — is **versioned** by `LAYOUT_VERSION`. Changing any of it relocates every building on screen. Nothing is persisted, so there is no migration; but the player is told once (below).
>
> **Rule R-2 (decoration).** Every decorative element — asphalt colour, centre line, crosswalks, 가로등, 나무, 텃밭, parked cars, 버스 정류장, the empty-lot ground variant, **the 마을 안내판 tile** — is produced by a **pure deterministic function of `(row, col)` alone**, computed at render time, and is **NEVER stored, never persisted, never versioned, and never referenced by any migration or notice path.** Decoration may therefore change freely, in any release, with no data consequence of any kind, forever.
>
> **Rule R-3 (no coordinates in the stylesheet).** §3.5.

```ts
/** Decoration only. Pure, (row, col) -> variant. Never stored. (R-2) */
export function decorVariant(row: number, col: number, kinds: number): number {
  return ((row * 31 + col * 17) % kinds + kinds) % kinds;
}
```

Why R-2 is a rule and not a note: the tempting shortcut is to store a lot's ground variant on the `Building` (or key it off `plotIndex`) so it "stays the same forever". That single decision would turn every future art tweak into a schema question. R-2 forbids it up front. Testable: `decorVariant` is called with nothing but `(row, col)`, and no storage key ever contains a decoration field (assertable by a key/JSON scan in `storage.test.ts`).

**`LAYOUT_VERSION` guard (R-1).** `StorageIndex` (`storage.ts:33-37`) gains one field:

```ts
export const LAYOUT_VERSION = 1;                 // bumped whenever R-1 constants change
export interface StorageIndex {
  schemaVersion: number;
  layoutVersion?: number;                        // optional: an index written before this change has none
  entryMonths: string[];
  buildingMonths: string[];
}
```

On boot, `loadBoot()` compares `index.layoutVersion ?? 0` against `LAYOUT_VERSION`. If they differ **and** at least one building exists, it pushes one `Notice` — reusing the existing FIFO notice queue (`useTownStore.ts:88-91`, rendered as a toast by `App.tsx:30-35` for every kind but `tier`) — and rewrites the index with the current version:

```ts
export type Notice =
  | { kind: "corruption"; message: string }
  | { kind: "drained"; count: number }
  | { kind: "tier"; tier: number }
  | { kind: "savings"; id: SavingCategoryId }    // NEW (§2.6a) — level-up toast, owned by the store
  | { kind: "relayout" };                        // NEW — "마을에 도로가 새로 놓였어요. 건물 위치가 조금 바뀌었어요."
```

⚠️ `App.tsx:32` currently derives the toast text with a **binary** ternary (`notice.kind === "corruption" ? notice.message : \`밀렸던 건물 ${notice.count}채…\``), so **any** third non-tier kind falls into the `drained` branch and renders `undefined`. Both new kinds hit this:

```ts
// App.tsx — replaces line 32's binary ternary
const message =
  notice.kind === "corruption" ? notice.message
  : notice.kind === "drained"  ? `밀렸던 건물 ${notice.count}채가 오늘 아침에 완성됐어요!`
  : notice.kind === "savings"  ? levelUpToastFor(notice.id)          // §2.6a
  : "마을에 도로가 새로 놓였어요. 건물 위치가 조금 바뀌었어요.";       // relayout — copy is D-26
```

Two branches, not one, and they land in two different tasks (`savings` with the savings block, `relayout` with the road layout). Counted in **B8** (§5.2).

This is **a notice, not a migration.** Nothing stored moves; `plotIndex` values are not touched, read, or rewritten. A pre-existing index has no `layoutVersion`, reads as 0, and fires the notice exactly once on the first boot after this ships, which is correct: that boot is exactly when the buildings move — and under rev. 6 they move further than under rev. 5, since the savings block pushes the whole town down two grid rows.

### 3.7 What makes it read as a village, not a grid with a stripe

1. **Buildings face the street.** `.town-tile--left .building-roof { left: 62% }`, `.town-tile--right .building-roof { left: 38% }` — roofs and doors lean toward the road, overriding `building-roof`'s current `left: 50%` (App.css:171-178). **Pure CSS on the wrapper; `PlaceholderBuilding.tsx` is not modified.** The savings structures get the same treatment from their own `roadSideOf(col)` class, so 예적금 and 주식 투자 lean toward each other across the main street.
2. **Unbuilt lots are countryside, not construction site.** `EmptyLot` gains an optional `variant?: 0 | 1 | 2` (default 0 = today's dashed lot — the component currently takes no props at all, `EmptyLot.tsx:4`), chosen by `decorVariant(row, col, 3)`: 잔디, 나무 두 그루, 텃밭. This is the single highest delight-per-line change in the addendum — today a half-built town looks abandoned; after this it looks like a village with fields around it, which matters much more now that a fresh install always renders a full block of them under the savings block. (Keyed on the cell, per R-2.)
3. **Street furniture, zero data.** A 가로등 pseudo-element on every second block's street-front tile; a 버스 정류장 on every second cross street; both from `decorVariant`, nothing stored.
4. **The village has an entrance.** The town now opens on a road, then the 저축 블록, then a road — so the first thing the player sees is a block of buildings on a street, not a grid of lots. The 안내판 in the block's free lot is what tells them it is a village entrance rather than row one of a spreadsheet.

### 3.8 AC (`src/townLayout.test.ts` + `src/components/TownGrid.test.tsx`, both NEW)

Same disposition legend as §2.9.

| AC | How |
|---|---|
| **Round-trip property, `i = 0..600`:** `indexFromPlot(plotFromIndex(i)) === i`, and `plotFromIndex(indexFromPlot(p))` deep-equals `p`. Makes the mapping *provably* collision-free rather than argued to be. | `[unit]` |
| **Injectivity, `i = 0..600`:** `cellFromIndex(i)` produces 601 distinct `"row,col"` keys. | `[unit]` |
| **No plot on a road, `i = 0..600`:** `col !== ROAD_COLUMN` and `isCrossStreetRow(row) === false`. | `[unit]` |
| **§2.1's structural invariant, `i = 0..600` — the AC the whole D-32 answer rests on:** `cellFromIndex(i).row >= TOWN_HEAD_ROWS + 1`, `isSavingsRow(cellFromIndex(i).row) === false`, and the set of `savingsCellFor(id)` cells is **disjoint** from the set of `cellFromIndex(i)` cells. Asserted again with `TOWN_HEAD_ROWS` conceptually doubled (a second savings row, i.e. the D-17 6-plus-sub-types case) so the disjointness is proven as a property of the formula rather than of today's constant. | `[unit]` |
| **Frontage invariant, extended to savings:** for `i = 0..47` (4 blocks, hand-checkable; run to 600 too) every plot cell has ≥ 1 orthogonal road neighbour, **and every `savingsCellFor(id)` cell has ≥ 2** (the cross streets above and below). | `[unit]` |
| **`SERPENTINE_COLUMNS` and `SAVINGS_COLUMN_RANK` are both permutations of the six non-road grid columns (`{0,1,2,4,5,6}`)** — guards a typo that would stack two structures on one column or park one on the street. | `[unit]` |
| **MVP-SPEC F2's AC, made runnable in screen space (D-30 answered, §3.9):** for every `i` in `0..600` where `i` and `i+1` are in the same block, `cellFromIndex(i+1)` is either the cell immediately left/right in the same row, or `{row: row+1, col: col}` — i.e. screen adjacency holds. Spot-checked at the serpentine wrap: `cellFromIndex(6)` is `{row: 4, col: 6}`, directly below `cellFromIndex(5)`'s `{row: 3, col: 6}`. Across a block boundary (`i = 11 → 12`) the column is still equal and exactly one cross-street row lies between — asserted as its own case, because "directly below" is physically impossible there and pretending otherwise is what §3.9 refuses to do. | `[unit]` |
| **`savingsCellFor` is injective over `SAVING_CATEGORY_IDS`**, every result has `col !== ROAD_COLUMN` and `isSavingsRow(row) === true`, `savingsCellFor("deposit").col` and `savingsCellFor("stock").col` are `ROAD_COLUMN ∓ 1` (the two street-front lots), and `SAVINGS_ROW_ORDER` is sorted by `(row, col)` and contains every id exactly once. | `[unit]` |
| **`freeSavingsCells()` returns exactly `SAVINGS_ROWS * TOWN_COLUMNS - SAVING_CATEGORY_IDS.length` cells** (today: 1), none of them on `ROAD_COLUMN`. | `[unit]` |
| **The R-3 stylesheet guard (§3.5), extended in rev. 6 to the savings block's new class names and pip properties.** Read `src/App.css` as **text** (`node:fs`, no jsdom needed) and assert: <br>**(i) over the road blocks** `.town-grid` / `.town-tile` / `.town-main-street` / `.town-cross-street` — (a) no `grid-column`, `grid-row`, `grid-template-columns` **or `grid-template-rows`** declaration; (b) no `var(--town-*, …)` with a fallback argument; (c) `.town-grid`'s `padding` matches `/^8px\s+var\(--town-grid-pad-x\)\s+24px$/` and its `grid-auto-rows` is the keyword `auto`. <br>**(ii) over the savings block** `.savings-plot*` / `.savings-structure*` / `.savings-pip*` / `.savings-signpost` — (a) no `grid-column`, `grid-row`, `grid-template-columns` or `grid-template-rows` declaration in any of them; (b) no `var(--district-*, …)`, `var(--pip-*, …)` or `var(--town-*, …)` with a fallback; (c) neither `.savings-plot` nor `.savings-structure` declares `height` or `width` — those arrive inline from `savingsPlotHeightPx` / `structureLevelHeightPx`; (d) `.savings-pip`'s `width` and `height` are exactly `var(--pip-size)` and `.savings-structure-pips`'s `gap` matches `/^var\(--pip-row-gap\)\s+var\(--pip-gap\)$/` — the three literals rev. 5 left in the stylesheet, now that the wrap arithmetic reads them. <br>Both halves fail the moment someone re-hardcodes a number or adds a fallback — the drift AC-F13-16 and `plotTileWidthPx(390) >= 48` cannot see, since those read only TS constants. | `[unit]` (text assertion on a real file) |
| The container's inline style carries all **nine** custom properties, and `--town-grid-pad-x === GRID_PADDING_X_PX + "px"`, `--pip-size === PIP_SIZE_PX + "px"` — the DOM half of the same guard. | `[dom]` |
| **`@toss/tds-colors` actually loads under Vitest (§2.3).** Mount `TownGrid` with one building of a real category and assert the tile's inline `style.backgroundColor` is a non-empty string. This is the first time any test in this repo pulls `content.placeholder.ts` → `@toss/tds-colors` into its module graph. | `[dom]` |
| `gridRowCount(0) = 6`, `gridRowCount(12) = 6`, `gridRowCount(13) = 9`; `crossStreetRowCount(0) = 3`, `crossStreetRowCount(13) = 4`; `renderedTileCount(13) = 24`; **the first grid row and the last grid row are both cross streets**, and row 1 is a savings row. | `[unit]` |
| `GRID_TEMPLATE_COLUMNS === "1fr 1fr 1fr 22px 1fr 1fr 1fr"`, and it contains exactly `GRID_COLUMNS` tokens with the px token at index `ROAD_COLUMN` — **the R-3 guard**: this fails the moment someone changes `ROAD_COLUMN` without the template following. | `[unit]` |
| `plotTileWidthPx(390) >= 48`. Replaces rev. 2's "on the reference viewport plot tiles are ≥ 48px wide", which jsdom cannot measure. | `[unit]` |
| The rendered grid contains exactly **one** `.town-main-street` node at any town size, and `crossStreetRowCount(nextPlotIndex)` cross-street nodes. | `[dom]` |
| No tile's inline `style.gridColumn` equals `ROAD_COLUMN + 1`, and no tile's inline `style.gridRow` is a cross-street row + 1 **or the savings row + 1**. Catches any off-by-one between the template, the transform and the head offset. Readable because `TownGrid` sets these **inline** (`TownGrid.tsx:58` does so today). | `[dom]` |
| The street node's inline `style.gridColumn === String(ROAD_COLUMN + 1)` and the container's `style.gridTemplateColumns === GRID_TEMPLATE_COLUMNS` — the second R-3 guard, at the DOM level. | `[dom]` |
| **The main street spans the whole town, not one row (§3.4).** The single `.town-main-street` node's inline grid-row is `` `1 / span ${gridRowCount(nextPlotIndex)}` ``, asserted at **two** town sizes so a hardcoded span cannot pass: `nextPlotIndex = 0` → `"1 / span 6"`, `nextPlotIndex = 13` → `"1 / span 9"` (the same numbers `gridRowCount` is unit-asserted at). Additionally assert the value **is not** `"1 / -1"` — a named regression, since that string renders a plausible-looking one-row stub rather than failing. Read from the element's raw `style` **attribute text** (`street.getAttribute("style")`) rather than from `CSSStyleDeclaration`: jsdom's `cssstyle` is not guaranteed to round-trip the `grid-row` shorthand, and an empty read there would fail this AC for a harness reason rather than a layout one. | `[dom]` |
| Every tile wrapper carries `town-tile--left` or `town-tile--right` matching `roadSideOf(col)`, **and so does every `.savings-plot`**. Rev. 2 asked for "roofs lean right / left, snapshot or computed-style assertion" — **not possible**: the lean lives in App.css and Vitest never applies it (`css` defaults to false, §2.9). The class is assertable; the lean is `qa`'s eye. | `[dom]` for the class, `[qa]` for the lean |
| On the 390×844 reference viewport, the street is visible at every scroll position, **it runs through the savings block between 예적금 and 주식 투자**, the crosswalk sits on the intersection, and the centre line runs inside the street column (**the direct regression test for §3.5's positioning-context defect** — the broken version paints a line down the whole page). | `[qa]` |
| `dense` fixture (5,400 plots): 900 plot rows → 450 blocks → **1,353 grid rows** (900 plot + 451 road + 1 savings + 1 extra road row for the head). F3's dense AC (< 1s paint, 60fps) is re-verified against this; virtualization (already deferred to the F3 dense task) must skip cross-street rows outside the window **and must never virtualize away the savings row while it is on screen**. | `[qa]`, on the real build |
| **Regression, the point of the whole architecture:** `selectors.test.ts` passes **unmodified**, and neither task's diff touches `plotFromIndex`/`TOWN_COLUMNS`/`nextPlotIndex` (§5.5's rescoped evidence rule — the road task's `ladderFor` append is expected and does not violate this). | `[unit]` + Gate-1 evidence |

### 3.9 MVP-SPEC F2's screen-adjacency AC — answered, not amended (D-30)

MVP-SPEC §5 F2's AC ends, verbatim (MVP-SPEC:220):

> Building at index 6 is directly below index 5 (serpentine adjacency), verified by unit test on `plotFromIndex` for i = 0..23.

**Rev. 3 handled this by reinterpretation ("it is a statement about *storage* order"), and that was wrong.** The AC's parenthetical says *serpentine adjacency*, its subject is *a building*, and a reader — the director, QA, or the dev implementing it — takes "directly below" to mean **on screen**. Quietly redefining it to mean "adjacent in an array the player never sees" changes what the app looks like while leaving the spec sentence intact. That is the project's named failure mode wearing a technicality. Rev. 4/5 withdrew the reinterpretation and raised it as D-30 with two fully specified mappings.

**Rev. 6 answers it: the mapping that keeps the sentence true on screen ships.** `SERPENTINE_COLUMNS = [0,1,2,4,5,6]` is the only column mapping in the codebase; `COLUMN_ORDER`, `STREET_FIRST_COLUMNS` and the guarded per-branch ACs are deleted. Concretely:

| index | plot space (`plotFromIndex`) | screen (`cellFromIndex`) |
|---|---|---|
| 5 | `{row: 0, col: 5}` | `{row: 3, col: 6}` |
| 6 | `{row: 1, col: 5}` | `{row: 4, col: 6}` — **directly below** |

**What this costs, stated so it is not hidden:** the street-front-first *fill order* is gone. Row 0 now fills from the far-left edge inward, and the two lots flanking the main street are the 3rd and 4th ordinary buildings a player earns rather than the 1st and 2nd. Rev. 5 recommended the opposite trade. Three things changed its price:

1. **D-32's answer already put buildings on the street front** — the two the director named, permanently, at the village entrance. The fill order was a proxy for "도로 근처에 건물"; the savings block is the literal article.
2. **The frontage invariant was always the real answer** and it is unaffected: every plot has road frontage under either mapping, proven by the same test.
3. **The serpentine is the town's stated character.** MVP-SPEC F2's own comment calls it "one street winding downward" (`selectors.ts:18`); carrying it onto the screen makes the rendered town match the sentence the spec uses to describe it, instead of matching it only in an array.

**The one clause MVP-SPEC still needs** (listed in §2.8a at :220), because a road physically sits between two blocks:

> *"— and on screen too (`cellFromIndex`, ADDENDUM-01 §3.3), except across a block boundary, where the two plots share a column and a cross street lies between them."*

That is not an amendment to what the AC promises; it is the geometry the AC could not have anticipated before there were roads. §3.8 asserts both halves separately.

---
## 4. Data model diff — exactly what changes vs T002/T003/T004

Everything below is **additive**, and — worth restating now that the savings structures stand in the village — **the on-street move changed nothing in this section.** §4.1 through §4.5a are byte-for-byte what rev. 5 specified for the band. That is the D-32 answer's whole engineering story: it is a rendering change (§2.1).

### 4.1 `src/types.ts`

```ts
// CHANGED — ADDENDUM-01 §2.2. `invest` retired; `deposit`/`stock` added. (was types.ts:26)
export type SavingCategoryId =
  | "deposit"        // 예적금  (NEW)
  | "stock"          // 주식 투자 (NEW)
  | "emergency"      // unchanged
  | "goal"           // unchanged
  | "other_saving";  // unchanged

// NEW — readable-only legacy id, never offered in the picker (§4.4).
export type LegacySavingCategoryId = "invest";

export type CategoryId =
  | ExpenseCategoryId | IncomeCategoryId | SavingCategoryId;   // unchanged shape; legacy is NOT in here
```

`LegacySavingCategoryId` is deliberately **kept out of `CategoryId`**, following the same reasoning the file already applies to `ParkCategoryId` (`types.ts:37-43`: "Building-only widening — kept OUT of `CategoryId` … so `LedgerEntry`/`EntryDraft` stay honest to real categories at the type level"). A legacy id is a *readable* id, not a creatable one.

```ts
export interface TownState {
  // ... every existing field unchanged (types.ts:101-114) ...
  cumulativeSavingsKrw: number;                                      // KEPT — total; still powers 기록, still the compat anchor
  savingsByCategoryKrw?: Partial<Record<SavingCategoryId, number>>;  // NEW — OPTIONAL, drives the block
}
```

**The `?` is load-bearing.** A required field would be a **compile break in six places** that construct a `TownState` literal: `storage.ts:96` `defaultTownState()`, `storage.test.ts:17`, `devtools/fixtures.ts:124` `freshTown()`, and the three test-local `freshTown` helpers at `entryActions.test.ts:6`, `queueActions.test.ts:5`, `noSpendActions.test.ts:5`. Optional costs one `?? {}` at each read (which the persistence story wanted anyway — a `core` written before this change has no such field) and buys zero breakage. `defaultTownState()` still sets `savingsByCategoryKrw: {}` explicitly so fresh towns are not "absent"; that is an addition to an object literal, not a signature change.

**Data invariant, worth testing (AC-F13-4):** `cumulativeSavingsKrw === sum(Object.values(savingsByCategoryKrw ?? {}))`. Both are denormalized from the same entries; if they ever disagree, one of the two write paths is wrong.

Read discipline, one helper so `?? 0` is never open-coded:

```ts
export function savingsOf(town: Pick<TownState, "savingsByCategoryKrw">, id: SavingCategoryId): number {
  return town.savingsByCategoryKrw?.[id] ?? 0;
}
```

### 4.2 `src/selectors.ts` — **append only, nothing modified**

```ts
// UNCHANGED, not opened: TOWN_COLUMNS, plotFromIndex, rebuildDerived, towerSegments,
//                        and every existing selector and its tests. See §4.7 on towerSegments.

// NEW — rebuild the per-category aggregate from entries (import / corrupt-core recovery).
// `bucketOf` is injected rather than imported for the same reason `towerSegments` takes its
// thresholds and `canClaimNoSpend` takes `noSpendDayCostsSlot`: selectors.ts imports only
// ./calendar and ./types (lines 10-11) and stays free of content/balance modules.
export function savingsByCategory(
  entries: readonly LedgerEntry[],
  bucketOf: (categoryId: string) => SavingCategoryId,
): Partial<Record<SavingCategoryId, number>> {
  const totals: Partial<Record<SavingCategoryId, number>> = {};
  for (const e of entries) {
    if (e.type !== "saving") continue;
    const id = bucketOf(e.categoryId);
    totals[id] = (totals[id] ?? 0) + e.amountKrw;
  }
  return totals;
}
```

**`rebuildDerived` keeps its exact current signature** (`selectors.ts:63-75`). Widening its return to a third key breaks `selectors.test.ts:247` and `:259` — both assert the whole object with `toEqual({ cumulativeSavingsKrw, lastSettledPeriod })`, and `toEqual` fails on an extra key. Composing at the one call site instead is the same one line of behaviour and zero test churn:

```ts
// storage.ts:338-345, corrupt-core recovery — one added line, no signature change anywhere
core = { town: {
  ...defaultTownState(),
  ...rebuildDerived(recoveredEntries),
  savingsByCategoryKrw: savingsByCategory(recoveredEntries, savingsBucketOf),   // NEW
  nextPlotIndex,
  noSpendDays: recoverNoSpendDays(buildings),
  queue: recoverQueue(recoveredEntries),
}, budget: …, onboarded: true };
```

(Alternative, if a future reader prefers one function: widen `rebuildDerived` and update those two assertions — 2 lines of test. Recorded so the choice is visible, not so it is taken.)

### 4.3 `src/balance.placeholder.ts`

```ts
savingsTowerSegments: [ ...unchanged (lines 25-28)... ],   // now the DEFAULT ladder for every savings structure — D-13
// NEW — empty means "every structure uses the default". Per-type curves are D-13a.
savingsStructureSegments: {} as Partial<Record<SavingCategoryId, readonly number[]>>,
```

**No new numeric values are introduced.** `BALANCE_UNSET` stays `true`; the banner (`App.tsx:65-69`) and the Gate-3 block are unaffected. `balance.placeholder.test.ts` asserts per-key presence (`:28-29` checks `savingsTowerSegments` is a non-empty array), not an exact key set, so an added key does not break it. Layout constants (`GRID_COLUMNS`, `ROAD_COLUMN`, `BLOCK_ROWS`, `TOWN_HEAD_ROWS`, the `SEG_*_PX` / `PIP_*_PX` / road px values) stay out of this file and live in `townLayout.ts`, consistent with the rule the file's own footer states (`balance.placeholder.ts:32-34`: layout is not pacing).

### 4.4 `src/content.placeholder.ts` — including a rev. 2 type error

- `CATEGORY_CONTENT`'s four saving rows (lines 44-47) become five: `deposit 예적금 🏦`, `stock 주식 투자 📈`, `emergency 비상금 🔒`, `goal 목표 저축 🎯`, `other_saving 기타 저축 🪙`.
- `CATEGORIES_BY_TYPE.saving` (line 57): **`[]` → the five above.** This is the line that makes 저축 selectable at all; it was left empty on purpose by T003 and is unblocked by this addendum, not broken by it.
- **NEW** `SAVINGS_STRUCTURE` — the full contract in §2.3, and `levelUpToastFor` (§2.6a).

**Rev. 2 defect, found on re-check.** Rev. 2 said it would keep "a legacy `invest` row … for old data" in `CATEGORY_CONTENT`. **That does not compile.** `CATEGORY_CONTENT` is declared `Record<BuildingCategoryId, CategoryContent>` (line 39) and `CategoryContent.id` is typed `BuildingCategoryId` (line 13); once `invest` leaves `SavingCategoryId`, an `invest` key is an excess property on the literal and `id: "invest"` is not assignable. Three lines fix it:

```ts
/** Ids that CONTENT must cover: every creatable category, the park tile, and read-only legacy ids. */
export type ContentCategoryId = BuildingCategoryId | LegacySavingCategoryId;

export interface CategoryContent {
  id: ContentCategoryId;          // was BuildingCategoryId
  label: string; icon: string; color: string;
}

export const CATEGORY_CONTENT: Record<ContentCategoryId, CategoryContent> = {
  …,
  invest: { id: "invest", label: "투자", icon: "📈", color: colors.purple400 },  // legacy, never in CATEGORIES_BY_TYPE
};
```

Why keep the row at all rather than route every read through the alias: 기록's entry list renders a stored entry by `CATEGORY_CONTENT[entry.categoryId]`, and a legacy entry's stored `categoryId` really is `"invest"`. Aliasing on read would mean auditing every lookup site; one row means none. `EntrySheet.tsx:192`'s existing `c.id as CategoryId` cast already absorbs the widening — but its comment (lines 188-191, which explains the cast in terms of the park tile only) must be updated to mention legacy ids, or it becomes a lie.

### 4.5 `src/savingsBuckets.ts` (NEW) — legacy `invest`, and the id list

`CATEGORIES_BY_TYPE.saving` is `[]` today **and** `EntrySheet.tsx:157` renders the 저축 segment `disabled` (`title="저축은 곧 지원돼요 (F13)"`), so **no user can have created a 저축 entry through the UI**. The only `invest` data that can exist is inside a **loaded fixture** (`devtools/fixtures.ts:82`), which may be sitting in the director's or QA's browser right now.

So: retire `invest` from the picker, keep it readable.

**Rev. 3 put `savingsBucketOf` in `content.placeholder.ts`. That does not work, and §4.5a is why:** `entryActions.ts` needs it (it is the only way `EntryDraft.categoryId` narrows), and `entryActions.ts` imports exactly `./selectors` and `./types` (lines 13-14). Importing `content.placeholder.ts` from a pure domain module would drag `@toss/tds-colors` (`content.placeholder.ts:9`) into the domain layer *and* into `entryActions.test.ts`'s module graph. So the bucket logic moves to its own module with **one import, and it is `./types`**:

```ts
// src/savingsBuckets.ts — NEW. Pure domain. Imports only ./types (no content, no colours,
// no balance). Peer of selectors.ts, so entryActions.ts / townLayout.ts may import it freely.
import type { SavingCategoryId } from "./types";

/**
 * Canonical PROMINENCE RANK order (changed in rev. 6 — it used to be "left→right
 * render order"). Rank 0 and 1 are the two sub-types the director named, and
 * `SAVINGS_COLUMN_RANK` (§3.3) puts them on the two lots flanking the main
 * street. The left→right DOM/screen order is DERIVED from that mapping as
 * `SAVINGS_ROW_ORDER`, so this list never has to encode geometry.
 */
export const SAVING_CATEGORY_IDS = [
  "deposit", "stock", "emergency", "goal", "other_saving",
] as const satisfies readonly SavingCategoryId[];

/** Read-only legacy ids, never offered in the picker. D-24 decides the target. */
export const LEGACY_SAVING_ALIAS: Record<string, SavingCategoryId> = { invest: "stock" };

/** Type guard — the honest form of "is this stored string a live saving category?". */
export function isSavingCategoryId(id: string): id is SavingCategoryId {
  return (SAVING_CATEGORY_IDS as readonly string[]).includes(id);
}

/**
 * Any stored categoryId -> the bucket it counts toward. TOTAL over `string`:
 * unknown ids fall to 기타 저축, so a stale localStorage value can never produce
 * an `undefined` lookup. This function's RETURN TYPE is the narrowing §4.5a needs.
 */
export function savingsBucketOf(id: string): SavingCategoryId {
  const aliased = LEGACY_SAVING_ALIAS[id] ?? id;
  return isSavingCategoryId(aliased) ? aliased : "other_saving";
}
```

`isSavingCategoryId` replaces rev. 3's `(aliased in SAVINGS_STRUCTURE ? … ) as SavingCategoryId` — that version needed a cast because `in` does not narrow a `string` against a `Record` key type, and it coupled bucket logic to a content record. This version has no cast and no content import.

`savingsByCategory()` (§4.2) keeps taking `bucketOf` as an **argument** rather than importing it, because `selectors.ts`'s own header rule is "imports only `./calendar` and `./types`" (lines 10-11). `entryActions.ts` imports it **directly**, because that file already imports a sibling domain module (`./selectors`, line 13) and injecting a second function through `ApplyNewEntryArgs` would put a content decision in `useTownStore`'s call site for no gain.

Whether `invest` aliases to 주식 투자 or falls into 기타 저축 is **D-24**. It is one line in this file either way.

### 4.5a `entryActions.ts` — the 저축 branch, and exactly how `categoryId` narrows

**The defect rev. 3 shipped:** it described accumulating `savingsByCategoryKrw[draft.categoryId]` inside the `if (draft.type === "saving")` branch as though `categoryId` were narrowed there. It is not. `EntryDraft` (`entryActions.ts:16-22`) declares `type: EntryType` and `categoryId: CategoryId` as **two independent fields** — not a discriminated union — so inside that branch `draft.categoryId` is still the full `CategoryId`. Indexing `Partial<Record<SavingCategoryId, number>>` with it does not compile.

**The mechanism: a total function whose return type is the narrow one.** `savingsBucketOf(draft.categoryId)` takes `string` and returns `SavingCategoryId`. No cast, no assertion, no type guard at the call site — the narrowing is the function's signature, and its totality is what makes that honest.

```ts
// entryActions.ts — import list (line 13-14) gains one sibling domain module
import { advanceStreak, slotsRemainingToday, tier } from "./selectors";
import { savingsBucketOf } from "./savingsBuckets";                    // NEW
import type { Building, CategoryId, EntryType, LedgerEntry, QueuedMaterial, TownState } from "./types";

// ... replaces the short-circuit at lines 106-117 ...
if (draft.type === "saving") {
  // 저축 never builds/queues/consumes a slot and is never a streak act (F13).
  // `draft.type === "saving"` narrows NOTHING about `draft.categoryId` —
  // EntryDraft's two fields are independent, not a discriminated union.
  // `savingsBucketOf` is total over string and RETURNS SavingCategoryId;
  // that return type is the narrowing, and it also absorbs legacy `invest` (§4.5).
  const bucket = savingsBucketOf(draft.categoryId);
  const buckets = town.savingsByCategoryKrw ?? {};
  const newTown: TownState = {
    ...town,
    cumulativeSavingsKrw: town.cumulativeSavingsKrw + draft.amountKrw,
    savingsByCategoryKrw: { ...buckets, [bucket]: (buckets[bucket] ?? 0) + draft.amountKrw },
  };
  return {
    entry: { ...baseEntry, buildingId: null, queued: false },
    building: null,
    queuedMaterial: null,
    queueOverflow: false,
    town: newTown,          // NEW OBJECT — this is break B2 (§5.2), and AC-F13-1 replaces the identity check
    revokedNoSpend,
    celebrateTier: null,
  };
}
```

Three properties worth naming, because each is an AC:

- **`town` here is the post-revocation `town` local** (`entryActions.ts:82`, reassigned at `:87`), not `args.town`. A 저축 entry can never trigger F15 revocation (that branch is `draft.type === "expense"` only, line 84), so the two are always the same object on this path — but spreading the local is what keeps that true if the revocation condition ever widens. AC-F13-1's "every other field equals its pre-save value" covers it.
- **Exactly one bucket moves** (AC-F13-5), because one entry has one `categoryId`.
- **`cumulativeSavingsKrw` and the bucket map are written in the same expression**, which is what makes §4.1's data invariant (`cumulative === sum(buckets)`) a property of the code rather than of two call sites remembering each other. AC-F13-4 asserts it.
- **Nothing in this branch reads or writes `nextPlotIndex`, and that is now the load-bearing fact** (§2.1). On-street placement did not add a line here.

### 4.6 Components / storage / fixtures / CSS

| File | Change |
|---|---|
| **`savingsBuckets.ts`** | **NEW** (§4.5) — `SAVING_CATEGORY_IDS`, `LEGACY_SAVING_ALIAS`, `isSavingCategoryId`, `savingsBucketOf`. Imports **only `./types`**. **PM correction (post rev. 6 review): lands with the road task, not the 저축 블록 task** — `townLayout.ts` imports `SAVING_CATEGORY_IDS` from it for `TOWN_HEAD_ROWS`/`SAVINGS_COLUMN_RANK` sizing, so it must exist before the road task can compile. `savingsBucketOf` and the alias logic are unused until the 저축 블록 task wires the entry-sheet branch, but the file itself ships early. |
| `savingsBuckets.test.ts` | **NEW** — `savingsBucketOf` is total (every `CategoryId`, `"invest"`, and an unknown string all return a live `SavingCategoryId`); `"invest"` maps per D-24; `SAVING_CATEGORY_IDS` has five distinct members and covers `SavingCategoryId` exhaustively. |
| `townLayout.ts` | **NEW** (§3.3, §2.5) — the entire road layout, all grid coordinates, all road px, all box metrics the TS arithmetic uses (incl. `GRID_PADDING_X_PX` and the three pip metrics), the generated column template, **the savings block's cells** (`SAVINGS_COLUMN_RANK`, `SAVINGS_ROWS`, `TOWN_HEAD_ROWS`, `savingsCellFor`, `isSavingsRow`, `SAVINGS_ROW_ORDER`, `freeSavingsCells`) and **the savings plot geometry** (`structureHeightPx`, `structureLevelHeightPx`, `savingsPlotHeightPx`, `savingsPlotTemplateRows`, `pipRowWidthPx`, `PIPS_PER_ROW`, `pipRowCount`, `pipBlockHeightPx`, `districtLadderLength`). Imports from `selectors.ts` and `savingsBuckets.ts`; nothing imports back. **Holds no number that App.css also holds.** |
| `townLayout.test.ts` | **NEW** (§3.8) — round-trip, injectivity, **the §2.1 disjointness invariant**, frontage (plots + savings), row/tile/cross-street counts, the serpentine screen-adjacency AC, `savingsCellFor` / `SAVINGS_ROW_ORDER` / `freeSavingsCells`, the R-3 template guard, the **R-3 `App.css` text guard (road + savings blocks)**, `plotTileWidthPx`, and AC-F13-16's pip-overflow guard and height/template identity. |
| `components/TownGrid.tsx` | Call site switches `plotFromIndex(i)` → `cellFromIndex(i)` (line 50); row/tile counts from `gridRowCount`/`renderedTileCount`/`crossStreetRowCount` (replacing line 45); side class from `roadSideOf`; one main-street node **spanning `1 / span gridRowCount(...)`, never `1 / -1` (§3.4)**; cross-street nodes; **`<SavingsRow>` + the signpost node**; **inline `gridTemplateColumns` (line 78) replaced by `GRID_TEMPLATE_COLUMNS`** plus the **nine** custom properties (§3.4). **Props gain the four savings fields (break B14).** Memoization, `justBuiltId` auto-scroll and the `byPlotIndex` map are unchanged, and the `tiles` `useMemo` deps are untouched. |
| `components/TownGrid.test.tsx` | **NEW — the repo's first component test.** Bare `createRoot` + `act`, copying `useTownStore.test.tsx:17-18`'s harness. No new dependency (§2.9). Carries the placement ACs, including AC-F13-17/-18. |
| `components/EmptyLot.tsx` | **Additive** optional `variant?: 0 \| 1 \| 2`, default 0 = today's rendering (the component currently takes no props, `EmptyLot.tsx:4`). |
| `components/PlaceholderBuilding.tsx` | **No change.** Facing is a CSS concern on the wrapper. |
| **`components/SavingsRow.tsx`** | **NEW** (renamed from rev. 5's `SavingsDistrict.tsx`, because it is no longer a district component — it is a row of village lots). **Returns a fragment of grid items, never a wrapper element (§2.4a).** DOM and class contract per §2.4a; every metric inline from §2.5's functions (R-3). Must not import `@toss/tds-mobile`, and does **not** raise its own toast — the store does (§2.3, §2.6a). Owns the level-up `scrollIntoView` ref, keyed on `justGrew.seq`. |
| `components/SavingsRow.test.tsx` | **NEW** — the content ACs: AC-F13-8 / -9 / -10(c) / -11(b). Placement ACs live in `TownGrid.test.tsx` (§2.9). |
| `content.placeholder.ts` | Five 저축 rows + legacy `invest` row + `ContentCategoryId` (§4.4); `SAVINGS_STRUCTURE` (§2.3); `levelUpToastFor` (§2.6a). `LEGACY_SAVING_ALIAS` / `savingsBucketOf` do **not** live here — see §4.5. |
| `components/EntrySheet.tsx` | Line 157's `disabled` + `title="저축은 곧 지원돼요 (F13)"` come off the 저축 `SegmentedControl.Item`; the existing category grid then renders the five 저축 chips with no other change (it already reads `CATEGORIES_BY_TYPE[type]`). Update the stale comment at lines 188-191 (§4.4). |
| `App.tsx` | **The `buildingCount === 0` ternary becomes an unconditional `<TownGrid>` plus a compact empty-state banner (§2.4, break B13)**; `TownGrid` receives the four savings props from `store` and `BALANCE` (break B14); two imports (`levelUpToastFor`, and `SavingsRow` only if it is not imported by `TownGrid` — it is, so App gains one import, not two). Plus line 32's binary toast ternary becomes a four-way chain for the `savings` and `relayout` notices (§2.6a / §3.6, break B8). |
| `App.css` | `.town-grid` gap/auto-rows/**padding** (every coordinate and every TS-shared metric removed, R-3 — `padding: 8px var(--town-grid-pad-x) 24px`, **no fallback**, §3.5); new `.town-main-street`, `.town-cross-street` (**both `position: relative`**, §3.5), `.town-tile--left/right`, `.empty-lot--v0/1/2`, `.town-empty-state--with-grid`, and the **savings block written out in §3.5** (`.savings-plot*`, `.savings-structure*`, `.savings-pip*`, `.savings-signpost`, `@keyframes savings-rise`) — same R-3 discipline, covered by the same `App.css` text guard (§3.8). |
| `useTownStore.ts` | Expose `savingsByCategoryKrw` and `justGrew: { id; seq } \| null` (F13 task); `addEntry` calls `grownStructures(prev.town, result.town, …)` and pushes a `savings` notice + bumps `justGrew.seq` (§2.6a); `Notice` union gains `{ kind: "savings"; id }` and `{ kind: "relayout" }` (§3.6). One new `useRef` for the sequence counter. |
| `entryActions.ts` | The 저축 branch (lines 106-117) gains accumulation of `cumulativeSavingsKrw` + `savingsByCategoryKrw` via `savingsBucketOf` (**the narrowing — §4.5a**), plus one import. The branch returns a **new** town object. See §2.1 and break B2. |
| `selectors.ts` | **Append only** (§4.2, §2.5, §2.6a): `savingsByCategory`, `ladderFor`, `grownStructures`. Its type import (line 11) gains `SavingCategoryId`. **PM correction: `ladderFor` alone lands with the road task** (`townLayout.ts` needs it for savings-plot row-height sizing); `savingsByCategory` and `grownStructures` still land with the 저축 블록 task. Nothing **existing** in this file is ever modified — both tasks only append. §5.5's Gate-1 evidence rule is rescoped accordingly (see §5.5). |
| `storage.ts` | `defaultTownState()` (line 95) gains `savingsByCategoryKrw: {}`; corrupt-core recovery (line 338) composes `savingsByCategory()`; `StorageIndex`/`emptyIndex()`/`rebuildIndexFromKeys()` gain `layoutVersion`; `loadBoot()` compares it and reports a relayout. |
| **`devtools/fixtures.ts`** | **Six changes — see below.** Unaffected by the on-street move: fixtures carry data, not geometry. |

**`devtools/fixtures.ts` in full** — the file constructs town state in more places than rev. 2 accounted for, and one of them contradicts the new model outright.

| # | Location | Change |
|---|---|---|
| **f1** | `SAVING_CATEGORIES` (line 82) — `["emergency","goal","invest","other_saving"]` | Replace with the new five. A **compile** break (B3), not a migration: fixtures are code. |
| **f2** | `freshTown(today)` (lines 124-139) | Add `savingsByCategoryKrw: {}`. This one addition covers `empty`, `budgetBlown`, `noSpendStreak`, and the base of every other fixture, since all seven spread it. |
| **f3** | `generateMonth` (lines 169-236) | No signature change needed. Its saving branch (lines 206-209) already emits real saving entries with real category ids drawn from `SAVING_CATEGORIES`, so per-category data comes for free once fixtures derive it from `entries` — exactly what the real recovery path does (§4.2). |
| **f4** | `oneMonth` (line 284) — `cumulativeSavingsKrw` computed by filtering entries | Replace with the shared derivation: `const savingsByCategoryKrw = savingsByCategory(entries, savingsBucketOf); const cumulativeSavingsKrw = Object.values(savingsByCategoryKrw).reduce((a, b) => a + b, 0);` and put both on the town (line 291). Same total as today, now with the split. `corrupt()` (line 600) inherits this for free. Result: the block boots at a **plausible mixed state** — some structures at level 1-2, some at 0 — which is what "the normal case" fixture is for, and it is what makes the entrance block look alive in a demo. |
| **f5** | **`dense` (line 355) — the contradiction, fixed.** Today: `cumulativeSavingsKrw = Math.max(cumulativeSavingsKrw, BALANCE.savingsTowerSegments[last])`, i.e. the total is forced to the top of the ladder. After this addendum that fixture would boot showing **a maxed-out savings total in 기록 next to five empty level-0 lots**. | Keep the fixture's job ("prove rendering at max height"), make it truthful: derive organically, then **top every bucket up to the last ladder threshold**, and make the total the sum of the buckets. Code below. |
| **f6** | `unsettled` (lines 566-597) — spreads `freshTown` and never sets `cumulativeSavingsKrw`, although `generateMonth` gave it real saving entries across three months | Pre-existing inconsistency (its 기록 savings total is 0 today despite the entries). Apply f4's two lines here too, so the block and 기록 agree. |
| **f7** | `capExceeded` (line 410) and `queueFull` (line 463) | **Deliberately left at `{}` / 0.** Their job is F14's cap and overflow branches, and **AC-F13-3 depends on it**: starting from an all-zero block makes "a 저축 save still grows a structure while the queue is full" observable as an unambiguous 0 → 1, with nothing else on screen moving. Both fixtures generate only expense entries (lines 393, 443), so this is also simply true rather than imposed. |

```ts
// dense(), replacing line 355. No new number: TOP is read from the same D-13 placeholder
// ladder the block already uses, so the balance pass moves this fixture with it.
const TOP = BALANCE.savingsTowerSegments[BALANCE.savingsTowerSegments.length - 1];
const organic = savingsByCategory(entries, savingsBucketOf);
const savingsByCategoryKrw: Partial<Record<SavingCategoryId, number>> = {};
for (const id of SAVING_CATEGORIES) savingsByCategoryKrw[id] = Math.max(organic[id] ?? 0, TOP);
const cumulativeSavingsKrw = Object.values(savingsByCategoryKrw).reduce((a, b) => a + b, 0);
```

Consequences of the `dense` change, re-checked against on-street placement:

- `fixtures.test.ts:52-59` ("dense has ~5,400 buildings, 36 monuments, and a full tower") asserts `f.town.cumulativeSavingsKrw >= savingsTowerSegments[last]`. The new total is the sum of five buckets each ≥ that threshold, so the assertion **still passes unmodified**. Only the test's *name* is now stale ("full tower" → "full 저축 블록"); renaming it is optional and free.
- `dense`'s 기록 savings total rises to ≈ 5 × the top threshold. Derived from the ladder, not chosen.
- **New in rev. 6:** `dense` is also the fixture that proves the entrance block at maximum height (five structures at `structureHeightPx(8) = 128px` in a `savingsPlotHeightPx(8) = 170px` row) sits correctly above 1,351 rows of town. That is §3.8's `[qa]` dense line.
- **Alternative considered and not taken:** leave `dense` organic and add a sixth fixture (`savingsMaxed`). That splits "the dense state" into two fixtures QA must remember to load, and leaves `dense`'s own documented job ("full tower", line 371) unfulfilled.

### 4.7 `towerSegments` — the disposition, stated once, plainly

**1. The 저축탑 *mechanic* — one tower whose height is `cumulativeSavingsKrw` — is REMOVED.** Not kept as a fallback, not behind a flag, not a rendering option. Five per-category buildings replace it. There is nothing to fall back to because **the tower was never built**: F13 is build-order step 4 and has not been started, `CATEGORIES_BY_TYPE.saving` is still `[]`, and the 저축 segment is still `disabled` in the entry sheet. No user-visible behaviour is being retired.

**2. The `towerSegments` *function* (`selectors.ts:192-195`) is KEPT, UNCHANGED, and REUSED as the level function.** It is already category-agnostic — `towerSegments(krw, thresholds)` counts thresholds ≤ krw and knows nothing about towers — so each structure calls it with its own amount and its own ladder (§2.5). **Rev. 2's proposed `savingsStructureLevel` is withdrawn: it was a byte-for-byte duplicate of an existing exported selector.**

**3. `selectors.test.ts:180-187` is KEPT, unmodified.** It is not a test for a retired mechanic; it is the only test of the exact arithmetic every structure's level now depends on (`0 → 0`, `99,999 → 0`, `100,000 → 1`, `650,000 → 3`).

**4. Nothing becomes dead code.** `towerSegments` has zero production call sites today (the only importer in the whole `src/` tree is `selectors.test.ts:16`) — the savings block gives it its first real caller.

**5. One cosmetic debt, named rather than done:** the function's name and doc comment still say "tower". Renaming it to `savingsLevel` would touch `selectors.ts` and `selectors.test.ts` for zero behaviour change, which conflicts with §5.5's empty-diff evidence rule for the road task. **Recommendation: leave the name, update only the doc comment when the F13 task opens the file.**

---

## 5. Migration / compatibility — what actually breaks

### 5.1 Breaks the naive version has, that this one does not

| Was going to break | Why it no longer does |
|---|---|
| `selectors.test.ts:22-63` — the whole `describe("plotFromIndex")` block | `plotFromIndex` and `TOWN_COLUMNS` are byte-identical. The road layout lives in `cellFromIndex` (§3.1). And with D-30 answered in favour of screen adjacency (§3.9), **MVP-SPEC F2's AC sentence is true in both spaces** — the test passes *and* the sentence holds, which is the outcome rev. 3 faked and rev. 4/5 could not promise. |
| `entryActions.test.ts:61` — `plotFromIndex(building.plotIndex)` equals `{row:0,col:0}` | Same. Untouched. |
| `useTownStore.test.tsx:88` — second building at `{row:0,col:1}` | Same. Untouched. |
| Every existing demo/fixture town re-arranging its stored geometry | Nothing stored changes. Buildings paint in new cells; not one byte moves. §3.6's one-time notice covers the visual change. |
| Six `TownState` object literals failing to compile | `savingsByCategoryKrw` is optional (§4.1). `defaultTownState()` still sets `{}`. |
| **`nextPlotIndex` having to skip reserved indices for the savings buildings** (the cost D-32 warned about) | **Does not happen.** Savings structures own *cells*, never *indices*, and the two cell spaces are provably disjoint (§2.1, §3.8). `entryActions.ts`, the F14 drain, F9 deletion, F12 import and `storage.ts`'s recovery paths are all untouched by the placement decision. |

### 5.2 Breaks that are real

| # | Break | Cause | Status |
|---|---|---|---|
| **B1** | `selectors.test.ts:247` / `:259` — `toEqual({ cumulativeSavingsKrw, lastSettledPeriod })` fails on an extra key | A widened `rebuildDerived` return | **Designed out.** Signature kept; `savingsByCategory()` composed at the one call site in `storage.ts` (§4.2). Zero test change. |
| **B2** | `entryActions.test.ts:108` — `expect(result.town).toBe(town); // untouched` (reference identity) | The 저축 branch must return a new town object once it accumulates `savingsByCategoryKrw` | **Real, unavoidable, accepted.** One assertion is rewritten into the stronger AC-F13-1 plus AC-F13-3. The invariant gets *better* coverage than the identity check gave it — `toBe` would also have passed if the branch had silently stopped running. |
| **B3** | `devtools/fixtures.ts:82` — `SAVING_CATEGORIES` no longer type-checks | Retiring `invest` from `SavingCategoryId` (§4.1). A **compile** break — Gate 1 fails, tests never run. | **Real, 1 line** (§4.6 f1). |
| **B4** | `storage.test.ts:112-116` — `expect(bootAfterIndexCorruption.index).toEqual({ schemaVersion: 1, entryMonths: […], buildingMonths: […] })`, an exact-object assertion | Adding `layoutVersion` to `StorageIndex` (§3.6) | **Real, 1 line** in the test (add `layoutVersion: 1`). No other index assertion in the suite is exact — `:144`, `:271`, `:278` assert individual arrays. |
| **B5** | `CATEGORY_CONTENT` will not compile with a legacy `invest` row | `Record<BuildingCategoryId, …>` + `CategoryContent.id: BuildingCategoryId` (content.placeholder.ts:13, 39) | **Real, 3 lines** — new `ContentCategoryId`, widened `id`, widened record (§4.4). |
| **B6** | The 7-column template silently never applies | `TownGrid.tsx:78`'s inline `gridTemplateColumns: repeat(${TOWN_COLUMNS}, 1fr)` overrides any stylesheet | **Not a test break — worse: a silent no-op.** Fixed by replacing the inline value with `GRID_TEMPLATE_COLUMNS` (§3.4). §3.8 adds two DOM assertions that catch a regression. |
| **B7** | 저축 is unreachable in the UI | `EntrySheet.tsx:157` renders the 저축 segment `disabled` | **Real, 1 line**, in the F13 task. No test asserts on it (there is no `EntrySheet` test file). |
| **B8** | The `relayout` **and** `savings` notices would each toast `undefined` | `App.tsx:32`'s binary ternary maps every non-`corruption`, non-`tier` notice to the `drained` message | **Real, 2 branches** (one per task). §2.6a replaces the ternary with an explicit four-way chain so the *next* added kind is a visible edit rather than another silent `undefined`. |
| **B9** | Two road pseudo-elements position against `.town-screen` | Neither `.town-grid` (App.css:133-138) nor rev. 2's road rules declare `position` | **Not a test break — a silent visual bug.** Fixed by `position: relative` on the two road rules (§3.5). Regression is `[qa]`. |
| **B10** | `savingsByCategoryKrw[draft.categoryId]` does not compile in `entryActions.ts` | `EntryDraft.type` and `EntryDraft.categoryId` are independent fields, so `type === "saving"` narrows `categoryId` not at all | **Real, and rev. 3 shipped it as prose.** Fixed by `savingsBucketOf` from the new `savingsBuckets.ts` — one import, no cast (§4.5a). A **compile** break if missed. |
| **B11** | `justGrew` as a bare `SavingCategoryId` silently skips the second rise animation | Two consecutive level-ups of the *same* structure set the same value; React sees no change | **Not a test break — a silent UX bug.** Fixed by `{ id, seq }` (§2.6a); AC-F13-10(b) is the regression test. |
| **B12** | The main street paints **one row tall** at the top of the town instead of running its full height | `gridRow: "1 / -1"` inside a grid that declares no `grid-template-rows` | **Not a test break — a silent visual bug.** Fixed by spanning from `gridRowCount()` (§3.4); §3.8's `[dom]` AC is the regression, asserted at two town sizes (`"1 / span 6"`, `"1 / span 9"` — the numbers moved in rev. 6 because the head rows count) and against the literal `"1 / -1"`. |
| **B13** | **NEW (rev. 6).** `App.tsx:89-98`'s `buildingCount === 0` ternary would hide the entire 저축 블록 on a fresh install, because the block is now a row of the grid | On-street placement (D-32's answer) | **Real, and it is the one behavioural break the D-32 answer costs.** The grid renders unconditionally and the empty-state copy becomes a compact banner above it (§2.4, §3.5). MVP-SPEC F3's AC (:224) and S2's empty state (:328) need the one-clause amendment listed in §2.8a. `[qa]` AC-F13-13 is the check. |
| **B14** | **NEW (rev. 6).** `TownGridProps` gains four fields (`savingsByCategoryKrw`, `ladder`, `ladderOverrides`, `justGrew`) | The savings plots are grid items, so `TownGrid` must own them (§2.4) | **Real, but contained: `App.tsx` is the only call site**, and no test asserts the props type (there is no `TownGrid` test today — the new one is ours). The `ReactNode`-prop alternative is rejected in §2.4 on `React.memo` grounds. |
| **B15** | **NEW (rev. 6).** A wrapper element around the five savings plots would put all five in **one** grid cell | `SavingsRow` must return a fragment (§2.4a) | **Not a test break — a silent visual bug**, and the most likely one for a dev to introduce, since returning a wrapper is the reflex. AC-F13-18's direct-children count is the guard. |

**Net:** four real one-line edits (B2 test, B3, B4, B7), one two-branch edit (B8), one 3-line type fix (B5), one new pure module + one import (B10), one component-props widening plus one App.tsx restructure (B13, B14), and **five** silent-defect guards (B6, B9, B11, B12, B15). Zero rewritten test suites, zero data migrations.

**Verified unaffected** (checked, not assumed): `queueActions.test.ts`, `noSpendActions.test.ts`, `useTownStore.retention.test.tsx`, `balance.placeholder.test.ts` (`:28-29` asserts `savingsTowerSegments` is a non-empty array, not an exact key set), `devtools/fixtures.test.ts` (`:52-59` still passes with `dense`'s new total — §4.6; `:104`/`:125` compare `boot.core` against the fixture's own town object, so an added field appears on both sides), and every `storage.test.ts` recovery assertion except `:112` (they assert individual fields — `:194`, `:197`, `:200`, `:227`, `:231`, `:252`). **Re-checked specifically against on-street placement:** none of these files touches a grid coordinate, and the three that touch savings touch only the aggregate, which is placement-independent.

### 5.3 Behaviour already shipped (T002–T004)

**Unchanged:** slot economy, streak, tier, materials queue, 무지출 데이 claim/revoke, entry save, persistence keys, chunking, corrupt-chunk recovery, the balance banner, Gate 1, **and the plot-index mapping itself**.
**Changed visually only:** which grid cell an existing building paints into (now also shifted down by the two head rows), and that the grid renders at 0 buildings.
**Not changed at all:** `nextPlotIndex` allocation, `Building.plotIndex` semantics, `plotFromIndex`, `TOWN_COLUMNS`, existing `TownState` field meanings.

### 5.4 Persisted data

- **No schema migration and no `schemaVersion` bump required.** Fields are added, never repurposed; the new `TownState` field is optional and the new index field is optional.
- A town saved before this change **keeps every stored byte** and simply renders on the block plan. Buildings keep identity, order, category, and index — and now also keep their stored position, because their stored position was never their screen position. The one-time `relayout` notice (§3.6) explains the visual move.
- Old fixture states containing `invest` savings entries keep working via §4.5's alias.
- Decoration is never persisted and never will be (R-2), so no future art change can create a data question — and that now covers the 안내판 tile too.

### 5.5 What still needs a human eye

`plotFromIndex` staying byte-identical is a claim a machine can check — but the road task DOES append `ladderFor` to `selectors.ts` (PM correction, above), so an empty-file-diff rule is no longer literally true. **The real invariant, restated precisely: neither task's Gate-1 evidence may show a diff touching `plotFromIndex`, `TOWN_COLUMNS`, or `nextPlotIndex`'s allocation logic in `selectors.ts` or `entryActions.ts`.** Appends elsewhere in the same files (`ladderFor` by the road task; `savingsByCategory`/`grownStructures` by the 저축 블록 task) are expected and do not violate it. Evidence: a diff of just those three symbols (`git diff -G'plotFromIndex|TOWN_COLUMNS|nextPlotIndex' -- src/selectors.ts src/entryActions.ts`) is empty for both tasks.

### 5.6 The thing I am *not* proposing

An isometric/canvas village (true diagonal streets, depth-sorted sprites, pan-and-zoom) would read closer to Fortune City still. It is on the WON'T list and **I am leaving it there.** For the record: it would mean a rendering engine, a camera, hit-testing, sprite depth sorting, its own perf budget on the mid-range Android WebView floor, and an isometric art order (every asset redrawn at a fixed angle) — on the order of the entire remaining MVP build, and it would put the art order squarely into D-12's imitation-risk territory. The CSS-grid block plan above gets a village that reads as a village at roughly the cost of one new file and one stylesheet.

---

## 6. Build order placement

| Step | Fits into | Note |
|---|---|---|
| **Component test harness** | **Prerequisite of the two steps below** | The repo has no component test (§2.9). One shared 20-line mount helper (`createRoot` + `act`, copied from `useTownStore.test.tsx:17-18`) plus the first `src/components/*.test.tsx`. **No new dependency.** Cost: ~half a day. Without it, every `[dom]` AC in §2.9 and §3.8 is unverifiable. **This is also the task that first loads `@toss/tds-colors` under Vitest** (§2.3) — if that package needs a `test.server.deps.inline` entry, it is discovered here, at the cheapest possible point. |
| Road layout (§3) | **New standalone task**, immediately after T004 | `townLayout.ts` (new), `townLayout.test.ts` (new), `TownGrid.tsx`, `TownGrid.test.tsx` (new), `EmptyLot.tsx`, `App.css`, plus `storage.ts` + 1 line of `storage.test.ts` for `LAYOUT_VERSION` + 1 branch of `App.tsx` for B8's `relayout`. **PM correction (post rev. 6 review, resolving a real compile-order gap): also carries `savingsBuckets.ts` (new, §4.5, needed for `SAVING_CATEGORY_IDS`) and the `ladderFor` append to `selectors.ts`** — `townLayout.ts` imports both, so they must exist first. `savingsBucketOf`/the entry-sheet wiring stay unused until the next task. **No existing selector/geometry logic is edited** (see §5.5's rescoped evidence rule). Independently demoable — the director sees a village the same day. **No longer blocked on any decision:** D-30 and D-31 are answered, so there is one mapping and one placement model to build. |
| 저축 블록 (§2) | **Build order step 4, together with F13** — not yet started | Near-zero rework: F13 gets built as five street buildings instead of as a tower, first time. Carries the two remaining `selectors.ts` appends (`savingsByCategory`, `grownStructures`), B2, B3, B5, B7, B8's `savings` branch, B10, B11, **B13, B14, B15**, and the `devtools/fixtures.ts` changes (§4.6). `savingsBuckets.ts` already exists from the road task — this task wires `savingsBucketOf` into `entryActions.ts`'s 저축 branch. |
| **Ordering note (updated in this pass)** | — | The savings block's **cells** (`SAVINGS_COLUMN_RANK`, `TOWN_HEAD_ROWS`, `savingsCellFor`) ship with the **road** task, because `cellFromIndex`'s row formula depends on `TOWN_HEAD_ROWS` and shipping it later would move every building a second time (a second `LAYOUT_VERSION` bump and a second "your town moved" toast). For the same reason, `savingsBuckets.ts` and `ladderFor` (needed to size the savings row's height) ship with the road task too — see the corrected file rows above. The road task renders the savings **cells as empty lots plus the 안내판**, and the 저축 블록 task fills them with structures and wires entry logging into them. One relayout, not two. |
| Art order delta (D-22) | Parallel, `ui-ux` | Placeholder components ship first; dev is never blocked on art (MVP-SPEC §6.1 rule, unchanged). The footprint changed to one plot column wide (§2.3) — the order must be placed against that, not against a band cell. |

Cut order if time runs out, appended to MVP-SPEC §12's list: sticky collapsed strip → 아치 → per-structure `idleAnim` → ground variants → the 안내판 tile. **Neither the road layout nor the five structures are on the cut list** — they are the director's request.

---

## 7. Open decisions — director's call, not mine

> **Three of rev. 5's entries are gone, and they are gone for three different reasons — the distinction matters and is recorded rather than blurred:**
> - **D-32 (savings on plots vs a band) — answered by the DIRECTOR**, 2026-08-03: 일반 건물처럼 도로변에 실제로 배치. §2 is rebuilt around that answer; there is no band branch left in this document.
> - **D-30 (screen adjacency vs a street-front fill order) — answered as an ENGINEERING DEFAULT by me**, in favour of preserving MVP-SPEC F2's AC on screen (§3.9). It is mine to take because both branches were equally implementable and the difference is a fill order the director never asked for by name, while the AC is a sentence he was handed. If he prefers the street-front fill, it is one array and a `LAYOUT_VERSION` bump — but it is no longer a question this document asks him.
> - **D-31 (automatic vs player-chosen placement) — answered as an ENGINEERING DEFAULT by me**, in favour of automatic (§3.1). It is mine to take because player-chosen placement is not a variant of this design, it is a different feature with its own spec, and because MVP-SPEC's own ≤3-tap/≤8-second entry budget (F1, P-b) argues against adding a placement step to every logged coffee. If the director wants it, it is a new task, not an option here.
>
> Nothing below is a gameplay constant, and no `[TBD]` value is filled in anywhere in this document.

| # | Decision | Why it isn't mine |
|---|---|---|
| **D-27** (**required**) | **Invariant 3 amendment — sign-off requested.** MVP-SPEC §7 invariant 3 reads "**Amount drives exactly one visual, the 저축탑, and only via 저축.**" This addendum makes amount drive **five** visuals. §7's own header requires director sign-off for that. **Proposed replacement:** *"Amount drives visuals only in the 저축 블록, and only via 저축 entries. No 지출 or 수입 amount, at any magnitude, changes the size, height, count or appearance of anything in the town."* **§2.8a lists all five places MVP-SPEC restates the old wording** (:54, :95, :370, :381, and the reasoning at :693) — rev. 5 named two of them. §2.8 shows the arithmetic and states plainly that F13's "**the single tallest thing in town**" claim must be **struck, not re-worded**: at the placeholder ladder a structure tops out at 1.78 building tiles and 0.16% of a dense town's painted area, and the single tower was no better. What survives, and is strengthened, is **exclusivity**: spending amount still moves nothing, at any size. | It is an invariant, and the claim being retired is one the spec argues its whole anti-perverse-incentive case on. |
| **D-18** | **Invariant 1 amendment.** MVP-SPEC §7 invariant 1 lists the only three sources of a building. Savings structures are a **fourth kind of structure** — sourced only from real 저축 ledger entries, living outside `buildings[]`, and now standing on village lots, which makes the wording matter more than it did under the band: a reader looking at the town sees five buildings that no ledger *expense* produced. §2.1's guarantee is what keeps invariant 1's spirit (nothing is obtainable except by real money behaviour) intact. | It is an invariant. |
| **D-16** (unchanged, still open) | **Confirm 저축 escapes the daily cap.** This entire addendum is built on that yes; AC-F13-3 is the test that proves it. If the answer is no, §2 must be redesigned from scratch. | The load-bearing principle. |
| **D-17** | **The 저축 sub-category list.** §2.2 proposes exactly five. **On-street placement gives this a geometric consequence the band did not have:** the entrance block seats `TOWN_COLUMNS = 6` structures per savings row, so a **6th** sub-type takes the 안내판's lot (free, one cell), and a **7th** adds a second savings row (`SAVINGS_ROWS` and `TOWN_HEAD_ROWS` follow automatically — §3.3 — but every building moves down one more row, i.e. a `LAYOUT_VERSION` bump). Cutting to fewer than five leaves free lots, which is harmless. Each added sub-type is still one more art family (D-22). | Content taste, and it now sizes both the art order and the town's head. |
| **D-13** (unchanged, still open) | The KRW→level curve and how many levels. Still the flagged placeholder; nothing here fills it in. §2.5 guarantees the block survives any length it takes — **including the pip row, which rev. 6 made wrap rather than overflow.** | Balance constant, and a tone call about what counts as "a lot saved". |
| **D-13a** | **One shared ladder, or a ladder per sub-type?** 예적금 and 주식 투자 have very different natural monthly magnitudes; a shared curve makes one structure grow much faster than the other. Ships as "shared" until decided. Note §2.5's shared-longest box rule: a per-type ladder that is *longer* than the default makes the whole entrance row taller, which is the intended behaviour and is asserted (AC-F13-7). | Balance constant + a fairness-between-structures judgement. |
| **D-28** (still open, and sharper now) | **Do the five lots render on a fresh install (0 buildings, 0 저축)?** Proposed: **yes** — five level-0 fenced lots with signboards, on the best block in the village. Under the band this was five markers on a strip; on the street it is **the first thing the player sees**, above a block of empty village lots. Alternative: hide level-0 structures until the first 저축 entry, which now leaves five visible holes in the village entrance and is worse than the band's version of the same alternative. | Whether five "you haven't done this" lots on day one read as invitation or as nagging is the director's read of his user, not mine. |
| **D-29** (still open) | **If exclusivity is not enough, what carries a size-based counterweight?** §2.8 concludes no bounded-height structure can out-scale an unbounded town grid. Every remedy (block height scaling with savings-vs-town-size, a savings-gated town-wide visual state, a savings-driven tier ladder) is a **new mechanic with new constants**, and I am not inventing one. | A new mechanic and its numbers. |
| **D-19** | **마을 어귀 아치** — light up when all five savings types are at level ≥ 1. On-street placement gives it an exact home: the 안내판's lot (§2.4a), so it costs no new geometry. But it nudges the user toward diversified saving, which is product advice about their money, not decoration. | Do we want the app to have an opinion about how someone saves? |
| **D-20** | **Road pattern taste.** Proposed: one central vertical main street + cross streets bounding blocks of `BLOCK_ROWS = 2`, plus the head block for 저축. **`BLOCK_ROWS = 2` is not taste — it is the deepest block for which the frontage invariant holds with one vertical street (§3.2).** Alternatives: (a) as proposed; (b) two vertical streets, `BLOCK_ROWS = 3`, 5 plots per row; (c) frontage relaxed to "within 2 cells". **Needs to be seen, not read** — `ui-ux` should render the candidates as PNGs, **now including the entrance block**, since it is the first thing on screen. ⚠️ Options (b)/(c) move the street off the grid's horizontal centre, which invalidates §3.5's crosswalk `left: calc(50% − …)` **and would break the 예적금/주식 street-front pairing in §3.3**; no automated AC catches either. | Pure visual taste, inside a constraint the test enforces. |
| **D-21** | **Grid width 7 vs 6.** Proposed 7 keeps `TOWN_COLUMNS = 6` plot columns (unchanged growth pace, unchanged storage) at 50px tiles. **New consideration from on-street placement:** a 6-wide grid (5 plot columns) would seat the five savings structures **exactly**, with no free lot — which loses the 안내판 (and D-19's home) but removes the odd empty cell. It would also change `TOWN_COLUMNS` and re-open §5.1's whole break table. Recommendation: still 7. | Pacing-adjacent layout feel. |
| **D-22** | **Art order growth.** §6.1 item 4 goes 3 assets → **15** (5 families × base/segment/cap) + 5 signboards + **1 안내판**; plus a road tileset (~6 pieces incl. intersection and crosswalk) + 3 ground variants + street furniture. Roughly **+26 assets** on a ~40-asset order. **The footprint spec changed in rev. 6**: each savings family is drawn to a *one-plot-column* column (50px wide × up to 128px tall), not a band cell — same count, different canvas. Approve the cost, or cut structure count (D-17) to shrink it. | Budget. |
| **D-23** | **Does the block stay on screen?** Now that it is a village block rather than a HUD strip, the default answer flips: it **scrolls away like any other block**, and the sticky 44px silhouette strip becomes an optional extra rather than the way to avoid a permanent status bar. Proposed: ship without the strip, add it if the director misses it. | How present should savings be while the player looks at the rest of town? |
| **D-24** | **Legacy `invest`:** alias it to 주식 투자 (proposed, safest) or drop it into 기타 저축. Either way the id stays readable (§4.4). | Trivial, but it is data the director may have on screen. |
| **D-25** | **Do 기념비 (F16) get corner plots at intersections** instead of ordinary plots? **Rev. 5 flagged this as colliding with D-32 over reserved-plot machinery; that collision is gone.** The savings block demonstrates the pattern a monument row would reuse — fixed cells outside the image of `cellFromIndex`, no reserved indices — so if the director wants it, it is now a known-shape change rather than an unknown one. Still not specified here. | Scope + taste; flagged rather than assumed. |
| **D-26** | **The `relayout` notice copy — and whether to show it at all.** Proposed: one toast, once, "마을에 도로가 새로 놓였어요. 건물 위치가 조금 바뀌었어요." The move is now larger than in rev. 5 (roads *and* two head rows), which argues for saying it. Alternative: bump `LAYOUT_VERSION` silently. | It is a message to the player about their town, so it is the director's voice, not mine. |

**Assumptions I did make** (cheap to overturn, all content/layout, none of them balance): the five structure identities and their visual metaphors; every literal in `SAVINGS_STRUCTURE` (§2.3) including the `CapShape`/`IdleAnim`/`RiseAnim` member names; **`SAVING_CATEGORY_IDS` as a prominence rank and `SAVINGS_COLUMN_RANK = [2,4,1,5,0,6]`, i.e. that 예적금 and 주식 투자 get the two street-front lots** (§2.2 — one array to overturn); the 안내판 tile in the block's free lot (decoration, R-2); empty savings lots visible from day one (D-28); `roadSideOf` facing; three ground variants; **every class name in §2.4a's DOM contract** (naming, not behaviour); and the pixel values `SEG_*_PX`, `LABEL_ROW_PX`, `PIP_SIZE_PX`, `PIP_GAP_PX`, **`PIP_ROW_GAP_PX` (the one genuinely new number in rev. 6)**, `DISTRICT_ROW_GAP_PX`, `MIN_VIEWPORT_PX = 320`, `ROAD_WIDTH_PX`, `ROAD_HEIGHT_PX`, `GRID_GAP_PX` — layout px, not pacing. `TILE_HEIGHT_PX = 72` and `GRID_PADDING_X_PX = 16` are not assumptions: they are App.css:136-137's current values moved into TS (§3.5), and `PIP_SIZE_PX`/`PIP_GAP_PX` are likewise rev. 5's stylesheet literals moved into TS because the wrap arithmetic now reads them.

**Engineering choices I did make** (mine to make, recorded so a reviewer can overturn them cheaply): serpentine screen order (D-30, §3.9) and automatic placement (D-31, §3.1); the shared-longest reserved box rather than a per-structure box (§2.5); pips wrap rather than shrink (§2.5); both ladders arrive as props rather than being read from `BALANCE` inside the component, and the four savings props go on `TownGrid` rather than a `ReactNode` prop (§2.4, on `React.memo` grounds); `useTownStore` owns the level-up toast through the existing Notice FIFO (§2.6a); `justGrew` carries a `seq` (§2.6a); `savingsBucketOf` lives in its own types-only module (§4.5); `App.tsx`'s toast ternary becomes an explicit chain (§2.6a); the savings cells ship with the **road** task so the town relayouts once rather than twice (§6).

**Not assumed, on purpose:** every value in `BALANCE` — including the ladder length that sizes the entrance block (D-13) and the first threshold AC-F13-3's QA script reads. §2.5 is written so the block adapts to whatever the director picks, and §2.8's conclusion is stated as a formula so it does not depend on the placeholder.

---

## Trade-offs the author admits

1. **Build cost.** This is the expensive option by design. Five distinct savings buildings (each with its own placeholder variant, rise animation and signboard) plus a real street plan is materially more work than the minimum patch, which would be: keep one tower, recolour it per sub-type, and paint a road stripe as a background image. I chose the expensive path because the director's requests are about how the app *feels*, and the minimum patch satisfies the words without satisfying the ask.

2. **On-street placement bought fidelity and spent three breaks.** B13 (the empty-state ternary), B14 (`TownGridProps`) and B15 (the fragment trap) exist only because the savings buildings are grid items. None of them touches data, and §2.1's guarantee survives — but rev. 5's band genuinely was the cheaper build, and it is honest to say so rather than to pretend the director's answer was free. What it was *not* is the expensive version D-32 feared: no reserved indices, no allocator changes, no deletion special case.

3. **A new test cost rev. 2 hid.** The repo has never mounted a component in a test. §6 buys the harness explicitly (~half a day, no new dependency) and §2.9/§3.8 reassign every AC that even a harness cannot deliver. The honest total is: more automated coverage than rev. 2 claimed *and* more `qa` time than rev. 2 admitted.

4. **Art order grows ~65%** (roughly +26 assets), and the savings families must be redrawn to a one-plot-column footprint rather than a band cell. `ui-ux` cannot generate real illustration in this engine, so the gap between the placeholder build and the finished look widens with every asset added.

5. **Two mappings instead of one.** A reader has to know that plot space (`plotFromIndex`) and grid-cell space (`cellFromIndex`) are different things, and that only the first is stored. That is one more concept — and rev. 6 adds a third space that is neither (the savings cells, which have no index at all). I think they are the *right* extra concepts, because together they are what makes the F13 invariant provable, but they are a real comprehension cost.

6. **Buildings move further than they did in rev. 5.** Every existing building shifts down two grid rows (the savings row and its cross street) on top of the road-induced shift. Nothing is lost and nothing is migrated, but a screenshot taken before the change will not match one after, and the `relayout` notice is the whole answer (D-26).

7. **The town's head costs ~204px of first-screen real estate, permanently.** The 저축 블록 is above every ordinary building, forever, which is exactly what makes it prominent and exactly what makes the first ordinary building further away. §2.4's fresh-install arithmetic shows both still fit above the fold on the reference viewport; on a 320px-wide, short device that will be tighter, and AC-F13-13/-14 are `[qa]`'s job for that reason.

8. **`BLOCK_ROWS = 2` is a tighter town.** Roughly 15% more vertical scroll than a roadless grid, plus the head. That is the price of the frontage invariant being true rather than approximately true; D-20 (b) buys the looser block back at the cost of a plot column.

9. **Plot tiles shrink 53px → 50px** on the reference viewport, and the savings lots are the same 50px — which is what makes §2.8's comparison honest, and also what forced rev. 6's pip wrap. Accepted in exchange for a street.

10. **The street-front-first fill order is gone** (§3.9). Ordinary buildings now fill from the left edge inward, so the plots flanking the main street are earned 3rd and 4th rather than 1st and 2nd. I traded it for keeping an MVP-SPEC AC true on screen, and I think the trade is right *because* the savings block already puts named buildings on the street front — but a director who liked the fill order is entitled to want both, and cannot have them with one vertical street.

11. **Five always-visible savings lots put five empty lots in front of the user on day one**, on the best block in the village, above a full block of empty plot lots. I argue this is the motivational engine; the opposite read is that a fresh install now looks like a village that has not been built yet. D-28 is that call, and it is a sharper call than it was under the band.

12. **The counterweight got weaker as a *claim* and stayed the same as a *rule*.** §2.8 retires a sentence the spec has leaned on since draft 2, and the on-street numbers make it *worse* (0.16% of a dense town, down from the band's 0.21%, because the lots are narrower). I would rather hand the director that arithmetic than let the doc keep asserting something a ruler disproves. If exclusivity is not enough, D-29 is where a real mechanism gets designed, with his numbers.

13. **The 아치 (D-19) is product advice.** Rewarding diversified saving is an opinion about the user's finances the app does not otherwise hold. I surfaced it rather than shipping it, but I did propose it, and rev. 6 even built it a lot.

14. **No same-evening return hook is added.** MVP-SPEC trade-off 2's gap is untouched — a savings block on the street and a prettier village do not bring anyone back at 9pm on a day they already logged.

15. **A rule that only lived in prose got violated by the document that wrote it, twice.** R-3 says the stylesheet may not hold a number the TS arithmetic uses; rev. 3 left `var(--town-grid-pad-x, 16px)` next to `GRID_PADDING_X_PX = 16`, and rev. 5 left the pip's `5px`/`3px` in App.css and then wrote no arithmetic that needed them — until rev. 6 needed them. The general lesson, which applies to R-1 and R-2 too: **a rule about two files is only real if some test opens both**, and §3.8's `App.css` text guard is that test.

16. **Three of this document's own defects were CSS-shaped, and CSS is where its ACs are thinnest.** The street's positioning context (B9), its row span (B12), and the fragment trap (B15) are all things a stylesheet reviewer would catch in a browser in ten seconds and a Vitest suite cannot catch at all (`css: false`, no layout engine — §2.9). The answers are the same three moves each time: put the number in `townLayout.ts` where a unit test can read it, give `App.css` a text guard that fails on the copy, and assert node *counts* where geometry is unreachable.

17. **`justGrew` gained a field for a bug nobody had hit yet.** `{ id, seq }` is one more concept than `justBuiltId`'s bare string, and it exists solely so that saving into the same structure twice re-plays the animation. It is the kind of detail that looks like over-engineering until the second 예적금 deposit of the evening does nothing.

