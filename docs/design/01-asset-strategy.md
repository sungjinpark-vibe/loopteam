
# Decision Document — Village Building Asset Strategy (pre-T007)
**Author:** ui-ux · **Date:** 2026-07-16 · **Decides:** how T007 sources the 7×tier building geometry for the real Unity village screen · **Does not decide:** T007's scene wiring, which is implementation

## 0. The bar, restated

T005 stalled at 76/90 in HTML because colored div rectangles do not read as buildings. Whatever wins here must, at minimum viable art fidelity, give a player scanning the 8×8 grid a building silhouette with a **roof, a wall, and an opening** — not a tinted box — and it must slot into T004's already-locked system without a re-litigation: isometric grid (`Cell Size (1,0.5,1)`, PPU 128 ground / 100 buildings), 7 fixed category hexes, the `top+60%white / front+25%white / side+0%` shading formula, and the cube→+block→+roof-cap tier-evolution grammar (T004 §3.1–§3.3).

Three real options were evaluated. All three were checked against real URLs and real license terms — none of the following is asserted without a source.

---

## 1. Option A — Unity Asset Store isometric building packs

**What actually exists, verified:**
- [Isometric Buildings Pack](https://assetstore.unity.com/packages/3d/environments/urban/isometric-buildings-pack-122505) — ITPoint pro, **$10**, Standard Unity Asset Store EULA, "Single Entity" license, 3D, no building-count/type breakdown published on the page.
- [Isometric City Pack](https://assetstore.unity.com/packages/2d/environments/isometric-city-pack-197912) — **$15**, Standard Unity Asset Store EULA, Cartoon-style 2D isometric tileset.
- Several other paid packs surfaced (Complete Isometric City Builder Megapack, 2D Isometric City theme Pack, etc.) — all paid, all Standard EULA.
- **I could not confirm a genuinely free, commercial-safe Unity Asset Store isometric *building* pack with real content specifics.** Search results gestured at "free options exist" but every concrete pack I opened and verified was paid ($10–$15). I am not recommending anything I couldn't confirm — flagging this gap honestly per the task's non-negotiable rather than asserting a free pack exists.

**License:** Standard Unity Asset Store EULA is commercial-safe (it's Unity's own store policy — ships in shipped commercial games routinely), but is a **Single Entity license**, i.e., scoped to one project/publisher, not redistributable — fine for LifeTown as a single product, not a blocker.

**Fit to T004:** Generic cartoon/low-poly commercial aesthetic — not our pastel `#FF9EC4`/`#B6A0EF` palette, no 7-category color system, no tier/construction-ring states, no coquette (ribbon/lace/sticker) motif. Recoloring pre-baked textured meshes to hit our exact `500`/`tint`/`ink` triad per category is nontrivial — most of these packs bake lighting/AO into diffuse textures, so a flat category-hex recolor either looks wrong (fighting baked shadows) or requires re-texturing from scratch, which is most of the labor of custom-building anyway, plus $10-15 and an EULA to track.

**Readability:** Genuinely good — this is the category's actual selling point, real roof/window/door geometry, so it clears T005's bar out of the box.

**Integration effort:** Medium-low to import; medium-high to actually match identity (re-texture/re-light every building to the shading formula, strip mismatched roof/signage styles, likely mix-and-match from multiple $10-15 packs since no single one covers 7 clean archetypes) — effort saved on modeling is partly spent on reconciliation.

**Verdict: rejected.** No free option confirmed; the paid options that exist don't fit identity closely enough to justify the reconciliation cost, and the reconciliation cost is comparable to just building it right the first time.

---

## 2. Option B — free/open asset packs (itch.io / Kenney / GitHub)

**What actually exists, verified:**
- [KayKit: City Builder Bits](https://kaylousberg.itch.io/city-builder-bits) by Kay Lousberg — **confirmed free, CC0** ("Free for personal and commercial use, no attribution required"; creator asks only that you not resell unmodified). 32+ low-poly 3D models: buildings, roads, cars, street elements. OBJ/FBX/GLTF, Unity-compatible. Paid tiers ($3.95/$5.95) add extra props and source files but the base pack is genuinely free and commercially usable.
- [Kenney — Isometric City](https://kenney.nl/assets/isometric-city) and the sibling [Isometric Tiles Buildings](https://kenney.nl/assets/isometric-tiles-buildings) — Kenney's entire catalog is famously **CC0/public-domain**, corroborated independently via search results (itch.io mirror at kenney-assets.itch.io, and an [OpenGameArt.org mirror](https://opengameart.org/content/isometric-city)) listing ~128 assets each, free, commercial-safe. **Caveat, stated honestly:** my direct fetch of kenney.nl and the itch.io mirror both returned HTTP 404 (likely bot-blocked, not necessarily absent) — I'm relying on corroborating search-result listings and Kenney's well-established, long-standing CC0-everything policy rather than a page I personally rendered. Treat as high-confidence, not fetch-verified.

**License:** Both genuinely CC0 — the cleanest possible license, zero risk, no attribution needed. This is the one place Option B outright beats Option A on paperwork.

**Fit to T004:** Same core problem as Option A — KayKit is a cute chunky "toy" low-poly cartoon style, Kenney's isometric sets are flat-shaded blocky primitives; neither is pastel-pink-coquette, neither ships 7-category color coding, tier stages, or a construction-ring convention, and **combining two different free kits** (to get more type variety) means combining two different hand-authored art styles in one village — a "kit soup" cohesion problem T004 §0 explicitly names as this app's specific past failure mode (two independent redesign-drift incidents already happened before T004 locked the grammar). Re-skinning either kit to our exact shading formula means overriding materials on someone else's mesh topology, fighting whatever LOD/pivot conventions the original artist chose.

**Readability:** Good — same strength as Option A, real geometry, clears T005's bar.

**Integration effort:** Lowest raw effort to get *something* on screen fast (download, drop in, done in under a day) — but re-skinning to identity, and reconciling category-count (do either pack even have 7 clean distinct silhouette-different structures, or will 2 categories end up sharing a look?) is unverified and likely requires picking-and-choosing pieces across packs, which reintroduces the "kit soup" risk above.

**Verdict: rejected for this app, but the technically strongest of the two commissioned-elsewhere options** — CC0 is bulletproof and KayKit's low-poly-toy style is not far from cozy. If speed-to-playable were the priority over identity, this is where I'd send the team. It isn't the priority here; T004 was scored 92/90 specifically for locking a grammar that cannot drift, and importing someone else's art style is definitionally a drift risk the moment a 65th building or a landmark needs to match.

---

## 3. Option C — art team builds it directly in Unity (RECOMMENDED)

### The approach
Build buildings as **real 3D low-poly geometry with [ProBuilder](https://docs.unity3d.com/6000.4/Documentation/Manual/com.unity.probuilder.html)**, Unity's own official modeling package.

**License, verified:** ProBuilder is distributed by Unity Technologies via the Package Manager, under the **Unity Companion License** ([source LICENSE.md](https://github.com/Unity-Technologies/com.unity.probuilder/blob/master/LICENSE.md), [official docs](https://docs.unity3d.com/Packages/com.unity.probuilder@4.3/license/LICENSE.html)) — free, no separate purchase, unrestricted commercial use as a Unity-dependent package. This is not a third-party asset with a license to track at all; it's part of the engine LifeTown already runs on. Zero license risk, by construction — nothing to verify going forward because nothing is a dependency on someone else's IP.

**Why 3D meshes instead of extending T004's 2D procedural sprite grammar (§3.1) literally:** T004 designed a 2D `Tilemap` isometric world with painted-sprite buildings (PPU 100, fixed canvas sizes). That grammar is sound for *color/tier logic* but its actual silhouette vocabulary (flat rectangle + smaller rectangle + a triangle "roof cap") is exactly the kind of geometry that reads as blocks when rendered as flat 2D sprites without a trained pixel artist's shading skill — which is the T005 failure mode, and the team doesn't have a pixel artist. Real 3D geometry gets genuine roof pitch, wall recesses, window/door notches "for free" from actual mesh topology + our orthographic isometric camera + real directional shadowing, which is much more achievable by a non-specialist using ProBuilder's extrude/bevel/boolean tools than convincingly hand-painting the same illusion in 2D. **This is a small, additive delta to T004, not a re-plan:** the ground layer stays exactly as spec'd (2D Isometric Tilemap, PPU 128), only the *building* layer becomes 3D meshes sorted into the same `Buildings` sorting layer, under the same Global Light 2D / brightness-floor rule (T004 §5), with the shading formula reapplied as real face materials instead of painted pixel regions.

### Concrete plan
1. **Design the archetype set before building anything** (this is the T005 mitigation, not optional): assign each of the 7 categories a distinct **roof/silhouette archetype**, not just a color swap —
   - 독서 Reading → gentle gable roof, small arched window
   - 공부 Study → flat roof + skylight box, square window grid
   - 일 Work → slightly angled shed roof, single wide window (desk-lamp read)
   - 운동 Exercise → low box + open garage-style front notch
   - 취미창작 Hobby → asymmetric roof with a small dormer, round window
   - 마음챙김 Mind → domed/rounded roof cap, no hard corners
   - 게임 Game → flat roof + small antenna/aerial prop, striped awning-shape trim
   
   Every archetype still obeys T004's tier grammar (S1 base cube, S2 +upper block, S3 +roof cap/spire; Tier2 scaled ×1.6 + more blocks) — the archetype changes roof/opening *shape*, never the block-count logic, so the "reads at a glance" leveling rule (T004 §3.4) still holds.
2. **Build a small modular kit, not 49 bespoke models**: wall-block primitive, 5–7 roof-shape primitives (the archetypes above), a window/door inset primitive (boolean-cut or offset-plane), one signage-plate primitive, one prop primitive (flag/lantern/antenna, recolor-only per T004 §3.2 stage-3 rule) — compose per-category buildings from these pieces via prefab variants, not 49 unique sculpts.
3. **Materials = the T004 shading formula, applied per-face**, not painted: top face material = category `500`+60% white, front face = `500`+25% white, side face = pure `500` — flat/unlit or simple-lit materials, trivial to parameterize per category via a `MaterialPropertyBlock` (the 3D equivalent of the `BuildingBlockKit` procedural tool T004 §3.1 already specifies — same idea, now driving mesh materials instead of sprite pixels).
4. **Camera**: orthographic, isometric angle matching the existing Tilemap's `(0,1,-0.26)` custom sort axis, so 3D buildings sit visually flush with the 2D ground grid — a well-established "2.5D" pattern (flat ground + 3D props), low risk.
5. **QA gate before calling this done**: render all 7 categories at Tier1-S1/S2/S3 and Tier2-S1..S4 at isometric-thumbnail scale (matching how they'll actually appear on an 8×8 grid) and check — can each category be told apart from silhouette alone, with color hidden? This is the literal T005 regression test, run inside Unity instead of discovered in a mockup review.

### Effort estimate (honest, not optimistic)
| Phase | Estimate |
|---|---|
| ProBuilder setup + archetype design pass (design the 7 roof/silhouette shapes on paper/screenshot before touching geometry) | 1 day |
| Modular kit build (wall block, 5–7 roof shapes, window/door insets, signage plate, prop primitive) | 3–4 days |
| Per-category × per-tier-stage assembly from kit pieces (7 × (3+4) = 49 states, composed not sculpted) | 2–3 days |
| Integration: orthographic camera alignment, sorting layers, construction-ring/ghost state, day-night material response | 2 days |
| Readability QA pass (the T005 regression check above) + one revision round | 1 day |
| **Total** | **~9–11 working days** (1.5–2 weeks), single art-capable dev/artist |

Compare: Option A/B "integration effort" is lower on paper (hours to import) but was assessed above as **not actually low** once re-texturing to hit exact category hexes + reconciling mixed kit styles is counted — likely converges toward a similar order of magnitude, just spent fighting someone else's mesh/material conventions instead of building to spec directly.

### Risks (stated plainly)
- **Repeat-T005 risk is real and specific to this option**: if the archetype-design step (plan item 1) is skipped or rushed, this collapses back into "cube + tinted roof cap" and fails the exact bar T005 failed on — this is why the plan puts archetype design as a distinct, gated first step rather than folding it into general modeling.
- **Needs an art-capable hand**, not just an engineer — ProBuilder is approachable but still modeling; if client-dev alone executes this without design review, quality risk goes up. Recommend ui-ux stays involved through the archetype-design and QA-gate steps even though execution is a build task.
- **Slowest to first-playable** of the three options — ~2 weeks vs. hours/days for a pack import. If the director's priority shifts to "anything on screen fast," this is the wrong call and Option B (KayKit, CC0) is the fallback.
- **No safety net of "someone else already solved variety"** — all 7 archetypes have to actually be distinct and actually read, which is a design judgment call, not a checkbox.

---

## 4. IP boundary check (Fortune City)

Fortune City is cited only for **approach**: it proves that clean, exaggerated archetypal shapes (a bakery reading unmistakably as a bakery from its roof/awning silhouette alone) are what makes an isometric building-collection game legible at a glance, even with limited detail budget. **Nothing in Option C's plan touches Fortune City's actual assets, textures, specific building designs, or color language** — the 7 archetypes above (gable/flat-skylight/shed/garage-notch/dormer/dome/awning-antenna) were derived from our own 7 categories (reading/study/work/exercise/hobby/mind/game), not from any FC building list, and every material is our own locked palette (`#FF9EC4`/`#B6A0EF`/etc., T004 §1.1/§4.1), not FC's. **This proposal does not cross the IP line** — it treats FC the way the brief asks: readability-approach inspiration, not asset or style reference. Options A and B carry no FC IP risk either (they're unrelated third-party asset packs), so this isn't a differentiator between options — it's a constraint all three already satisfy.

---

## 5. Recommendation

**Recommend Option C — custom-build in Unity via ProBuilder, per the plan in §3 — for T007.**

**This does NOT reverse D6.** D6 already says "in-house geometric for MVP" — Option C is D6 executed properly in the actual engine, with the concrete archetype-variety fix T005 proved was missing. The only technical delta from T004's literal text is 2D-sprite-buildings → 3D-mesh-buildings on the same 2D tilemap ground (§3, "Why 3D meshes" above) — small enough to fold into T007 as an implementation note, not something that needs the director to re-approve D6 itself.

**Flag for the director, explicitly:** had this document instead recommended Option A or B (an external asset pack), **that would have reversed D6** and required your sign-off before T007 could commit to it — noting this per the task's instruction, even though it's not the path I'm recommending, so the boundary is visible either way.

### Next steps for T007
1. Adopt the plan in §3 as T007's building-asset task: archetype design (1 day, ui-ux-reviewed) → modular kit (3–4 days) → per-category assembly (2–3 days) → integration (2 days) → readability QA gate (1 day).
2. Keep T004's ground-layer Tilemap spec (§2) unchanged; only note the buildings-layer delta (3D mesh + orthographic camera alignment) in T007's implementation notes.
3. Run the T005-regression readability check (§3, step 5) as an explicit acceptance criterion before T007 is scored — this is the concrete, checkable version of "must beat colored cubes."
4. If timeline pressure makes ~2 weeks unacceptable, the documented fallback is Option B specifically (KayKit City Builder Bits, CC0, kaylousberg.itch.io) — not Option A — but that is a distinct director decision to reverse D6, not a default to fall into silently.
