/**
 * Gate-3-rerun fix — every expert flagged the same gap: a plain tap on an
 * ordinary building (as opposed to a monument) is a total silent no-op, so
 * the thing the player just earned can never be inspected, and the T021
 * amount->level rule ("bigger spend, bigger building") is taught nowhere in
 * the app. Reuses the exact `BottomSheet` chrome `MonumentDetailSheet.tsx`
 * already established for the same tap-a-map-tile interaction — read-only,
 * no form state, no save/delete (F9 delete/edit stays 기록-only).
 *
 * 저축 entries never reach here: `EntrySheet.tsx`'s own header note says
 * "저축 never builds a plot" — a `Building` only ever comes from an expense
 * or income entry (or the nospend park tile, or a monument). So `entry`
 * below is always an expense/income entry when `building.source.kind ===
 * "entry"`, never a saving one.
 */
import { BottomSheet, Button } from "@toss/tds-mobile";
import { CATEGORY_CONTENT } from "../content.placeholder";
import { formatKrw } from "../format";
import { levelOf } from "../selectors";
import type { Building, LedgerEntry } from "../types";

export interface BuildingDetailSheetProps {
  open: boolean;
  /** A non-monument building (`source.kind === "entry" | "nospend"`); null closes the sheet. */
  building: Building | null;
  /** The founding/growing entry, when `building.source.kind === "entry"` and its month is loaded. Null for a nospend (park) building, or while the month is still loading. */
  entry: LedgerEntry | null;
  expPerLevel: number;
  maxLevel: number;
  onClose: () => void;
}

export function BuildingDetailSheet({ open, building, entry, expPerLevel, maxLevel, onClose }: BuildingDetailSheetProps) {
  if (building === null) return null;

  const content = building.categoryId ? CATEGORY_CONTENT[building.categoryId] : null;
  const level = levelOf(building, expPerLevel, maxLevel);
  const isNospend = building.source.kind === "nospend";

  return (
    <BottomSheet
      open={open}
      onDimmerClick={onClose}
      header={<div className="entry-sheet-title">{content?.label ?? "건물"}</div>}
      cta={
        <Button as="button" display="block" size="xlarge" onClick={onClose}>
          닫기
        </Button>
      }
    >
      <div className="entry-sheet-body">
        <div className="history-totals">
          <div className="history-total-item">
            <span className="history-total-label">레벨</span>
            <span className="history-total-value">Lv.{level}</span>
          </div>
          {entry && (
            <div className="history-total-item">
              <span className="history-total-label">{entry.type === "income" ? "수입" : "지출"}</span>
              <span className="history-total-value">{formatKrw(entry.amountKrw)}</span>
            </div>
          )}
          <div className="history-total-item">
            <span className="history-total-label">지은 날</span>
            <span className="history-total-value">{building.builtOn}</span>
          </div>
        </div>
        {/* ux-researcher's TOP FIX, playtest round 2: teach the amount->level
            rule at the exact moment of curiosity, not in a text beat nobody
            rereads. Only shown once an amount is actually on hand. */}
        {entry && (
          <p className="history-pace-label">
            {formatKrw(entry.amountKrw)} {entry.type === "income" ? "수입" : "지출"} → Lv.{level} · 금액이 클수록 건물이 커져요
          </p>
        )}
        {isNospend && <p className="history-pace-label">지출 없는 날 하루의 기록이에요.</p>}
      </div>
    </BottomSheet>
  );
}
