/**
 * Shared form body for S4 (`EntrySheet`) and S5 (`EntryDetailSheet`) — amount
 * readout + keypad, category grid, date picker, memo field. Factored out
 * (round of F9's implementation) once a second real caller needed the exact
 * same fields: the type segmented control and the sheet chrome (header/cta/
 * dismiss-confirm) differ between the two callers, but everything below "pick
 * a type" is identical, down to the CSS classes. No new dependency, no new
 * abstraction beyond "the same JSX, in one place" (rubric C3: reuse, not
 * reimplementation).
 */
import { ChipItem, NumberKeypad, TextField, WheelDatePicker } from "@toss/tds-mobile";
import { CATEGORIES_BY_TYPE } from "../content.placeholder";
import { commaizeAmount, krwReadingHint } from "../format";
import { dateToYmd, ymdToDate } from "../platform/clock";
import type { CategoryId, EntryType } from "../types";

const MEMO_MAX = 40;

export interface EntryFieldsProps {
  type: EntryType;
  amountDigits: string;
  onAmountDigit: (digit: string) => void;
  onAmountBackspace: () => void;
  categoryId: CategoryId | null;
  onSelectCategory: (id: CategoryId) => void;
  date: string; // 'YYYY-MM-DD'
  today: string; // max selectable date — never future (§8.3)
  onDateChange: (date: string) => void;
  memo: string;
  onMemoChange: (memo: string) => void;
}

export function EntryFields({
  type,
  amountDigits,
  onAmountDigit,
  onAmountBackspace,
  categoryId,
  onSelectCategory,
  date,
  today,
  onDateChange,
  memo,
  onMemoChange,
}: EntryFieldsProps) {
  const amountKrw = Number(amountDigits || "0");
  const categories = CATEGORIES_BY_TYPE[type];

  return (
    <>
      <div className="entry-amount-display">
        <span className="entry-amount-value">{commaizeAmount(amountDigits || "0")}</span>
        <span className="entry-amount-suffix">원</span>
      </div>
      {amountKrw > 0 && <div className="entry-amount-hint">{krwReadingHint(amountKrw)}</div>}

      <NumberKeypad className="entry-keypad" onKeyClick={onAmountDigit} onBackspaceClick={onAmountBackspace} />

      <div className="category-grid" role="group" aria-label="카테고리 선택">
        {categories.map((c) => (
          <ChipItem
            key={c.id}
            as="button"
            selected={c.id === categoryId}
            left={<span aria-hidden="true">{c.icon}</span>}
            // See EntrySheet's own note: `categories` here is always
            // CATEGORIES_BY_TYPE[expense|income|saving], never "park"/"invest".
            onClick={() => onSelectCategory(c.id as CategoryId)}
          >
            {c.label}
          </ChipItem>
        ))}
      </div>

      <WheelDatePicker
        title="날짜 선택"
        triggerLabel="날짜"
        value={ymdToDate(date)}
        initialDate={ymdToDate(date)}
        max={ymdToDate(today)}
        onChange={(d) => onDateChange(dateToYmd(d))}
      />

      <TextField
        variant="box"
        label="메모"
        placeholder="메모 (선택)"
        value={memo}
        maxLength={MEMO_MAX}
        onChange={(e) => onMemoChange(e.target.value.slice(0, MEMO_MAX))}
      />
    </>
  );
}
