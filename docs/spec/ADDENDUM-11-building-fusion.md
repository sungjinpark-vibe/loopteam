# ADDENDUM-11 — Building fusion (Lv.6 → Lv.10)

Origin: user request, 2026-08-12 — *"최고 티어에 같은 칸슨 건물 두 개 융합해서 Lv.6 건물 생성 (그렇게
Lv.10까지 성장 가능) 규칙 추가해서 기능 개발하고 리소스 추가해줘."*

Why: the Gate 3 expert panel found a hard progression ceiling — at the top tier the app says
"지금이 가장 높은 Tier예요" (`TierCelebration.tsx:52`) and nothing remains to do. Map expansion is
**not** the answer: the 20×20 map (ADDENDUM-08, commit `afc7cd6`) is a frozen user-approved
baseline. Fusion gives the endgame a sink that **consumes buildings instead of requiring land**.

Written after code recon. Every claim in §1 was verified against the source, not taken from a
report. Sections marked **PROPOSAL** are design choices awaiting approval, not descriptions.

---

## §0 — Decision record

| # | Decision | Status |
|---|---|---|
| D-11.1 | **"같은 칸슨" = 같은 **칸 수** AND 같은 **카테고리** — fusion requires BOTH the same footprint and the same category.** | **Confirmed by the user, 2026-08-12.** Rationale in §2.1; rule in §2.2 |
| D-11.2 | **Tier and header counting switches to `townScale` (§5.1).** Fusion becomes tier-neutral, and the top tier becomes reachable for the first time. | **Approved (HQ, 2026-08-12).** Touches no user-confirmed dial — see §5.1.3 |

`같은 칸슨` was a typo in the original request with two plausible readings — (a) 같은 **칸 수** =
same cell count / footprint, (b) 같은 **카테고리**. The user resolved it to **both**. §2.1 keeps the
reasoning, which is now the rationale for a settled rule rather than an argument for a proposal.

Nothing in this spec remains gated on that question.

---

## §1 — Verified current state

| Fact | Evidence |
|---|---|
| Visible level is `1 + floor(exp/expPerLevel)`, capped at `maxLevel` | `selectors.ts:78-80` |
| `expPerLevel: 3`, `maxLevel: 5` — **re-confirmed by the user 2026-08-12, not to be changed** | `balance.approved.ts:41-42`, commit `bed6cca` |
| A single entry ≥150,000원 is worth 12 EXP | `balance.approved.ts:64-70` |
| Founding stores the full gain (`exp: gain` when `gain > 1`) | `entryActions.ts:245` |
| ⇒ **one ≥150,000원 entry founds a Lv.5 building outright** | 1 + floor(12/3) = 5 |
| `tier()` is fed the **literal building count**, NOT `growthScore` | `selectors.ts:128`, `TownScreen.tsx:265`, `entryActions.ts:212,247` |
| That revert was a Gate-3-rerun fix: the tier gate and the header must be **the same number** | `entryActions.ts:112-124` |
| `tierThresholds = [0, 10, 30, 80, 200]`, untouched by ADDENDUM-08 | `balance.approved.ts:28` |
| The map has exactly **193 buildable (ground) cells** | `townLayout.test.ts:341` ("1x1 has exactly 193 valid anchors") |
| Grow-pick mode: enter, highlight candidates, tap to commit, 취소 / back to cancel | `useGrowPickMode.ts:36-63` |
| Grow candidates = live, `source.kind === "entry"`, same `categoryId` — monuments and nospend park tiles excluded by construction | `selectors.ts:120-125` |
| Pick mode and move mode are mutually exclusive; long-press is disabled while picking | `TownScreen.tsx:343` |
| The banner (`.town-move-bar`) is a **sibling** of `.town-grid`, one banner at a time | `TownScreen.tsx:350-382` |
| A plain tap on any building opens `BuildingDetailSheet` | `TownScreen.tsx:223-225`, `BuildingDetailSheet.tsx:33` |
| One DOM element per building spans its whole footprint, `data-plot-index` = **anchor** | `TownGrid.tsx:592-599` |
| ⇒ tapping any cell of a 2×2 candidate reports the anchor index — `useGrowPickMode.ts:54`'s `b.plotIndex === plotIndex` lookup is correct for multi-cell buildings | derived from the two above |
| `MAX_VISUAL_LEVEL = 5`; floors = `min(level,5) - 1` (so 4 floors at Lv.5) | `buildingArt.tsx:192,194-196` |
| Wall-height growth per floor **saturates**: `max(0.6, 1 - 0.07*floors)` hits its floor at 6 floors | `buildingArt.tsx:244,346` |
| Art fills 94% of its tile-shaped box in **both** axes; the 6% is deliberate overhang room for decor | `buildingArt.tsx:232-235,258-262` |
| `ART_UNIT` is constant so decor keeps identical on-screen px across footprints | `buildingArt.tsx:231` |
| Windows: 1 pane in 3 unlit, deterministic from `variantIndex` | `buildingArt.tsx:265-268,417` |
| **No image assets exist in this project** — all art is procedural SVG | `buildingArt.tsx` whole file; ADDENDUM-08 §6 |
| `occupiedCells` recomputes from the array on every call — no incremental bookkeeping | `placement.ts:33-40` |
| Reconcile keeps a building that still `fits` where it stands, no write | `placement.ts:238-241` |
| Buildings with no seat are parked at `plotIndex: -1`, never dropped | `placement.ts:253-267` |
| Buildings persist in **per-month chunks**; deletion = `mutateBuildingsForMonth(... filter)` | `useTownStore.ts:770-772,975,1046` |
| Cosmetic SKUs are bound per building via `economy.appliedByBuildingId` | `useTownStore.ts:1213` |
| NPC count = `min(1 + buildingCount + purchasedNpcSlots, NPC_MAX_VISIBLE)` | `useTownStore.ts:1354` |
| Seed awards are idempotent per event key | `economy/awards.ts:17-21,55` |

