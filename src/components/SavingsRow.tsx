/**
 * 저축 블록 (savings block) — ADDENDUM-08 §1.1: five real savings structures
 * (one per `SAVING_CATEGORY_IDS`) standing on the map's fixed `S` cells (row
 * 1, cols 7..11, `savingsCells()`/`savingsCellFor`), each sized from the
 * shared ladder length (§2.5's shared-longest rule) but leveled from its OWN
 * cumulative amount and its OWN ladder (`ladderFor`).
 *
 * ADDENDUM-08 drops the old 안내판 signpost: the old map reserved extra
 * `TOWN_COLUMNS`-wide savings-row cells beyond the five structures; the new
 * fixed map has exactly 5 `S` cells and nothing else to signpost.
 *
 * This MUST return a `<>…</>` fragment of direct grid items, never a
 * wrapping element — a wrapper collapses every lot into one cell.
 *
 * Does NOT raise its own toast (forbids a `@toss/tds-mobile` import here —
 * it would drag the TDS runtime into `TownGrid.test.tsx`). `useTownStore`
 * owns the level-up toast through the existing Notice FIFO; this component
 * only owns the one-shot rise animation and its auto-scroll, keyed on
 * `justGrew.seq` (the same `scrollIntoView` mechanism `TownGrid`'s
 * `justBuiltId` effect already uses).
 *
 * `justGrew` is a one-shot event, not sticky state — once the rise
 * animation's native `animationend` fires, `onRiseSettled` (owned by
 * `useTownStore`, mirrors `dismissNotice`'s shape) resets it to `null` so
 * the structure falls back to its `idleAnim` loop instead of staying in
 * `.savings-plot--rise` forever.
 */
import { memo, useEffect, useMemo, useRef } from "react";
import { CATEGORY_CONTENT, SAVINGS_STRUCTURE } from "../content.placeholder";
import { ladderFor, towerSegments } from "../selectors";
import {
  SAVINGS_ROW_ORDER,
  districtLadderLength,
  savingsCellFor,
  savingsPlotHeightPx,
  savingsPlotTemplateRows,
  structureLevelHeightPx,
} from "../townLayout";
import { savingsOf } from "../types";
import type { SavingCategoryId } from "../types";

export interface SavingsRowProps {
  /** Per-structure cumulative KRW — undefined/absent id both read as 0 (level 0, empty lot). */
  savingsByCategoryKrw: Partial<Record<SavingCategoryId, number>> | undefined;
  /** The shared default ladder — sizes the savings block's shared row height (BALANCE.savingsTowerSegments, D-13). */
  ladder: readonly number[];
  /** Per-structure ladder overrides (BALANCE.savingsStructureSegments, D-13a). Ships `{}`. */
  ladderOverrides: Partial<Record<SavingCategoryId, readonly number[]>>;
  /** The structure that just gained a level, and a per-event sequence number (§2.6a). */
  justGrew: { id: SavingCategoryId; seq: number } | null;
  /** Called when the one-shot rise animation ends (native `animationend`) — clears `justGrew` back to `null` (round-4 finding C1 #2). Required, not optional: a forgetful call site would leave a structure stuck in `.savings-plot--rise` forever. */
  onRiseSettled: () => void;
}

