
# Life Town (Unity) — Art Design System
**Angle: Cohesion-first.** ui-ux · 2026-07-16 · Carries forward `app-dev-team/lifetown/docs/design/00–03, 08` (LOCKED) into the Unity rebuild per `docs/spec/00-mvp-spec.md` §6–§8 and `01-decisions-resolved.md`.

---

## 0. The angle, argued

The brief calls out that the Flutter original "dropped its own isometric plan, hand-rolled a flat grid." That is not editorializing — it's in the spec the team already wrote for this rebuild:

> `00-mvp-spec.md` §7.1: *"The original hand-rolled `CustomPainter` + `flutter_svg` on a **flat** grid, never added Flame as a dependency, and **deleted the isometric diamond** (commit `0e51871`)... Unity's Tilemap has Isometric... as a first-class Cell Layout — no library, no custom painter, no math."*
> §7.5: *"This is the setting the original's `CustomPainter` did not have and could not get, and it is why the isometric diamond was deleted."*

And the design docs themselves record a second, independent inconsistency episode — the S10 village-home screen was redesigned *away from* the game's own real grid into a "diary/washi-tape notebook" metaphor, and had to be pulled back (`08-art-direction.md`, "Village Home — Grid Builder" postscript): *"An earlier pass reframed the village-home screen... buildings scattered over blurred hills inside a decorative note-paper border. The user rejected it: it drifted from the app's actual core loop."*

Two separate failures, one root cause: **there was no enforced grammar, so every redesign pass was free to reinterpret the world from scratch.** A pastel palette and a mascot are not enough to hold a village together once it has 64 tiles, 7 categories, 2 tiers, and a report screen that re-renders the same world. What holds a village together across months of accretion is **math and a shading rule that cannot drift, because they are not re-authored per building — they are computed.**

That is this proposal's one bet: spend the "signature" budget the frontend-design process asks for on **the tile grammar itself** — a single procedural shading formula and a single tier-evolution rule, applied without exception to all 7 categories × both tiers × the eventual landmark — rather than on any one screen's flourish. Everything below is written so that adding building #65 next year requires zero new visual decisions.

---

## 1. Design tokens