### §1.1 Verified pre-existing defect found during recon (fusion makes it worse)

**The top tier is already mathematically unreachable in normal play.**
`tierThresholds[4] = 200` (`balance.approved.ts:28`), but `tier()` is fed `buildings.length`
(`selectors.ts:128`, `TownScreen.tsx:265`) and the map holds at most **193** buildings
(193 ground cells, `townLayout.test.ts:341`, one building minimum per cell). 193 < 200, so tier
index 4 can never be reached without seeding a save through devtools.

This is *adjacent to*, not identical to, the panel's ceiling finding, and it is **arithmetic, not
opinion**. ADDENDUM-08 §4.1 argued the top tier was safe on a capped map; that argument assumed
`tier()` was fed `growthScore` (count + Σexp, uncapped), and the Gate-3-rerun revert at
`entryActions.ts:112-124` removed the uncapped term and **invalidated §4.1 without updating it**.

Fusion, which *removes* a building per act, makes the count strictly worse. **§5.1 (approved,
D-11.2) fixes both with one selector**, and §5.1.2 records the full history of how §4.1 went stale
— read it before citing ADDENDUM-08 §4.1 on tier reachability.

---

## §2 — Fusion rule

### §2.1 Why both are required (rationale for D-11.1, settled)

Fusion requires the same footprint **and** the same category (D-11.1, user-confirmed 2026-08-12).
The reasoning, in order of force — recorded so the rule is not relaxed later by someone who reads
it as an arbitrary restriction:

1. **Same footprint is structurally forced.** Fusion must yield a building with a *defined*
   footprint. Allowed footprints are exactly `1×1 / 1×2 / 2×1 / 2×2` and nothing else
   (ADDENDUM-08 §2.1). If a 1×1 could fuse with a 2×2, the spec would have to invent the result's
   size — and the fact that the question has no natural answer is itself evidence the user meant
   same-size. With same-footprint, the result keeps that footprint and no invention is needed (§3).
2. **Same category is forced by the *same class of argument*, for the look instead of the size.**
   The archetype, palette, roof and sign are all selected from `categoryId`
   (`buildingArt.tsx:185-189`). Fusing a 카페 with a 정비소 has no defined archetype exactly as
   fusing a 1×1 with a 2×2 has no defined size. Category is therefore not merely thematic — it has
   the same structural teeth as footprint, which is why requiring both is one rule, not two.
3. **Same category is free to implement.** `growCandidates(buildings, categoryId)`
   (`selectors.ts:120-125`) is already exactly this filter, and it already excludes monuments and
   nospend park tiles — which §5.2 needs anyway. Reusing it is one call, not a new concept.

**Cost of requiring both, stated honestly:** matching pairs get rarer, and footprint is *rolled*,
not chosen (ADDENDUM-08 §2.2: 1×1 60% / 1×2 15% / 2×1 15% / 2×2 10%). For same-category pairs the
1×1 case dominates (0.6² = 36% of random same-category pairs match on footprint), so 1×1 fusions
will be the common path and 2×2 fusions a rare prize. That is acceptable for an endgame sink, and
it is the shape the user asked for.

**If playtest shows pairs are too rare, this is NOT an implementer's call to relax.** D-11.1 is
user-confirmed; changing it requires going back to the user. The relaxation to propose in that case
is dropping the *footprint* requirement only, with the result taking **the first-selected
(initiating) building's footprint** — §3 already handles that, because the survivor never moves.
The category requirement has no defined fallback for the art (point 2 above) and should not be
offered as one.

### §2.2 Conditions — settled (D-11.1); all must hold

