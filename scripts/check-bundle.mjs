#!/usr/bin/env node
/**
 * Gate check (MVP-SPEC §11): asserts `src/devtools/**` never reaches a
 * production bundle. Run as `npm run gate:extra` (see `gate/gate-node.ps1`
 * in the engine repo — "gate-relevant, not advisory").
 *
 * Greps every `dist/**\/*.js` file for `DEVTOOLS_FIXTURES_BUNDLE_MARKER`
 * (`src/devtools/fixtures.ts`) — a string that exists nowhere else in the
 * codebase. Finding it in the bundle means the fixtures module (and its
 * dense-fixture generator) leaked into production, not just that
 * `import.meta.env.DEV` tree-shaking happened to work this time.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST_DIR = "dist";
/**
 * Each entry is a string that must NEVER appear in a production bundle.
 * - the fixtures marker: `src/devtools/fixtures.ts` leaking (see header).
 * - the time-travel key: ADDENDUM-11 QA scenarios pin "today" in
 *   `sessionStorage` so a QA agent can cross a month boundary. That code sits
 *   behind `import.meta.env.DEV` in `src/main.tsx`, but nothing ASSERTED it —
 *   and this is a household-ledger app, where a shippable way to move the
 *   clock would corrupt month-end settlement and the F16 monuments it
 *   engraves. Tree-shaking working today is not the same as a guarantee.
 */
const FORBIDDEN = [
  ["devtools/fixtures marker", "__AIT_DEVTOOLS_FIXTURES_MARKER__"],
  ["QA time-travel key", "__aitTimeTravel"], // keep in sync with `TIME_TRAVEL_KEY` in src/main.tsx
];

function listJsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) out.push(...listJsFiles(path));
    else if (name.endsWith(".js")) out.push(path);
  }
  return out;
}

let jsFiles;
try {
  jsFiles = listJsFiles(DIST_DIR);
} catch (err) {
  console.error(`gate:extra FAIL — could not read '${DIST_DIR}' (did the build step run first?): ${err.message}`);
  process.exit(1);
}

if (jsFiles.length === 0) {
  console.error(`gate:extra FAIL — no .js files found under '${DIST_DIR}'; build produced nothing to check.`);
  process.exit(1);
}

const sources = jsFiles.map((f) => [f, readFileSync(f, "utf8")]);

let failed = false;
for (const [label, needle] of FORBIDDEN) {
  const hits = sources.filter(([, text]) => text.includes(needle)).map(([f]) => f);
  if (hits.length > 0) {
    console.error(`gate:extra FAIL — ${label} found in production bundle:\n  ${hits.join("\n  ")}`);
    failed = true;
  }
}
if (failed) process.exit(1);

console.log(
  `gate:extra PASS — ${FORBIDDEN.length} forbidden marker(s) absent from ${jsFiles.length} bundle file(s) under '${DIST_DIR}'.`,
);
