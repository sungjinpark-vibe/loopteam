import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // NOTE (verified by build output, not assumed): `TDSMobileAITProvider` —
    // required synchronously at boot by main.tsx — itself statically imports
    // from `@toss/tds-mobile` internally. Rollup's own module graph proves
    // this: manual-chunking it separately from `@toss/tds-mobile` produces a
    // *circular* chunk (tds-mobile <-> tds-runtime), and removing manual
    // chunking entirely still merges the whole ~1.1MB barrel into the boot
    // chunk because nothing in it is unique to any app-level import. So the
    // SDK's own boot path pulls in the full component barrel regardless of
    // app-level code-splitting — this is the library's footprint, not
    // something this task's app code (plumbing only, no screens yet) can
    // defer further. `chunkSizeWarningLimit` is intentionally left at Vite's
    // default: the warning is accurate and should keep printing until T003
    // (or a later measurement against a real mid-range Android WebView,
    // spec §10.4) actually reduces the byte count — raising the threshold
    // would hide the warning without shrinking anything it's warning about.
    // The vendor chunk is still named below so it caches independently of
    // app-code hash churn across deploys; re-check per-screen splitting once
    // T003 adds real routes.
    rollupOptions: {
      output: {
        manualChunks: {
          tds: ["@toss/tds-mobile", "@toss/tds-mobile-ait", "@toss/tds-colors", "@emotion/react"],
        },
      },
    },
  },
});
