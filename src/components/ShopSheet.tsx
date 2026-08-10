/**
 * S8 상점 시트 — PM-DECISIONS §F-ECON / ADDENDUM-05 §6. One `BottomSheet`,
 * three sections (건물 꾸미기 / 마을 꾸미기 / NPC), same structural pattern as
 * `SettingsSheet.tsx`/`MonumentDetailSheet.tsx`: a plain `<ul>` row list, a
 * `useBackGuard` so Android/gesture back closes only this sheet (§10.4 — an
 * unhandled back otherwise pops the whole mini-app), no `ConfirmDialog`
 * anywhere (a seed purchase is reversible in spirit — re-toggle application —
 * and never a data-loss risk, unlike 초기화/가져오기).
 *
 * The seed balance in the header is one of only two surfaces allowed to show
 * it (PM-DECISIONS §F-ECON) — rendered only via `formatSeeds` (the prop the
 * PM hands down; this file never imports the KRW formatter, same rule R-7
 * `src/economy/**` itself is bound by).
 *
 * Ownership vs. application: `economy.ownedSkus` is permanent once bought,
 * separate from where it's currently applied (ADDENDUM-03 DE-9 rule 4). A
 * 건물 꾸미기 sku is applied by picking one building from an inline list that
 * expands under its row (`pickingSkuId`); tapping a building already carrying
 * THIS sku clears it, tapping any other building overwrites whatever it had —
 * `applyBuildingSku` is keyed by buildingId, last write wins, no separate
 * "remove" UI needed. Monument/park are excluded from the picker: F16/F15
 * behaviour must never change, and mixing a cosmetic into either muddies
 * signals that are supposed to stay legible (monument = frozen record, park =
 * deliberately rare).
 *
 * `NPC_SLOT_SKU` is repeatable and never lands in `ownedSkus` (economy/types
 * .ts's own doc comment) — its row always shows a buy control, never "owned",
 * and is pre-emptively disabled with the cap message once `npcCount` (a prop,
 * already computed by the store) reaches `NPC_MAX_VISIBLE`, so a tap can
 * never even reach the "maxed" result in the common case. The `purchaseSku`
 * return value is still handled for every sku (race-safe fallback): "maxed"
 * shows the same cap message (never the insufficient-funds copy — the
 * player's balance was fine), "insufficient"/"alreadyOwned" show their own
 * short inline notices, "ok" clears any prior notice.
 */
import { useState } from "react";
import { BottomSheet } from "@toss/tds-mobile";
import "../shop.css";
import { CATEGORY_CONTENT } from "../content.placeholder";
import { NPC_MAX_VISIBLE, NPC_SLOT_SKU, seeds as toSeedCount, type EconomyState, type SeedCount } from "../economy/types";
import { hasAffordableUnowned, skusBySection, type ShopSku } from "../economy/skus";
import { useBackGuard } from "../hooks/useBackGuard";
import type { Building } from "../types";
import type { PurchaseSkuResult } from "../useTownStore";

export interface ShopSheetProps {
  open: boolean;
  onClose: () => void;
  economy: EconomyState;
  /** For the 건물 꾸미기 building picker only — monument/park entries are filtered out below. */
  buildings: Building[];
  /** Current NPC sprite count (store-computed, `1 + buildings.length + purchasedNpcSlots`, already capped). */
  npcCount: number;
  purchaseSku: (sku: string, priceSeeds: number) => PurchaseSkuResult;
  applyTownSku: (sku: string | null) => void;
  applyBuildingSku: (buildingId: string, sku: string | null) => void;
  formatSeeds: (n: SeedCount) => string;
  /** Opens the 충전소 stub. The parent closes this sheet first — two stacked bottom sheets share one dimmer and one back-guard entry. */
  onOpenCharge: () => void;
}

const SECTION_TITLES: Record<ShopSku["section"], string> = {
  building: "건물 꾸미기",
  town: "마을 꾸미기",
  npc: "NPC",
};

const RARITY_LABELS: Record<ShopSku["rarity"], string> = {
  common: "기본",
  rare: "레어",
  epic: "에픽",
};

const PURCHASE_ERROR_LABEL: Record<Exclude<PurchaseSkuResult, "ok">, string> = {
  insufficient: "씨앗이 부족해요",
  alreadyOwned: "이미 보유하고 있어요",
  maxed: "NPC를 더 놓을 수 없어요",
};

/** A building eligible for 건물 꾸미기 — excludes the monument (F16) and the park tile (F15), neither of which may change behaviour or visual rarity from a cosmetic. */
function decoTargetBuildings(buildings: Building[]): Building[] {
  return buildings.filter((b) => b.categoryId !== null && b.categoryId !== "park");
}

function buildingLabel(b: Building): string {
  const content = b.categoryId !== null ? CATEGORY_CONTENT[b.categoryId] : null;
  return content ? `${content.icon} ${content.label} · ${b.builtOn}` : b.id;
}

