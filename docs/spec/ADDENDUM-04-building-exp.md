# ADDENDUM-04 — Building EXP (grow, don't only sprawl)

Status: **design fixed by the PM, one dial left open for the director** (§7).
Supersedes nothing. Amends MVP-SPEC.md F2 (building creation) and F5 (tier), ADDENDUM-02 (placement).
F16/F17 untouched — still cut pending the director.

## 1. Why

Gate 3 finding #1: "a ₩1 entry and a ₩10,000,000 entry produce an identical building." The director's
chosen first move is **agency**, not amount-sensitivity: let the player decide whether a record widens
the town or deepens one building. Amount-sensitivity is §7, still open.

## 2. Data model

```ts
// types.ts — Building
exp?: number;   // OPTIONAL. absent === 0. no migration, no schema bump.
```

Nothing else changes. `Building.source` still names the **founding** entry; a contributing entry is
linked from the other side (`LedgerEntry.buildingId` points at the host it grew). `SCHEMA_VERSION`
stays 1: an old chunk parses unchanged, an old building simply reads exp 0.

Read discipline, same rule `savingsOf` already sets for optional `TownState` fields — never open-code
`?? 0`:

```ts
export function expOf(b: Pick<Building, "exp">): number   // selectors.ts
export function levelOf(b, expPerLevel, maxLevel): number // 1 + floor(exp/expPerLevel), capped
```

## 3. Tier: growth score, not building count

`tier()` is unchanged. What is fed into it changes:

```
growthScore(buildings) = buildings.length + Σ expOf(b)
```

Every logging act adds **exactly 1** to that score — a new building adds 1 via `length`, a grow adds 1
via `exp`. Consequences, all deliberate:

- Tier pacing is **byte-identical to today** for a player who always picks "new building".
- Neither branch is punished, so the choice stays a free expression of taste. If growing gave no tier
  progress nobody would ever grow, and the feature would be dead on arrival.
- **Existing saves keep their exact tier** on first load: every old building has exp 0, so
  `growthScore === buildings.length`, which is what `tier()` was already getting.
- `tierThresholds` in `balance.approved.ts` need no re-approval.

`buildingCount()` in `selectors.ts` remains (기록/UI still want a literal count); every *tier* call site
moves to `growthScore`.

## 4. The choice

Trigger, evaluated at save time in `TownScreen` before calling `addEntry`:

| Condition | Behaviour |
|---|---|
| `draft.type === "saving"` | No dialog. 저축 never builds (F13). |
| No free build slot today | No dialog. Queues or overflows exactly as today (F14). Growing must not bypass the F4 daily cap. |
| No standing building with `categoryId === draft.categoryId` | **No dialog.** New building, as today. |
| ≥ 1 such building | Dialog: (a) 새 건물 세우기 / (b) 기존 건물 키우기 |

Candidate set = live buildings with `source.kind === "entry"` and matching `categoryId`. Park tiles
(`nospend`) and monuments are never grow targets.

Branch (b):
- exactly 1 candidate → grow it immediately, no second step.
- ≥ 2 candidates → **grid pick mode**: the sheet is already closed, the town is visible, candidates
  are highlighted, tapping one grows it. Back / Escape / 취소 aborts — the entry is **not** saved, the
  player is returned to nothing having happened. (Reuses the `useMoveMode` interaction shape and
  `useTileGestures`; no new gesture layer.)

The entry sheet closes **before** the dialog opens, so this never nests a `ConfirmDialog` inside an
open `BottomSheet` — the vendor backdrop bug `useConfirmDialogBackdropFix` exists for is avoided by
construction, not patched a second time.

### UX: what was deliberately NOT built

- **No "remember my choice" / "don't ask again".** Considered and skipped. The two buttons keep fixed
  positions every time, which is what actually builds speed; a remembered default that swaps button
  roles moves the tap target and causes mis-saves. Add a remember-toggle only if the director reports
  the dialog is actually annoying in real use.
- **No renaming/labelling of buildings** to identify them in a list. The town map already identifies
  them by position, which is why pick-mode is on the grid rather than in a list sheet.

## 5. Grow effects (F2/F4/F5/F7 deltas)

Growing = building, minus the plot:

| | New building | Grow |
|---|---|---|
| Build slot | consumed | **consumed** |
| Streak (F7) | advances | **advances** |
| Tier check (F5) | growth score +1 | growth score +1 |
| `nextPlotIndex` | +1 | **unchanged** (no lot opens) |
| `Building` created | yes | no — host's `exp` +1 |
| `entry.buildingId` | new building's id | **host's id** |

`entry.buildingId` pointing at a building whose `source.entryId !== entry.id` **is** the marker of a
grow contribution. No extra field.

## 6. Edit / delete (F9)

- **Delete a grow-entry** → host's exp −`expGainFor(entry)`, floored at 0. Host is not removed. The
  slot is not refunded (D-10 unchanged).
- **지출/수입 → 저축 conversion of a grow-entry** → same back-out, then the amount joins the tower.
- **Category edit of a grow-entry** → nothing moves. EXP is a growth contribution, not a skin; the
  host's category belongs to its founding entry. (Contrast: a category edit on a *founding* entry
  still re-skins its building, unchanged from today.)
- **Delete the founding entry of a grown building** → the building is removed with its EXP, as today.
  Contributor entries keep a dangling `buildingId`; they are ledger records and still display fine.
  `ponytail:` accepted ceiling — the alternative (re-hosting contributions) is a lot of machinery for a
  rare case. Revisit only if players report losing growth.

## 7. OPEN — should EXP scale with the amount? (director's call)

Default shipped: **flat 1 EXP per act.** The dial exists and is off:

```ts
expAmountTiers: null,   // balance.approved.ts — null = flat 1
```

Option A — flat (shipped). The choice is expressive, not economic. ₩1,000 and ₩10,000,000 still grow
the town identically, so Gate-3 finding #1 is only *half* addressed.

Option B — amount tiers, e.g. `[[10_000, 1], [50_000, 2], [200_000, 3], [Infinity, 5]]` (< ₩10k → 1 EXP,
… ≥ ₩200k → 5 EXP). Big spending becomes visibly bigger growth.

**The caveat the director must weigh:** in a *budgeting* app, making a ₩2,000,000 splurge grow the town
five times faster rewards the behaviour the app exists to discourage. Fortune City gets away with it
because overspending has a separate, visible cost. This app currently has none (Gate-3 finding #2 —
"overspending has zero mechanical consequence" — is still open). Three coherent answers:

1. Keep flat. Address amount-sensitivity later, on the *penalty* side rather than the reward side.
2. Scale EXP by amount for **저축/수입 only**, flat for 지출. Rewards the good behaviour, not the spend.
3. Scale for everything, and accept that finding #2 must be built alongside it or the loop tells the
   player "spend more."

Do not pick one autonomously — the balance file is director-owned (MVP-SPEC §9 rule 3).

## 8. Level and visuals

```ts
expPerLevel: 3,   // NEW dial, PM default, needs director confirmation
maxLevel: 5,      // NEW dial, visual cap only
```

`level = min(maxLevel, 1 + floor(exp / expPerLevel))`. Level 1 renders exactly as a building renders
today (so nothing regresses visually for existing towns). Each level above 1 adds a stacked floor to
the tile and shows a small `Lv.N` badge. EXP past `maxLevel * expPerLevel` still counts toward tier —
the cap is cosmetic only, so late-game growth never silently stops mattering.

`variantIndex` (roof shape) is untouched and independent of level.
