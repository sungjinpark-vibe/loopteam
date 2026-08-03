/**
 * 저축 블록 (savings block) — the fixed-cell row at the town's head.
 * ADDENDUM-01 §3.4 item 4 / §2.4a: `SavingsRow` is its own component, not
 * inlined into `TownGrid`, so the 저축 블록 task (real structures — signboard,
 * label, pips) has one seam to extend instead of growing `TownGrid` further
 * (round-1 lead finding C3).
 *
 * THIS TASK renders the block's five cells as empty lots + one signpost —
 * `SavingsRow`'s next-task job is to swap `.savings-plot--empty` for the real
 * `.savings-structure*` subtree (§2.4a); the props below (`ladder` only) are
 * deliberately the subset this task needs. The full contract (adds
 * `ladderOverrides`, `savingsByCategoryKrw`, `justGrew`) lands with that task
 * (§3.4's `TownGridProps` list, break B14) — not here, since none of that
 * data exists on `TownState` yet (ADDENDUM-01 §4.6).
 *
 * §2.4a's trap: this MUST return a `<>…</>` fragment of direct grid items,
 * never a wrapping element — a wrapper collapses every lot into one cell.
 */
import { memo, useMemo } from "react";
import {
  SAVINGS_ROW_ORDER,
  districtLadderLength,
  freeSavingsCells,
  roadSideOf,
  savingsCellFor,
  savingsPlotHeightPx,
  savingsPlotTemplateRows,
} from "../townLayout";

export interface SavingsRowProps {
  /** The shared default ladder — sizes the savings block's shared row height (BALANCE.savingsTowerSegments, D-13). */
  ladder: readonly number[];
}

function SavingsRowImpl({ ladder }: SavingsRowProps) {
  // §2.5's shared-longest rule: all five savings lots share one reserved
  // height, sized to the longest ladder any structure resolves to. No
  // per-structure overrides are wired yet (this task ships empty lots), so
  // `overrides` is always `{}` — the next task's job is to thread it through.
  const ladderLength = useMemo(() => districtLadderLength(ladder, {}), [ladder]);
  const plotHeight = savingsPlotHeightPx(ladderLength);
  const plotRowTemplate = savingsPlotTemplateRows(ladderLength);

  const plots = useMemo(
    () =>
      SAVINGS_ROW_ORDER.map((id) => {
        const { row, col } = savingsCellFor(id);
        const side = roadSideOf(col);
        return (
          <div
            key={id}
            className={`savings-plot savings-plot--empty town-tile--${side}`}
            data-structure-id={id}
            aria-hidden="true"
            style={{
              gridColumn: col + 1,
              gridRow: row + 1,
              height: `${plotHeight}px`,
              gridTemplateRows: plotRowTemplate,
            }}
          />
        );
      }),
    [plotHeight, plotRowTemplate],
  );

  // The 마을 안내판 (village signpost) — the first free savings-row cell in
  // column-rank order. Decoration only (rule R-2): no data, never persisted,
  // so it never needs to change once mounted.
  const signposts = useMemo(
    () =>
      freeSavingsCells().map(({ row, col }) => (
        <div key={`${row},${col}`} className="savings-signpost" style={{ gridColumn: col + 1, gridRow: row + 1 }} aria-hidden="true">
          🪧
        </div>
      )),
    [],
  );

  return (
    <>
      {plots}
      {signposts}
    </>
  );
}

export const SavingsRow = memo(SavingsRowImpl);
