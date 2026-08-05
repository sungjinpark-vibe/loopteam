/**
 * S6 설정 시트 (spec §6 S6) — sheet over S3 (기록): town name, monthly budget
 * (F6's "editable from 기록" entry point — `useTownStore.setBudget` propagates
 * to both S2's mood and 기록's own pace bar, since both read the same
 * `budgetKrw`/`budgetPace`/`moodTier` chain), and 데이터 초기화.
 *
 * 내보내기/가져오기 (F12) are OUT OF SCOPE for this task (a separate follow-up,
 * T014) — the two rows below are reserved slots only, disabled, with no
 * export/import logic behind them, so T014 drops its handlers in without
 * restructuring this sheet.
 *
 * Town name / budget commit on blur AND on dismiss (round-2 fix, C1 finding
 * #1) — unlike EntrySheet/EntryDetailSheet's "confirm before discarding",
 * a settings field is lower-stakes than an entry: there is nothing to
 * confirm because dismissing never throws work away, it COMMITS whatever
 * draft is sitting in the fields (same values `onBlur` would have saved,
 * just also on backdrop-tap/Android-back so an edit that never blurred —
 * e.g. type digits then immediately hit back — is not silently lost).
 *
 * `useBackGuard` (same pattern as `EntrySheet.tsx`/`EntryDetailSheet.tsx`) is
 * required here too: §10.4 — an unhandled hardware/gesture back pops the
 * WHOLE mini-app, not just this sheet. The 초기화 `ConfirmDialog` shares the
 * same one guard (`confirmResetOpen` doubles as the hook's `touched` flag) —
 * a back press while it's open closes just the confirm and RE-ARMS the
 * guard (the hook only re-pushes its history entry when `touched` is true),
 * so a second back press still closes the sheet instead of leaking through
 * to the host app; a back press with the confirm already closed commits the
 * drafts and closes the sheet in one step, consuming the guard's entry (no
 * re-arm needed since the sheet itself is going away).
 */
import { useState } from "react";
import { BottomSheet, Button, ConfirmDialog, TextField } from "@toss/tds-mobile";
import { commaizeAmount, decommaizeAmount } from "../format";
import { useBackGuard } from "../hooks/useBackGuard";

export interface SettingsSheetProps {
  open: boolean;
  townName: string;
  budgetKrw: number | null;
  onClose: () => void;
  onSaveTownName: (name: string) => void;
  onSaveBudget: (krw: number | null) => void;
  onResetAll: () => void;
}

const TOWN_NAME_MAX = 20;

export function SettingsSheet({
  open,
  townName,
  budgetKrw,
  onClose,
  onSaveTownName,
  onSaveBudget,
  onResetAll,
}: SettingsSheetProps) {
  const [nameDraft, setNameDraft] = useState(townName);
  const [budgetDigits, setBudgetDigits] = useState(budgetKrw === null ? "" : String(budgetKrw));
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  // Same "reset form state DURING RENDER on open" pattern EntryDetailSheet
  // uses (its own doc comment) — this component stays mounted across opens
  // (BottomSheet only transitions false->true on an already-mounted
  // instance), so a stale draft from a prior open must not leak into the next
  // one, and a `useEffect` would run one paint too late.
  const [shownOpen, setShownOpen] = useState(false);
  if (open && !shownOpen) {
    setShownOpen(true);
    setNameDraft(townName);
    setBudgetDigits(budgetKrw === null ? "" : String(budgetKrw));
  } else if (!open && shownOpen) {
    setShownOpen(false);
  }

  function commitName() {
    const trimmed = nameDraft.trim().slice(0, TOWN_NAME_MAX);
    if (trimmed === "") {
      setNameDraft(townName); // empty name is not a legal town name — revert instead of saving it
      return;
    }
    setNameDraft(trimmed);
    if (trimmed !== townName) onSaveTownName(trimmed);
  }

  function commitBudget() {
    const next = budgetDigits === "" ? null : Number(budgetDigits);
    if (next !== budgetKrw) onSaveBudget(next);
  }

  function handleResetConfirmed() {
    setConfirmResetOpen(false);
    onResetAll();
    onClose();
  }

  // Backdrop tap / Android back — see the file doc for why this commits
  // instead of confirming a discard, and why `confirmResetOpen` is the guard's
  // `touched` flag.
  function dismiss(resetConfirmOpen: boolean) {
    if (resetConfirmOpen) {
      setConfirmResetOpen(false);
      return;
    }
    commitName();
    commitBudget();
    onClose();
  }

  useBackGuard(open, confirmResetOpen, dismiss);

  return (
    <>
      <BottomSheet
        open={open}
        onDimmerClick={() => dismiss(confirmResetOpen)}
        maxHeight="80vh"
        header={<div className="entry-sheet-title">설정</div>}
      >
        <div className="settings-sheet-body">
          <TextField
            variant="box"
            label="마을 이름"
            value={nameDraft}
            maxLength={TOWN_NAME_MAX}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
          />

          <TextField
            variant="box"
            label="월 예산"
            placeholder="예산을 정하지 않았어요"
            inputMode="numeric"
            value={budgetDigits === "" ? "" : `${commaizeAmount(budgetDigits)}원`}
            onChange={(e) => setBudgetDigits(decommaizeAmount(e.target.value))}
            onBlur={commitBudget}
          />

          <ul className="settings-row-list">
            {/* F12 (T014, out of scope here) — reserved rows, no logic wired. */}
            <li className="settings-row settings-row--stub" aria-disabled="true">
              <span>내보내기</span>
              <span className="settings-row-hint">곧 지원돼요</span>
            </li>
            <li className="settings-row settings-row--stub" aria-disabled="true">
              <span>가져오기</span>
              <span className="settings-row-hint">곧 지원돼요</span>
            </li>
          </ul>

          <Button
            as="button"
            color="danger"
            variant="weak"
            display="block"
            size="large"
            onClick={() => setConfirmResetOpen(true)}
          >
            데이터 초기화
          </Button>
        </div>
      </BottomSheet>

      {/* Destructive-action confirm (S6 AC: "a real destructive-action confirm"), same ConfirmDialog pattern as F9's delete (EntryDetailSheet.tsx). */}
      <ConfirmDialog
        open={confirmResetOpen}
        title="모든 데이터를 초기화할까요?"
        description="마을, 내역, 예산까지 전부 사라지고 되돌릴 수 없어요."
        onClose={() => setConfirmResetOpen(false)}
        cancelButton={<ConfirmDialog.CancelButton onClick={() => setConfirmResetOpen(false)}>취소</ConfirmDialog.CancelButton>}
        confirmButton={<ConfirmDialog.ConfirmButton onClick={handleResetConfirmed}>초기화</ConfirmDialog.ConfirmButton>}
      />
    </>
  );
}
