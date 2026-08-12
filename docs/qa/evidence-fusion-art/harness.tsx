/* eslint-disable react-refresh/only-export-components -- QA-only harness, never hot-reloaded as part of the app */
/**
 * QA-only render harness for ADDENDUM-11 §4 (Lv.6-10 fusion art) — NOT part of
 * the shipped app, not imported by main.tsx/App.tsx, not wired into any route.
 *
 * Why this exists: the fusion MODEL (types.ts `fuse` field, useTownStore
 * fusion action) is being implemented concurrently in another workstream and
 * had not landed a `fuse`-tagged fixture at the time this evidence was
 * captured, so there was no way to reach a real Lv.6-10 building by playing
 * the app. Per the task brief this is the documented fallback: render
 * `BuildingArt` directly with `level`/`fuseTier` and measure/screenshot that,
 * rather than block on the model landing.
 *
 * Every tile below is real production code — `BuildingArt` imported straight
 * from `src/components/buildingArt.tsx`, using the SAME `townLayout.ts`
 * pixel constants the real grid uses — this file only supplies the props a
 * real fused Building would eventually carry (`level`, `fuseTier`) and a
 * tile-sized wrapper div to measure fill against, exactly like
 * `scripts/evidence-art-fill.mjs` measures real `.building-tile` elements.
 */
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BuildingArt, MAX_FUSE_TIER, MAX_VISUAL_LEVEL } from "../../../src/components/buildingArt";
import { GRID_GAP_PX, MIN_TILE_WIDTH_PX, TILE_HEIGHT_PX } from "../../../src/townLayout";
import type { BuildingCategoryId } from "../../../src/types";

// Fill % is a ratio of drawn-geometry-bbox / tile-box — scale-invariant, so
// this SAME grid doubles as the "readable zoom" screenshot set (see the
// artBox comment in buildingArt.tsx for why ART_UNIT keeps this true).
const SCALE = 6;

function tilePx(w: number, h: number) {
  return {
    w: w * MIN_TILE_WIDTH_PX + (w - 1) * GRID_GAP_PX,
    h: h * TILE_HEIGHT_PX + (h - 1) * GRID_GAP_PX,
  };
}

function totalLevelToArgs(totalLevel: number): { level: number; fuseTier: number } {
  const fuseTier = Math.max(0, Math.min(MAX_FUSE_TIER, totalLevel - MAX_VISUAL_LEVEL));
  return { level: totalLevel, fuseTier }; // level self-caps via floorsFor; fuseTier is the separate channel
}

function Tile({
  categoryId,
  variantIndex,
  totalLevel,
  w,
  h,
  label,
}: {
  categoryId: BuildingCategoryId;
  variantIndex: number;
  totalLevel: number;
  w: 1 | 2;
  h: 1 | 2;
  label: string;
}) {
  const { level, fuseTier } = totalLevelToArgs(totalLevel);
  const { w: pw, h: ph } = tilePx(w, h);
  return (
    <div style={{ display: "inline-block", textAlign: "center", margin: 10, verticalAlign: "top" }}>
      <div
        data-tile="1"
        data-total-level={totalLevel}
        data-fuse-tier={fuseTier}
        data-footprint={`${w}x${h}`}
        data-category={categoryId}
        style={{
          width: pw * SCALE,
          height: ph * SCALE,
          background: "#e2e6ed",
          outline: "1px solid #c7ccd6",
          position: "relative",
        }}
      >
        <BuildingArt categoryId={categoryId} variantIndex={variantIndex} level={level} fuseTier={fuseTier} w={w} h={h} />
      </div>
      <div style={{ fontSize: 12, marginTop: 4, color: "#333" }}>{label}</div>
    </div>
  );
}

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section data-row="1" style={{ padding: "16px 12px", borderBottom: "1px solid #ddd" }}>
      <h2 style={{ font: "600 14px sans-serif", margin: "0 0 8px" }}>{title}</h2>
      <div>{children}</div>
    </section>
  );
}

const LEVELS_1_TO_10 = Array.from({ length: 10 }, (_, i) => i + 1);
const FOOTPRINTS: Array<[1 | 2, 1 | 2]> = [
  [1, 1],
  [2, 1],
  [1, 2],
  [2, 2],
];

function App() {
  return (
    <div>
      <Row title="A — cafe (pyramid roof), 1x1, Lv.1 through Lv.10 (fuseTier 0 -> 5 at Lv.6+)">
        {LEVELS_1_TO_10.map((lv) => (
          <Tile key={lv} categoryId="cafe" variantIndex={0} totalLevel={lv} w={1} h={1} label={`Lv.${lv}`} />
        ))}
      </Row>
      <Row title="B — health (flat roof), 1x1, Lv.1 through Lv.10 (fuseTier 0 -> 5 at Lv.6+)">
        {LEVELS_1_TO_10.map((lv) => (
          <Tile key={lv} categoryId="health" variantIndex={0} totalLevel={lv} w={1} h={1} label={`Lv.${lv}`} />
        ))}
      </Row>
      <Row title="C — food, Lv.5 (fuseTier 0) at all 4 footprints — pre-fusion baseline for A/B">
        {FOOTPRINTS.map(([w, h]) => (
          <Tile key={`${w}x${h}`} categoryId="food" variantIndex={0} totalLevel={5} w={w} h={h} label={`${w}x${h} Lv.5`} />
        ))}
      </Row>
      <Row title="D — food, Lv.10 (fuseTier 5) at all 4 footprints — the ceiling case for the fill invariant">
        {FOOTPRINTS.map(([w, h]) => (
          <Tile key={`${w}x${h}`} categoryId="food" variantIndex={0} totalLevel={10} w={w} h={h} label={`${w}x${h} Lv.10`} />
        ))}
      </Row>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
// signal for the capture script — everything above is synchronous, but this
// keeps the "ready" contract explicit and greppable rather than a fixed sleep.
(window as unknown as { __fusionEvidenceReady?: boolean }).__fusionEvidenceReady = true;
