/**
 * S5 내역 상세 시트 (spec §6 S5 / §5 F9) — sheet over S3, opened by tapping a
 * row in the 기록 entry list. Same field set as S4's `EntrySheet`, including a
 * live `type` `SegmentedControl` (round-4 finding C1: F9's own AC is "F1's
 * fields + 삭제 + 저장", and `type` is one of F1's fields — it must not be
 * display-only). Changing `type` resets `categoryId` to `null` exactly like
 * `EntrySheet.selectType` does — the category grid is filtered by type, so
 * the old selection may not exist in the new list. `useTownStore.updateEntry`
 * (via `historyActions.editEntryEffects`) owns what a type change actually
 * does to the entry's building/queue/저축탑 membership; this component only
 * collects the field values.
 *
 * Only the CHANGED fields are sent to `onSave` (a bare object, not the whole
 * entry) — `useTownStore.updateEntry` only re-skins the bound building when
 * `categoryId` is actually present in the patch (spec: "editing amount/memo/
 * date does not move the building"), so an edit that never touched category
 * must not include it just because the field is always rendered.
 *
 * Form state is reset from `entry` DURING RENDER (the React-documented
 * "adjusting state when a prop changes" pattern — a plain `if` in the
 * component body that calls `setState` while rendering, guarded by an
 * `entry.id` comparison against the previous render's id) rather than from a
 * `useEffect`. Round-1 finding C1: an effect-based reset ran one render
 * AFTER first paint, so `EntryFields`'s `WheelDatePicker` (which captures
 * `initialDate` at mount) locked onto whatever the state started as instead
 * of the entry's actual date — tapping 적용 without touching the wheel
 * silently rewrote the date (and could move the entry across a month
 * boundary) from a no-op gesture. Remounting this component (`key={entry.id}`
 * at the call site) was the first fix attempted and is explicitly WRONG: this
 * component mounts already `open`, and TDS's `BottomSheet` only plays/shows
 * on a false -> true TRANSITION of its own `open` prop on an already-mounted
 * instance — a fresh mount starting at `open={true}` never opens at all
 * (verified live: 0 DOM nodes for the sheet). So the same component instance
 * must stay mounted across opens; only the FORM STATE resets, synchronously,
 * before the first paint that shows the new entry.
 */
import { useEffect, useRef, useState } from "react";
import { BottomSheet, Button, ConfirmDialog, SegmentedControl } from "@toss/tds-mobile";
import { appendAmountDigit } from "../format";
import { useBackGuard } from "../hooks/useBackGuard";
import type { CategoryId, EntryType, LedgerEntry } from "../types";
import type { EntryEditPatch } from "../useTownStore";
import { EntryFields } from "./EntryFields";

export interface EntryDetailSheetProps {
  open: boolean;
  /** The entry being viewed/edited. Stays non-null while `open` is true; may already be null while the sheet is closing. */
  entry: LedgerEntry | null;
  today: string; // 'YYYY-MM-DD' — the date field may never go past it
  onClose: () => void;
  onSave: (patch: EntryEditPatch) => void;
  onDelete: () => void;
}

