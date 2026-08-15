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
import { useConfirmDialogBackdropFix } from "../hooks/useConfirmDialogBackdropFix";
import type { CategoryId, EntryType, LedgerEntry } from "../types";
import type { EntryEditPatch, EntryMutability } from "../useTownStore";
import { EntryFields } from "./EntryFields";

// ADDENDUM-12 §7.4 — the confirm dialog tells the truth about what deleting
// actually gives back, instead of the generic warning alone.
function deleteDescription(preview: { seeds: number; shortfall: number } | null): string {
  if (preview === null || preview.seeds <= 0) {
    return "함께 지어진 건물도 사라져요. 이 작업은 되돌릴 수 없어요.";
  }
  let text = `함께 지어진 건물이 사라지고, 씨앗 ${preview.seeds}개를 돌려받아요. 이 작업은 되돌릴 수 없어요.`;
  if (preview.shortfall > 0) text += " 지금 씨앗이 부족해서 다음 적립에서 차감돼요.";
  return text;
}

const REASON_TEXT: Record<"past-month" | "fused", string> = {
  "past-month": "지난달 기록은 정산이 끝나 수정할 수 없어요.",
  fused: "이 기록은 합쳐진 건물에 들어가 있어 금액 수정·삭제를 할 수 없어요. 메모와 분류는 바꿀 수 있어요.",
};

export interface EntryDetailSheetProps {
  open: boolean;
  /** The entry being viewed/edited. Stays non-null while `open` is true; may already be null while the sheet is closing. */
  entry: LedgerEntry | null;
  today: string; // 'YYYY-MM-DD' — the date field may never go past it
  /** ADDENDUM-12 §9 — store-computed edit/delete permissions for `entry`. `null` only when `entry` is null. */
  mutability: EntryMutability | null;
  /** ADDENDUM-12 §7.4 — honest seed clawback preview for the delete confirm dialog. `null` only when `entry` is null. */
  clawbackPreview: { seeds: number; shortfall: number } | null;
  onClose: () => void;
  onSave: (patch: EntryEditPatch) => void;
  onDelete: () => void;
}

export function EntryDetailSheet({
  open,
  entry,
  today,
  mutability,
  clawbackPreview,
  onClose,
  onSave,
  onDelete,
}: EntryDetailSheetProps) {
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

  // ADDENDUM-12 §4 — an edit may never carry `occurredOn` out of the current
  // month (the store refuses it; this is the UI-side hint). `today`'s own
  // month, not the viewed month's — only the current month is ever editable
  // at all (`mutability.canEdit` gates everything else).
  const minDate = `${today.slice(0, 7)}-01`;

  const canEditAny = mutability?.canEdit ?? true;
  const canEditAmount = mutability?.canEditAmount ?? true;
  const canDeleteEntry = mutability?.canDelete ?? true;
  const reason = mutability?.reason ?? null;

  // The lower bound itself is enforced by `WheelDatePicker`'s native `min`
  // prop (passed down via `EntryFields`) — it already stops the user from
  // ever PICKING a date below `minDate`, so re-checking it here would only
  // re-reject an entry's own already-loaded `occurredOn` on an unrelated
  // save (e.g. amount/memo-only edits), which is never sent as a patch
  // field anyway since it's unchanged.
  const amountKrw = Number(amountDigits || "0");
  const canSave = entry !== null && canEditAny && amountKrw > 0 && categoryId !== null && date <= today;
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

  // Vendor bug workaround (see hook doc) — cancelling either nested
  // ConfirmDialog above (close-with-unsaved-changes, delete) otherwise
  // leaves this sheet's own backdrop tap dead.
  useConfirmDialogBackdropFix(open, confirmCloseOpen || confirmDeleteOpen);

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
        <div className={`entry-sheet-body${canEditAmount ? "" : " entry-sheet-body--amount-locked"}`}>
          {reason !== null && <div className="entry-sheet-reason">{REASON_TEXT[reason]}</div>}

          <SegmentedControl
            value={type}
            onChange={selectType}
            aria-label="거래 유형"
            className={canEditAmount ? undefined : "entry-type-toggle--locked"}
          >
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
            minDate={minDate}
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
            disabled={!canDeleteEntry}
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
        description={deleteDescription(clawbackPreview)}
        onClose={() => setConfirmDeleteOpen(false)}
        cancelButton={<ConfirmDialog.CancelButton onClick={() => setConfirmDeleteOpen(false)}>취소</ConfirmDialog.CancelButton>}
        confirmButton={<ConfirmDialog.ConfirmButton onClick={onDelete}>삭제</ConfirmDialog.ConfirmButton>}
      />
    </>
  );
}
