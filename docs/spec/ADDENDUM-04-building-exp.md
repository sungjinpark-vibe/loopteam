# ADDENDUM-04 — Building EXP (grow, don't only sprawl)

Status: **CLOSED — both dials director-confirmed, 2026-08-09** (§7, §8).
Supersedes nothing. Amends MVP-SPEC.md F2 (building creation) and F5 (tier), ADDENDUM-02 (placement).
F16/F17 untouched — still cut pending the director.

## 1. Why

Gate 3 finding #1: "a ₩1 entry and a ₩10,000,000 entry produce an identical building." The director's
first move was **agency**: let the player decide whether a record widens the town or deepens one
building. Amount-sensitivity (§7) is the second move, now closed too — see §5/§7.

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

**Parity rule (§7 CLOSED, 2026-08-09):** with the amount dial on, every logging act adds **exactly
`expGainFor(amountKrw)`** to that score, whichever branch it takes — a new building founded with gain
`G` adds `G` (`1` via `.length` + `G - 1` via `exp`), a grow of the same amount adds `G` too (all via
`exp`, `expOf(growTarget) + G`). Consequences, all deliberate:

- Tier pacing is **byte-identical to today** for a player who always picks "new building" *and* whose
  amounts stay under the dial's first tier (flat 1) — and byte-identical always when the dial is off
  (`expAmountTiers: null` still means flat 1 for both branches).
- Neither branch is punished **regardless of amount** — founding and growing the same amount always
  contribute the same score, so the choice stays a free expression of taste. If growing gave less tier
  progress than founding (or vice versa) nobody would ever pick the losing branch.
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
| Tier check (F5) | growth score **+G** (`G = expGainFor(amountKrw)`) | growth score **+G** |
| `nextPlotIndex` | +1 | **unchanged** (no lot opens) |
| `Building` created | yes, with `exp: G - 1` (omitted when `G === 1`) | no — host's `exp` +`G` |
| `entry.buildingId` | new building's id | **host's id** |

`G - 1` on a fresh founding plus the `1` every `Building` already contributes via `.length` sums to
`G`, exactly matching a grow of the same amount — the §3 parity rule. This is also §1's fix: a
₩10,000,000 founding entry now visibly outsizes a ₩1,000 one (`levelOf`), not just identical siblings.

`entry.buildingId` pointing at a building whose `source.entryId !== entry.id` **is** the marker of a
grow contribution. No extra field.

## 6. Edit / delete (F9)

- **Delete a grow-entry** → host's exp −`expGainFor(entry)`, floored at 0. Host is not removed. The
  slot is not refunded (D-10 unchanged).
- **Edit the amount of a grow-entry** → host's exp adjusts by `expGainFor(newAmount) -
  expGainFor(oldAmount)`, floored at 0 (same math as delete, just a delta instead of a full back-out).
- **Edit the amount of a founding entry** → the host's `exp` adjusts by `(newGain - 1) - (oldGain - 1)`,
  floored at 0, leaving any *contributor* exp already on that host untouched — only the founding
  component is re-derived.
- **지출/수입 → 저축 conversion of a grow-entry** → same back-out, then the amount joins the tower.
- **Category edit of a grow-entry** → nothing moves. EXP is a growth contribution, not a skin; the
  host's category belongs to its founding entry. (Contrast: a category edit on a *founding* entry
  still re-skins its building, unchanged from today.)
- **Delete the founding entry of a grown building** → the building is removed with its EXP, as today.
  Contributor entries keep a dangling `buildingId`; they are ledger records and still display fine.
  `ponytail:` accepted ceiling — the alternative (re-hosting contributions) is a lot of machinery for a
  rare case. Revisit only if players report losing growth.
- **CLOSED** — a material that queues (F14) and drains later now founds with the same amount-driven gain
  a same-day founding save would get: `QueuedMaterial.amountKrw` (types.ts, OPTIONAL) is captured at queue
  time and re-run through `expGainFor` in `queueActions.ts`'s builder at drain time (`exp: G - 1`, omitted
  when `G === 1`, the same parity rule as §5). Migration-safe: a material persisted before this field
  existed simply has none, and reads as gain 1 — exactly the old behaviour, never a crash.

## 7. CLOSED — director chose Option 3 (all types), 2026-08-09

**Decision:** EXP scales with amount for **저축/수입/지출 alike** — no per-type branching anywhere
(`expGainFor` takes only `amountKrw`, never `type`). The dial is on:

```ts
expAmountTiers: [[10_000, 1], [50_000, 2], [200_000, 3], [Infinity, 5]],   // balance.approved.ts
```

< ₩10k → 1 EXP, ₩10k–50k → 2, ₩50k–200k → 3, ≥ ₩200k → 5. Both a founding entry (`exp: G - 1` on the
new `Building`) and a grow (host's `exp` +`G`) now scale identically with amount — §3/§5's parity rule
— which is also the rest of Gate-3 finding #1's fix (§1): a ₩10,000,000 entry now visibly outsizes a
₩1,000 one, not just an identical sibling.

**저축 was already amount-proportional by construction**, with no building of its own: the 저축탑 ladder
(`BALANCE.savingsTowerSegments`) scales tower height directly with cumulative KRW. So "all three types
scale with amount" doesn't mean giving 저축 a building — it already had its own amount-proportional
mechanic before this addendum existed.

**The caveat the director weighed, now an accepted and tracked risk, not an open question:** in a
*budgeting* app, making a ₩2,000,000 splurge grow the town five times faster rewards the behaviour the
app exists to discourage. Fortune City gets away with it because overspending has a separate, visible
cost. This app currently has none — **Gate-3 finding #2 ("overspending has zero mechanical
consequence") is now a required follow-up**, not a someday item: shipping the reward side (this
addendum) without eventually shipping the penalty side lets the loop read as "spend more." Tracked, not
blocking this ship.

## 8. Level and visuals

```ts
expPerLevel: 3,   // director-confirmed, 2026-08-09
maxLevel: 5,      // director-confirmed, 2026-08-09 — visual cap only
```

`level = min(maxLevel, 1 + floor(exp / expPerLevel))`. Level 1 renders exactly as a building renders
today (so nothing regresses visually for existing towns). Each level above 1 adds a stacked floor to
the tile and shows a small `Lv.N` badge. EXP past `maxLevel * expPerLevel` still counts toward tier —
the cap is cosmetic only, so late-game growth never silently stops mattering.

`variantIndex` (roof shape) is untouched and independent of level.
