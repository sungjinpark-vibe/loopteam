import { TDSMobileAITProvider } from "@toss/tds-mobile-ait";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import config from "../granite.config.ts";
import App from "./App.tsx";
import { installSafeAreaInsetsFallback } from "./platform/insets.ts";
import "./index.css";
import "./theme.ts";

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

// Dev-only console hook so `qa`/the director can actually drive a fixture
// (e.g. `dense`, ADDENDUM-01 §3.8's 5,400-plot AC) instead of hand-seeding a
// town. The dynamic import is required by eslint.config.js's devtools rule
// (MVP-SPEC §11) and lets Rollup tree-shake this whole branch out of a
// production build (`import.meta.env.DEV` is statically replaced with
// `false` there). This is the console-only stand-in for the S7 "load
// fixture" sheet, which is a separate, later UI task (`fixtures.ts`'s own
// header comment) — call from devtools or a Playwright `page.evaluate`:
// `window.__aitLoadFixture("dense")`, then reload.
if (import.meta.env.DEV) {
  void Promise.all([import("./devtools/fixtures"), import("./storage")]).then(
    ([{ FIXTURES, loadFixtureIntoStorage }, { createChunkedStorage }]) => {
      (window as unknown as { __aitLoadFixture: (name: keyof typeof FIXTURES) => void }).__aitLoadFixture = (name) => {
        const client = createChunkedStorage();
        loadFixtureIntoStorage(FIXTURES[name](), client);
        client.flush(); // writes are debounced ~300ms (storage.ts) — flush before the reload below, or it wipes them
        window.location.reload();
      };
    },
  );

  // Dev-only console hook for §11.B TimeTravel — `setTimeTravelDate`/
  // `getTimeTravelDate` already existed in `platform/clock.ts` (the app was
  // already time-travelable everywhere `clock.today()`/`clock.now()` are
  // read from) but had no reachable entry point outside the app itself; the
  // S7 "TimeTravel" sheet that was meant to expose it is a later task. This
  // is the same console-only stand-in `__aitLoadFixture` above already is:
  // `window.__aitSetTimeTravelDate("2026-08-08")` moves the app's clock to
  // that date (re-renders live, no reload needed — `useTownStore` already
  // subscribes via `subscribeTimeTravel`); `window.__aitSetTimeTravelDate(null)`
  // restores the real device date. `window.__aitGetTimeTravelDate()` reads
  // the current override for a Playwright assertion.
  void import("./platform/clock").then(({ setTimeTravelDate, getTimeTravelDate }) => {
    (
      window as unknown as {
        __aitSetTimeTravelDate: (dateOrNull: string | null) => void;
        __aitGetTimeTravelDate: () => string | null;
      }
    ).__aitSetTimeTravelDate = setTimeTravelDate;
    (window as unknown as { __aitGetTimeTravelDate: () => string | null }).__aitGetTimeTravelDate = getTimeTravelDate;
  });
}
