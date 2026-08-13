/**
 * Test fixtures for "the town is full" — shared because three suites
 * (`placement`, `settlementActions`, and anything else asserting the downgrade
 * chain) need exactly the same construction.
 *
 * Why this exists at all: before the RX1-N2 spacing rule these suites built a
 * full town by hand as "every ground cell occupied by a 1x1, minus one gap".
 * Under the rule that town is not a town the placer could ever have produced —
 * every building in it violates the spacing rule, and the single gap is
 * illegal by construction, so `placeNew` correctly refuses it and the tests
 * were asserting against an unreachable state. These helpers saturate the town
 * THROUGH the placer instead, so "full" always means "full by the rules the
 * game actually plays by", whatever those rules become next.
 */
import { anchorsFor, cellOwners, placeNew } from "../placement";
import type { Building } from "../types";

function entryBuilding(id: string, plotIndex: number, createdAt: number): Building {
  return {
    id,
    source: { kind: "entry", entryId: `e-${id}` },
    categoryId: "cafe",
    variantIndex: 0,
    plotIndex,
    builtOn: "2026-08-01",
    createdAt,
  };
}

/** rng pinned to a 1x1 roll (`< 0.6`), so the town saturates in 1x1s only. */
const ALWAYS_1X1 = () => 0.1;

/**
 * A town `placeNew` itself considers full: seated one 1x1 at a time until the
 * placer refused. Deterministic — the rng is pinned, not seeded.
 */
export function saturatedTown(): Building[] {
  const buildings: Building[] = [];
  for (;;) {
    const placed = placeNew(buildings, ALWAYS_1X1);
    if (placed === null) return buildings;
    buildings.push(entryBuilding(`f${buildings.length}`, placed.anchor, buildings.length));
  }
}

/**
 * A saturated town with exactly ONE legal 1x1 anchor left and no legal 2x1,
 * 1x2 or 2x2 anchor anywhere — the premise every "downgrades all the way to
 * 1x1" test needs. Found by freeing one building at a time and checking the
 * resulting anchor sets, rather than assuming which building's removal gives
 * it.
 */
export function townWithOneFreeCell(): { buildings: Building[]; gap: number } {
  const full = saturatedTown();
  for (let i = full.length - 1; i >= 0; i--) {
    const buildings = full.filter((_, k) => k !== i);
    const owners = cellOwners(buildings);
    if (
      anchorsFor(1, 1, owners).length === 1 &&
      anchorsFor(2, 1, owners).length === 0 &&
      anchorsFor(1, 2, owners).length === 0 &&
      anchorsFor(2, 2, owners).length === 0
    ) {
      return { buildings, gap: full[i].plotIndex };
    }
  }
  throw new Error("townWithOneFreeCell: no building whose removal leaves exactly one 1x1 anchor");
}
