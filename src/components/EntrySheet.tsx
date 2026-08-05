/**
 * S4 입력 시트 (spec §6 S4 / §5 F1) — logs one ledger entry in <=3 taps.
 *
 * 저축 segment (ADDENDUM-01 §2.7 MUST, `EntrySheet.tsx:157`) is enabled —
 * `CATEGORIES_BY_TYPE.saving` now lists the five 저축 sub-types
 * (content.placeholder.ts), so the existing category grid renders them with
 * no other change. Saving hands the draft to the caller, which applies
 * F1/F2/F13 via `entryActions.ts` — this component owns form state only and
 * has no idea 저축 never builds a plot.
 *
 * Built on TDS primitives end to end (idiomatic-TDS is an explicit rubric
 * sub-aspect, VISION.md): `SegmentedControl` for the type row, `NumberKeypad`
 * + a plain amount display for the amount (spec §6 S4 key elements: "numeric
 * keypad · amount display", not the OS keyboard), `WheelDatePicker` for the
 * date chip, `ChipItem` (in a fixed-column grid, not TDS's `<Chip>` — that
 * wraps children in a horizontal scroller by design) for the category grid,
 * and `ConfirmDialog` for the touched-and-dismissing confirm (native
 * `window.confirm` blocks the main thread while open, and an Android WebView
 * host with no JS-confirm handler registered can suppress it outright).
 *
 * Fits the 390x844 reference viewport with no scroll trade-off (round-5 fix,
 * C1 finding): `maxHeight="92vh"` on `BottomSheet` (TDS's own default is
 * 70vh, which left only ~473px for header+body+cta combined — not enough for
 * every field at once regardless of internal compaction), plus a compact
 * keypad (`.entry-keypad` in App.css overrides TDS's default 64px/row) and a
 * real 5-column icon grid for categories (`.category-grid`, App.css) instead
 * of a free-flowing wrap. Field order in the DOM mirrors F1's spec order
 * (type -> amount -> category -> date -> memo).
 */
import { useEffect, useRef, useState } from "react";
import { BottomSheet, Button, ConfirmDialog, SegmentedControl } from "@toss/tds-mobile";
import type { EntryDraft } from "../entryActions";
import { appendAmountDigit } from "../format";
import { useBackGuard } from "../hooks/useBackGuard";
import type { CategoryId, EntryType } from "../types";
import { EntryFields } from "./EntryFields";

export interface EntrySheetProps {
  open: boolean;
  today: string; // 'YYYY-MM-DD' — the date field defaults to this and may never go past it
  onClose: () => void;
  onSave: (draft: EntryDraft) => void;
}

export function EntrySheet({ open, today, onClose, onSave }: EntrySheetProps) {
  const [type, setType] = useState<EntryType>("expense");
  const [amountDigits, setAmountDigits] = useState(""); // normalized numeric string, no leading zeros
  const [categoryId, setCategoryId] = useState<CategoryId | null>(null);
  const [date, setDate] = useState(today);
  const [memo, setMemo] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Mirrors the latest render's `onClose`/`today` into a ref, written only
  // from an effect (never during render — a render that's interrupted/
  // discarded must never leave this ref pointing at state that never
  // actually committed). Declared (and thus fired) before the open-reset
  // effect below, so that effect always reads this render's `today`, not a
  // stale one — see the ordering note on that effect.
  const latestRef = useRef({ onClose, today });
  useEffect(() => {
    latestRef.current = { onClose, today };
  });

  // Reset the form on the open transition (false -> true) only — NOT keyed
  // on `today`. `today` is recomputed from clock.today() on every store
  // render, so keying this effect on it would silently wipe an in-progress
  // form (type, amount, category, date, memo) on a midnight rollover, or on
  // any TimeTravel change (S7, later) while the sheet is open — with no
  // confirmation, unlike a mere backdrop tap in the same situation. The date
  // field still defaults to "today", just read from `latestRef` (kept
  // current by the effect above, which runs first) instead of from a dep.
  useEffect(() => {
    if (!open) return;
    setType("expense");
    setAmountDigits("");
    setCategoryId(null);
    setDate(latestRef.current.today);
    setMemo("");
    setConfirmOpen(false);
  }, [open]);

  const amountKrw = Number(amountDigits || "0");
  const canSave = amountKrw > 0 && categoryId !== null && date <= today;
  // Anything different from the sheet's just-opened defaults counts as
  // "touched" — F1 AC: dismiss must confirm if any field was touched.
  const touched = type !== "expense" || amountDigits !== "" || categoryId !== null || date !== today || memo !== "";

  function pressDigit(digit: string) {
    setAmountDigits((prev) => appendAmountDigit(prev, digit));
  }

  function pressBackspace() {
    setAmountDigits((prev) => prev.slice(0, -1));
  }

  function selectType(next: string) {
    if (next === type) return;
    setType(next as EntryType);
    setCategoryId(null); // the category grid is filtered by type — the old selection may not exist in the new list
  }

  function handleSave() {
    if (!canSave || categoryId === null) return;
    onSave({ type, amountKrw, categoryId, occurredOn: date, memo: memo.trim() || undefined });
  }

  // F1 AC: "Sheet dismisses on save, on backdrop tap (confirm if touched),
  // and on Android back." Both the backdrop tap and `useBackGuard` below
  // call this.
  function dismiss(currentlyTouched: boolean) {
    if (currentlyTouched) {
      setConfirmOpen(true);
      return;
    }
    latestRef.current.onClose();
  }

  function confirmDismiss() {
    setConfirmOpen(false);
    latestRef.current.onClose();
  }

  useBackGuard(open, touched, dismiss);

  return (
    <>
      <BottomSheet
        open={open}
        onDimmerClick={() => dismiss(touched)}
        hasTextField
        maxHeight="92vh"
        header={<div className="entry-sheet-title">거래 입력</div>}
        cta={
          <Button as="button" display="block" size="xlarge" disabled={!canSave} onClick={handleSave}>
            저장
          </Button>
        }
      >
        <div className="entry-sheet-body">
          <SegmentedControl value={type} onChange={selectType} aria-label="거래 유형">
            <SegmentedControl.Item value="expense">지출</SegmentedControl.Item>
            <SegmentedControl.Item value="income">수입</SegmentedControl.Item>
            <SegmentedControl.Item value="saving">저축</SegmentedControl.Item>
          </SegmentedControl>

          <EntryFields
            type={type}
            amountDigits={amountDigits}
            onAmountDigit={pressDigit}
            onAmountBackspace={pressBackspace}
            categoryId={categoryId}
            onSelectCategory={setCategoryId}
            date={date}
            today={today}
            onDateChange={setDate}
            memo={memo}
            onMemoChange={setMemo}
          />
        </div>
      </BottomSheet>

      <ConfirmDialog
        open={confirmOpen}
        title="입력한 내용이 사라져요"
        description="닫으면 지금까지 입력한 내용이 사라져요. 닫을까요?"
        onClose={() => setConfirmOpen(false)}
        cancelButton={
          <ConfirmDialog.CancelButton onClick={() => setConfirmOpen(false)}>계속 입력</ConfirmDialog.CancelButton>
        }
        confirmButton={<ConfirmDialog.ConfirmButton onClick={confirmDismiss}>닫기</ConfirmDialog.ConfirmButton>}
      />
    </>
  );
}
