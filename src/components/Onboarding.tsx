/**
 * S1 cold-start onboarding — MVP-SPEC's own feature list names this screen;
 * it shipped hardcoded off (`useTownStore.ts`'s old `onboarded: true` "out of
 * scope" note) and the round-1 5-expert playtest flagged the gap as the
 * single most common finding across all five lenses (game-designer -6,
 * ux-researcher -4, liveops-pd -3, qa-lead -4, target-player -6): a cold
 * start shows game-economy jargon ("남은 건축 슬롯 10/10", a Tier badge, "연속
 * 0일") with zero explanation, for a non-gamer-first audience inside a
 * banking app.
 *
 * Deliberately small — a 3-beat, skippable overlay, not a full carousel
 * framework: beat 1 names the loop, beat 2 defines the two jargon terms on
 * screen one, beat 3 asks for a budget so the mood/weather layer (F6) isn't
 * dormant on day one (liveops-pd's TOP FIX). Skipping at any beat commits
 * onboarding as done without setting a budget — the player can always set
 * one later from 설정, and this overlay must never be the ONLY way to reach
 * the app (an unskippable first-run flow is its own drop-out risk).
 *
 * Fires once: `useTownStore`'s `onboarded` flips true (persisted) the moment
 * this unmounts via `onComplete`, for a genuinely fresh install only — an
 * existing player's data (including a corruption-recovered town, `storage.ts`)
 * already carries `onboarded: true` and never sees this again.
 */
import { useEffect, useRef, useState } from "react";
import { Button, TextField } from "@toss/tds-mobile";
import { commaizeAmount, decommaizeAmount } from "../format";

export interface OnboardingProps {
  dailyBuildSlots: number;
  onSetBudget: (monthlyBudgetKrw: number | null) => void;
  onComplete: () => void;
}

const BEATS = 3;

export function Onboarding({ dailyBuildSlots, onSetBudget, onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [budgetDigits, setBudgetDigits] = useState("");

  // The overlay declares `aria-modal`, so focus must actually start inside it —
  // without this a screen-reader user lands on the town header behind and can
  // swipe straight past a screen that claims to be modal. Focus-moving only;
  // no trap (the shell behind stays reachable by Tab).
  // ponytail: no focus trap / no `inert` on the shell — add if this ever ships
  // anywhere but a mobile WebView, where Tab navigation effectively doesn't exist.
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    cardRef.current?.focus();
  }, []);

  // Gate-3 follow-up (A4): the last beat's CTA was tappable with an empty
  // field AND with a literal "0", both of which persist nothing usable — a 0
  // budget is indistinguishable from "unset" downstream (`selectors.budgetPace`
  // returns a null pace for both) yet the player believes they set one. Same
  // validation shape `EntrySheet` already uses for 저장 (`disabled={!canSave}`
  // on the TDS Button): the CTA is disabled until the field holds a real
  // amount, and 건너뛰기 — right there on the card — remains the way to start
  // without a budget.
  const budgetKrw = budgetDigits === "" ? 0 : Number(budgetDigits);
  const canStart = Number.isFinite(budgetKrw) && budgetKrw > 0;

  /** 건너뛰기 — completes without ever writing a budget the player didn't set. */
  function skip() {
    onComplete();
  }

  /** 시작하기 — only reachable with a valid budget (`canStart`), so it always commits one. */
  function finish() {
    if (!canStart) return; // defensive — the CTA is already disabled
    onSetBudget(budgetKrw);
    onComplete();
  }

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-label="시작하기">
      <div className="onboarding-card" ref={cardRef} tabIndex={-1}>
        <button type="button" className="onboarding-skip" onClick={skip}>
          건너뛰기
        </button>

        {step === 0 && (
          <div className="onboarding-beat">
            <div className="onboarding-emoji" aria-hidden="true">
              🏙️
            </div>
            <h2>지출을 기록하면 우리 동네에 건물이 하나 생겨요</h2>
            <p>커피 한 잔, 버스비 하나까지 — 기록할 때마다 동네가 자라나요.</p>
          </div>
        )}

        {step === 1 && (
          <div className="onboarding-beat">
            <div className="onboarding-emoji" aria-hidden="true">
              🧱
            </div>
            <h2>
              하루에 {dailyBuildSlots}채까지 지을 수 있어요.
              <br />
              넘으면 내일 아침에 지어드려요.
            </h2>
            <p>매일 기록을 이어가면 연속 기록 일수와 Tier가 올라가요. 저축은 슬롯을 쓰지 않고 따로 쌓여요.</p>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-beat">
            <div className="onboarding-emoji" aria-hidden="true">
              🌤️
            </div>
            <h2>이번 달 예산을 정해두면 동네 날씨가 생겨요</h2>
            <p>페이스에 맞게 맑음·흐림·비로 바뀌어요. 나중에 설정에서 언제든 바꿀 수 있어요.</p>
            <TextField
              variant="box"
              // No longer "(선택)": 시작하기 now requires a real amount, and
              // 건너뛰기 is the labelled way past this beat without one.
              label="월 예산"
              placeholder="예: 800,000"
              inputMode="numeric"
              value={budgetDigits === "" ? "" : `${commaizeAmount(budgetDigits)}원`}
              onChange={(e) => setBudgetDigits(decommaizeAmount(e.target.value))}
            />
          </div>
        )}

        <div className="onboarding-dots" aria-hidden="true">
          {Array.from({ length: BEATS }, (_, i) => (
            <span key={i} className={`onboarding-dot${i === step ? " onboarding-dot--active" : ""}`} />
          ))}
        </div>

        <Button
          as="button"
          color="primary"
          variant="fill"
          size="large"
          display="block"
          // A4 — only the final beat validates; 다음 is never gated.
          disabled={step === BEATS - 1 && !canStart}
          onClick={() => (step < BEATS - 1 ? setStep(step + 1) : finish())}
        >
          {step < BEATS - 1 ? "다음" : "시작하기"}
        </Button>
      </div>
    </div>
  );
}
