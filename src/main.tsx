import { TDSMobileAITProvider } from "@toss/tds-mobile-ait";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import config from "../granite.config.ts";
import App from "./App.tsx";
import { installSafeAreaInsetsFallback } from "./platform/insets.ts";
import { setTimeTravelDate, getTimeTravelDate } from "./platform/clock.ts";
import "./index.css";
import "./theme.ts";

/**
 * Dev-only QA scenario driver — `docs/qa/SCENARIOS.md`.
 *
 * Two entry points, one code path: `?scenario=<name>` in the URL, or
 * `window.__aitLoadFixture("<name>")` in the console. Both write the named
 * fixture through the real chunked storage layer, pin the clock to the date
 * that fixture was designed for, and reload.
 *
 * The clock pin lives in `sessionStorage` rather than a module variable
 * because every state that matters here is computed ONCE PER BOOT — F16
 * settlement and the F14 queue drain both run in `useTownStore`'s boot effect
 * and nowhere else. "Cross into next month" and "next morning's drain" are
 * therefore a date change PLUS a reload, and a pin that did not survive the
 * reload could not express either. Per-tab, so it never leaks into another
 * window and never outlives the browser session.
 */
const TIME_TRAVEL_KEY = "__aitTimeTravel";

// Applied BEFORE the first render: `clock.today()` is read during boot, so a
// pin installed after `createRoot` would boot the app against the real date.
if (import.meta.env.DEV) {
  const pinned = window.sessionStorage.getItem(TIME_TRAVEL_KEY);
  if (pinned !== null) setTimeTravelDate(pinned);
}

/**
 * Writes the fixture and navigates to `to`. Deliberately NEVER renders the app
 * first: the store's boot effect writes core state back to storage
 * asynchronously, so rendering and then overwriting storage underneath it is a
 * race that can leave the scenario half-applied.
 */
async function loadScenario(name: string, to: string): Promise<void> {
  const [{ FIXTURES, loadFixtureIntoStorage }, { createChunkedStorage }] = await Promise.all([
    import("./devtools/fixtures"),
    import("./storage"),
  ]);
  const build = FIXTURES[name as keyof typeof FIXTURES];
  if (build === undefined) {
    // dev-only driver; a typo'd scenario name must say so, not silently boot the old town
    console.error(`[ait] unknown scenario '${name}'. Known: ${Object.keys(FIXTURES).join(", ")}`);
    return;
  }
  const fixture = build();
  const client = createChunkedStorage();
  loadFixtureIntoStorage(fixture, client);
  client.flush(); // writes are debounced ~300ms (storage.ts) — flush or the navigation below wipes them
  window.sessionStorage.setItem(TIME_TRAVEL_KEY, fixture.today);
  window.location.replace(to);
}

// `?scenario=` is consumed here and stripped from the URL by the navigation,
// so the reloaded page does not re-apply the fixture forever.
const scenarioParam = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("scenario") : null;

if (scenarioParam !== null) {
  const url = new URL(window.location.href);
  url.searchParams.delete("scenario");
  void loadScenario(scenarioParam, url.toString());
} else {
  // Gate-3 follow-up (A3) — must run BEFORE the first render: the constant is
  // read from `TDSMobileAITProvider`'s own mount effect. See
  // `platform/insets.ts` for the root cause; no-op inside a real Toss host.
  installSafeAreaInsetsFallback();

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <TDSMobileAITProvider brandPrimaryColor={config.brand.primaryColor}>
        <App />
      </TDSMobileAITProvider>
    </StrictMode>,
  );
}

// Dev-only console hooks — the console-only stand-in for the S7 devtools sheet
// (a separate, later UI task; see `devtools/fixtures.ts`'s header). The dynamic
// import inside `loadScenario` is required by eslint.config.js's devtools rule
// (MVP-SPEC §11) and lets Rollup drop this whole branch from a production build
// (`import.meta.env.DEV` is statically replaced with `false` there) — asserted
// by `npm run gate:extra`.
if (import.meta.env.DEV) {
  const w = window as unknown as {
    __aitLoadFixture: (name: string) => void;
    __aitSetTimeTravelDate: (dateOrNull: string | null) => void;
    __aitGetTimeTravelDate: () => string | null;
  };
  w.__aitLoadFixture = (name) => void loadScenario(name, window.location.href);
  // §11.B TimeTravel. Takes effect immediately (`useTownStore` subscribes via
  // `subscribeTimeTravel`) AND survives a reload — the reload is what re-runs
  // the boot-only F16 settlement / F14 drain against the new date. `null`
  // restores the real device date.
  w.__aitSetTimeTravelDate = (dateOrNull) => {
    if (dateOrNull === null) window.sessionStorage.removeItem(TIME_TRAVEL_KEY);
    else window.sessionStorage.setItem(TIME_TRAVEL_KEY, dateOrNull);
    setTimeTravelDate(dateOrNull);
  };
  w.__aitGetTimeTravelDate = getTimeTravelDate;
}