All hex values below are the **locked Board A palette + 7 category colours**, carried verbatim from `00-design-system.md` §1 and `00-mvp-spec.md` §6.1 (which is itself sourced from `category_catalog.dart`). **Verification note:** I searched `Assets/LifeTown.Economy.Core` for shipped hex constants (per the task brief's claim that these are "already in Assets/LifeTown.Economy.Core config from T002") and found none — T002 built only the economy math (`EconomyConfig.cs`, `Settlement.cs`, etc.), no `CategoryDef`/colour ScriptableObject exists yet. **This document is therefore the source of truth client-dev bakes into `CategoryDef.color` when that ScriptableObject is built** — the values are unambiguous either way (spec §6.1 and the design docs agree exactly), so this is a paperwork gap, not a values gap. Flagged as **[assumption: no shipped Color config found — this doc is the values source]**.

### 1.1 Brand / role colours (unchanged from Board A)

| Token | Hex | Role |
|---|---|---|
| `color.primary` | `#FF9EC4` | Brand primary — CTA, FAB, active nav |
| `color.primary.gradTop` / `.gradBottom` | `#FFA9C7` / `#FF7FAE` | Primary button vertical gradient |
| `color.primary.tint` | `#FFE0EC` | Selected-state washes, badge backgrounds |
| `color.primary.ink` | `#D6447A` | Pink text/icon on white (4.9:1) |
| `color.secondary` | `#B6A0EF` | EXP, secondary actions |
| `color.secondary.deep` | `#8A7BD8` | EXP bar gradient bottom |
| `color.currency.coin` / `.coin.ink` | `#FFD066` / `#8A6104` | Coin icon fill / coin numeral (5.53:1) |
| `color.success` / `.success.bg` | `#4FAE82` / `#EAF8F1` | Achievement, level-up |
| `color.warning` / `.warning.bg` | `#C98A12` / `#FFF6DF` | Daily-cap proximity only |
| `color.danger` / `.danger.bg` | `#C93A54` / `#FFE8EC` | Destructive confirm only — **never used on S5/S6 receipts per spec §6.4 banned list (no red hue on balance content)** |
| `color.text.primary` | `#5A4A6A` | 8.0:1 on white — titles, numerals |
| `color.text.secondary` | `#6B5C7C` | 6.1:1 — body/help |
| `color.text.tertiary` | `#8A7A95` | 3.96:1 — 18px+/bold caption only |
| `color.text.accentMuted` | `#8A5E96` | 5.1:1 — lavender labels |
| `color.text.disabled` | `#C4B9CE` | disabled text, always with disabled icon |
| `color.surface` / `.surface.raised` | `#FFFDFE` / `#FFFFFF` | cards / modals |
| `color.surface.sunken` | `#F5EFF8` | inputs, disabled tracks |
| `color.border` / `.border.strong` | `#EFE6F6` / `#D8C9E6` | card borders / focus rings |
| `color.bg.app` | `linear(160°, #DFF1FF→#FFE9F3→#FFF5E6)` | onboarding/settings/report chrome |
| `color.bg.village.sky` | `linear(180°, #EAFAFF→#E6FBEF→#DFF6E6)` | S2/S6 canvas base (day; see §5 for the Light2D-driven variant) |

**Cut from the original token set for MVP, and why:**
- `color.currency.gem` / `.gem.ink` (`#6FD0E8`/`#1C7C93`) — **dropped from the HUD.** Spec §3.2 cuts IAP/gems/shop entirely for MVP; a gem pill with nothing to spend gems on is a broken affordance. **[decision]** Blue `#6FD0E8` stays live in the palette as the *reading/study category colour only* — it does not disappear from the app, it just stops meaning "gem."
- `color.type.growth`/`color.type.leisure` (Mint/Peach) — **kept**, used exactly as the source spec's "은은한" (subtle) badge layer §1-2 describes: never recolours a category's own identity, only adds a small underline/badge.

### 1.2 Typography — Unity mapping

| Token | Size / Weight | Font | Use | Unity note |
|---|---|---|---|---|
| `type.numeric.hero` | 40–48px / 700 | **Jua** | Timer countdown (S4), receipt count-up (S5) | TMP Dynamic SDF asset; Jua is single-weight — do not fake-bold |
| `type.display.l` | 32px / 700 | Jua | S5 celebration headline | same asset |
| `type.h1` | 26px / 700 | **Gmarket Sans Bold** | Screen titles | |
| `type.h2` | 22px / 700 | Gmarket Sans Bold | Section headers, building name |
| `type.h3` | 18px / 500 | Gmarket Sans Medium | Sub-sections |
| `type.body.l` | 16px / 500 | Gmarket Sans Medium | Body default |
| `type.body.m` | 14px / 300–500 | Gmarket Sans Light/Medium | Secondary text |
| `type.body.s` | 12px / 500 | Gmarket Sans Medium | Captions, timestamps — **12px is the floor, never smaller** |
| `type.label` | 15px / 700 | Gmarket Sans Bold | Button/chip labels |

**Unity implementation, concretely:**
- Both faces are Korean-supporting, commercially free (Gmarket Sans TTF, Jua via Google Fonts) — acquire TTF/OTF, generate **TextMeshPro Font Assets**, `Atlas Population Mode = Dynamic`, since the Korean glyph set is too large for a static atlas at reasonable texture size. Budget one dynamic atlas per face (2× 2048px pages), fallback chain: Gmarket Sans → system Korean fallback → Jua for numerals only.
- Tabular/monospaced numerals for the timer and receipt counters (§below) — Jua doesn't guarantee tabular figures; **fix width via a `TMP_Text` + fixed-width character cells (a `HorizontalLayoutGroup` of per-digit `TMP_Text` cells) for `S4`'s HH:MM:SS and `S5`'s count-up, not a single auto-sizing text block** — this is the concrete fix for the layout-jitter risk the source doc only flagged in prose.

### 1.3 Spacing / radius / elevation — carried verbatim (they were already px, not Flutter-specific)

| Spacing | Radius | Elevation (Unity: drop-shadow via `Shadow`/`Outline2D` component or a 9-sliced shadow sprite, never native box-shadow) |
|---|---|---|
| 4/8/12/16/20/24/28/32/40/48/64 px | sm 12 / md 16 / lg 20 / xl 22 / 2xl 24 / 3xl 28 / 4xl 36 / full 999 | `elevation.1`→`.4` = soft deep-purple shadow, `glow.primary` = pink glow on FAB, `glow.secondary` = lavender glow on building icon frames |

**Canvas Scaler contract (this is what makes every px above literal, not advisory):**
```
Canvas Scaler: UI Scale Mode = Scale With Screen Size
Reference Resolution = 1080 × 2400 (portrait)
Screen Match Mode = Match Width Or Height, Match = 0.5
```
At reference resolution, 1 token-px = 1 Canvas unit. Every RectTransform size in §7 can be typed in directly.

---

## 2. Isometric grid & rendering system — the load-bearing layer

Carried verbatim from `00-mvp-spec.md` §7.5 (do not re-derive):

| Param | Value |
|---|---|
| Grid Cell Layout | Isometric |
| Cell Size | `(1, 0.5, 1)` |
| Grid extent | 8×8 (spec §4 item 4, §9 `TownState`) |
| Transparency Sort Mode | Custom Axis, `(0, 1, -0.26)` |
| PPU (buildings, UI, decor) | 100 |
| Building sprite pivot | bottom-center, all sprites |
| Sprite canvas — Tier1 | 128×208px @1x/@2x/@3x, transparent PNG |
| Sprite canvas — Tier2 | 256×320px |
| Sprite canvas — Landmark | 320×400px (kept in scope per D11; footprint 2×2–3×3) |

**One reconciliation this proposal adds, because the spec pins three numbers that don't independently resolve:** ground tile art is fixed at 128×64px, the cell is `(1, 0.5, 1)` world units, and PPU is stated as "100 everywhere." At PPU 100, a 128×64px sprite is 1.28×0.64 world units — it overhangs a 1.0-unit-wide cell by 0.28 units, which breaks tile-to-tile abutment across the whole grid (the single most cohesion-breaking bug a tile game can ship).

**Fix, concrete: ground tile sprites use PPU = 128, not 100.** 128px ÷ 128 PPU = 1.0 unit width; 64px ÷ 128 PPU = 0.5 unit height — this exactly fills the `(1, 0.5, 1)` cell with no overhang. Building/decoration/UI sprites keep PPU 100 as spec'd (their footprint is meant to sit *inside* the cell, not tile edge-to-edge, so the mismatch doesn't apply to them). **This is a Sprite Import Setting split by asset folder, not a code change** — `Assets/.../Tiles/*` → PPU 128, everything else → PPU 100.

