import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
  {
    // MVP-SPEC §10.2: nothing outside src/platform/** may import an
    // @apps-in-toss/* symbol directly — all platform touchpoints go through
    // the port layer so a Toss driver swap never touches call sites.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/platform/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@apps-in-toss/*", "@apps-in-toss/**"],
              message: "Import @apps-in-toss/* only inside src/platform/** (MVP-SPEC §10.2 port layer).",
            },
          ],
        },
      ],
    },
  },
  {
    // MVP-SPEC §10.2: `new Date()` / `Date.now()` are banned outside the clock
    // port — that's what makes the whole app time-travelable (§11 TimeTravel).
    // clock.test.ts is exempt too: asserting the port's own behavior legitimately
    // needs to build expected Date values independent of the port under test.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/platform/clock.ts", "src/platform/clock.test.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='Date']",
          message: "new Date() is banned outside src/platform/clock.ts (MVP-SPEC §10.2).",
        },
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: "Date.now() is banned outside src/platform/clock.ts (MVP-SPEC §10.2).",
        },
      ],
    },
  },
);