export function ShopSheet({
  open,
  onClose,
  economy,
  buildings,
  npcCount,
  purchaseSku,
  applyTownSku,
  applyBuildingSku,
  formatSeeds,
  onOpenCharge,
}: ShopSheetProps) {
  // Which 건물 꾸미기 row currently has its building picker expanded — at most
  // one at a time, closed whenever the sheet closes (reset below).
  const [pickingSkuId, setPickingSkuId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [shownOpen, setShownOpen] = useState(false);
  if (open && !shownOpen) {
    setShownOpen(true);
  } else if (!open && shownOpen) {
    setShownOpen(false);
    setPickingSkuId(null);
    setNotice(null);
  }

  function dismiss() {
    setPickingSkuId(null);
    onClose();
  }

  // The picker (if any) is the only "back should undo one step, not close
  // the sheet" state here — same pattern SettingsSheet's confirm dialogs use.
  useBackGuard(open, pickingSkuId !== null, (touched) => (touched ? setPickingSkuId(null) : dismiss()));

  function handlePurchase(sku: ShopSku) {
    const result = purchaseSku(sku.id, sku.priceSeeds);
    if (result === "ok") {
      setNotice(null);
      if (sku.section === "building") setPickingSkuId(sku.id);
    } else {
      setNotice(PURCHASE_ERROR_LABEL[result]);
    }
  }

  function handleBuildingPick(sku: ShopSku, building: Building) {
    const applied = economy.appliedByBuildingId[building.id] === sku.id;
    applyBuildingSku(building.id, applied ? null : sku.id);
  }

  function renderRow(sku: ShopSku) {
    const owned = !sku.repeatable && economy.ownedSkus.includes(sku.id);
    const npcMaxed = sku.id === NPC_SLOT_SKU && npcCount >= NPC_MAX_VISIBLE;
    const affordable = economy.seeds >= sku.priceSeeds;

    return (
      <li key={sku.id} className="shop-row">
        <div className="shop-row-main">
          <div className="shop-row-name">
            {sku.name}
            <span className={`shop-row-rarity shop-row-rarity--${sku.rarity}`}>{RARITY_LABELS[sku.rarity]}</span>
          </div>

          {owned ? (
            <span className="shop-row-owned">보유중</span>
          ) : npcMaxed ? (
            <span className="shop-row-unaffordable">{PURCHASE_ERROR_LABEL.maxed}</span>
          ) : (
            <button
              type="button"
              className={`shop-row-buy${affordable ? "" : " shop-row-buy--unaffordable"}`}
              disabled={!affordable}
              onClick={() => handlePurchase(sku)}
            >
              {formatSeeds(toSeedCount(sku.priceSeeds))}
            </button>
          )}
        </div>

        {owned && sku.section === "town" && (
          <button type="button" className="shop-row-apply" onClick={() => applyTownSku(economy.appliedTownSku === sku.id ? null : sku.id)}>
            {economy.appliedTownSku === sku.id ? "적용됨 · 해제하기" : "마을에 적용"}
          </button>
        )}

        {owned && sku.section === "building" && (
          <button type="button" className="shop-row-apply" onClick={() => setPickingSkuId(pickingSkuId === sku.id ? null : sku.id)}>
            {pickingSkuId === sku.id ? "건물 선택 닫기" : "적용할 건물 선택"}
          </button>
        )}

        {owned && sku.section === "building" && pickingSkuId === sku.id && (
          <ul className="shop-building-picker">
            {decoTargetBuildings(buildings).length === 0 ? (
              <li className="shop-building-picker-empty">적용할 건물이 아직 없어요</li>
            ) : (
              decoTargetBuildings(buildings).map((b) => {
                const applied = economy.appliedByBuildingId[b.id] === sku.id;
                return (
                  <li key={b.id}>
                    <button type="button" className={`shop-building-picker-item${applied ? " shop-building-picker-item--applied" : ""}`} onClick={() => handleBuildingPick(sku, b)}>
                      {buildingLabel(b)} {applied ? "· 적용됨" : ""}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </li>
    );
  }

  return (
    <BottomSheet
      open={open}
      onDimmerClick={dismiss}
      maxHeight="80vh"
      header={
        <div className="entry-sheet-title shop-header">
          <span>상점</span>
          <span className="shop-balance">{formatSeeds(economy.seeds)}</span>
        </div>
      }
    >
      <div className="shop-sheet-body">
        {notice && (
          <p className="shop-notice" role="status">
            {notice}
          </p>
        )}
        {(["building", "town", "npc"] as const).map((section) => (
          <section key={section} className="shop-section">
            <h3 className="shop-section-title">{SECTION_TITLES[section]}</h3>
            <ul className="shop-row-list">{skusBySection(section).map(renderRow)}</ul>
          </section>
        ))}
        {/* ADDENDUM-05 §6 — the 충전소 entry point lives here, at the bottom of
            the shop, because "I can't afford this" is the only moment it is
            relevant. Deliberately NOT beside a seed price (R-9b: a KRW route
            must never sit typographically parallel to a 씨앗 price), and it
            opens a sheet that can only ever say "추후 지원됩니다". */}
        <button type="button" className="shop-charge-entry" onClick={onOpenCharge}>
          충전소 열기
        </button>
      </div>
    </BottomSheet>
  );
}

export interface ShopFabProps {
  onClick: () => void;
  economy: EconomyState;
  /** Current NPC sprite count — see `ShopSheetProps.npcCount`'s own doc comment. */
  npcCount: number;
}

/**
 * S8 entry point — a 꾸미기 mini-FAB meant to sit directly above the
 * existing ⊕ FAB (`TownScreen.tsx`'s `button.town-fab`, `App.css`, W1-owned —
 * this component only positions itself relative to it via `shop.css`, never
 * edits that file). Never a nag, never a numeric badge (PM-DECISIONS
 * §F-ECON) — `hasAffordableUnowned` (economy/skus.ts) drives a plain,
 * non-numeric dot, recomputed fresh every render, no persisted "seen" state.
 */
export function ShopFab({ onClick, economy, npcCount }: ShopFabProps) {
  const dot = hasAffordableUnowned(economy, npcCount, NPC_MAX_VISIBLE);
  return (
    <button type="button" className="shop-fab" aria-label="상점" onClick={onClick}>
      🎨
      {dot && <span className="shop-fab-dot" aria-hidden="true" />}
    </button>
  );
}
