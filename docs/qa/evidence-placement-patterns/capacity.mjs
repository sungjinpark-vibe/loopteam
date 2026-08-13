// Capacity arithmetic for the three anti-occlusion placement options.
// Pure re-implementation of townLayout/placement geometry (no import of src/,
// so this runs standalone under plain node). Verified against the shipped
// constants: GRID_SIZE 20, ground census 193, footprint weights 60/15/15/10,
// downgrade chain 2x2 -> 2x1 -> 1x2 -> 1x1.
//
// Usage: node capacity.mjs
const MAP = [
  "    PPP......PPP    ",
  "  .....SSSSS.....   ",
  " ################## ",
  " ...#........#...PP ",
  " ...#........#..PPP ",
  "  ..#........#....P ",
  "  ..#........#..... ",
  "  ################# ",
  " ...#..LLLL..#..... ",
  " ...#.LLLLL..#..... ",
  " ...#..LLL...#..... ",
  " ...#........#..... ",
  " ################## ",
  " ...#PPP.....#..... ",
  " ...#PPPP....#..... ",
  " ...#PPP.....#....P ",
  "  ..#........#....  ",
  "  ################  ",
  "   ...PPP........   ",
  "     PPP.......     ",
];
const N = 20;
const ground = (r, c) => r >= 0 && r < N && c >= 0 && c < N && MAP[r][c] === ".";
const idx = (r, c) => r * N + c;
const cell = (i) => ({ r: (i / N) | 0, c: i % N });

let groundCount = 0;
for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (ground(r, c)) groundCount++;

// ── the four options as a cell-level buildability mask + a placement predicate ──
export const OPTIONS = {
  current: { mask: () => true, extra: () => true },
  // H — only every other ROW is buildable. Both parities reported; the better one is used.
  H0: { mask: (r) => r % 2 === 0, extra: () => true },
  H1: { mask: (r) => r % 2 === 1, extra: () => true },
  // X — checkerboard.
  X0: { mask: (r, c) => (r + c) % 2 === 0, extra: () => true },
  X1: { mask: (r, c) => (r + c) % 2 === 1, extra: () => true },
  // R — every ground cell buildable, but no building may be vertically adjacent
  // to another in a shared column. SYMMETRIC: check the row above the top edge
  // AND the row below the bottom edge, otherwise a later building seated ABOVE
  // an earlier one slips through (the one-sided rule is not sufficient).
  R: {
    mask: () => true,
    extra: (r, c, w, h, occ) => {
      for (let dx = 0; dx < w; dx++) {
        if (occ.has(idx(r - 1, c + dx))) return false;
        if (occ.has(idx(r + h, c + dx))) return false;
      }
      return true;
    },
  },
};

/**
 * RX-1 — R's vertical rule PLUS X's horizontal rhythm: at most `limit`
 * BUILDINGS may sit shoulder-to-shoulder in one row before an empty cell is
 * forced. Counted in buildings, not cells, so a 2x1 is one building occupying
 * two cells and never trips its own limit — that is what keeps every footprint
 * placeable at limit=1 (a cell-based run cap would eliminate 2x1 and 2x2 on the
 * spot). `occ` maps cell -> owning building seq, which is why occupancy is a Map.
 */
const rx1 = (limit) => ({
  mask: () => true,
  extra: (r, c, w, h, occ) => {
    if (!OPTIONS.R.extra(r, c, w, h, occ)) return false;
    for (let dy = 0; dy < h; dy++) {
      const row = r + dy;
      const ids = new Set();
      for (let cc = c - 1; cc >= 0 && occ.has(idx(row, cc)); cc--) ids.add(occ.get(idx(row, cc)));
      for (let cc = c + w; cc < N && occ.has(idx(row, cc)); cc++) ids.add(occ.get(idx(row, cc)));
      if (ids.size + 1 > limit) return false;
    }
    return true;
  },
});
OPTIONS["RX1-N1"] = rx1(1);
OPTIONS["RX1-N2"] = rx1(2);
OPTIONS["RX1-N3"] = rx1(3);

/**
 * RX-2 — X's checkerboard mask for 1x1 only; multi-cell footprints are exempt
 * from the mask (they could not exist under it) but still obey R. The exemption
 * rate is reported: an exception that fires on a quarter of all buildings is
 * noise, not a rhythm.
 */
OPTIONS["RX2"] = {
  mask: () => true,
  maskFor: (r, c, w, h) => (w === 1 && h === 1 ? (r + c) % 2 === 1 : true),
  extra: (r, c, w, h, occ) => OPTIONS.R.extra(r, c, w, h, occ),
};

function fits(opt, anchor, w, h, occ) {
  const { r, c } = cell(anchor);
  if (opt.maskFor && !opt.maskFor(r, c, w, h)) return false;
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++) {
      if (!ground(r + dy, c + dx)) return false;
      if (!opt.mask(r + dy, c + dx)) return false;
      if (occ.has(idx(r + dy, c + dx))) return false;
    }
  return opt.extra(r, c, w, h, occ);
}

/** `occ` is a cell -> building-seq Map (RX-1 needs to tell neighbours apart). */
function claim(occ, anchor, w, h, seq) {
  const { r, c } = cell(anchor);
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) occ.set(idx(r + dy, c + dx), seq);
}

function anchorsFor(opt, w, h, occ) {
  const out = [];
  for (let i = 0; i < N * N; i++) if (fits(opt, i, w, h, occ)) out.push(i);
  return out;
}

