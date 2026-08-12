/**
 * Gate-3 follow-up (A3) — the safe-area console error.
 *
 * `@apps-in-toss/web-bridge` resolves every constant through
 * `window.__CONSTANT_HANDLER_MAP[name]` and throws
 * `"<name> is not a constant handler"` when the key is absent, which is the
 * case in every non-native host. `TDSMobileAITProvider` calls
 * `getSafeAreaInsets()` in a mount effect and `console.error`s the throw, once
 * per mount — the 18-per-session spam.
 *
 * `getConstantLikeTheBridge` below is a faithful copy of the bridge's own
 * `NativeWindow.getConstant` (verified against
 * `node_modules/@apps-in-toss/web-bridge/dist/index.js`), so these tests fail
 * for the same reason the real app failed, without importing the SDK.
 */
import { afterEach, describe, expect, it } from "vitest";
import { installSafeAreaInsetsFallback, type SafeAreaInsetsPx } from "./insets";

type BridgeWindow = Window & { __CONSTANT_HANDLER_MAP?: Record<string, unknown> };

function getConstantLikeTheBridge(method: string): unknown {
  const map = (window as BridgeWindow).__CONSTANT_HANDLER_MAP;
  if (map && method in map) return map[method];
  throw new Error(`${method} is not a constant handler`);
}

afterEach(() => {
  delete (window as BridgeWindow).__CONSTANT_HANDLER_MAP;
});

describe("installSafeAreaInsetsFallback", () => {
  it("without it, the bridge lookup throws the exact error the console was full of", () => {
    expect(() => getConstantLikeTheBridge("getSafeAreaInsets")).toThrowError(
      "getSafeAreaInsets is not a constant handler",
    );
  });

  it("after it, the bridge lookup resolves to numeric insets instead of throwing", () => {
    expect(installSafeAreaInsetsFallback()).toBe(true);
    const value = getConstantLikeTheBridge("getSafeAreaInsets") as SafeAreaInsetsPx;
    for (const side of ["top", "bottom", "left", "right"] as const) {
      expect(typeof value[side]).toBe("number");
      expect(Number.isFinite(value[side])).toBe(true);
    }
  });

  it("never shadows a real Toss host — an existing handler is left exactly as it was", () => {
    const hostValue = { top: 47, bottom: 34, left: 0, right: 0 };
    (window as BridgeWindow).__CONSTANT_HANDLER_MAP = { getSafeAreaInsets: hostValue };

    expect(installSafeAreaInsetsFallback()).toBe(false);
    expect(getConstantLikeTheBridge("getSafeAreaInsets")).toBe(hostValue);
  });

  it("leaves other constants alone — only the one key is seeded", () => {
    installSafeAreaInsetsFallback();
    expect(Object.keys((window as BridgeWindow).__CONSTANT_HANDLER_MAP!)).toEqual(["getSafeAreaInsets"]);
    expect(() => getConstantLikeTheBridge("getAppsInTossGlobals")).toThrowError("is not a constant handler");
  });

  it("leaves no probe element behind in the document", () => {
    const before = document.body.childElementCount;
    installSafeAreaInsetsFallback();
    expect(document.body.childElementCount).toBe(before);
  });
});
