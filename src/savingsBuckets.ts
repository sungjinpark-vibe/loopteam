/**
 * Pure domain module — the 저축 sub-category id list and legacy-id handling.
 * ADDENDUM-01 §4.5. Peer of `selectors.ts`, imports **only `./types`** (no
 * content, no colours, no balance), so `townLayout.ts` and `entryActions.ts`
 * may import it freely without dragging a runtime stylesheet or a content
 * decision into a pure module.
 *
 * PM correction (ADDENDUM-01 §4.6/§6): this file ships with the ROAD task,
 * not the 저축 블록 task — `townLayout.ts` needs `SAVING_CATEGORY_IDS` to size
 * the savings block (`TOWN_HEAD_ROWS`, `SAVINGS_COLUMN_RANK`), so it must
 * exist before the road task can compile. `savingsBucketOf`/
 * `LEGACY_SAVING_ALIAS` stay unused in production until the 저축 블록 task
 * wires them into `entryActions.ts`'s 저축 branch.
 */
import type { SavingCategoryId } from "./types";

/**
 * Canonical PROMINENCE RANK order (not "left→right render order" — that is
 * `SAVINGS_ROW_ORDER`, derived from `SAVINGS_COLUMN_RANK` in `townLayout.ts`).
 * Rank 0 and 1 are the two sub-types the director named, and
 * `SAVINGS_COLUMN_RANK` (townLayout.ts §3.3) puts them on the two lots
 * flanking the main street.
 */
export const SAVING_CATEGORY_IDS = [
  "deposit",
  "stock",
  "emergency",
  "goal",
  "other_saving",
] as const satisfies readonly SavingCategoryId[];

/**
 * The narrow literal union of `SAVING_CATEGORY_IDS`'s five members — NOT the
 * same type as `SavingCategoryId` (which still has 6, `invest` included until
 * the 저축 블록 task retires it). `townLayout.ts`'s `savingsCellFor` takes this
 * type, not `SavingCategoryId`, so passing a legacy/unknown id (e.g.
 * `"invest"`) is a compile error at the call site instead of a silent
 * out-of-range lookup (round-1 lead finding C2).
 */
export type SavingCategoryCellId = (typeof SAVING_CATEGORY_IDS)[number];

/** Read-only legacy ids, never offered in the picker. D-24 decides the target. */
export const LEGACY_SAVING_ALIAS: Record<string, SavingCategoryId> = { invest: "stock" };

/** Type guard — the honest form of "is this stored string a live saving category?". */
export function isSavingCategoryId(id: string): id is SavingCategoryId {
  return (SAVING_CATEGORY_IDS as readonly string[]).includes(id);
}

/**
 * Any stored categoryId -> the bucket it counts toward. TOTAL over `string`:
 * unknown ids fall to 기타 저축, so a stale localStorage value can never
 * produce an `undefined` lookup. This function's RETURN TYPE is the
 * narrowing the 저축 블록 task's `entryActions.ts` branch needs (§4.5a).
 */
export function savingsBucketOf(id: string): SavingCategoryId {
  const aliased = LEGACY_SAVING_ALIAS[id] ?? id;
  return isSavingCategoryId(aliased) ? aliased : "other_saving";
}
