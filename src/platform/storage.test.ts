import { afterEach, describe, expect, it } from "vitest";
import { browserStorage } from "./storage";

/** Simulates QuotaExceededError / blocked-storage: every op throws. */
function installThrowingLocalStorage(): void {
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: () => {
        throw new Error("QuotaExceededError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    },
  };
}

describe("browserStorage never propagates a throwing localStorage (F10: no white screen)", () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("get() swallows the error and reports 'absent'", () => {
    installThrowingLocalStorage();
    expect(() => browserStorage.get("k")).not.toThrow();
    expect(browserStorage.get("k")).toBeNull();
  });

  it("set() swallows a QuotaExceededError instead of throwing", () => {
    installThrowingLocalStorage();
    expect(() => browserStorage.set("k", "v")).not.toThrow();
  });

  it("remove() swallows the error", () => {
    installThrowingLocalStorage();
    expect(() => browserStorage.remove("k")).not.toThrow();
  });

  it("get() is also safe when window is entirely absent", () => {
    delete (globalThis as { window?: unknown }).window;
    expect(() => browserStorage.get("k")).not.toThrow();
    expect(browserStorage.get("k")).toBeNull();
  });
});