| # | Condition | Basis |
|---|---|---|
| F1 | Both buildings at **Lv.5** = `BALANCE.maxLevel` — derive it, never duplicate the literal | `selectors.ts:78`, `balance.approved.ts:42` |
| F2 | Same `categoryId` | D-11.1, `selectors.ts:122` |
| F3 | Same footprint (`footprintOf(a)` deep-equals `footprintOf(b)`) | D-11.1, `placement.ts:20-22` |
| F4 | Both `source.kind === "entry"` — monuments and nospend park tiles are never inputs | §5.2, `selectors.ts:122` |
| F5 | Same **fuse tier** (§2.3) — a Lv.6 fuses only with a Lv.6 | §2.3 |
| F6 | Two *distinct* live buildings; neither is at the fuse cap | §2.3 |

### §2.3 The ladder Lv.6 → Lv.10 — geometric, and it survives the map arithmetic

**Rule (PROPOSAL, matching the user's literal "그렇게 Lv.10까지"): `Lv.n + Lv.n → Lv.n+1`, for
n = 5..9.** Two Lv.5 → one Lv.6; two Lv.6 → one Lv.7; and so on to Lv.10.

Cost in Lv.5-equivalents:

| Target | Lv.5 buildings consumed | Fusion acts |
|---|---|---|
| Lv.6 | 2 | 1 |
| Lv.7 | 4 | 3 |
| Lv.8 | 8 | 7 |
| Lv.9 | 16 | 15 |
| **Lv.10** | **32** | **31** |

**Sanity-check 1 — space (does the 20×20 map allow it?). Yes, with a wide margin.** The naive
reading ("you need 32 buildings standing at once") is wrong: fusion is a binary counter, so a
player only ever *holds* at most one partial building per rung. Peak concurrent footprint on the
fusion track is **5 buildings** (one held at each of Lv.6/7/8/9, plus the Lv.5 partner being
matched) — 5 to 20 cells out of 193. Even the maximally wasteful strategy of founding all 32 Lv.5
buildings before fusing anything needs 32 cells (all-1×1) to 128 cells (all-2×2), still inside 193.
**The ladder is throughput-bound, not space-bound**, which is exactly the property the feature was
chosen for.

**Sanity-check 2 — time (is it trivially easy?). No.** A Lv.5 building costs 12 EXP
(`selectors.ts:78`, `expPerLevel = 3`). Lv.10 therefore costs **32 × 12 = 384 EXP**, reachable as:
- 32 entries of ≥150,000원 (the top band, `balance.approved.ts:69`) ⇒ ≥4,800,000원 logged; or
- 128 entries in the 20,000–50,000원 band (3 EXP each); or
- a realistic mixed diary at ~4 entries/day averaging ~4 EXP ⇒ ~16 EXP/day ⇒ **~24 days to the
  first Lv.10.**

`dailyBuildSlots = 10` (`balance.approved.ts:26`) caps the fastest path at ≥4 days. A three-to-four
week arc for the town's first Lv.10 tower is the right size for an endgame sink and is not
reachable by accident.

**Conclusion: geometric works on this map — no cheaper variant is needed.** A cheaper rule (e.g.
Lv.5+Lv.5→Lv.6, Lv.6+Lv.5→Lv.7) would put Lv.10 at 6 Lv.5 buildings ≈ 72 EXP ≈ 4-5 days, which is
a weekend, not an endgame. Rejected on those numbers.

### §2.4 Storage of the fused level

`levelOf` caps at `maxLevel` (`selectors.ts:79`) and `maxLevel` is frozen, so EXP cannot express
Lv.6+. **PROPOSAL:** one new optional field on `Building`, same absent-means-zero discipline that
`exp` and `w`/`h` already set (`types.ts:84-96`) — no migration, old JSON stays valid:

```ts
  fuse?: 1 | 2 | 3 | 4 | 5;   // fuse tier; absent === 0. Lv = maxLevel + fuse.
```

Plus one read-discipline selector next to `levelOf`, so `?? 0` is never open-coded
(the rule `expOf` sets at `selectors.ts:72-75`):

```ts
export function fuseOf(b: Pick<Building, "fuse">): number       // b.fuse ?? 0
export function totalLevelOf(b, expPerLevel, maxLevel): number  // levelOf(...) + fuseOf(b)
```

**`levelOf` is not modified.** Every existing caller keeps its current meaning and its current
`maxLevel` cap; only the display/art path (§4) and the fusion condition read `totalLevelOf`.

---

## §3 — Cells: what happens to the vacated space

**PROPOSAL, and it is deliberately the smallest thing that works:**

- The **initiating** building (the one whose detail sheet started fusion) is the **survivor**. It
  keeps its `id`, `plotIndex`, `w`, `h`, `createdAt`, `categoryId`, `variantIndex`, `builtOn`,
  `source`, and `exp`. Only `fuse` is incremented.
- The **second-selected** building is deleted outright. Its cells become ordinary empty lots.
- **The fused building does NOT grow into the freed space.** The two buildings can be anywhere on
  the map, so the freed cells are usually not adjacent to the survivor — "grow into the freed
  space" is undefined in the general case. Growing the footprint would also require footprints
  outside the legal `1×1/1×2/2×1/2×2` set (ADDENDUM-08 §2.1). Lv.6-10 grandeur is carried entirely
  by art (§4), never by area.

**Interaction with `placement.ts` — verified, and the answer is that nothing there changes:**

- `occupiedCells` rebuilds its `Set` from the buildings array on every call
  (`placement.ts:33-40`), so removing the consumed building from the array frees its cells
  automatically. There is no occupancy cache to invalidate.
- The survivor's anchor and footprint are unchanged, so `reconcilePlacement` takes its
  keep-in-place branch on the next boot (`placement.ts:238-241`) — no re-seat, no write.
- Reconcile's sort key is `(createdAt, id, plotIndex)` (`placement.ts:220-226`); the survivor keeps
  its own `createdAt`, so global ordering is stable and deterministic across devices.
- The freed cells immediately become valid `anchorsFor` results (`placement.ts:63-67`) for the next
  build, with no extra call.
- **Free side effect worth keeping:** buildings parked at `plotIndex: -1` because the town was full
  (`placement.ts:253-267`) get seated on the next reconcile once fusion frees cells. Fusion is
  therefore also a relief valve for a full town. Assert this in a test.

**No new function is added to `placement.ts`.** Fusion is an array delete plus a field edit on the
survivor, performed by the store; `placement.ts` stays the pure geometry module it is today.

### §3.1 Two-chunk persistence and its atomicity rule

**The sharp edge.** Buildings live in per-month chunks keyed by their build month. The only writer
is `mutateBuildingsForMonth`, which is a plain **load-modify-save on one chunk with no transaction**
(`useTownStore.ts:193-200`, used at `:770-772,975,1046`). The two fusing buildings can belong to
**different** month chunks, so a cross-month fusion is **two independent writes** and an interruption
between them leaves a half-persisted fusion. Neither partial state self-heals:

| Interrupted after | Resulting state | Verdict |
|---|---|---|
| survivor write only | Lv.6 survivor **and** the consumed Lv.5 still standing | free level — duplication |
| delete write only | consumed building gone, survivor still Lv.5 | **silent loss of a player's building** |

Same-month fusions are a single write and are already atomic; only the cross-month case is at risk.

**PROPOSAL — one optional field makes the sequence self-healing, with no transaction support
needed.** Same absent-means-nothing discipline as `exp` / `w` / `h` / `moveHintSeen`
(`types.ts:84-96,158`), so old saves parse unchanged:

```ts
  fusePending?: string;   // id of the building this fusion is still to consume; absent normally
```

Ordered sequence:
1. **Write 1 (survivor's chunk):** increment `fuse` **and** set `fusePending = <consumed id>`.
2. **Write 2 (consumed building's chunk):** delete the consumed building.
3. **Write 3 (survivor's chunk):** clear `fusePending`. Skipped when both are the same chunk — that
   case does all of this in one write and never sets the field at all.

Boot repair, folded into the existing reconcile pass (`placement.ts:218`) so it costs no new pass:
if any building has `fusePending` set, delete that id if it still exists, then clear the field.
Idempotent, and re-entrant if boot itself is interrupted. Crash after write 1 ⇒ repaired on next
boot. Crash after write 2 ⇒ the stale field is simply cleared. **No ordering leaves a lost
building.**

This is the one place the spec deliberately spends a field rather than taking the shorter path:
the shorter path's failure mode is user data loss, which §5/§7 treat as non-negotiable.

Reuse `mutateBuildingsForMonth` for all three writes; do not invent a second writer.

---

## §4 — Art for Lv.6-10

### §4.0 — SUPERSEDED 2026-08-13 by user instruction (kept for the record)

> **⚠️ THIS PRINCIPLE WAS REVOKED BY THE USER ON 2026-08-13.** He instructed, directly:
> **"레벨이 오를수록 건물이 높아져야 한다"** and **"무슨 건물인지 알 수 있게 지붕에 간판을 달아라"**.
> Height is now the PRIMARY level signal and buildings DO grow — upward, past the top of their tile.
> The material/crown channels below survive as the SECONDARY signal and are still accurate.
>
> This is the author of the constraint changing his own mind, not a violation of it. The reasoning
> below is preserved because it correctly documents *why* the engine made "bigger" hard, and that
> analysis is exactly what the height implementation had to solve (bottom-anchored overflow above the
> tile, z-order so lower rows occlude upper rows, no clipping at the grid's top edge).
>
> **What survives unchanged:** the building's BASE FOOTPRINT still fills its tile and never spills
> sideways — the horizontal half of the `d8ce379` property is still an invariant. Only the vertical
> ceiling is lifted. See `app_in_toss/CLAUDE.md` for the standing record.

**Every Lv.6-10 proposal below is subordinate to this one rule:** a higher level reads as **more
refined, never physically bigger.** A Lv.10 must not outgrow its cell, and it must not shrink its
own silhouette to make room for ornament either. The `d8ce379` cell-fill property — the drawn
geometry filling ~94% of the tile in **both** axes (`buildingArt.tsx:232-235,258-262`) — holds
**identically at every level, fused and unfused.** Fill is an invariant here, not a budget to spend.

**This is a constraint the engine already enforces, not an aesthetic preference.** Three verified
facts make "bigger" impossible rather than merely undesirable:

1. The art box is already full at Lv.5 — there is no unused room to grow into
   (`buildingArt.tsx:235`, `FILL = 0.94`).
2. Wall-height growth per floor **saturates**: `max(0.6, 1 - 0.07*floors)` (`buildingArt.tsx:244,346`)
   reaches its floor at 6 floors. Simply raising `MAX_VISUAL_LEVEL` would add five rungs that render
   *identically* to Lv.5 — motion with no visible result.
3. `d8ce379` is a frozen user-approved baseline (CLAUDE.md:9), and the user accepted its look
   knowing that filling the cell changes a building's proportions. Re-proportioning buildings to fit
   ornament would walk that approval back.

There are **no image assets in this project and none may be proposed** (ADDENDUM-08 §6). Lv.1-5 must
render byte-identically after this work.

### §4.1 Channels

**PROPOSAL — keep `MAX_VISUAL_LEVEL = 5` and add `fuseTier` (0-5) as a separate visual channel.
Every channel below is a *material* or *lighting* change, never a size change** — that is what makes
each of them obey §4.0 by construction:

| Channel | Mechanism | Why it is safe |
|---|---|---|
| Roof material step | Per fuse tier, the roof/trim palette steps toward metallic/jewel tones | Colour only — zero geometry change, cannot affect fill |
| Crown / spire ornament | Drawn into the existing **6% overhang margin** (`artBox.left/top`, `buildingArt.tsx:261`) — the margin that already carries decor drawing past the wall faces (doorstep, chimney, canopy) | Uses space the baseline already budgets, and the `<svg>` root clips to its viewBox so it cannot overflow the cell. **§4.0 guard:** the building's own silhouette is not reduced to make room, and measured fill must stay inside 94%±0.5pp — an ornament that moves the number is rejected, not tuned around |
| Windows fully lit | Relax the "1 pane in 3 unlit" rule (`buildingArt.tsx:265-268`) as fuse tier rises — a Lv.10 tower is lit end to end at night | Recolours existing quads; no new geometry |
| Plinth / ground glow | A ring on the existing ground diamond | Inside the drawn silhouette |
| Fuse pips or numeral badge | Small deterministic marker, absolute px like the existing signboard | `ART_UNIT` (`buildingArt.tsx:231`) keeps it identical across footprints |

Fuse tier 0 must render **byte-identically** to today. That is the whole compatibility story: an
unfused building never enters any of the branches above.

**Regression defense (required, not optional):**
1. Extend `PlaceholderBuilding.test.tsx`'s fill-rate test from *4 footprints × 2 roof shapes* to
   *4 footprints × 6 fuse tiers*, threshold unchanged at ≥90%.
2. Re-run `scripts/evidence-art-fill.mjs`; any ornament moving fill outside **94%±0.5pp** of the
   frozen baseline is rejected, not tuned around.
3. A snapshot test asserting the Lv.1-5 (fuse 0) SVG output is unchanged before/after this work.

---

## §5 — Balance and economy touchpoints

`balance.approved.ts` is a user-confirmed table. **`expAmountTiers`, `expPerLevel`, and `maxLevel`
are not touched** (user re-confirmed 2026-08-12, commit `bed6cca`). New dials are proposed as new
named constants only.

### §5.1 Tier counting — APPROVED (D-11.2, HQ 2026-08-12)

#### §5.1.1 The pre-existing defect, in plain terms

**The top tier is unreachable by normal play today, and this spec fixes it.** Stated without
reference to fusion, because fusion did not cause it:

- `tier()` is fed the **raw building count** (`selectors.ts:128`, `TownScreen.tsx:265`,
  `entryActions.ts:212,247`).
- The top threshold is **200** (`tierThresholds = [0, 10, 30, 80, 200]`, `balance.approved.ts:28`).
- The map has exactly **193 buildable cells** (`townLayout.test.ts:341`), and a building occupies at
  least one cell, so `buildings.length` **can never exceed 193**.
- 193 < 200 ⇒ tier index 4 is unreachable outside a devtools-seeded save. This is arithmetic, not
  judgement.

This is a real bug being fixed here — **not** a side effect of fusion, and not something fusion
introduced. Fusion only makes it worse: it removes a building per act, so reaching Lv.10 costs
**31 fusions = −31 buildings**, pushing the count further from a threshold it already could not
reach, while the header's "건물 N채" visibly falls. `highestTierSeen` (`types.ts:143`) suppresses
re-celebration but does not stop the displayed tier from regressing.

#### §5.1.2 How ADDENDUM-08 §4.1's assumption came to be invalidated

A future reader will find ADDENDUM-08 §4.1 asserting the top tier *is* reachable and §5.1.1 above
asserting it is not. Both were correct when written. The history, so nobody has to guess:

1. **ADDENDUM-04 §3** introduced `growthScore(buildings) = buildings.length + Σ exp` and switched
   every tier call site to feed `tier()` that instead of `buildings.length`
   (`selectors.ts:82-95` still documents this).
2. **ADDENDUM-08 §4.1** then capped the map at 193 cells and checked the interaction explicitly. Its
   reachability argument depended entirely on the **`Σ exp` term being uncapped**: the count term
   alone could no longer reach 200, but growing buildings raised `growthScore` at no cell cost, so
   all five tiers stayed reachable. It concluded "do not change `tierThresholds`" — correct, given
   its premise.
3. **The Gate-3-rerun revert (2026-08-12)** changed the premise. Every one of the five panelists
   confirmed the same defect: `growthScore` ran **ahead of** the header's literal "건물 N채", so a
   tier fired at growthScore 10 while the header read 6 buildings, and the celebration banner's own
   "N채 더" math — computed from the literal count — reconciled with neither. The fix reverted
   `tier()`'s input to the literal building count so one number drives both the gate and the display
   (`entryActions.ts:112-124`).
4. **That revert was right, and it silently removed the uncapped term §4.1's argument rested on.**
   ADDENDUM-08 §4.1 was not revisited. The contradiction is the residue: §4.1 is now stale, and
   §5.1.1 supersedes it. **Do not cite ADDENDUM-08 §4.1 as evidence that the top tier is reachable.**

The lesson worth carrying: the revert traded an uncapped progression term for display honesty, and
nobody re-checked what else depended on the term being uncapped.

#### §5.1.3 The fix — `townScale`, and it satisfies both constraints at once

```ts
/** Lv.5-equivalents: a fused building counts as the buildings it absorbed. */
export function townScale(buildings: readonly Building[]): number   // Σ 2 ** fuseOf(b)
```

Feed `townScale` to **both** `tier()` and the header count. That preserves the Gate-3-rerun
invariant exactly — the gate and the display remain **one number reached through one accessor**
(`entryActions.ts:112-124`), which is precisely why this must not be introduced as a second,
parallel number sitting beside the count.

Consequences, all intended:
- Fusion is exactly **tier-neutral**: two Lv.5s (scale 2) become one Lv.6 (scale 2). Never a
  regression, at any rung.
- **The top tier becomes reachable for the first time** — a single Lv.10 counts 32, so 200 is
  attainable without 200 cells. The mechanism that protects fusion from regressing the tier is the
  same one that fixes §5.1.1's ceiling, from the other side.
- It restores an uncapped progression term (fuse tier grows at no cell cost, exactly as `Σ exp` used
  to) **without** reintroducing the drift the revert removed, because the header shows the same
  number. Step 3's fix and step 2's premise both hold simultaneously.
- An unfused town is unaffected: every building has `fuse` absent ⇒ `2^0 = 1` ⇒ `townScale` equals
  `buildings.length` exactly. Existing saves see **no** tier change on first load. Assert this.

**No user-confirmed dial is touched.** `expAmountTiers`, `expPerLevel`, and `maxLevel` stay exactly
as re-confirmed on 2026-08-12 (`balance.approved.ts:41-42,64-70`, commit `bed6cca`), and
`tierThresholds` stays `[0, 10, 30, 80, 200]` (`balance.approved.ts:28`). This is a change to *what
is counted*, implemented as one new selector — not a change to the balance table, and not a
risk-limit or safety relaxation.

Header copy consequence to hand to ux/PM (not an implementer decision): a fused building reads as
the N buildings it absorbed, so "건물 N채" stays literally true of the town's scale rather than its
object count.

### §5.2 F16 monument — preserved for free

F16 is a director-approved must-keep feature (CLAUDE.md:7). Monuments carry
`source.kind === "monument"` and `categoryId: null` (`types.ts:73,78`). Condition **F4** excludes
them, and the existing `growCandidates` filter (`selectors.ts:122`) already implements that
exclusion — so reusing it means **a monument can never be a fusion input and never a fusion
output**, with no new code. The same filter excludes nospend park tiles. Assert both in tests.

### §5.3 Seed economy (PROPOSAL)

Add one award kind to the existing idempotent award system (`economy/awards.ts:17-21,55`) — do not
build a parallel reward path:

```ts
  | { kind: "fuse"; buildingId: string }      // idempotency key = the survivor's id + fuse tier
  seedAwards: { ..., fuse: 12 }               // NEW constant; nospend is 8, tier is 25
```

12 seeds sits between the two: a fusion is rarer and more deliberate than a no-spend day, less
momentous than a tier crossing. Tunable dial, not director-confirmed — same discipline as
`primeLot`/`primeLotMax` (`balance.approved.ts:89-91`). The idempotency key must include the fuse
tier, or a Lv.6 that later becomes a Lv.7 would be treated as an already-paid event.

### §5.4 Dangling references — the rule is REMAP TO THE SURVIVOR

A fusion consumes a building id that other records point at. **Every reference to the consumed
building is remapped to the survivor's id.** Not nulled, not tombstoned. The two references that
exist, both verified:

| Reference | Evidence | Rule |
|---|---|---|
| `LedgerEntry.buildingId` — the founding/growing entry of the consumed building | `types.ts:64` | **Remap to the survivor's id**, written into the entry's own month chunk as part of the fusion |
| `economy.appliedByBuildingId` — a cosmetic SKU applied to the consumed building | `useTownStore.ts:1213` | **Transfer to the survivor** when the survivor has no SKU applied; otherwise drop the *binding* only. Ownership lives separately in `economy.ownedSkus` (`useTownStore.ts:1184-1189`), so a dropped binding never destroys a purchase and the SKU can simply be re-applied — the precedent `useTownStore.ts:1161` already sets ("deleting a building never revokes a purchase") |

**Why remap and not null.** `buildingId: null` is already a loaded value — it means *queued,
over-cap, or a 저축 entry* (`types.ts:64`). Nulling a founded entry would make a real building's
founding entry indistinguishable from one that never built, corrupting 기록 rather than merely
loosening a link. Remapping is also the honest model: the consumed building was **absorbed**, not
destroyed — its EXP is standing in the fused tower — so pointing its entry at the survivor is
truthful, not a repair hack.

**A tombstone was considered and rejected**: it is a new concept (a third `buildingId` state,
readable by every 기록 consumer) bought for a case remapping already answers.

**No entry is ever deleted or orphaned by a fusion**, and F16 monuments are untouched because they
can never be a fusion input (§5.2, condition F4). Both are acceptance criteria (§7.10, §7.11).

### §5.5 Other verified touchpoints

| Touchpoint | Evidence | Rule |
|---|---|---|
| **NPC count shrinks** — `min(1 + buildingCount + slots, MAX)` | `useTownStore.ts:1354` | Feed it `townScale` (§5.1) so the crowd does not thin out with every fusion |
| **`justGrew` rise animation** exists and is reusable for fusion feedback | `useTownStore.ts:404` | Reuse; do not build a celebration system (ADDENDUM-04 §4's "what was deliberately NOT built" applies) |

---

## §6 — Interaction: fusion borrows grow-pick mode wholesale

**No new modal system.** Fusion reuses `useGrowPickMode` (`useGrowPickMode.ts:36-63`) exactly as it
stands. Justification: the two modes are already mutually exclusive on screen, and the hook already
owns candidate highlighting, the 취소 button, `useBackGuard`, and the FAB-hiding rule.

Flow:
1. Tap a building → `BuildingDetailSheet` opens (`TownScreen.tsx:223-225`).
2. The sheet shows a **융합하기** CTA, rendered **only** when the tapped building satisfies F1/F4
   **and** at least one partner satisfying F2/F3/F5/F6 exists. No partner ⇒ no button (never a
   disabled button that cannot explain itself).
3. Tapping it closes the sheet and calls the existing `growPick.start(partnerIds)`.
4. The grid highlights partners via the existing `growCandidateIds` prop and
   `town-tile--grow-candidate` class (`TownGrid.tsx:346,590`). Nothing new in `TownGrid`.
5. The existing banner shows **"융합할 건물을 선택하세요"** with the existing 취소 button
   (`TownScreen.tsx:363-369`).
6. Tapping a highlighted partner commits. Tapping a non-candidate is a documented no-op, exactly
   as grow already behaves (`useGrowPickMode.ts:55`).
7. 취소 / Escape / Android back exit with nothing committed (`useGrowPickMode.ts:47`).

**Implementation note (ponytail):** do **not** fork the hook or add a second instance. Add one
`pickPurpose: "grow" | "fuse"` state beside the existing `growPick` instance and branch the banner
copy and the commit callback on it. The two purposes can never be active at once — grow starts from
the entry sheet and fusion from the detail sheet, and both entry points are unreachable while pick
mode is open (the FAB is hidden at `TownScreen.tsx:387`).

Multi-cell taps are already correct: one element spans the whole footprint carrying the anchor's
`data-plot-index` (`TownGrid.tsx:592-599`), so `useGrowPickMode.ts:54`'s `b.plotIndex === plotIndex`
lookup resolves a tap on any cell of a 2×2 candidate. No change needed — but assert it, because the
lookup reads as if it only handles 1×1.

**Confirmation step (PROPOSAL):** fusion destroys a building and is irreversible. Unlike a move, it
has **no undo** (`useMoveMode.ts:203-222`'s undo has no analogue — the consumed building is gone).
Require one confirm dialog naming both buildings and the resulting level before committing. This is
the one place fusion should *not* be lazier than move mode.

---

## §7 — Acceptance criteria

Each is checkable against a real run. This project gates on browser-verified evidence, not unit
tests alone (ADDENDUM-08 §9.3).

1. Two Lv.5 buildings of the same category **and** same footprint fuse into one Lv.6; the survivor
   keeps its position, id, and footprint; the second building is gone from the grid. **Screenshot
   before and after.**
2. The vacated cells render as empty lots and accept a new building immediately (build one there in
   the same session, screenshotted).
3. Fusion is refused (no 융합하기 CTA) when the pair differs in level, category, or footprint, and
   for any monument or nospend park tile — one case each.
4. The ladder reaches **Lv.10** from 32 Lv.5 buildings via 31 fusions on a seeded save, with the
   Lv.6/7/8/9/10 art screenshotted side by side and visibly distinct at each rung.
5. `PlaceholderBuilding.test.tsx`'s fill-rate test passes at **4 footprints × 6 fuse tiers**,
   ≥90%; `scripts/evidence-art-fill.mjs` reports **94%±0.5pp** for every fuse tier.
6. Lv.1-5 art is **unchanged** — snapshot test green, plus a visual diff of the frozen `d8ce379`
   baseline screenshot showing no pixel change on unfused buildings.
7. Tier does not regress across 31 fusions (§5.1): the header count and the displayed tier are
   asserted equal before and after, in the same run.
8. `townScale` equals `buildings.length` for a town with zero fused buildings, so an existing save's
   tier is **unchanged on first load** after this work ships (§5.1.3).
9. NPC count does not fall after a fusion (§5.5).
10. **Dangling references — remap verified (§5.4).** After fusing two buildings whose founding
    entries are both in 기록: every `LedgerEntry` that pointed at the consumed building now points
    at the survivor; **no entry is deleted, and no entry's `buildingId` becomes `null`**; opening
    either entry in 기록 navigates to the surviving building; the survivor's detail sheet still
    resolves a founding entry (`TownScreen.tsx:231`). Assert the total ledger entry count is
    identical before and after. **Screenshot 기록 before and after.**
11. **Dangling references — cosmetics and F16 (§5.4/§5.2).** A cosmetic SKU applied to the consumed
    building transfers to the survivor when the survivor has none; `economy.ownedSkus` is
    **identical** before and after in every case (a fusion never revokes a purchase). Separately: a
    town containing F16 monuments survives 5 fusions with every monument, its `monumentSummary`, and
    its 2×2 footprint intact — monuments are never offered as fusion candidates.
12. **Two-chunk atomicity — never half-persisted (§3.1).** For a **cross-month** fusion (the two
    buildings built in different months, so two chunk writes), inject a failure after each write in
    turn and reload. In **every** case the town must settle into exactly one of two states, never a
    third: (a) the fusion did not happen — both buildings present at Lv.5; or (b) the fusion
    completed — survivor at Lv.6, consumed building gone. Specifically forbidden and each its own
    assertion: **no state where the consumed building is gone and the survivor is still Lv.5**
    (a lost building), and **no state where the survivor is Lv.6 and the consumed building is still
    standing** (a duplicated one). `fusePending` is cleared in both outcomes. Repeat the reload to
    prove the repair is idempotent.
13. A **same-month** fusion completes in a single chunk write and never sets `fusePending` (§3.1).
14. A reload after fusion restores the fused building at the same cell with the same fuse tier.
    **Screenshot after reload.**
15. Fusion pick mode cancels cleanly via 취소, Escape, and Android back, leaving both buildings
    intact; the FAB and 꾸미기 mini-FAB are hidden throughout and return afterwards.
16. Long-press move mode is unreachable while fusion pick mode is active, and unchanged afterwards
    (`TownScreen.tsx:343`).
17. A building parked at `plotIndex: -1` on a full map gets seated after a fusion frees cells (§3).
18. Gate 1 mechanical: `npx tsc --noEmit`, `npm run build`, `npm run lint`, `npm test` all green.
19. `docs/PLAY_GUIDE.md` gains a Korean, non-technical description of fusion.

---

## §8 — Out of scope

Explicitly not built, so implementation does not sprawl:

- **Un-fusing / splitting** a fused building; any undo of a fusion beyond the pre-commit confirm.
- **Fusing more than two buildings at once**, or fusing across fuse tiers (Lv.6 + Lv.5).
- **Any change to `expAmountTiers`, `expPerLevel`, `maxLevel`, or `tierThresholds`** — frozen.
- **Any change to the map, footprint set, or the `d8ce379` / `afc7cd6` visual baselines.**
- **Fused buildings growing beyond 2×2**, taking the freed cells, or moving on fusion.
- **Image assets of any kind** — none exist in this project and none are proposed (§4).
- **Fusing monuments, savings structures, or nospend park tiles** (§5.2).
- A fusion celebration/animation system beyond reusing the existing `justGrew` rise
  (`useTownStore.ts:404`) and the existing toast channel.
- Auto-fusion, a fusion queue, a fusion history log, or a "fusable pairs" finder UI.
- Monetizing fusion (a paid fusion slot or a fusion catalyst) — ADDENDUM-03 is not approved.
