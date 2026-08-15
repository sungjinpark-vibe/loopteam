// Colour-legibility audit for the town art (2026-08-15, `ui-ux-pro-max`).
//
// Reports what a screenshot cannot: the WCAG contrast ratio between every colour
// the art paints on a roof and every terrain colour it can stand next to, plus
// the fusion material ladder. `buildingArt.contrast.test.ts` asserts the
// invariants; this prints the whole table so a human can see WHY the keyline is
// there and what would change if the map were ever retuned.
//
// Not part of the build or the gate — it starts no process and kills none
// (shared machine, incident 2026-08-11):
//   node scripts/check-art-contrast.mjs [--json docs/qa/evidence-art-keyline/contrast.json]
//
// It reads the tokens out of the source rather than restating them: the roof
// colours come from buildingArt.tsx's own ARCHETYPES table, the terrain colours
// from App.css. A retune in either file shows up here on the next run.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { colors } from "@toss/tds-colors";

const jsonIdx = process.argv.indexOf("--json");
const JSON_OUT = jsonIdx > -1 ? process.argv[jsonIdx + 1] : null;

// ── the two sources of truth ────────────────────────────────────────────────

const art = readFileSync("src/components/buildingArt.tsx", "utf8");
const css = readFileSync("src/App.css", "utf8");

