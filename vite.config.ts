import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // NOTE (verified by build output, not assumed): `App.tsx` already defers
    // its only `@toss/tds-mobile` import behind `React.lazy(() => import("./HomeDemo"))`
    // (HomeDemo.tsx), but `TDSMobileAITProvider` — required synchronously at
    // boot by main.tsx via `@toss/tds-mobile-ait` — itself statically
    // imports from `@toss/tds-mobile` internally. Rollup's own module graph
    // proves this: splitting them into separate manual chunks produces a
    // *circular* chunk (tds-mobile <-> tds-runtime), and removing manual
    // chunking entirely still merges the whole ~1.1MB barrel into the boot
    // chunk because nothing in it is actually unique to the lazy import. So
    // the SDK's own boot path pulls in the full component barrel regardless
    // of app-level code-splitting — this is the library's footprint, not
    // something this task's app code can defer further. Once T003 adds real
    // routes, re-check whether per-screen splitting has anything left to cut;
    // for now the vendor chunk is named only so it caches independently of
    // app-code hash churn across deploys.
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      output: {
        manualChunks: {
          tds: ["@toss/tds-mobile", "@toss/tds-mobile-ait", "@toss/tds-colors", "@emotion/react"],
        },
      },
    },
  },
});
