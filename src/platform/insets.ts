/** insets port — MVP-SPEC.md §10.2 / §10.4. Browser driver: CSS `env(safe-area-inset-*)` with a fallback. */

export interface InsetsPort {
  /** CSS length, ready to drop into an inline style or a CSS custom property. */
  top: string;
  bottom: string;
  left: string;
  right: string;
}

export const browserInsets: InsetsPort = {
  top: "env(safe-area-inset-top, 0px)",
  bottom: "env(safe-area-inset-bottom, 0px)",
  left: "env(safe-area-inset-left, 0px)",
  right: "env(safe-area-inset-right, 0px)",
};

/** Toss driver — later swaps to native inset values from the host. Same shape until then. */
export const tossInsets: InsetsPort = browserInsets;

export const insets: InsetsPort = browserInsets;
