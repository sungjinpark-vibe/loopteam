/**
 * Content placeholders — labels, icons, colours for categories (spec §13 D-2:
 * "Category set ... is a marked assumption. Add, cut, rename freely.").
 *
 * Unlike `balance.placeholder.ts` this is not a pacing dial, so it carries no
 * `BALANCE_UNSET`-style gate — but it is still content the director may
 * overturn for free, kept in one file so a rename never touches a component.
 */
import { colors } from "@toss/tds-colors";
import { SAVING_CATEGORY_IDS } from "./savingsBuckets";
import type {
  BuildingCategoryId,
  EntryType,
  ExpenseCategoryId,
  IncomeCategoryId,
  LegacySavingCategoryId,
  SavingCategoryId,
} from "./types";

/**
 * Ids CONTENT must cover: every creatable category, the park tile, and
 * read-only legacy ids (ADDENDUM-01 §4.4). `BuildingCategoryId` alone stopped
 * being total the moment `invest` retired from `SavingCategoryId` — a legacy
 * entry's stored `categoryId` really is `"invest"`, and 기록 still renders it
 * via `CATEGORY_CONTENT[entry.categoryId]`, so the row stays rather than
 * routing every read through the alias.
 */
export type ContentCategoryId = BuildingCategoryId | LegacySavingCategoryId;

export interface CategoryContent {
  id: ContentCategoryId;
  label: string;
  icon: string; // single glyph — stands in for real art (spec §6.1 PlaceholderBuilding)
  color: string; // CSS colour, sourced from @toss/tds-colors tokens
}

const EXPENSE_CONTENT: Record<ExpenseCategoryId, CategoryContent> = {
  food: { id: "food", label: "식비", icon: "🍚", color: colors.orange400 },
  cafe: { id: "cafe", label: "카페", icon: "☕", color: colors.orange600 },
  transport: { id: "transport", label: "교통", icon: "🚌", color: colors.blue400 },
  shopping: { id: "shopping", label: "쇼핑", icon: "🛍️", color: colors.purple400 },
  living: { id: "living", label: "생활", icon: "🏠", color: colors.teal400 },
  health: { id: "health", label: "건강", icon: "💊", color: colors.red400 },
  culture: { id: "culture", label: "문화", icon: "🎬", color: colors.purple500 },
  education: { id: "education", label: "교육", icon: "📚", color: colors.blue500 },
  social: { id: "social", label: "경조사", icon: "🎁", color: colors.yellow500 },
  etc: { id: "etc", label: "기타", icon: "✳️", color: colors.grey400 },
};

const INCOME_CONTENT: Record<IncomeCategoryId, CategoryContent> = {
  salary: { id: "salary", label: "급여", icon: "💼", color: colors.green400 },
  sidejob: { id: "sidejob", label: "부업", icon: "🧾", color: colors.green500 },
  bonus: { id: "bonus", label: "보너스", icon: "🎉", color: colors.yellow400 },
  other_income: { id: "other_income", label: "기타수입", icon: "💰", color: colors.teal500 },
};

const SAVING_CONTENT: Record<SavingCategoryId, CategoryContent> = {
  deposit: { id: "deposit", label: "예적금", icon: "🏦", color: colors.teal400 },
  stock: { id: "stock", label: "주식 투자", icon: "📈", color: colors.purple400 },
  emergency: { id: "emergency", label: "비상금", icon: "🔒", color: colors.blue400 },
  goal: { id: "goal", label: "목표저축", icon: "🎯", color: colors.orange400 },
  other_saving: { id: "other_saving", label: "기타저축", icon: "🪙", color: colors.grey400 },
};

export const CATEGORY_CONTENT: Record<ContentCategoryId, CategoryContent> = {
  ...EXPENSE_CONTENT,
  ...INCOME_CONTENT,
  ...SAVING_CONTENT,
  // Legacy, never in CATEGORIES_BY_TYPE.saving (ADDENDUM-01 §4.4) — 기록 still
  // renders an old stored `categoryId: "invest"` entry through this row.
  invest: { id: "invest", label: "투자", icon: "📈", color: colors.purple400 },
  // F15 무지출 데이 park tile — spec §6.1: "the rarest and most attractive
  // asset in the set"; the placeholder just gets a distinct colour/icon so
  // it reads as different from every spending/income category on sight.
  park: { id: "park", label: "무지출 공원", icon: "🌳", color: colors.green600 },
};

export const CATEGORIES_BY_TYPE: Record<EntryType, CategoryContent[]> = {
  expense: Object.values(EXPENSE_CONTENT),
  income: Object.values(INCOME_CONTENT),
  // ADDENDUM-01 §4.4/§2.2 — the five 저축 sub-types, unblocked now that
  // EntrySheet's 저축 segment is enabled. `SAVING_CATEGORY_IDS` is the
  // canonical order (prominence rank), not object insertion order.
  saving: SAVING_CATEGORY_IDS.map((id) => SAVING_CONTENT[id]),
};

// ── ADDENDUM-01 §2.3 — the per-structure visual contract ──

/** Structure family. One art family per member; adding one is an art-order line (D-22). */
export type StructureKind = "bank" | "exchange" | "vault" | "house" | "warehouse";

