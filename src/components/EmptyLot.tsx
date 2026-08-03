import { memo } from "react";

export interface EmptyLotProps {
  /**
   * Ground decoration variant — keyed on `(row, col)` via `townLayout.ts`'s
   * `decorVariant` (rule R-2, ADDENDUM-01 §3.6/§3.7): never stored, never
   * persisted, never versioned. Default 0 = today's plain dashed lot; 1 =
   * 잔디+나무, 2 = 텃밭. Purely visual — the "reads as a village, not a grid
   * with a stripe" checklist item 2.
   */
  variant?: 0 | 1 | 2;
}

/** An unbuilt plot — dashed outline, no content, plus a ground variant. */
export const EmptyLot = memo(function EmptyLot({ variant = 0 }: EmptyLotProps) {
  return <div className={`empty-lot empty-lot--v${variant}`} aria-hidden="true" />;
});