/** `hue: "orange"` + `roofTone: ROOF_DEEP` off each ARCHETYPES row. */
function parseArchetypes() {
  const block = art.slice(art.indexOf("const ARCHETYPES"), art.indexOf("export const MAX_VISUAL_LEVEL"));
  const tones = { ROOF_LIGHT: 400, ROOF_DEEP: 700, DEFAULT_ROOF_TONE: 500 };
  const out = [];
  for (const line of block.split("\n")) {
    const id = line.match(/^\s{2}(\w+):\s*\{/);
    const hue = line.match(/hue:\s*"(\w+)"/);
    if (!id || !hue) continue;
    const tone = line.match(/roofTone:\s*(\w+)/);
    out.push({ id: id[1], hue: hue[1], tone: tone ? tones[tone[1]] : tones.DEFAULT_ROOF_TONE });
  }
  return out;
}

function parseTerrain() {
  const wanted = ["--terrace-a", "--terrace-b", "--terrace-c", "--town-asphalt", "--town-grass", "--town-water"];
  return Object.fromEntries(
    wanted.map((name) => {
      const m = css.match(new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{6})`));
      if (!m) throw new Error(`${name} is gone from src/App.css — this audit is out of date`);
      return [name, m[1]];
    }),
  );
}

function parseColorList(constName) {
  const m = art.match(new RegExp(`${constName}:\\s*readonly string\\[\\]\\s*=\\s*\\[([^\\]]+)\\]`));
  if (!m) throw new Error(`${constName} not found in buildingArt.tsx`);
  return m[1].split(",").map((t) => colors[t.trim().replace("colors.", "")]);
}

function parseKeyline() {
  const m = art.match(/const EDGE = colors\.(\w+);/);
  if (!m) throw new Error("EDGE not found in buildingArt.tsx");
  return colors[m[1]];
}

// ── contrast ───────────────────────────────────────────────────────────────

const shade = (hue, n) => colors[`${hue}${Math.min(900, Math.max(100, Math.round(n / 100) * 100))}`];

function luminance(hex) {
  const [r, g, b] = hex
    .replace("#", "")
    .match(/../g)
    .map((h) => {
      const v = parseInt(h, 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const cr = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)];
  return +(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2));
};

// ── the report ─────────────────────────────────────────────────────────────

const archetypes = parseArchetypes();
const terrain = parseTerrain();
const EDGE = parseKeyline();
const TRIM = parseColorList("FUSE_TRIM");
const RIDGE = parseColorList("FUSE_RIDGE");

/** The threshold below which two flat fills stop reading as separate surfaces. */
const SEPARATION_FLOOR = 1.5;

const roofRows = archetypes.map(({ id, hue, tone }) => {
  const top = shade(hue, tone);
  const worst = Object.entries(terrain)
    .map(([name, hex]) => [name, cr(top, hex)])
    .reduce((a, b) => (a[1] < b[1] ? a : b));
  return { category: id, roofTop: top, worstTerrain: worst[0], worstRatio: worst[1], needsKeyline: worst[1] < SEPARATION_FLOOR };
});

const keylineRows = Object.entries(terrain).map(([name, hex]) => ({ terrain: name, hex, keylineRatio: cr(EDGE, hex) }));

const roofPlanes = new Map();
for (const { id, hue, tone } of archetypes) {
  for (const [plane, n] of [
    ["top", tone],
    ["roofLite", tone - 100],
    ["roofMid", tone],
    ["roofDark", tone + 200],
  ]) {
    const hex = shade(hue, n);
    roofPlanes.set(hex, [...(roofPlanes.get(hex) ?? []), `${id}.${plane}`]);
  }
}

const TIERS = ["bronze", "silver", "gold", "platinum", "jewel"];
const fuseRows = TRIM.map((trim, i) => ({
  tier: i + 1,
  material: TIERS[i],
  trim,
  ridge: RIDGE[i],
  trimCollidesWith: roofPlanes.get(trim) ?? [],
  ridgeCollidesWith: roofPlanes.get(RIDGE[i]) ?? [],
}));

const report = {
  generatedAt: new Date().toISOString().slice(0, 10),
  keyline: { color: EDGE, minRatioAgainstTerrain: Math.min(...keylineRows.map((r) => r.keylineRatio)) },
  terrain,
  keylineVsTerrain: keylineRows,
  roofVsTerrain: roofRows,
  fuseLadder: fuseRows,
  verdict: {
    roofsThatWouldVanishWithoutTheKeyline: roofRows.filter((r) => r.needsKeyline).map((r) => r.category),
    fuseStepsInvisibleOnSomeCategory: fuseRows.filter((r) => r.trimCollidesWith.length || r.ridgeCollidesWith.length).map((r) => r.material),
  },
};

const pad = (s, n) => String(s).padEnd(n);
console.log(`\nkeyline ${EDGE} — worst ratio against any terrain surface: ${report.keyline.minRatioAgainstTerrain}`);
for (const r of keylineRows) console.log(`  ${pad(r.terrain, 16)} ${r.hex}  ${r.keylineRatio}`);

console.log(`\nroof fill vs the terrain it touches (below ${SEPARATION_FLOOR} = the two fills stop reading as separate):`);
for (const r of roofRows) {
  console.log(`  ${pad(r.category, 14)} ${r.roofTop}  ${pad(r.worstRatio, 6)} vs ${pad(r.worstTerrain, 16)} ${r.needsKeyline ? "NEEDS KEYLINE" : ""}`);
}

console.log("\nfusion material ladder — a step equal to the roof it sits on is invisible:");
for (const r of fuseRows) {
  const bad = [...r.trimCollidesWith, ...r.ridgeCollidesWith];
  console.log(`  ${r.tier} ${pad(r.material, 9)} trim ${r.trim} ridge ${r.ridge}  ${bad.length ? "COLLIDES: " + bad.join(", ") : "ok"}`);
}

const collisions = report.verdict.fuseStepsInvisibleOnSomeCategory;
console.log(
  `\n${report.verdict.roofsThatWouldVanishWithoutTheKeyline.length}/${roofRows.length} roofs rely on the keyline to separate from the ground.`,
);
console.log(collisions.length ? `FAIL: fusion steps invisible on some category: ${collisions.join(", ")}` : "OK: every fusion step is visible on every category.");

if (JSON_OUT) {
  mkdirSync(dirname(JSON_OUT), { recursive: true });
  writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));
  console.log(`\nwrote ${JSON_OUT}`);
}

process.exit(collisions.length ? 1 : 0);
