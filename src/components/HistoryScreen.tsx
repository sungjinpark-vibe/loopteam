/**
 * S3 기록 (spec §6 S3 / §5 F8) — the ledger-utility tab: "is my money OK?"
 * Month ‹ › nav, totals row, budget-pace bar, expense category donut, and a
 * reverse-chronological day-grouped entry list. Tapping a row opens S5
 * (`EntryDetailSheet`) for edit/delete (F9).
 *
 * Reuses the store's own storage/selector layer end to end — no local
 * re-derivation: `monthTotals`/`categoryDonut`/`dayGroups`/`budgetPace`/
 * `moodTier` (selectors.ts) do the math, `ensureMonthLoaded`/`getMonthEntries`
 * (useTownStore.ts) own the "only the viewed month's chunk loads" contract
 * (§8.4/AC), and `updateEntry`/`deleteEntry` are the same functions F9 tests
 * against directly.
 */
import { useEffect, useMemo, useState } from "react";
import { colors } from "@toss/tds-colors";
import { Button } from "@toss/tds-mobile";
import { BALANCE } from "../balance.placeholder";
import { monthAfter, monthBefore, parseYm } from "../calendar";
import { CATEGORY_CONTENT } from "../content.placeholder";
import { commaizeAmount } from "../format";
import { budgetPace, categoryDonut, dayGroups, monthTotals, moodTier, type DonutSlice } from "../selectors";
import type { EntryEditPatch, TownStore } from "../useTownStore";
import type { LedgerEntry } from "../types";
import { EntryDetailSheet } from "./EntryDetailSheet";

export interface HistoryScreenProps {
  store: Pick<
    TownStore,
    "today" | "budgetKrw" | "noSpendDays" | "getMonthEntries" | "ensureMonthLoaded" | "updateEntry" | "deleteEntry"
  >;
}

function formatKrw(amountKrw: number): string {
  return `${commaizeAmount(String(amountKrw))}원`;
}

function formatMonthLabel(ym: string): string {
  const { y, m } = parseYm(ym);
  return `${y}년 ${m}월`;
}

function formatDayLabel(date: string): string {
  return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;
}

// One paint colour per mood bucket (F6's own 3-bucket placeholder,
// BALANCE.moodPaceThresholds) — reused here for the pace bar fill so 기록
// agrees with S2's sky mood instead of inventing a second palette. `-1`
// (neutral, no budget set) never reaches this — callers only look it up once
// `pace !== null`.
const PACE_COLORS = [colors.green500, colors.yellow500, colors.red500];