/** Roof/cap silhouette. Closed on purpose: the art order is one cap sprite per member (§6.1 item 4). */
export type CapShape = "gable" | "spire" | "dome" | "pitched" | "sawtooth";

/** The always-running, zero-input ambient loop. "none" is a legal value — SHOULD-tier, cuttable per structure. */
export type IdleAnim = "none" | "seal-glint" | "ticker-blink" | "dial-tick" | "scaffold-sway" | "bay-creak";

/** The one-shot animation when this structure gains a level (§2.6 step 2). */
export type RiseAnim = "seal-stamp" | "candle-add" | "bolt-add" | "scaffold-drop" | "bay-open";

export interface SavingsStructureContent {
  /** Same id as the SavingCategoryId it renders — kept so an array iteration keeps its key. */
  id: SavingCategoryId;
  kind: StructureKind;
  capShape: CapShape;
  /** Signboard text, ko. Rendered as text on the structure's board; never a 원 figure (invariant 2). */
  signboard: string;
  /** Shown on the level-0 empty lot, under the signboard (§2.4). */
  emptyHint: string;
  idleAnim: IdleAnim;
  riseAnim: RiseAnim;
  /** Toast copy on a level-up. `{label}` is substituted from CATEGORY_CONTENT[id].label; never an amount. */
  levelUpToast: string;
}

/**
 * PLACEHOLDER CONTENT — not balance, not a design decision the director is
 * bound by (D-17). Total over SavingCategoryId by construction: adding a 6th
 * sub-type is a compile error until its structure is written here.
 */
export const SAVINGS_STRUCTURE: Record<SavingCategoryId, SavingsStructureContent> = {
  deposit: {
    id: "deposit",
    kind: "bank",
    capShape: "gable",
    signboard: "예적금 은행",
    emptyHint: "아직 비어있어요",
    idleAnim: "seal-glint",
    riseAnim: "seal-stamp",
    levelUpToast: "{label} 은행이 한 층 올라갔어요",
  },
  stock: {
    id: "stock",
    kind: "exchange",
    capShape: "spire",
    signboard: "증권거래소",
    emptyHint: "아직 비어있어요",
    idleAnim: "ticker-blink",
    riseAnim: "candle-add",
    levelUpToast: "{label} 차트에 봉이 하나 늘었어요",
  },
  emergency: {
    id: "emergency",
    kind: "vault",
    capShape: "dome",
    signboard: "비상금 금고",
    emptyHint: "아직 비어있어요",
    idleAnim: "dial-tick",
    riseAnim: "bolt-add",
    levelUpToast: "{label} 금고가 더 든든해졌어요",
  },
  goal: {
    id: "goal",
    kind: "house",
    capShape: "pitched",
    signboard: "꿈의 집",
    emptyHint: "아직 비어있어요",
    idleAnim: "scaffold-sway",
    riseAnim: "scaffold-drop",
    levelUpToast: "{label} 집이 조금 더 지어졌어요",
  },
  other_saving: {
    id: "other_saving",
    kind: "warehouse",
    capShape: "sawtooth",
    signboard: "저축 창고",
    emptyHint: "아직 비어있어요",
    idleAnim: "none",
    riseAnim: "bay-open",
    levelUpToast: "{label} 창고에 칸이 하나 늘었어요",
  },
};

/** Joins the two content records for the level-up toast (§2.6a) — never a hardcoded 한글 name. */
export function levelUpToastFor(id: SavingCategoryId): string {
  return SAVINGS_STRUCTURE[id].levelUpToast.replace("{label}", CATEGORY_CONTENT[id].label);
}

// ── F6 town mood (spec §5 F6 / §6.1 art item 7) ──

export interface MoodContent {
  /** Appended to `town-screen--mood-` (S2 sky gradient, App.css) and to `history-pace-bar-fill`'s palette index elsewhere — a slot name, not a design decision (§6.1: "ordered by slot index, not by name"). */
  skyClass: string;
  /** One-line status shown in the S2 town header. */
  headerLabel: string;
}

/**
 * Index 0..2 = `selectors.moodTier`'s 3 buckets (best -> worst pace), for
 * `BALANCE.moodPaceThresholds`'s 2 thresholds. `MOOD_NEUTRAL` covers
 * `moodTier`'s `-1` (no budget set) separately, per spec F6: "If budget ===
 * null, mood is pinned neutral". Labels/slot count are D-4, director's call —
 * placeholder content only, safe to rename without touching any selector.
 */
export const MOOD_CONTENT: MoodContent[] = [
  { skyClass: "clear", headerLabel: "이번 달 페이스가 여유로워요" },
  { skyClass: "cloudy", headerLabel: "이번 달 페이스가 딱 맞아요" },
  { skyClass: "rain", headerLabel: "이번 달 페이스가 빠듯해요" },
];

export const MOOD_NEUTRAL: MoodContent = {
  skyClass: "neutral",
  headerLabel: "예산을 정하면 우리 동네 날씨가 생겨요",
};

/** `moodTier`'s return value (-1..thresholds.length) -> the content to render. Never touches building state (spec F6 AC) — sky/header only. */
export function moodContentFor(tier: number): MoodContent {
  return tier === -1 ? MOOD_NEUTRAL : (MOOD_CONTENT[tier] ?? MOOD_NEUTRAL);
}
