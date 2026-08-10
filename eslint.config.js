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
    // MVP-SPEC §10.2 / §11: nothing outside src/platform/** may import an
    // @apps-in-toss/* symbol directly — all platform touchpoints go through
    // the port layer so a Toss driver swap never touches call sites. And
    // nothing outside src/devtools/** may statically import devtools code
    // (fixtures, the dense generator) — a future consumer must reach it
    // through a dynamic `import()` gated by `import.meta.env.DEV` so a
    // production bundle can tree-shake it out (§11 "stripped from any
    // non-dev build"). Both patterns live in one rule: two separate
    // `no-restricted-imports` blocks with overlapping `files` would silently
    // override each other in ESLint's flat config (later block wins per rule
    // key, not merges), which would drop one of the two bans undetected.
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
            {
              group: ["**/devtools/*", "**/devtools/**"],
              message:
                "Import src/devtools/** only via a dynamic import() gated by import.meta.env.DEV (MVP-SPEC §11).",
            },
          ],
        },
      ],
    },
  },
  {
    // ADDENDUM-05 rule R-7: `src/economy/**` may never reach for the KRW
    // formatter (`../format`, `src/format.ts`'s `formatKrw`) — 씨앗 is a game
    // count, not money, and `economy/format.ts`'s `formatSeeds` is the only
    // display path. This is the IMPORT half of R-7 only; the other half (no
    // literal KRW character in a non-test economy file) can't be expressed
    // as an import restriction and is instead enforced by
    // `economy/ruleR7.test.ts`'s source-scan test.
    //
    // A self-contained block (repeats the two bans above) rather than adding
    // a pattern to that earlier `no-restricted-imports` block: per that
    // block's own comment, two separate blocks for the same rule key on
    // overlapping `files` don't merge in ESLint's flat config — the later
    // block's rule value replaces the earlier one's for any file both match.
    // `src/economy/**` matches both, so this one restates the @apps-in-toss/
    // devtools bans rather than silently losing them here.
    files: ["src/economy/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@apps-in-toss/*", "@apps-in-toss/**"],
              message: "Import @apps-in-toss/* only inside src/platform/** (MVP-SPEC §10.2 port layer).",
            },
            {
              group: ["**/devtools/*", "**/devtools/**"],
              message:
                "Import src/devtools/** only via a dynamic import() gated by import.meta.env.DEV (MVP-SPEC §11).",
            },
            {
              group: ["../format"],
              message: "src/economy/** may not import the KRW formatter (rule R-7) — use economy/format.ts's formatSeeds instead.",
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
    //
    // ADDENDUM-02 §2 rule R-6: `Math.random()` is banned outside the random
    // port for the same reason (DE-3 — untestable, unreproducible placement).
    // Both bans share one block/one ignore list rather than two separate
    // `no-restricted-syntax` blocks — see the `no-restricted-imports` block
    // above for why: a later block for the same rule key silently REPLACES
    // an earlier one's selectors in ESLint's flat config, it does not merge.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/platform/clock.ts", "src/platform/clock.test.ts", "src/platform/random.ts", "src/platform/random.test.ts"],
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
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message: "Math.random() is banned outside src/platform/random.ts (ADDENDUM-02 §2 rule R-6).",
        },
      ],
    },
  },
);
