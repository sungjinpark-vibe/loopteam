/**
 * S4 입력 시트 (spec §6 S4 / §5 F1) — logs one ledger entry in <=3 taps.
 *
 * Scope for this task: 지출/수입 only (저축 shown disabled, F13 is a later
 * task). Saving hands the draft to the caller, which applies F1+F2 via
 * `entryActions.ts` — this component owns form state only.
 *
 * Built on TDS primitives end to end (idiomatic-TDS is an explicit rubric
 * sub-aspect, VISION.md): `SegmentedControl` for the type row, `NumberKeypad`
 * + a plain amount display for the amount (spec §6 S4 key elements: "numeric
 * keypad · amount display", not the OS keyboard), `WheelDatePicker` for the
 * date chip, `ChipItem` (in a wrapping grid, not TDS's `<Chip>` — that wraps
 * children in a horizontal scroller by design) for the category grid, and
 * `ConfirmDialog` for the touched-and-dismissing confirm (native
 * `window.confirm` blocks the main thread while open, and an Android WebView
 * host with no JS-confirm handler registered can suppress it outright).
 *
 * Field order in the DOM mirrors F1's spec order (type -> amount -> category
 * -> date -> memo); `NumberKeypad` sits directly under the amount readout —
 * not after date/memo — so amount entry never needs the sheet scrolled at
 * the 390x844 reference viewport.
 */
import { useEffect, useRef, useState } from "react";
import {
  BottomSheet,
  Button,
  ChipItem,
  ConfirmDialog,
  NumberKeypad,
  SegmentedControl,
  TextField,
  WheelDatePicker,
} from "@toss/tds-mobile";
import type { EntryDraft } from "../entryActions";
import { CATEGORIES_BY_TYPE } from "../content.placeholder";
import { commaizeAmount, krwReadingHint } from "../format";
import { dateToYmd, ymdToDate } from "../platform/clock";
import type { CategoryId, EntryType } from "../types";

export interface EntrySheetProps {
  open: boolean;
  today: string; // 'YYYY-MM-DD' — the date field defaults to this and may never go past it
  onClose: () => void;
  onSave: (draft: EntryDraft) => void;
}

const MEMO_MAX = 40;
const AMOUNT_DIGITS_MAX = 10; // ~99억 원 — a generous input ceiling, not a balance dial

export function EntrySheet({ open, today, onClose, onSave }: EntrySheetProps) {
  const [type, setType] = useState<EntryType>("expense");
  const [amountDigits, setAmountDigits] = useState(""); // normalized numeric string, no leading zeros
  const [categoryId, setCategoryId] = useState<CategoryId | null>(null);
  const [date, setDate] = useState(today);
  const [memo, setMemo] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Reset the form every time the sheet opens, and default the date to "today" at open time.
  useEffect(() => {
    if (!open) return;
    setType("expense");
    setAmountDigits("");
    setCategoryId(null);
    setDate(today);
    setMemo("");
    setConfirmOpen(false);
  }, [open, today]);

  const amountKrw = Number(amountDigits || "0");
  const canSave = amountKrw > 0 && categoryId !== null && date <= today;
  const categories = CATEGORIES_BY_TYPE[type];
  // Anything different from the sheet's just-opened defaults counts as
  // "touched" — F1 AC: dismiss must confirm if any field was touched.
  const touched = type !== "expense" || amountDigits !== "" || categoryId !== null || date !== today || memo !== "";

  // Mirrors the latest render's `touched`/`onClose` into a ref, written only
  // from an effect (never during render — see useTownStore.ts's doc comment
  // for why a mid-render ref write is unsafe under StrictMode) so the
  // Android-back `popstate` listener below never acts on a stale closure.
  const latestRef = useRef({ touched, onClose });
  useEffect(() => {
    latestRef.current = { touched, onClose };
  });

  function pressDigit(digit: string) {
    setAmountDigits((prev) => {
      const next = (prev + digit).replace(/^0+(?=\d)/, "");
      return next.length > AMOUNT_DIGITS_MAX ? prev : next;
    });
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
  // and on Android back." Both the backdrop tap and the back-guard's
  // `popstate` handler below call this.
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

  // ── Android back guard ──
  // §10.4: the host app owns the top-level back gesture, so an unhandled
  // hardware/gesture back pops the whole mini-app, not this sheet. Pushing
  // one history entry while the sheet is open turns that gesture into a
  // `popstate` this component can catch — the standard WebView-safe way to
  // make an in-page modal consume one "back" locally, no native bridge
  // required. If the form was touched, the guard is re-armed immediately so
  // the confirm dialog's "keep editing" choice still has back-press
  // protection.
  const guardPushed = useRef(false);
  useEffect(() => {
    if (!open) return;
    window.history.pushState({ entrySheet: true }, "");
    guardPushed.current = true;

    function onPopState() {
      guardPushed.current = false; // the browser already popped it
      const isTouched = latestRef.current.touched;
      if (isTouched) {
        window.history.pushState({ entrySheet: true }, "");
        guardPushed.current = true;
      }
      dismiss(isTouched);
    }

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (guardPushed.current) {
        guardPushed.current = false;
        window.history.back(); // closed some other way (save/backdrop/confirm) — consume the guard entry
      }
    };
  }, [open]);

  return (
    <>
      <BottomSheet
        open={open}
        onDimmerClick={() => dismiss(touched)}
        hasTextField
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
            <SegmentedControl.Item value="saving" disabled title="저축은 곧 지원돼요 (F13)">
              저축
            </SegmentedControl.Item>
          </SegmentedControl>

          <div className="entry-amount-display">
            <span className="entry-amount-value">{commaizeAmount(amountDigits || "0")}</span>
            <span className="entry-amount-suffix">원</span>
          </div>
          {amountKrw > 0 && <div className="entry-amount-hint">{krwReadingHint(amountKrw)}</div>}

          {/* Amount's own input control sits directly under its readout — spec
           * §6 S4 key elements list "numeric keypad · amount display" as one
           * pair, and F1's <=3-tap flow needs it on screen with no scroll at
           * the 390x844 reference viewport. */}
          <NumberKeypad onKeyClick={pressDigit} onBackspaceClick={pressBackspace} />

          {/* "icon grid" (spec §5 F1 / MVP-SPEC.md:201), not a horizontally
           * scrolling chip row — every category for the selected type must be
           * on screen at once. `<Chip>` wraps its children in a horizontal
           * scroller by design (TDS's filter-chip pattern), so the grid here
           * is plain `ChipItem`s in a wrapping flex container instead. */}
          <div className="category-grid" role="group" aria-label="카테고리 선택">
            {categories.map((c) => (
              <ChipItem
                key={c.id}
                as="button"
                selected={c.id === categoryId}
                left={<span aria-hidden="true">{c.icon}</span>}
                onClick={() => setCategoryId(c.id)}
              >
                {c.label}
              </ChipItem>
            ))}
          </div>

          <WheelDatePicker
            title="날짜 선택"
            triggerLabel="날짜"
            value={ymdToDate(date)}
            max={ymdToDate(today)}
            onChange={(d) => setDate(dateToYmd(d))}
          />

          <TextField
            variant="box"
            label="메모"
            placeholder="메모 (선택)"
            value={memo}
            maxLength={MEMO_MAX}
            onChange={(e) => setMemo(e.target.value.slice(0, MEMO_MAX))}
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
