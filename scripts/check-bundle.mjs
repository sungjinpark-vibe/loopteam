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
const MARKER = "__AIT_DEVTOOLS_FIXTURES_MARKER__";

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

const hits = jsFiles.filter((f) => readFileSync(f, "utf8").includes(MARKER));

if (hits.length > 0) {
  console.error(`gate:extra FAIL — devtools/fixtures marker found in production bundle:\n  ${hits.join("\n  ")}`);
  process.exit(1);
}

console.log(`gate:extra PASS — devtools/fixtures marker absent from ${jsFiles.length} bundle file(s) under '${DIST_DIR}'.`);