function SavingsRowImpl({ savingsByCategoryKrw, ladder, ladderOverrides, justGrew, onRiseSettled }: SavingsRowProps) {
  // §2.5's shared-longest rule: all five savings lots share one reserved
  // height, sized to the longest ladder any structure resolves to.
  const ladderLength = useMemo(() => districtLadderLength(ladder, ladderOverrides), [ladder, ladderOverrides]);
  const plotHeight = savingsPlotHeightPx(ladderLength);
  const plotRowTemplate = savingsPlotTemplateRows(ladderLength);

  const risingRef = useRef<HTMLDivElement | null>(null);
  // §2.6 step 1: auto-scroll to the structure that just rose, keyed on `seq`
  // (not the bare id) so crossing the SAME structure's threshold twice in one
  // session still re-triggers — same mechanism TownGrid's justBuiltId effect uses.
  useEffect(() => {
    if (justGrew === null) return;
    risingRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    // The lint rule wants the whole `justGrew` object in the deps array, but
    // this effect is deliberately keyed on `justGrew.seq` alone (§2.6a): the
    // same structure crossing a threshold twice in one session produces two
    // DIFFERENT `justGrew` objects sharing the same `id`, and only `seq`
    // distinguishes them, so an object-identity dependency is exactly as
    // correct as `seq` here — but a plain `justGrew` dep would also fire this
    // effect on unrelated re-renders that happen to reconstruct an
    // equivalent-looking object with no real level-up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justGrew?.seq]);

  const plots = SAVINGS_ROW_ORDER.map((id) => {
    const { row, col } = savingsCellFor(id);
    const content = SAVINGS_STRUCTURE[id];
    const category = CATEGORY_CONTENT[id];
    const ownLadder = ladderFor(id, ladder, ladderOverrides);
    const level = towerSegments(savingsOf({ savingsByCategoryKrw }, id), ownLadder);
    const isEmpty = level === 0;
    const isRising = justGrew?.id === id;
    // §2.6 step 2 / round-1 finding C1 #3: the one-shot rise plays the
    // structure's OWN `riseAnim` (never the generic keyframe every kind used
    // to share), and level 0 -> 1 specifically — the only level a structure
    // can rise INTO from empty — gets the longer "터 닦기 -> 건물" beat via the
    // `--first` duration modifier (App.css), not a second animation name.
    //
    // Round-2 finding C1 #2: `isEmpty` gates the idle loop too — a level-0
    // lot has no structure standing on it, only its signboard + `emptyHint`
    // text (rendered below), and those must never carry an infinite idle
    // animation (e.g. `.savings-idle--ticker-blink` fading the 증권거래소
    // lot's "아직 비어있어요" hint to 0.55 opacity forever on a fresh install).
    const structureClassName =
      "savings-structure" +
      (isRising
        ? ` savings-rise--${content.riseAnim}${level === 1 ? " savings-rise--first" : ""}`
        : isEmpty || content.idleAnim === "none"
          ? ""
          : ` savings-idle--${content.idleAnim}`);

    return (
      <div
        key={id}
        className={
          `savings-plot savings-plot--${content.kind} savings-plot--cap-${content.capShape}` +
          `${isEmpty ? " savings-plot--empty" : ""}${isRising ? " savings-plot--rise" : ""}`
        }
        data-structure-id={id}
        style={{
          gridColumn: col + 1,
          gridRow: row + 1,
          height: `${plotHeight}px`,
          gridTemplateRows: plotRowTemplate,
        }}
      >
        {/* Round-2 finding C1 #3 (AC-F13-7 / §2.4a's DOM contract): inline
         * `height`, exactly `structureLevelHeightPx(level)` — not
         * `minHeight`. A level-0 lot's board+hint can still need more room
         * than the level-0 floor (32px). `align-self: end` (App.css) bottom-
         * anchors this div in its OWN reserved grid row (sized to the full
         * ladder, `structureHeightPx(ladderLength)` — always >= any single
         * level's floor).
         *
         * Round-4 finding C1 #1/#6: `align-self` only positions the BOX —
         * it does nothing to the overflow DIRECTION of content that doesn't
         * fit inside it, and plain block-flow content overflows a
         * height-constrained box DOWNWARD regardless of where the box sits,
         * which is exactly what painted the emptyHint over the label row.
         * `display: flex; flexDirection: column; justifyContent: flex-end`
         * is the actual (code, not prose) fix: a flex container that's
         * shorter than its content keeps its LAST child flush with the
         * container's end edge and lets the overflow bleed off the START
         * edge instead — i.e. upward, into the already-reserved room above
         * this box in its grid row, never down into `.savings-structure-label`. */}
        <div
          className={structureClassName}
          ref={isRising ? risingRef : undefined}
          onAnimationEnd={isRising ? onRiseSettled : undefined}
          style={{ height: `${structureLevelHeightPx(level)}px`, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
        >
          <div className="savings-structure-board">{content.signboard}</div>
          {isEmpty && <div className="savings-structure-hint">{content.emptyHint}</div>}
        </div>
        <div className="savings-structure-label">{category.label}</div>
        <div className="savings-structure-pips">
          {ownLadder.map((_, i) => (
            <span key={i} className={i < level ? "savings-pip savings-pip--on" : "savings-pip"} />
          ))}
        </div>
      </div>
    );
  });

  return <>{plots}</>;
}

export const SavingsRow = memo(SavingsRowImpl);
