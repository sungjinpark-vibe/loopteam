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
import { MAX_FUSE_TIER } from "../fusionActions";
import { useEscapeToClose } from "../hooks/useEscapeToClose";
import { footprintOf } from "../placement";
import { fuseOf, levelOf, totalLevelOf } from "../selectors";
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
  /** ADDENDUM-11 §6 step 2 — true when at least one legal fuse partner exists for `building`. Never a disabled button: absent partner means no CTA at all. */
  canFuse: boolean;
  /** Closes this sheet and starts fusion pick mode. No-op when `canFuse` is false — the caller only renders the CTA when true, but this stays defensive. */
  onFuse: () => void;
}

export function BuildingDetailSheet({ open, building, entry, expPerLevel, maxLevel, onClose, canFuse, onFuse }: BuildingDetailSheetProps) {
  useEscapeToClose(open, onClose); // called unconditionally — Rules of Hooks — before the early return below
  if (building === null) return null;

  const content = building.categoryId ? CATEGORY_CONTENT[building.categoryId] : null;
  // ADDENDUM-11 §2.4 — the level shown here is EXP level + fuse tier (6..10
  // for a fused building), the same `totalLevelOf` the grid's badge reads.
  const level = totalLevelOf(building, expPerLevel, maxLevel);
  const isNospend = building.source.kind === "nospend";
  const { w, h } = footprintOf(building);
  // Gate-3-rerun fix (every expert's top/near-top finding): footprint is
  // rolled at random on founding (ADDENDUM-08 §2.2) and fusion requires a
  // same-footprint, same-category partner, but neither fact was ever shown
  // anywhere — a player who founded two identical-looking Lv.5 buildings had
  // no way to learn why 융합하기 was silently absent. Two additions, both
  // read-only: the footprint itself, and — only once THIS building is
  // otherwise fusion-ready (maxed, entry-founded, not already at the tier
  // cap) but simply lacks a matching partner right now — a one-line
  // explanation of exactly what a partner needs to be, instead of the CTA
  // just not existing with no comment.
  const selfFuseReady =
    building.source.kind === "entry" &&
    building.categoryId !== null &&
    levelOf(building, expPerLevel, maxLevel) >= maxLevel &&
    fuseOf(building) < MAX_FUSE_TIER;
  const needsFusePartner = selfFuseReady && !canFuse;

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
          {!isNospend && (
            <div className="history-total-item">
              <span className="history-total-label">크기</span>
              <span className="history-total-value">{w}×{h}</span>
            </div>
          )}
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
        {/* ADDENDUM-11 §6 step 2 — rendered ONLY when a legal partner exists
            (`canFuse`, from `store.fuseCandidates(building.id).length > 0`):
            never a disabled button that cannot explain itself. */}
        {canFuse && (
          <>
            {/* Gate-3-rerun fix (unanimous panel finding): this used to hard-code
                "레벨 5" (the frozen `maxLevel` constant) regardless of the
                building's own fuse tier — a Lv.6+ building told the player it
                fuses with a "Lv.5" partner, but `canFuse`/F5 requires an EQUAL
                fuse tier, so that instruction could never be completed. `level`
                (totalLevelOf = maxLevel + fuse) is the partner's real required
                level; use it here instead of the constant. */}
            <p className="history-pace-label">Lv.{level} 건물끼리 합쳐 더 높은 레벨로 만들 수 있어요.</p>
            <Button as="button" color="primary" variant="weak" size="medium" display="block" onClick={onFuse}>
              융합하기
            </Button>
          </>
        )}
        {needsFusePartner && (
          <p className="history-pace-label">
            {content?.label ?? "같은 카테고리"} {w}×{h} 크기의 Lv.{level} 건물이 하나 더 있으면 합칠 수 있어요.
          </p>
        )}
      </div>
    </BottomSheet>
  );
}
