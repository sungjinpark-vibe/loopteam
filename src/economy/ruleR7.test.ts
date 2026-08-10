/**
 * Enforces the half of rule R-7 the eslint override in `eslint.config.js`
 * cannot (a lint rule can ban an import specifier, not a specific character
 * inside a string): no source file under `src/economy/` may contain the
 * character '원' outside test files (PM-DECISIONS §F-ECON). Scans real files
 * on disk rather than trusting a fixed file list, so a new file added later
 * is covered automatically.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ECONOMY_DIR = dirname(fileURLToPath(import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    if (!/\.(ts|tsx)$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) return [];
    return [full];
  });
}

describe("rule R-7", () => {
  it("no non-test source file under src/economy/ contains the KRW character", () => {
    const offenders = sourceFiles(ECONOMY_DIR).filter((f) => readFileSync(f, "utf-8").includes("원"));
    expect(offenders).toEqual([]);
  });
});
