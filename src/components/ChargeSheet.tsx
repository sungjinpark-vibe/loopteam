/**
 * S8 캐시 충전 STUB — PM-DECISIONS §F-ECON. Lists packages (씨앗 for KRW) with a
 * disabled-LOOKING primary action (`.charge-buy-btn` in `shop.css`, grey/weak
 * — the element itself stays a real, tappable `<button>`, because the spec
 * requires the tap to actually fire and show the stub message, not silently
 * no-op via the native `disabled` attribute). Tapping ANY package's button
 * shows exactly one message, verbatim: "토스 결제 연동은 추후 지원됩니다" — and
 * does NOTHING else. No seeds are granted, no receipt, no economy prop is
 * even accepted by this component, so there is no state here that COULD be
 * mutated into a fake success.
 *
 * This file must never import a payment bridge symbol (`checkoutPayment`,
 * `requestTossPayPaysBilling`, `@apps-in-toss/web-bridge` or any other) and
 * never add anything to `granite.config.ts`'s `permissions` array — both are
 * gate-checked (see `paymentBridge.test.ts`, a repo-wide grep-style test, and
 * ADDENDUM-05 §6's own requirement list).
 *
 * The KRW price and any seed count are kept typographically non-parallel
 * (spec requirement) by construction: the seed count only ever appears
 * embedded in a Korean sentence (`.charge-package-desc`, prose, not a bare
 * figure), never as a standalone number next to the price — so the two can
 * never be read side by side as a computable exchange rate (also banned
 * outright, separately, everywhere in the shop).
 */
import { useState } from "react";
import { BottomSheet } from "@toss/tds-mobile";
import "../shop.css";
import { formatKrw } from "../format";
import { useBackGuard } from "../hooks/useBackGuard";

export interface ChargeSheetProps {
  open: boolean;
  onClose: () => void;
}

const STUB_MESSAGE = "토스 결제 연동은 추후 지원됩니다";

interface ChargePackage {
  id: string;
  /** A friendly pack name — deliberately not "N개" so it never doubles as a bare seed figure next to the price. */
  name: string;
  seedDesc: string; // full sentence, e.g. "씨앗 500개가 들어있어요" — prose, not a tabular number
  krw: number;
}

const CHARGE_PACKAGES: readonly ChargePackage[] = [
  { id: "pack.sprout", name: "새싹팩", seedDesc: "씨앗 500개가 들어있어요", krw: 1200 },
  { id: "pack.tree", name: "나무팩", seedDesc: "씨앗 1500개가 들어있어요", krw: 3000 },
  { id: "pack.fruit", name: "열매팩", seedDesc: "씨앗 4000개가 들어있어요", krw: 7500 },
];

export function ChargeSheet({ open, onClose }: ChargeSheetProps) {
  const [tapped, setTapped] = useState(false);

  const [shownOpen, setShownOpen] = useState(false);
  if (open && !shownOpen) {
    setShownOpen(true);
  } else if (!open && shownOpen) {
    setShownOpen(false);
    setTapped(false);
  }

  useBackGuard(open, false, onClose);

  return (
    <BottomSheet open={open} onDimmerClick={onClose} maxHeight="80vh" header={<div className="entry-sheet-title">충전소</div>}>
      <div className="charge-sheet-body">
        <p className="charge-stub-banner">충전 기능은 준비 중이에요</p>
        <ul className="charge-package-list">
          {CHARGE_PACKAGES.map((pack) => (
            <li key={pack.id} className="charge-package">
              <div className="charge-package-name">{pack.name}</div>
              <p className="charge-package-desc">{pack.seedDesc}</p>
              <button type="button" className="charge-buy-btn" onClick={() => setTapped(true)}>
                {formatKrw(pack.krw)}
              </button>
            </li>
          ))}
        </ul>
        {tapped && (
          <p className="charge-stub-notice" role="status">
            {STUB_MESSAGE}
          </p>
        )}
      </div>
    </BottomSheet>
  );
}
