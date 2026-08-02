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
  /** Every key currently stored. Used only by the corrupt-index recovery path (§8.4 / F10). */
  keys(): string[];
}

// `localStorage` access can throw: QuotaExceededError (reachable — §8.4's own
// dense estimate is ~400KB of buildings), disabled/partitioned storage, or
// private-mode restrictions in some browsers. F10 rules out a white screen
// for a corrupt chunk; the same guarantee has to hold for a storage call that
// throws outright, so every op is caught here — the one place all callers
// route through — rather than in each caller.
export const browserStorage: StoragePort = {
  get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null; // treated as "absent", same as a fresh install
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // NOTE: write silently dropped (quota/blocked storage) — in-memory
      // state for this session is still correct; add a user-visible warning
      // if this shows up in the wild.
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // best-effort — nothing to roll back to if this fails
    }
  },
  keys() {
    try {
      const result: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key !== null) result.push(key);
      }
      return result;
    } catch {
      return []; // same "treat as absent" policy as get()
    }
  },
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
  keys() {
    throw new Error("toss storage driver not implemented yet — see src/platform/storage.ts (spec D-8)");
  },
};

/** MVP always runs the browser driver; swapping to `tossStorage` is a one-line change here. */
export const storage: StoragePort = browserStorage;
