/**
 * storage port — MVP-SPEC.md §10.2.
 *
 * A minimal synchronous key/value port. `src/storage.ts` (one level up) builds
 * the month-chunked layout (§8.4) on top of this; this file only knows how to
 * get/set/remove one string by key.
 */

export interface StoragePort {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export const browserStorage: StoragePort = {
  get: (key) => window.localStorage.getItem(key),
  set: (key, value) => window.localStorage.setItem(key, value),
  remove: (key) => window.localStorage.removeItem(key),
};

/**
 * Toss driver — stubbed for later (§10.2, §10.3 D-8).
 *
 * FINDING (D-8, recorded at scaffold time, 2026-08-02): `@apps-in-toss/web-framework@2.10.8`
 * as installed by `create-ait-app` exposes no Storage API in its public type
 * surface (`dist-web/index.d.ts` only re-exports `@apps-in-toss/web-bridge`
 * and `@apps-in-toss/web-analytics`; neither declares a storage module).
 * Whether/how a Storage API becomes available after Apps-in-Toss console
 * registration is unverified — the MVP does not depend on the answer.
 * This driver throws instead of silently no-op-ing so a future accidental
 * selection fails loudly instead of losing writes.
 */
export const tossStorage: StoragePort = {
  get() {
    throw new Error("toss storage driver not implemented yet — see src/platform/storage.ts (spec D-8)");
  },
  set() {
    throw new Error("toss storage driver not implemented yet — see src/platform/storage.ts (spec D-8)");
  },
  remove() {
    throw new Error("toss storage driver not implemented yet — see src/platform/storage.ts (spec D-8)");
  },
};

/** MVP always runs the browser driver; swapping to `tossStorage` is a one-line change here. */
export const storage: StoragePort = browserStorage;
