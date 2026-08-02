/** haptics port — MVP-SPEC.md §10.2 / F18. Browser driver is a no-op (silent on desktop web). */
import type { HapticFeedbackType } from "@apps-in-toss/web-bridge";

export interface HapticsPort {
  trigger(type: HapticFeedbackType): void;
}

export const browserHaptics: HapticsPort = {
  trigger: () => {}, // no-op — no haptics API on desktop web
};

/** Toss driver — real device haptics via `generateHapticFeedback`, wired when F18 is built. */
export const tossHaptics: HapticsPort = {
  trigger(type) {
    void import("@apps-in-toss/web-bridge").then(({ generateHapticFeedback }) => generateHapticFeedback({ type }));
  },
};

export const haptics: HapticsPort = browserHaptics;
