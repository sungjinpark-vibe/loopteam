import { describe, expect, it } from "vitest";
import { LEGACY_SAVING_ALIAS, SAVING_CATEGORY_IDS, isSavingCategoryId, savingsBucketOf } from "./savingsBuckets";
import type { SavingCategoryId } from "./types";

describe("SAVING_CATEGORY_IDS", () => {
  it("has five distinct members, deposit/stock first (the prominence rank, ADDENDUM-01 §4.5)", () => {
    expect(SAVING_CATEGORY_IDS).toEqual(["deposit", "stock", "emergency", "goal", "other_saving"]);
    expect(new Set(SAVING_CATEGORY_IDS).size).toBe(5);
  });
});

describe("isSavingCategoryId", () => {
  it("is true for every live sub-type and false for a legacy or unknown id", () => {
    for (const id of SAVING_CATEGORY_IDS) expect(isSavingCategoryId(id)).toBe(true);
    expect(isSavingCategoryId("invest")).toBe(false);
    expect(isSavingCategoryId("not-a-real-id")).toBe(false);
  });
});

describe("savingsBucketOf", () => {
  it("is total: every live id maps to itself", () => {
    for (const id of SAVING_CATEGORY_IDS) expect(savingsBucketOf(id)).toBe(id);
  });

  it("aliases legacy `invest` per D-24 (LEGACY_SAVING_ALIAS)", () => {
    const expected: SavingCategoryId = LEGACY_SAVING_ALIAS.invest;
    expect(savingsBucketOf("invest")).toBe(expected);
    expect(isSavingCategoryId(savingsBucketOf("invest"))).toBe(true);
  });

  it("falls back to other_saving for any unrecognized id, never undefined", () => {
    expect(savingsBucketOf("some-future-category")).toBe("other_saving");
    expect(savingsBucketOf("")).toBe("other_saving");
  });
});
