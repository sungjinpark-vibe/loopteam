/**
 * Content placeholders — labels, icons, colours for categories (spec §13 D-2:
 * "Category set ... is a marked assumption. Add, cut, rename freely.").
 *
 * Unlike `balance.placeholder.ts` this is not a pacing dial, so it carries no
 * `BALANCE_UNSET`-style gate — but it is still content the director may
 * overturn for free, kept in one file so a rename never touches a component.
 */
import { colors } from "@toss/tds-colors";
import type { BuildingCategoryId, EntryType, ExpenseCategoryId, IncomeCategoryId } from "./types";

export interface CategoryContent {
  id: BuildingCategoryId;
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

export const CATEGORY_CONTENT: Record<BuildingCategoryId, CategoryContent> = {
  ...EXPENSE_CONTENT,
  ...INCOME_CONTENT,
  // 저축 categories are out of this task's scope (F13, build order step 4) —
  // typed here only so `CATEGORY_CONTENT` stays total over `CategoryId`.
  emergency: { id: "emergency", label: "비상금", icon: "🏦", color: colors.teal400 },
  goal: { id: "goal", label: "목표저축", icon: "🎯", color: colors.blue400 },
  invest: { id: "invest", label: "투자", icon: "📈", color: colors.purple400 },
  other_saving: { id: "other_saving", label: "기타저축", icon: "🪙", color: colors.grey400 },
  // F15 무지출 데이 park tile — spec §6.1: "the rarest and most attractive
  // asset in the set"; the placeholder just gets a distinct colour/icon so
  // it reads as different from every spending/income category on sight.
  park: { id: "park", label: "무지출 공원", icon: "🌳", color: colors.green600 },
};

export const CATEGORIES_BY_TYPE: Record<EntryType, CategoryContent[]> = {
  expense: Object.values(EXPENSE_CONTENT),
  income: Object.values(INCOME_CONTENT),
  saving: [], // 저축 UI is out of scope for this task (F13) — kept empty, not undefined
};