// mulberry32 — same family as the app's seeded rng; only used to average runs.
function rngFrom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const roll = (rng) => {
  const r = rng();
  if (r < 0.6) return { w: 1, h: 1 };
  if (r < 0.75) return { w: 1, h: 2 };
  if (r < 0.9) return { w: 2, h: 1 };
  return { w: 2, h: 2 };
};
const chain = (s) =>
  s.w === 2 && s.h === 2
    ? [{ w: 2, h: 2 }, { w: 2, h: 1 }, { w: 1, h: 2 }, { w: 1, h: 1 }]
    : s.w === 1 && s.h === 1
      ? [{ w: 1, h: 1 }]
      : [s, { w: 1, h: 1 }];

/** Fill the town the way the real game does: roll, downgrade, seat at random. */
export function fillTown(optName, seed) {
  const opt = OPTIONS[optName];
  const rng = rngFrom(seed);
  const occ = new Map();
  const placed = [];
  const mix = { "1x1": 0, "1x2": 0, "2x1": 0, "2x2": 0 };
  for (;;) {
    let done = null;
    for (const s of chain(roll(rng))) {
      const a = anchorsFor(opt, s.w, s.h, occ);
      if (a.length) {
        done = { anchor: a[Math.floor(Math.min(rng(), 0.999999) * a.length)], ...s };
        break;
      }
    }
    if (!done) break;
    claim(occ, done.anchor, done.w, done.h, placed.length);
    placed.push(done);
    mix[`${done.w}x${done.h}`]++;
  }
  return { buildings: placed.length, cellsUsed: occ.size, mix, placed };
}

/** Max count of ONE footprint type, first-fit greedy in reading order. */
function maxOf(optName, w, h) {
  const opt = OPTIONS[optName];
  const occ = new Map();
  let n = 0;
  for (let i = 0; i < N * N; i++) {
    if (!fits(opt, i, w, h, occ)) continue;
    claim(occ, i, w, h, n);
    n++;
  }
  return n;
}

/**
 * What a version-bump relayout does to an EXISTING full town.
 * Mirrors `reconcilePlacement(..., {forceReseat:true})`: oldest first, first
 * legal anchor in reading order, shrink to 1x1 if the footprint has no anchor
 * anywhere, park at -1 (invisible, queued) if even 1x1 has none.
 */
function relayout(optName, footprints) {
  const opt = OPTIONS[optName];
  const occ = new Map();
  let seated = 0, shrunk = 0, unplaced = 0;
  for (const f of footprints) {
    let anchor = null, w = f.w, h = f.h;
    for (let i = 0; i < N * N && anchor === null; i++) if (fits(opt, i, w, h, occ)) anchor = i;
    if (anchor === null && (w > 1 || h > 1)) {
      for (let i = 0; i < N * N && anchor === null; i++) if (fits(opt, i, 1, 1, occ)) anchor = i;
      if (anchor !== null) { w = 1; h = 1; shrunk++; }
    }
    if (anchor === null) { unplaced++; continue; }
    claim(occ, anchor, w, h, seated);
    seated++;
  }
  return { total: footprints.length, seated, shrunk, unplacedInvisible: unplaced };
}
/**
 * Gate 2 — independent proof of zero front/back overlap. Re-derives occupancy
 * from the finished layout (not from the rule that built it) and counts every
 * pair where one building's cell sits directly above another's in the same
 * column. Must be 0 for any candidate that claims to fix the occlusion.
 */
function overlapPairs(placed) {
  const owner = new Map();
  placed.forEach((p, i) => claim(owner, p.anchor, p.w, p.h, i));
  let pairs = 0;
  for (const [i, seq] of owner) {
    const above = owner.get(i - N);
    if (above !== undefined && above !== seq) pairs++;
  }
  return pairs;
}

// The existing save to migrate: a real current-rules full town.
const existingTown = fillTown("current", 977).placed;

// Only print when run directly — capture.mjs imports fillTown/OPTIONS from here.
const RUN_DIRECT = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("capacity.mjs");
if (!RUN_DIRECT) {
  // nothing else to do on import
} else {
const report = { groundCells: groundCount, existingTownSize: existingTown.length, options: {} };
for (const name of Object.keys(OPTIONS)) {
  const opt = OPTIONS[name];
  let buildable = 0;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (ground(r, c) && opt.mask(r, c)) buildable++;
  const runs = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => fillTown(name, s * 977));
  const avg = (f) => +(runs.reduce((a, x) => a + f(x), 0) / runs.length).toFixed(1);
  report.options[name] = {
    buildableCells: buildable,
    maxSingleFootprint: { "1x1": maxOf(name, 1, 1), "2x1": maxOf(name, 2, 1), "1x2": maxOf(name, 1, 2), "2x2": maxOf(name, 2, 2) },
    fullTown: {
      buildings: avg((x) => x.buildings),
      cellsUsed: avg((x) => x.cellsUsed),
      pctOf193: +((avg((x) => x.cellsUsed) / groundCount) * 100).toFixed(1),
      mix: Object.fromEntries(["1x1", "1x2", "2x1", "2x2"].map((k) => [k, avg((x) => x.mix[k])])),
    },
    overlapPairs: Math.max(...runs.map((x) => overlapPairs(x.placed))), // gate 2 — must be 0
    relayoutOfExistingTown: relayout(name, existingTown),
    // townScale ceiling = concurrent buildings x 2^MAX_FUSE_TIER (32). Tier 4 needs 200.
    townScaleCeiling: Math.round(avg((x) => x.buildings)) * 32,
    fusionsNeededForScale200: Math.max(0, 200 - Math.round(avg((x) => x.buildings))),
  };
}
console.log(JSON.stringify(report, null, 2));
}