**Light2D layering (accessibility-critical — see §9):**
```
Sorting Layers used by Global Light 2D:  Ground, Buildings, Decorations
Sorting Layers EXCLUDED:                 UI
HUD Canvas render mode:                  Screen Space – Overlay (unlit, unaffected by any Light2D)
```
The village literally gets darker at night (§5). The numbers, buttons, and text sitting on top of it must not — a HUD pill readable at noon and unreadable at 3am is an accessibility regression the source docs never had to solve because Flutter had no Light2D at all. Locking the HUD to its own unlit overlay canvas is the one-line fix, and it must be stated as a rule, not left to whoever wires the scene.

---

## 3. The tile grammar — one shading formula, one evolution rule

This is the cohesion-first signature. It replaces "an artist follows a style guide" with **a formula every building's colour and silhouette is computed from**, so nothing can drift as the village scales to 64+ buildings.

### 3.1 The shading formula (carried from `03-art-assets.md` §1-3, now the enforced rule, not a suggestion)

| Face | Formula | Applies to |
|---|---|---|
| Top/roof | category `500` + 60% white mix | every building, every category, every tier, every stage |
| Right/front | category `500` + 25% white mix | ″ |
| Left/side | category `500` + 0% (pure `500`) | ″ |

**Implementation, concretely:** author this as a small **editor tool** (`BuildingBlockKit`), not per-sprite hand mixing — a script that takes `(categoryColor, stageIndex, tier)` and outputs the three faces programmatically (simple HSV-space white-blend, then flat-fill the 3 polygons of a block primitive). This is the mechanism that makes the rule unbreakable: a hand-authored sprite can accidentally drift 3% off the formula and nobody will notice for months; a formula cannot drift. Category swaps (7 categories) and future custom categories become a single hex parameter, not new art.

Outline: no pure black. Either omit the outline or use a 1px stroke at 15% opacity of the category's own `500` — never `#000000` (carried from `03-art-assets.md`: *"외곽선은 옅은 톤(순검정 금지)"*).

### 3.2 Tier1 evolution — 3 stages (Lv1–5)

Carried convention from the source doc's own retrospective note (`08-art-direction.md` postscript): *"evolution = added parts, not resize."* This is the correct cohesion rule — resizing a whole sprite makes every stage a new, independently-drawn silhouette; adding a block on top of the same base is a rule that stays recognizable no matter how many times it repeats.

| Stage | Levels | Silhouette rule | Detail added |
|---|---|---|---|
| S1 | Lv1–2 | Single cube block, height 1.0 units, footprint 1×1 | none — bare mass, category colour only |
| S2 | Lv3–4 | Same base block **+ one added upper block** (setback 20%, height +0.4 units) | signage plate appears: a flat coloured rectangle at `category.ink` on the front face (no text needed — reads as "occupied/signed" at a glance) |
| S3 | Lv5 (max) | Same base + upper block **+ roof cap** (small pitched triangular accent, `category.ink`) | 2 window-light sprites (see §5) + 1 recolour-only prop (a simple flagpole/lantern primitive, identical geometry across all 7 categories, only the flag/lantern colour changes) |

### 3.3 Tier2 evolution — 4 stages (Lv1–10, merge result, 2×2 footprint)

