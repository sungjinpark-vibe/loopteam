/** analytics port — MVP-SPEC.md §10.2. Browser driver sinks to `console.debug`; nothing leaves the device. */

export interface AnalyticsPort {
  track(eventName: string, params?: Record<string, unknown>): void;
}

export const browserAnalytics: AnalyticsPort = {
  track: (eventName, params) => console.debug("[analytics]", eventName, params ?? {}),
};

/** Toss driver — real event logging via `eventLog`, wired once analytics is in scope (deferred, §10.3). */
export const tossAnalytics: AnalyticsPort = {
  track(eventName, params) {
    void import("@apps-in-toss/web-framework").then(({ eventLog }) =>
      eventLog({
        log_name: eventName,
        log_type: "event",
        params: (params ?? {}) as Record<string, string | number | boolean | null | undefined>,
      }),
    );
  },
};

export const analytics: AnalyticsPort = browserAnalytics;
