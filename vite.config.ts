import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Split the design-system vendor code into its own chunk so app code
        // (currently ~17kB) doesn't keep re-bundling it as screens land in
        // T003+, and so it's cached independently across app-code deploys.
        // ponytail: @toss/tds-mobile itself is ~1.2MB — that's the library's
        // own weight, not app bloat, and this task ships no screens to
        // route-split by. Upgrade path once real screens exist: dynamic
        // import() per screen so a route only pulls the tds pieces it uses.
        manualChunks: {
          tds: ["@toss/tds-mobile", "@toss/tds-mobile-ait", "@toss/tds-colors", "@emotion/react"],
        },
      },
    },
  },
});
