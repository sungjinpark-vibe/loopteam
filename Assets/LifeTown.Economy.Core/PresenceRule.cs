using System;

namespace LifeTown.Economy.Core
{
    /// <summary>Result of evaluating I2 against one session's raw elapsed time.</summary>
    public readonly struct PresenceEvaluation
    {
        public readonly long CreditedElapsedMs;
        public readonly bool TimedOut;

        public PresenceEvaluation(long creditedElapsedMs, bool timedOut)
        {
            CreditedElapsedMs = creditedElapsedMs;
            TimedOut = timedOut;
        }
    }

    /// <summary>
    /// I2 - the Confirmed-Presence Rule (spec §5.3): "you are only ever credited up to your
    /// last confirmed presence." First ping at +60min elapsed (from the last confirm, or
    /// from session start if never confirmed), then every 30min after; either way a 10min
    /// response window follows. No response within the window => the session is credited
    /// only up to that boundary (last confirm + threshold), never further.
    ///
    /// All offsets here are relative to session start ("last confirmed at t=X ms into the
    /// session"), matching <see cref="Models.SessionRecord.lastConfirmedAtMs"/>'s own
    /// documented semantics ("monotonic offset of last presence confirm").
    /// </summary>
    public static class PresenceRule
    {
        public static PresenceEvaluation Evaluate(long lastConfirmedElapsedOffsetMs, long rawElapsedMs, EconomyConfig config)
        {
            if (config == null) config = EconomyConfig.Default;
            if (lastConfirmedElapsedOffsetMs < 0) lastConfirmedElapsedOffsetMs = 0;
            if (rawElapsedMs < 0) rawElapsedMs = 0;

            // No confirm has happened yet past session start (offset == 0) => the FIRST
            // ping interval applies. Any real confirm after start (offset > 0) means the
            // shorter, recurring 30-minute interval is the one in effect.
            long threshold = lastConfirmedElapsedOffsetMs <= 0
                ? config.PresenceFirstPingMs + config.PresenceResponseWindowMs
                : config.PresenceSubsequentPingMs + config.PresenceResponseWindowMs;

            long sinceConfirm = rawElapsedMs - lastConfirmedElapsedOffsetMs;
            if (sinceConfirm > threshold)
            {
                long credited = lastConfirmedElapsedOffsetMs + threshold;
                return new PresenceEvaluation(Math.Max(0, credited), true);
            }

            return new PresenceEvaluation(rawElapsedMs, false);
        }
    }
}
