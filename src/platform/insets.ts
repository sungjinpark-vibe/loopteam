/** insets port — MVP-SPEC.md §10.2 / §10.4. Browser driver: CSS `env(safe-area-inset-*)` with a fallback. */

export interface InsetsPort {
  /** CSS length, ready to drop into an inline style or a CSS custom property. */
  top: string;
  bottom: string;
  left: string;
  right: string;
}

export const browserInsets: InsetsPort = {
  top: "env(safe-area-inset-top, 0px)",
  bottom: "env(safe-area-inset-bottom, 0px)",
  left: "env(safe-area-inset-left, 0px)",
  right: "env(safe-area-inset-right, 0px)",
};

/** Toss driver — later swaps to native inset values from the host. Same shape until then. */
export const tossInsets: InsetsPort = browserInsets;

export const insets: InsetsPort = browserInsets;

/** Numeric px insets — the shape the Toss native bridge's `getSafeAreaInsets` constant returns. */
export interface SafeAreaInsetsPx {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * `@apps-in-toss/web-bridge`'s constant table. The bridge resolves EVERY
 * constant through `nativeWindow.getConstant(name)`, which reads exactly this
 * object and throws `"<name> is not a constant handler"` when the key is
 * missing — which is always the case outside the real Toss native host,
 * because only the host populates it.
 */
type ConstantHandlerMap = Record<string, unknown>;
type BridgeWindow = Window & { __CONSTANT_HANDLER_MAP?: ConstantHandlerMap };

/** Reads the four CSS `env(safe-area-inset-*)` values as numbers, in one probe element. */
function measureEnvInsets(doc: Document): SafeAreaInsetsPx {
  const probe = doc.createElement("div");
  probe.style.cssText =
    "position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;" +
    "padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)";
  doc.body.appendChild(probe);
  const style = doc.defaultView?.getComputedStyle(probe);
  const px = (value: string | undefined): number => {
    const n = Number.parseFloat(value ?? "");
    return Number.isFinite(n) ? n : 0; // jsdom / any engine that doesn't resolve env() -> 0
  };
  const measured = {
    top: px(style?.paddingTop),
    right: px(style?.paddingRight),
    bottom: px(style?.paddingBottom),
    left: px(style?.paddingLeft),
  };
  probe.remove();
  return measured;
}

/**
 * ROOT CAUSE FIX for the 18-per-session console error
 * `"SafeAreaInsets를 가져오는 중 에러가 발생했습니다: getSafeAreaInsets is not a
 * constant handler"`.
 *
 * `TDSMobileAITProvider` mounts a memoised child that calls the bridge's
 * `getSafeAreaInsets()` in an effect and `console.error`s whatever it throws.
 * The throw comes from the bridge, not from TDS: `getConstant("getSafeAreaInsets")`
 * looks the name up in `window.__CONSTANT_HANDLER_MAP`, which only the native
 * Toss host fills in, so in any bare browser (every dev run, every QA/Playwright
 * pass, every desktop preview) the lookup misses and throws — once per provider
 * mount, i.e. on every navigation/reload and twice per boot under StrictMode.
 *
 * So the fix is to give the bridge the constant it is asking for instead of
 * silencing its complaint: seed the ONE table every bridge constant is read
 * from, with insets measured from the platform's own
 * `env(safe-area-inset-*)` — this file's documented browser driver. One guard,
 * at the single point all callers route through; no try/catch per call site and
 * no `console.error` filter (the previous attempt patched `console.error` and
 * did not even work — the vendor passes the message and the Error as two
 * separate arguments, so a string test on the args never matched).
 *
 * Never shadows a real host: if the key is already present, this returns
 * without touching it, so native insets keep resolving exactly as before.
 * Returns whether it installed anything (for the test; callers ignore it).
 */
export function installSafeAreaInsetsFallback(win: Window = window): boolean {
  const bridgeWindow = win as BridgeWindow;
  const map = (bridgeWindow.__CONSTANT_HANDLER_MAP ??= {});
  if ("getSafeAreaInsets" in map) return false; // a real Toss host already provides it
  map.getSafeAreaInsets = measureEnvInsets(win.document);
  return true;
}