function donutBackground(slices: readonly DonutSlice[]): string {
  let acc = 0;
  const stops = slices.map((s) => {
    const from = acc;
    acc += s.percent;
    return `${CATEGORY_CONTENT[s.categoryId]?.color ?? colors.grey400} ${from}% ${acc}%`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

export function HistoryScreen({ store }: HistoryScreenProps) {
  const { today, budgetKrw, noSpendDays, getMonthEntries, ensureMonthLoaded, updateEntry, deleteEntry } = store;
  const [ym, setYm] = useState(() => today.slice(0, 7));
  const [selected, setSelected] = useState<{ entry: LedgerEntry; ym: string } | null>(null);

  // F8 AC / §8.4: only the VIEWED month's entries chunk loads — a no-op for
  // the current month (already resident in `useTownStore`'s own state) and a
  // single chunk read for any other month, cached for the rest of the
  // session by the store itself.
  useEffect(() => {
    ensureMonthLoaded(ym);
  }, [ym, ensureMonthLoaded]);

  const entries = getMonthEntries(ym);
  // Perf (rubric C4, round-1 finding): `dayGroups` sorts within every group
  // and `categoryDonut`/`monthTotals`/`budgetPace` are each an O(n) scan —
  // cheap for a normal month, but a dense one (300+ entries, spec's own
  // stress case) redid all four on EVERY render with no memoization. `entries`
  // is a stable array reference from the store for a given `ym` (only a new
  // add/edit/delete replaces it), so keying on it (not on its contents) is
  // both correct and cheap to check.
  const totals = useMemo(() => monthTotals(entries, ym), [entries, ym]);
  const pace = useMemo(() => budgetPace(entries, ym, budgetKrw, today), [entries, ym, budgetKrw, today]);
  const mood = moodTier(pace, BALANCE.moodPaceThresholds);
  const donut = useMemo(() => categoryDonut(entries, ym), [entries, ym]);
  const groups = useMemo(() => dayGroups(entries, noSpendDays, ym), [entries, noSpendDays, ym]);
  const currentYm = today.slice(0, 7);
  const grandExpense = donut.reduce((sum, s) => sum + s.totalKrw, 0);

  function openRow(entry: LedgerEntry) {
    setSelected({ entry, ym });
  }

  function handleSave(patch: EntryEditPatch) {
    if (!selected) return;
    updateEntry(selected.entry.id, selected.ym, patch);
    setSelected(null);
  }

  function handleDelete() {
    if (!selected) return;
    deleteEntry(selected.entry.id, selected.ym);
    setSelected(null);
  }

  return (
    <div className="history-screen">
      <header className="history-month-nav">
        <Button as="button" variant="weak" size="small" aria-label="이전 달" onClick={() => setYm((y) => monthBefore(y))}>
          ‹
        </Button>
        <span className="history-month-label">{formatMonthLabel(ym)}</span>
        <Button
          as="button"
          variant="weak"
          size="small"
          aria-label="다음 달"
          disabled={ym >= currentYm}
          onClick={() => setYm((y) => monthAfter(y))}
        >
          ›
        </Button>
      </header>

      {groups.length === 0 ? (
        <div className="town-empty-state">
          <p>이 달엔 기록이 없어요</p>
        </div>
      ) : (
        <>
          <div className="history-totals">
            <div className="history-total-item">
              <span className="history-total-label">지출</span>
              <span className="history-total-value">{formatKrw(totals.expenseKrw)}</span>
            </div>
            <div className="history-total-item">
              <span className="history-total-label">수입</span>
              <span className="history-total-value">{formatKrw(totals.incomeKrw)}</span>
            </div>
            <div className="history-total-item">
              <span className="history-total-label">저축</span>
              <span className="history-total-value">{formatKrw(totals.savingKrw)}</span>
            </div>
            <div className="history-total-item">
              <span className="history-total-label">순액</span>
              <span className="history-total-value">{formatKrw(totals.netKrw)}</span>
            </div>
          </div>

          <div className="history-pace">
            {pace === null ? (
              <p className="history-pace-empty">예산을 정하면 이번 달 페이스를 볼 수 있어요</p>
            ) : (
              <>
                <div className="history-pace-bar">
                  <div
                    className="history-pace-bar-fill"
                    style={{ width: `${Math.min(pace, 1) * 100}%`, background: PACE_COLORS[mood] ?? PACE_COLORS[0] }}
                  />
                </div>
                <span className="history-pace-label">예산의 {Math.round(pace * 100)}%</span>
              </>
            )}
          </div>

          <section className="history-donut-section" aria-label="카테고리별 지출">
            {donut.length === 0 ? (
              <p className="history-donut-empty">이 달엔 지출 내역이 없어요</p>
            ) : (
              <>
                <div className="history-donut" style={{ background: donutBackground(donut) }} aria-hidden="true" />
                <ul className="history-donut-legend">
                  {donut.map((s) => (
                    <li key={s.categoryId} className="history-donut-legend-item">
                      <span className="history-donut-swatch" style={{ background: CATEGORY_CONTENT[s.categoryId]?.color }} />
                      <span className="history-donut-legend-label">{CATEGORY_CONTENT[s.categoryId]?.label ?? s.categoryId}</span>
                      <span className="history-donut-legend-amount">{formatKrw(s.totalKrw)}</span>
                      <span className="history-donut-legend-percent">{s.percent}%</span>
                    </li>
                  ))}
                </ul>
                <p className="history-donut-total">총 {formatKrw(grandExpense)}</p>
              </>
            )}
          </section>

          <ul className="history-day-list">
            {groups.map((g) => (
              <li key={g.date} className="history-day-group">
                <div className="history-day-header">
                  <span className="history-day-date">{formatDayLabel(g.date)}</span>
                  <span className="history-day-subtotal">{formatKrw(g.incomeKrw - g.expenseKrw)}</span>
                </div>
                {g.isNoSpend && (
                  <div className="history-row history-row--nospend">
                    <span className="history-row-icon" aria-hidden="true">
                      {CATEGORY_CONTENT.park.icon}
                    </span>
                    <span className="history-row-label">무지출 데이</span>
                    <span className="history-row-amount">0원</span>
                  </div>
                )}
                {g.entries.map((e) => (
                  <button key={e.id} type="button" className="history-row" onClick={() => openRow(e)}>
                    <span className="history-row-icon" aria-hidden="true">
                      {CATEGORY_CONTENT[e.categoryId]?.icon ?? "•"}
                    </span>
                    <span className="history-row-label">
                      {CATEGORY_CONTENT[e.categoryId]?.label ?? e.categoryId}
                      {e.memo && <span className="history-row-memo"> · {e.memo}</span>}
                    </span>
                    <span className={`history-row-amount history-row-amount--${e.type}`}>
                      {e.type === "expense" ? "-" : e.type === "income" ? "+" : ""}
                      {formatKrw(e.amountKrw)}
                    </span>
                  </button>
                ))}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* NOT keyed by entry id — a single persistent instance, same as
          EntrySheet. `EntryDetailSheet` resets its own form state DURING
          RENDER when `entry.id` changes (its own doc comment) so the sheet
          never shows a stale default, without breaking `BottomSheet`'s
          false -> true open transition (remounting already-`open` would —
          see that doc comment for how round-1's `key` attempt broke this). */}
      <EntryDetailSheet
        open={selected !== null}
        entry={selected?.entry ?? null}
        today={today}
        onClose={() => setSelected(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}
