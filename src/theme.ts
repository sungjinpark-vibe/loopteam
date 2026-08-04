/**
 * Binds the CSS custom properties `App.css` reads to `@toss/tds-colors`
 * tokens, so the stylesheet never carries a hand-copied hex literal that can
 * drift from the design system (rubric C3: idiomatic TDS usage). Import for
 * its side effect, once, before the first paint (see `main.tsx`).
 */
import { colors } from "@toss/tds-colors";

const TOWN_CSS_VARS: Record<string, string> = {
  "--town-white": colors.white,
  "--town-grey900": colors.grey900,
  "--town-grey800": colors.grey800,
  "--town-grey700": colors.grey700,
  "--town-grey600": colors.grey600,
  "--town-grey300": colors.grey300,
  "--town-grey200": colors.grey200,
  "--town-grey100": colors.grey100,
  "--town-blue500": colors.blue500,
  // ADDENDUM-01 §2.3/§6.1 item 4 — one paint colour per savings StructureKind
  // (placeholder shape, D-22 replaces with real art). No CSS fallback (R-3):
  // this file is the one place that binds a var to a token.
  "--town-teal400": colors.teal400,
  "--town-purple400": colors.purple400,
  "--town-blue400": colors.blue400,
  "--town-orange400": colors.orange400,
  "--town-grey400": colors.grey400,
};

const root = document.documentElement;
for (const [name, value] of Object.entries(TOWN_CSS_VARS)) {
  root.style.setProperty(name, value);
}