export function EntryDetailSheet({ open, entry, today, onClose, onSave, onDelete }: EntryDetailSheetProps) {
  const [type, setType] = useState<EntryType>("expense");
  const [amountDigits, setAmountDigits] = useState("");
  const [categoryId, setCategoryId] = useState<CategoryId | null>(null);
  const [date, setDate] = useState(today);
  const [memo, setMemo] = useState("");
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Tracks which entry the form fields above currently reflect, `null` while
  // closed. Compared against `entry?.id` DURING RENDER (not in an effect) —
  // React's documented pattern for resetting state when a prop identity
  // changes without remounting: the extra `setState` calls below happen
  // before this render commits, so React immediately re-renders with the
  // corrected state and nothing ever paints (or hands a child a mount-time
  // default) with the wrong entry's values in it.
  const [shownEntryId, setShownEntryId] = useState<string | null>(null);
  if (entry !== null && entry.id !== shownEntryId) {
    setShownEntryId(entry.id);
    setType(entry.type);
    setAmountDigits(String(entry.amountKrw));
    setCategoryId(entry.categoryId);
    setDate(entry.occurredOn);
    setMemo(entry.memo ?? "");
    setConfirmCloseOpen(false);
    setConfirmDeleteOpen(false);
  } else if (entry === null && shownEntryId !== null) {
    // Sheet just closed — forget which entry was shown, so reopening the
    // SAME entry (after discarding unsaved edits) resets fresh again instead
    // of the `entry.id !== shownEntryId` guard above skipping the reset.
    setShownEntryId(null);
  }

  // Same pattern as EntrySheet's own `latestRef`: written only from an
  // effect, read by handlers that must see the LATEST props without being
  // part of any dependency list.
  const latestRef = useRef({ onClose, entry, today });
  useEffect(() => {
    latestRef.current = { onClose, entry, today };
  });

  function selectType(next: string) {
    if (next === type) return;
    setType(next as EntryType);
    setCategoryId(null); // the category grid is filtered by type — the old selection may not exist in the new list (EntrySheet's own selectType does the same)
  }

  const amountKrw = Number(amountDigits || "0");
  const canSave = entry !== null && amountKrw > 0 && categoryId !== null && date <= today;
  const touched =
    entry !== null &&
    (type !== entry.type ||
      amountKrw !== entry.amountKrw ||
      categoryId !== entry.categoryId ||
      date !== entry.occurredOn ||
      memo !== (entry.memo ?? ""));

  function dismiss(currentlyTouched: boolean) {
    if (currentlyTouched) {
      setConfirmCloseOpen(true);
      return;
    }
    latestRef.current.onClose();
  }

  function confirmDismiss() {
    setConfirmCloseOpen(false);
    latestRef.current.onClose();
  }

  useBackGuard(open, touched, dismiss);

  if (entry === null) return null; // nothing to show — BottomSheet stays closed via `open` regardless

  function handleSave() {
    if (!canSave || categoryId === null) return;
    const patch: EntryEditPatch = {};
    if (type !== entry!.type) patch.type = type;
    if (amountKrw !== entry!.amountKrw) patch.amountKrw = amountKrw;
    if (categoryId !== entry!.categoryId) patch.categoryId = categoryId;
    if (date !== entry!.occurredOn) patch.occurredOn = date;
    const trimmedMemo = memo.trim();
    if (trimmedMemo !== (entry!.memo ?? "")) patch.memo = trimmedMemo || undefined;
    onSave(patch);
  }

  return (
    <>
      <BottomSheet
        open={open}
        onDimmerClick={() => dismiss(touched)}
        hasTextField
        maxHeight="92vh"
        header={<div className="entry-sheet-title">내역 상세</div>}
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
            onAmountDigit={(digit) => setAmountDigits((prev) => appendAmountDigit(prev, digit))}
            onAmountBackspace={() => setAmountDigits((prev) => prev.slice(0, -1))}
            categoryId={categoryId}
            onSelectCategory={setCategoryId}
            date={date}
            today={today}
            onDateChange={setDate}
            memo={memo}
            onMemoChange={setMemo}
          />

          <Button
            as="button"
            color="danger"
            variant="weak"
            display="block"
            size="large"
            onClick={() => setConfirmDeleteOpen(true)}
          >
            삭제
          </Button>
        </div>
      </BottomSheet>

      <ConfirmDialog
        open={confirmCloseOpen}
        title="수정한 내용이 사라져요"
        description="닫으면 지금까지 수정한 내용이 사라져요. 닫을까요?"
        onClose={() => setConfirmCloseOpen(false)}
        cancelButton={
          <ConfirmDialog.CancelButton onClick={() => setConfirmCloseOpen(false)}>계속 수정</ConfirmDialog.CancelButton>
        }
        confirmButton={<ConfirmDialog.ConfirmButton onClick={confirmDismiss}>닫기</ConfirmDialog.ConfirmButton>}
      />

      {/* Destructive-action confirm (spec F9 AC: "Destructive action confirms"). */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="이 내역을 삭제할까요?"
        description="함께 지어진 건물도 사라져요. 이 작업은 되돌릴 수 없어요."
        onClose={() => setConfirmDeleteOpen(false)}
        cancelButton={<ConfirmDialog.CancelButton onClick={() => setConfirmDeleteOpen(false)}>취소</ConfirmDialog.CancelButton>}
        confirmButton={<ConfirmDialog.ConfirmButton onClick={onDelete}>삭제</ConfirmDialog.ConfirmButton>}
      />
    </>
  );
}
