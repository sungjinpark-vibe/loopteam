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
      get length(): number {
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

  it("keys() swallows the error and reports an empty list", () => {
    installThrowingLocalStorage();
    expect(() => browserStorage.keys()).not.toThrow();
    expect(browserStorage.keys()).toEqual([]);
  });
});

describe("browserStorage.keys() enumerates real localStorage", () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("returns every stored key", () => {
    const store = new Map<string, string>();
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
        get length() {
          return store.size;
        },
        key: (i: number) => [...store.keys()][i] ?? null,
      },
    };
    browserStorage.set("a", "1");
    browserStorage.set("b", "2");
    expect(browserStorage.keys().sort()).toEqual(["a", "b"]);
  });
});
