/**
 * S6 설정 시트 (spec §6 S6) — sheet over S3 (기록): town name, monthly budget
 * (F6's "editable from 기록" entry point — `useTownStore.setBudget` propagates
 * to both S2's mood and 기록's own pace bar, since both read the same
 * `budgetKrw`/`budgetPace`/`moodTier` chain), 데이터 초기화, and 내보내기/가져오기
 * (F12).
 *
 * F12: 내보내기 hands the sheet a ready `{ json, filename }` pair
 * (`useTownStore.exportData` — `storage.ts`'s `exportAll` + `serializeExport`,
 * both time-budgeted/yielded so a dense town's export never blocks the main
 * thread, §10.4) and this file owns the one piece of actual browser glue — a
 * Blob + `<a download>` click, the standard way to save a file from a WebView
 * (this task's brief: no Apps-in-Toss file SDK exists or is needed for
 * this). `isExporting` disables the row and swaps its label while the export
 * promise is in flight (round-1 finding C4 #2: an export can genuinely take
 * a while over a dense town, and the button must not be tappable again mid-
 * export) — with a `try`/`catch` around it so a throwing export surfaces an
 * inline error instead of an unhandled rejection (round-1 finding C3).
 *
 * 가져오기 opens a native `<input type="file">`, reads the picked file's
 * text (also `.catch`-guarded — an unreadable/removed file shows an error,
 * not a silent no-op, round-1 finding C3), then — same destructive-action
 * pattern as 초기화 below — requires an explicit `ConfirmDialog` confirm
 * BEFORE `onImport` (which does the actual parse/validate/replace,
 * `storage.ts`'s `importAll`) is ever called; a rejected import (bad
 * schemaVersion, malformed JSON) shows the returned error inline and never
 * reaches the confirm-consuming step, so existing state is untouched either
 * way.
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
 * WHOLE mini-app, not just this sheet. Both `ConfirmDialog`s (초기화 AND F12's
 * 가져오기 confirm) share the same one guard — `confirmResetOpen ||
 * importConfirmOpen` doubles as the hook's `touched` flag — a back press
 * while either is open closes just that confirm and RE-ARMS the guard (the
 * hook only re-pushes its history entry when `touched` is true), so a second
 * back press still closes the sheet instead of leaking through to the host
 * app; a back press with both confirms already closed commits the drafts and
 * closes the sheet in one step, consuming the guard's entry (no re-arm
 * needed since the sheet itself is going away).
 */
import { useRef, useState, type ChangeEvent } from "react";
import { BottomSheet, Button, ConfirmDialog, TextField } from "@toss/tds-mobile";
import { commaizeAmount, decommaizeAmount } from "../format";
import { useBackGuard } from "../hooks/useBackGuard";

export type ImportOutcome = { ok: true } | { ok: false; error: string };

export interface SettingsSheetProps {
  open: boolean;
  townName: string;
  budgetKrw: number | null;
  onClose: () => void;
  onSaveTownName: (name: string) => void;
  onSaveBudget: (krw: number | null) => void;
  onResetAll: () => void;
  /** F12 — returns the file to download; this component owns triggering the actual browser download. */
  onExport: () => Promise<{ json: string; filename: string }>;
  /** F12 — parses/validates/replaces state; returns an error to show inline when rejected. */
  onImport: (rawJson: string) => Promise<ImportOutcome>;
}