| Stage | Levels | Silhouette rule | Detail added |
|---|---|---|---|
| S1 | Lv1–2 | 2×2 base block, height ≈ Tier1 S2's block scaled ×1.6 | "TIER 2" riboon tag (carried from `01-components.md` §4-3) |
| S2 | Lv3–5 | **+1 upper block**, centred setback | window rows ×2 |
| S3 | Lv6–8 | **+2nd upper block**, offset | small spire/antenna primitive + banner prop (recolour-only, same primitive across categories) |
| S4 | Lv9–10 (max) | **+roof crown** (larger pitched accent than Tier1's) | 4 window-lights, flag prop, full glow treatment on selection |

**Landmark (kept per D11, forward-compat note, not part of the 7-screen MVP build list):** same grammar, one more added block than Tier2 S4, footprint 2×2–3×3, single fixed stage (no levels — unique). Because it uses the identical shading formula and block-addition rule, it will visually belong to the same town the day it's built, instead of needing its own bespoke pass.

### 3.4 Why this is the "reads at a glance" mechanism (A1 proof)

A player scanning the 8×8 grid identifies:
- **Category** → hue alone (7 distinct, pre-verified-contrast hues, §4).
- **Rough level** → silhouette *height and block count* (1 block = early, 2 blocks = mid, 2 blocks + cap/spire = maxed) — readable at isometric thumbnail size without reading a numeral.
- **Tier** → footprint size (1×1 vs 2×2) + the riboon tag close-up.
- **Construction-in-progress** → ghost silhouette + scaffold + radial ring (§7, S2), a state the grammar explicitly reserves rather than overloading an existing stage.

No two categories can be confused for "further along" than another, because the block-count vocabulary is identical for all 7 — this is also the leisure-parity guarantee stated as a rendering rule, not just a copy rule (§4.2).

---

## 4. Category system & leisure parity

### 4.1 The 7 category hex values (locked, verified against `00-mvp-spec.md` §6.1 / Board A / `category_catalog.dart`)

| Category | Type | Hex `500` | `ink` (text/icon, computed 30–38% lightness per source rule) | `tint` (light bg) |
|---|---|---|---|---|
| 독서 Reading | Growth | `#B6A0EF` | `#5A3FA0` | `#EFE6F6` |
| 공부 Study | Growth | `#6FD0E8` | `#1C7C93` | `#E3F7FB` |
| 일 Work | Growth | `#FFD066` | `#8A6104` | `#FFF6DF` |
| 운동 Exercise | Growth | `#8AD3B4` | `#1F7A61` | `#EAF8F1` |
| 취미창작 Hobby | Growth `[assumption — source marks it 가정, unconfirmed by planner data model]` | `#6FBFA6` | `#1E6E58` | `#E7F5F0` |
| 마음챙김 Mind | Leisure | `#FFB37A` | `#A5570F` | `#FFF1E6` |
| 게임 Game | Leisure | `#FF8FA3` | `#B03A54` | `#FFE9EE` |

*(`ink` values for Hobby/Game are computed here following the source's own "30–38% lightness target" rule since only Reading/Study/Work/Exercise/Mind had pre-verified inks in the source doc; client-dev should treat these two as needing a quick contrast re-check against white — target ≥4.5:1 — before final ship, flagged **[assumption]**.)*

### 4.2 Leisure parity — enforced as rendering rules, not sentiment

Binding, checkable (mirrors spec §6.4's banned-word list, extended to visuals):

1. **Same shading formula, same evolution grammar, same stage count (3/4), same prop budget** for all 7 categories — §3 applies without exception.
2. **Category tile selection grid (S3):** identical 96×96px size, identical elevation, identical badge size for all 7 — order is "last-used first," never "growth categories first."
3. **The type badge** (성장/여가, Mint/Peach underline + icon) is the *only* place growth vs leisure visually differs, and it is deliberately subtle (a 3px bottom accent bar, never a background recolour) — per source `01-components.md` §5-2's own rule: *"카테고리 배경색 자체를 성장/여가 색으로 덮어쓰기... 금지."*
4. **S6 (balance report):** no axis, no ranking numeral, no red, no ↑/↓ — carried directly from `00-mvp-spec.md` §6.4's banned list. If 게임 is the brightest building this week, it is simply rendered brightest — nothing points at it.

---

## 5. Day/night lighting (§6.2)

One **Global Light 2D**, colour/intensity keyed to device local time, values carried verbatim from `00-mvp-spec.md` §6.2 (marked `[assumption]` there — tunable, but deliberately drawn from the locked palette so the village cannot drift out of brand even at its darkest):

| Local time | Colour | Intensity | Feel |
|---|---|---|---|
| 05:30 | `#FFD9C7` | 0.80 | dawn |
| 09:00 | `#FFFFFF` | 1.00 | day |
| 17:00 | `#FFC98A` | 0.95 | golden hour |
| 19:30 | `#B6A0EF` | 0.72 | dusk |
| 21:30 | `#5A4A6A` | 0.55 | night, windows warm |
| 03:00 | `#3E3350` | 0.45 | deep night |

Interpolate by `DateTime.Now.TimeOfDay` (lerp between the two nearest keyframes). Building **window-light sprites** (the emissive dots from §3.2/3.3) cross-fade in below intensity 0.7, using an unlit additive material so they read as "lit from within" independent of the Global Light — this is the one sprite per building that is *not* Light2D-affected, deliberately, so a building always signals "occupied/complete" even in the darkest keyframe.

**Minimum-legibility floor (my addition, not in source):** at intensity 0.45 (deep night), verify via Unity's Light2D preview that category hues remain distinguishable — if Mint (`#8AD3B4`) and Sage-Teal (`#6FBFA6`) desaturate toward indistinguishability at 0.45, apply a **Light2D floor of 0.5 minimum intensity on the `Buildings` sorting layer specifically** (a second, dimmer Light2D targeting only buildings, floor-clamped), leaving `Ground`/`Decorations` free to go as dark as 0.45. This keeps category identification — the core "reads at a glance" promise — true at every hour, not just daytime. **[decision the director doesn't need to make — implementation detail, but client-dev should verify the two greens at 0.45 before shipping and apply the floor if they're not ΔE-distinct.]**

---

## 6. Component styles (carried + Unity-adapted)

| Component | Spec | Unity note |
|---|---|---|
| **Primary Button** | h56(L)/48(M)px, `radius.2xl`(24px), gradient `gradTop→gradBottom`, `type.label` white text, `glow.primary` shadow, pressed = scale 0.97 | `Button` + `Image` (gradient via a 2-stop gradient sprite or `UI Gradient` shader), `Animator` for pressed-scale |
| **FAB "시작"** | h64px pill, floating, bottom-center over the village, independent of any nav bar (spec: no tab bar) | anchored bottom-center, `Canvas Group` for show/hide across screens |
| **건설 (Build) button** | Secondary-style pill, positioned upper-left of the FAB; **pulses** (opacity 0.85↔1.0, 2s) + `glow.primary` when coin ≥ next cost; greys to `surface.sunken`/`text.disabled`, no glow, when not affordable | separate from FAB — never the same button, they answer different questions ("start a session" vs "spend what I have") |
| **Session Receipt (S5)** | Base Panel (`radius.3xl`, `elevation.3`), big Jua count-up numeral, `+EXP`/`+coin` pills, **itemized adjustment rows — zero-deduction rows not instantiated at all** (not hidden via alpha=0, literally not created, so screen readers/QA can assert row-count) | a `VerticalLayoutGroup` populated from `SessionRecord.adjustments[]` only — empty array ⇒ zero rows, enforced by data shape not visual toggle |
| **EXP bar** | 12px(compact)/20px(detail), `radius.full`, track `#EFE6F6`, fill gradient `secondary→secondary.deep`, 600–900ms easeOutCubic fill animation | `Image.fillAmount` + `DOTween`/`LeanTween` ease |
| **Category tile (S3)** | 96×96px, `radius.xl`(20px), selected = `tint` fill + 2px `500` border + inverted icon | `Toggle` group, 7-wide responsive grid (3 or 4 cols depending on 1080-wide reference) |
| **Bottom sheet** | `radius.3xl` top corners, drag handle 40×4px, max 85% height, scrim `rgba(90,74,106,.45)` | used for: category quick-edit (S3 "+"), merge confirm (S2 drag-merge), duration-in-app confirmations |
| **Presence-ping overlay** *(new component — not in source docs, designed here within the token system)* | Non-blocking banner, top-anchored below SafeArea, `warning.bg` background, `warning` icon, text "아직 하고 있어요?", one Primary-style pill "네, 하고 있어요" (h40px), auto-dismiss if any touch occurs anywhere on S4 within the window | Does **not** use a modal/scrim — per spec §5.3.1 "not a modal, not a timer, not a quiz." Any tap on the timer screen counts as confirm; the banner is advisory, never blocking. |
| **HUD pills (S2/S4 header)** | h32px, `surface` 90% opacity, `elevation.1`; coin (`coin.ink` numeral) + streak (flame icon, grey when 0) + days-recorded — **no gem pill** (§1.1) | Screen Space Overlay canvas, always full white-light regardless of §5 |
| **Toggle (S7)** | 44×26px pill, on = `primary` fill | `Toggle` + custom `Image` transition |
| **Daily Cap Gauge** | 10px bar, `radius.full`, 0–6h `type.growth` mint fill, 6–9h `warning`, 9h+ `danger.bg` (soft, not full-strength danger — "processing, not punishing") | tick marks at 6h/9h/12h |

---

## 7. The 7 MVP screens (spec §8) — layout, elements, states

Grid/canvas note: S2/S4/S6 host the isometric Tilemap+Cinemachine world (§2) under a Screen-Space-Overlay HUD (§2); S1/S3/S5/S7 are pure UI (`color.bg.app` gradient chrome, per source §1-2).

### S1 · Onboarding `OnboardingScreen`
```
┌──────────────────────────┐
│ (skip)              ● ○ ○ │  Ghost text + 3 dots (not 4 — spec's current
│                            │  version has 3 panels, not the source doc's 4;
│  [illustration 60%]       │  category select is REMOVED from onboarding
│  code-drawn iso vignette:  │  per current spec — CTA goes straight to S4)
│  empty lot → 1 building   │
│  → small skyline          │  panel 1–2: identity copy
│                            │
│  "당신의 시간이              │  type.h1
│   마을이 됩니다"             │
│                            │
│        [다음]              │  Primary, full-width
└──────────────────────────┘
Panel 3: notification time picker (system time-of-day wheel, styled with
token colours) instead of a slide.
Final CTA (replaces "다음" on panel 3): "지금 25분 시작하기" — full-width Primary.
```
- Illustration: code-drawn using the exact §3 tile-grammar primitives (empty lot → Tier1 S1 cube → 3-building skyline) — **zero new art**, this vignette literally reuses the building-grammar renderer at a small scale, which is itself a cohesion proof: the onboarding "promise" and the real village are pixel-for-pixel the same rendering path.
- Mongsil: **not placed in these 3 panels.** Spec §3.2 explicitly cuts the mascot from MVP ("Charm, not loop. Cut with real regret"); locked identity says Mongsil *exists* as a brand asset, not that it must appear in this build's 7 screens. **[decision for director]**: if a low-cost reappearance is wanted, the cheapest slot is a small static wordmark-adjacent icon on the skip/splash corner — flagged, not built into this spec, so it doesn't silently reopen the OUT decision.
- **Nav:** final CTA → S4, category pre-selected 독서 (changeable there) · Skip → S2.

### S2 · Village `VillageScreen` — HOME
```
[World layer — Tilemap + Cinemachine, §2/§3]
  8×8 isometric grid, no coastline/road mask (simplified from the Flutter
  original's irregular land-mask — a plain, disciplined grid legible at any
  fill level). Buildings per §3. One empty-lot highlight when in place-mode.

┌──────────────────────────┐
│ [🪙 12,340]  🔥7  기록 12일│ HUD pills, SafeArea+8px, Screen-Space-Overlay
│                            │ — NO gem pill (§1.1)
│ EXP ▓▓▓▓▓▓░░ Lv.4→5        │ compact EXP-to-next-level readout (which
│                            │ building is implicit: last session's target)
│                            │
│      (village view)        │
│                            │
│  [건설 🔨]  (pulses when    │ upper-left secondary pill (§6)
│   affordable)               │
│                            │
│           ╭─────────╮      │
│           │ ▶ 시작   │      │ FAB, bottom-center, always primary pink
│           ╰─────────╯      │
│  [report icon]  [⚙ settings]│ two icon buttons, corners — replaces the
│                            │ 4-tab bottom nav (spec: "No tab bar")
└──────────────────────────┘
```
- **Empty state:** all 64 lots empty + one ghost outline where the first building goes, per spec S2 "The hole is the ask" — rendered with the identical §3 construction-ghost treatment used later for real construction sites, so the very first screen a player sees already teaches the visual language they'll use for months.
- **Place-mode** (after 건설 tap): eligible lots get `primary.tint` wash + dashed `primary` border + centred "+"; ineligible lots dim (opacity 0.4).
- **Merge affordance:** two same-category Lv5 buildings get a slow pulse outline (`glow.secondary`); drag one onto the other → bottom sheet confirm (§6) with a preview built from the §3.3 grammar (not a bespoke merge illustration), cost 5,000 coin, then a 1.2–1.6s tween (two buildings converge → sparkle burst → Tier2 S1 back-out) — carried from `01-components.md` §4-4/§7-3's merge choreography timings.
- **Construction site:** ghost silhouette (dashed outline at 40% opacity of the eventual category colour) + scaffold-pole primitives (3 thin vertical rects, neutral grey) + radial progress ring in the category's `500` hue, per spec §4.3/S2 — reuses `01-components.md` §3 Focus Ring styling so "progress" always looks the same whether it's a timer or a building.
- **Nav:** 시작→S3 · 건설→inline place-mode (no screen) · tap building→ inline expand card (compact Building Card, §6, no dedicated S40 screen in this 7-screen scope — level/EXP/actions shown in a small popover anchored to the tapped building) · report icon→S6 · settings icon→S7.

### S3 · Category Select `CategorySelectScreen`
```
┌──────────────────────────┐
│ ← 무엇에 집중할까요?         │ type.h1
│                            │
│ [독서] [공부] [일]           │ 7 tiles, 96×96px, identical size/weight
│ [운동] [취미] [마음챙김][게임]│ Last-used floats first (spec)
│                            │
│         (tap → S4)         │ No confirm step, no duration chip
│                            │ (duration-goal UI from the source design
│                            │ doc is NOT in the current spec's S3/S4
│                            │ element list — carried as OUT for this
│                            │ build, [decision noted])
└──────────────────────────┘
```
- Each tile: icon (category-specific line symbol, Filled Duotone per `00-design-system.md` §6) + name + 3px bottom accent bar in growth (`#8AD3B4`) or leisure (`#FFB37A`) — the only type-signal, per §4.2 rule 3.
- **Nav:** tap → S4 immediately · back → S2.

### S4 · Timer Running `TimerRunningScreen`
```
┌──────────────────────────┐
│  독서 집중              ✕  │
│                            │
│        ╭──────────╮        │ Focus Ring Large, 220px, 18px track,
│       │  18:42     │       │ fill = category `500`, track = category `tint`
│       │  독서       │       │ digits: fixed-width cell layout (§1.2)
│        ╰──────────╯        │
│                            │
│   +1,120 EXP  +1,120 🪙    │ live counters, +1/sec tick
│                            │
│  [일시정지]        [끝내기] │ Ghost + Primary
└──────────────────────────┘

Presence-ping overlay (conditional, §6):
┌──────────────────────────┐
│ ⚠ 아직 하고 있어요?  [네, 하고 있어요] │ warning.bg banner, top, non-blocking
└──────────────────────────┘
```
- The category's building renders **mid-construction inside the Focus Ring's inner circle** at small scale, growing subtly as the counter ticks — this reuses the §3 grammar/§6 focus-ring pattern rather than inventing a new mini-preview widget.
- **끝내기 <60s:** inline confirm dialog (§ source `07-2 Dialog`, 320px, "60초 미만은 기록되지 않아요" + Ghost 취소/Primary 확인) — never silently discards.
- Background: persistent system notification shows elapsed HH:MM:SS.
- **Nav:** 끝내기 → S5 · back disabled (must end explicitly, per spec).

### S5 · Session Result `SessionResultScreen` — THE RECEIPT
```
┌──────────────────────────┐
│      25분                  │ type.numeric.hero, Jua, count-up 0→25 over
│  +1,500 EXP · +1,500 코인  │ ~800ms easeOutCubic
│                            │
│  (adjustment rows —        │ ONLY rendered if adjustments[] is non-empty:
│   only if any exist)       │  "확인까지  −7시간 2분" style row,
│                            │  warning-toned text, never red/danger
│                            │
│  ── EXP를 어디에? ──         │
│  [도서관 Lv4] [독서방 Lv2]   │ horizontal compact Building Cards
│  [새로 짓기 100🪙]          │ (only shown if affordable — construction-
│                            │  in-progress buildings ARE valid targets)
│         [확인]              │ Primary, full-width
└──────────────────────────┘
```
- **Honest session = the shortest possible screen** — big numeral, two pills, done. This is the component the source spec calls "the single most important sentence" — the receipt's *emptiness* on a clean session is itself the design.
- **Nav:** 확인 → S2, coin counter animates up, 건설 pulses if now affordable.

### S6 · Balance Report `BalanceReportScreen` — the village re-lit
```
[World layer — SAME Tilemap/camera as S2]
  This week's contributing buildings render at full §5 lighting +
  brightness ∝ hours logged; everything else desaturates to silhouette
  (a single shader parameter, not a second art pass — reuses the exact
  §3 building sprites, no new "dimmed" sprite variant needed)

┌──────────────────────────┐
│  나의 리포트        [주|월]  │ segmented control, h40px
│                            │
│      (re-lit village)      │
│                            │
│  "이번 주는 여가가 조금 더    │ one neutral line — no axis, no arrows,
│   많았어요."                │ no red — banned-list compliant (§6.4)
│                            │
│  ▾ 자세히 보기 (collapsed)  │ accessibility fallback: tap to expand a
│    성장 18h12m · 여가 6h40m │ plain text list — same numbers, zero chart
│    독서 3h12m · 공부 5h...  │
└──────────────────────────┘
```
- **Why the desaturate-not-redraw approach is a cohesion win, not just a budget one:** the "brightest building = most-played" effect is a `Material` brightness lerp on the *same* sprites S2 already renders — a second, competing "report art style" is exactly the kind of drift this proposal exists to prevent.
- **Nav:** back → S2.

### S7 · Settings `SettingsScreen`
```
┌──────────────────────────┐
│  설정                       │
│  알림                       │
│   리마인더 시간   오후 8시 >│ Flat Row (§01-components §7 carried verbatim)
│   이탈 알림       [●On ]  │ Toggle
│  데이터                     │
│   내보내기 / 가져오기    >  │
│  정보                       │
│   개인정보처리방침 / 버전    │
│  [debug only] 초기화         │
└──────────────────────────┘
```
- Deliberately the plainest screen in the app — `bg.appFlat` (`#FBF7FC`) solid background, not the gradient, per source rule ("스크롤 많은 리스트형 화면... 그라디언트 과다 방지"). Decoration intensity = **0 (minimal)**, consistent with the source's own decoration-intensity scale (`08-art-direction.md` §1).
- **Nav:** back → S2.

---

## 8. Village visual language — the "reads at a glance" summary

| Question | Answer, and where it's encoded |
|---|---|
| What category is this building? | Hue alone, from 7 pre-fixed, contrast-checked hexes (§4.1) — never ambiguous, never shared between categories |
| Roughly what level is it? | Block count + roof cap/spire presence (§3.2/3.3) — a 1-block cube reads "new," a 2-block-plus-cap reads "maxed," independent of numerals |
| Is it Tier1 or Tier2? | Footprint size (1×1 vs 2×2), visible from the grid alone before even looking at the building |
| Is it under construction? | Reserved ghost-silhouette + scaffold + radial-ring state, never confused with any finished stage (§7 S2) |
| Is growth "better" than leisure here? | No — same grammar, same stage counts, same prop budget, same shading formula, enforced at the renderer level, not just the copy level (§4.2) |
| Does this stay true at 64 buildings? | Yes, because every answer above is a formula parameterized by `(category, tier, level)`, not a hand-placed decision per building (§3.1's procedural shading tool is the mechanism) |

---

## 9. Accessibility

| Area | Rule |
|---|---|
| Text contrast | All body/label text uses `text.primary` (8.0:1), `.secondary` (6.1:1), or a category `.ink` token (all pre-verified ≥4.8:1 in `00-design-system.md` §1-4) — raw `500` pastel hues are **never** used as text colour anywhere, carried as a hard rule |
| Touch targets | Every interactive element ≥44×44px hit box (padding, not necessarily visual size); primary buttons 48–56px tall; category tiles 96×96 well above floor |
| Colour-blind safety | Growth/leisure and success/warning/danger are never colour-only — always paired with an icon/shape (sprout vs crescent-moon, flame vs greyed flame) per source §9 principle, carried forward unchanged |
| Day/night readability | **HUD/text is on a Screen-Space-Overlay canvas excluded from Light2D (§2)** — contrast never degrades regardless of hour. World-layer category legibility is protected by the §5 buildings-layer brightness floor (0.5 minimum) so hue identification survives even deep night |
| Fixed-width numerals | Timer and receipt counters use per-digit cells (§1.2), preventing layout shift that could otherwise cause a moving-target tap-mis-hit on adjacent buttons |
| Reduced motion | Level-up pop, merge tween, and count-up all check a "reduce motion" system/app setting and fall back to a plain cross-fade — carried from source `00-design-system.md` §9 |
| Minimum text size | 12px floor, no exceptions, carried verbatim |

---

## 10. Art-order spec

**Per D6 (locked, in-house geometric for MVP): nothing in this document requires external commission.** The entire tile grammar (§3) is procedural/code-producible by construction — that is the point of the cohesion-first angle. Full inventory of what code produces:

| Item | Method | Count |
|---|---|---|
| Building blocks (all 7 categories × 3 Tier1 stages × 4 Tier2 stages) | `BuildingBlockKit` procedural formula (§3.1) — one script, N colour parameters | 7×(3+4) = 49 sprite states, zero hand-authored |
| Landmark (kept, D11) | Same tool, +1 block, unique flag | 1–2 |
| Ground tiles, decor primitives (tree/lamp/bench/fence), coquette deco (ribbon/lace/sticker/sparkle) | Code polygon/vector primitives, carried from `03-art-assets.md` §2 and `08-art-direction.md` §2-3/§4 | ~20 primitives |
| UI icon set (nav, action, state, currency) | SVG/vector, 24×24 grid, Outline + Filled Duotone per `00-design-system.md` §6 | ~35 (gem/shop icons dropped per §1.1 cut) |
| FX (level-up sparkle, merge burst, confetti) | Code particle/tween, `03-art-assets.md` §2-5 | 3 systems |

**Explicitly not needed for this build:** the 49-building external illustration order in the source `03-art-assets.md` §3-1 (51 pieces, the original's biggest single art-order line item) — **superseded by D6.** If the director later wants hand-illustrated buildings (character, texture, unique per-category flourishes), that is a P1/P2 future decision, not a gap in this proposal — the procedural grammar is designed so hand-art could later slot into the same 3-stage/4-stage/pivot/PPU contract without a re-plan.

**Genuinely open, director-level decisions this document does NOT make:**
1. **Mongsil's reappearance** (§7, S1) — locked identity says the mascot exists; the MVP scope (spec §3.2) cuts it from all 7 screens. I did not silently resolve this either way.
2. **Onboarding illustration richness** — currently spec'd as a code-drawn vignette reusing §3's grammar (zero budget); a P1 hand-illustrated onboarding hero (`03-art-assets.md` §3-5) remains a legitimate upgrade if budget allows, but is not assumed here.
3. **The Tier1/Tier2 Hobby-category `ink` hex** (§4.1) is computed, not pre-verified in source — needs a 10-minute contrast re-check, not a design decision, but flagged so it isn't silently shipped unverified.
4. **Deep-night buildings-layer brightness floor (§5)** — an implementation detail I resolved with a concrete number (0.5) but genuinely needs a device check before lock.

---

## 11. Self-critique (frontend-design process, applied inside the locked frame)

Checked against the "does this read as a template default" pass: cozy-pastel + coquette + Mongsil is the *fixed* frame here, so the risk isn't drifting into cream-serif or neon-dark — it's drifting into *decorative sameness*, where "cohesion" quietly becomes "no risk taken anywhere." The one deliberate risk in this proposal is procedural, not decorative: enforcing the shading/evolution grammar via a code tool (§3.1) rather than a style-guide PDF, and reconciling the PPU/cell-size mismatch (§2) instead of leaving it for client-dev to discover mid-build. Both are boring to describe and load-bearing in practice — which is the right trade for a system document, even though it means this proposal has no single "wow" screen. If the team wants that instead, it should be a different angle's proposal, scored against this one.