/** F12's one piece of browser glue — save `json` as a downloadable file via the standard Blob + `<a download>` pattern (no native file-system SDK; §10.2/this task's own "Toss mini-app constraint"). */
function downloadJsonFile(json: string, filename: string): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
  onExport,
  onImport,
}: SettingsSheetProps) {
  const [nameDraft, setNameDraft] = useState(townName);
  const [budgetDigits, setBudgetDigits] = useState(budgetKrw === null ? "" : String(budgetKrw));
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  // F12 가져오기: the picked file's already-read text, held only between
  // "file chosen" and "confirm/cancel" — never touches storage until
  // `handleImportConfirmed` explicitly calls `onImport`.
  const [pendingImportJson, setPendingImportJson] = useState<string | null>(null);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  // F12 내보내기 — in-flight guard: disables the row and blocks a second tap
  // while `onExport` (which can genuinely take a while over a dense town,
  // §10.4) is still running.
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function handleExportClick() {
    if (isExporting) return; // already in flight — the row is disabled, but guard a stray double-invoke too
    setIsExporting(true);
    setExportError(null);
    try {
      const { json, filename } = await onExport();
      downloadJsonFile(json, filename);
    } catch {
      setExportError("내보내기에 실패했어요. 다시 시도해주세요.");
    } finally {
      setIsExporting(false);
    }
  }

  function handleFilePicked(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // clears the picker so re-selecting the SAME file still fires onChange next time
    if (!file) return;
    setImportError(null);
    void file.text().then(
      (text) => {
        setPendingImportJson(text);
        setImportConfirmOpen(true);
      },
      () => setImportError("파일을 읽을 수 없어요. 다시 시도해주세요."),
    );
  }

  async function handleImportConfirmed() {
    setImportConfirmOpen(false);
    if (pendingImportJson === null) return;
    const json = pendingImportJson;
    setPendingImportJson(null);
    const result = await onImport(json);
    if (result.ok) {
      setImportError(null);
      onClose();
    } else {
      setImportError(result.error);
    }
  }

  function handleImportCanceled() {
    setImportConfirmOpen(false);
    setPendingImportJson(null);
  }

  // Backdrop tap / Android back — see the file doc for why this commits
  // instead of confirming a discard, and why `confirmResetOpen`/
  // `importConfirmOpen` are the guard's `touched` flag.
  function dismiss(anyConfirmOpen: boolean) {
    if (anyConfirmOpen) {
      setConfirmResetOpen(false);
      handleImportCanceled();
      return;
    }
    commitName();
    commitBudget();
    onClose();
  }

  useBackGuard(open, confirmResetOpen || importConfirmOpen, dismiss);

  return (
    <>
      <BottomSheet
        open={open}
        onDimmerClick={() => dismiss(confirmResetOpen || importConfirmOpen)}
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
            {/* F12 — 내보내기: no confirm needed, non-destructive (just a download). Disabled + relabeled while in flight (round-1 finding C4 #2). */}
            <li>
              <button
                type="button"
                className="settings-row settings-row-action"
                disabled={isExporting}
                aria-busy={isExporting}
                onClick={() => void handleExportClick()}
              >
                {isExporting ? "내보내는 중…" : "내보내기"}
              </button>
            </li>
            {/* F12 — 가져오기: native file picker, then the destructive-action confirm below before anything is replaced. */}
            <li>
              <button type="button" className="settings-row settings-row-action" onClick={() => fileInputRef.current?.click()}>
                가져오기
              </button>
            </li>
          </ul>
          {(importError ?? exportError) && <p className="settings-import-error">{importError ?? exportError}</p>}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="settings-file-input"
            aria-hidden="true"
            tabIndex={-1}
            onChange={handleFilePicked}
          />

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

      {/* F12 — same destructive-action confirm pattern, gating the actual replace (`onImport`) behind an explicit tap. */}
      <ConfirmDialog
        open={importConfirmOpen}
        title="데이터를 가져올까요?"
        description="지금 있는 마을, 내역, 예산이 모두 파일 내용으로 바뀌고 되돌릴 수 없어요."
        onClose={handleImportCanceled}
        cancelButton={<ConfirmDialog.CancelButton onClick={handleImportCanceled}>취소</ConfirmDialog.CancelButton>}
        confirmButton={<ConfirmDialog.ConfirmButton onClick={() => void handleImportConfirmed()}>덮어쓰기</ConfirmDialog.ConfirmButton>}
      />
    </>
  );
}
