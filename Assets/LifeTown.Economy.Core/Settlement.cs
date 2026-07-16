using System;
using System.Collections.Generic;
using LifeTown.Economy.Core.Models;

namespace LifeTown.Economy.Core
{
    /// <summary>
    /// Raw elapsed time -> credited payout. This is where I2-I6 actually run (spec §7.4).
    /// Deterministic and pure: no wall-clock reads, no randomness, no static mutable state -
    /// the same inputs always produce the same <see cref="SessionRecord"/>.
    ///
    /// Two entry points, matching two real situations:
    ///
    /// <see cref="CommitLive"/> - the app never left memory (a normal 끝내기). The
    /// in-process monotonic reference cannot have desynced from wall time by itself, so
    /// the I6 reboot/clock-edit check does not run here - there is nothing for it to have
    /// detected. Duration is still computed purely from ElapsedMs (I1); WallMs is carried
    /// through only for the record's display fields, never for duration math.
    ///
    /// <see cref="CommitRecovered"/> - the RunningSession is being resettled after the
    /// process was killed and relaunched, or after a suspected device reboot (spec §7.3.2,
    /// I2's crash-recovery job, I6). Runs the boot-time drift check FIRST; only if the
    /// clock is still trustworthy does it fall through to the same presence/cap logic as
    /// CommitLive.
    /// </summary>
    public static class Settlement
    {
        public static SessionRecord CommitLive(
            string sessionId,
            string categoryId,
            string appliedToBuildingId,
            long startWallMs,
            long endWallMs,
            long startElapsedMs,
            long endElapsedMs,
            long lastConfirmedElapsedOffsetMs,
            DailyCaps.UsageSoFar usageSoFar,
            EconomyConfig config = null,
            int presenceConfirmCount = 0)
        {
            ValidateIds(sessionId, categoryId);
            if (config == null) config = EconomyConfig.Default;
            var adjustments = new List<string>();

            long rawElapsedMs = endElapsedMs - startElapsedMs;
            if (rawElapsedMs < 0) rawElapsedMs = 0; // I5: elapsed itself never runs backward on a real clock; defend anyway

            var presence = PresenceRule.Evaluate(lastConfirmedElapsedOffsetMs, rawElapsedMs, config);
            if (presence.TimedOut) adjustments.Add(AdjustmentReason.PresenceTimeout);

            return Finalize(sessionId, categoryId, appliedToBuildingId,
                startWallMs, endWallMs, startElapsedMs,
                rawElapsedMs, presence.CreditedElapsedMs, lastConfirmedElapsedOffsetMs,
                usageSoFar, config, adjustments,
                wasRecovered: false, presenceConfirmCount: presenceConfirmCount);
        }

        public static SessionRecord CommitRecovered(
            string sessionId,
            string categoryId,
            string appliedToBuildingId,
            long startWallMs,
            long endWallMs,
            long startElapsedMs,
            long endElapsedMs,
            long bootTimeMsAtStart,
            long lastConfirmedElapsedOffsetMs,
            DailyCaps.UsageSoFar usageSoFar,
            EconomyConfig config = null,
            int presenceConfirmCount = 0)
        {
            ValidateIds(sessionId, categoryId);
            if (config == null) config = EconomyConfig.Default;
            var adjustments = new List<string>();

            long rawElapsedMs = endElapsedMs - startElapsedMs;
            if (rawElapsedMs < 0) rawElapsedMs = 0;

            // I6 (§7.3.2): bootNow = clock.WallMs - clock.ElapsedMs, recomputed at the
            // moment of recovery/commit. A mismatch beyond tolerance means the device
            // rebooted or the wall clock was edited - elapsed is untrustworthy beyond the
            // last confirmed presence.
            long bootTimeMsAtRecovery = endWallMs - endElapsedMs;
            long creditedElapsedMs;
            if (Math.Abs(bootTimeMsAtRecovery - bootTimeMsAtStart) > config.ClockDriftToleranceMs)
            {
                adjustments.Add(AdjustmentReason.ClockUntrusted);
                creditedElapsedMs = Math.Max(0, lastConfirmedElapsedOffsetMs);
            }
            else
            {
                var presence = PresenceRule.Evaluate(lastConfirmedElapsedOffsetMs, rawElapsedMs, config);
                creditedElapsedMs = presence.CreditedElapsedMs;
                if (presence.TimedOut) adjustments.Add(AdjustmentReason.PresenceTimeout);
            }

            return Finalize(sessionId, categoryId, appliedToBuildingId,
                startWallMs, endWallMs, startElapsedMs,
                rawElapsedMs, creditedElapsedMs, lastConfirmedElapsedOffsetMs,
                usageSoFar, config, adjustments,
                wasRecovered: true, presenceConfirmCount: presenceConfirmCount);
        }

        private static void ValidateIds(string sessionId, string categoryId)
        {
            if (string.IsNullOrEmpty(sessionId))
                throw new ArgumentException("sessionId is required - it is the future sync idempotency key.", nameof(sessionId));
            if (string.IsNullOrEmpty(categoryId))
                throw new ArgumentException("categoryId is required.", nameof(categoryId));
        }

        private static SessionRecord Finalize(
            string sessionId, string categoryId, string appliedToBuildingId,
            long startWallMs, long endWallMs, long startElapsedMs,
            long rawElapsedMs, long creditedElapsedMs, long lastConfirmedElapsedOffsetMs,
            DailyCaps.UsageSoFar usageSoFar, EconomyConfig config,
            List<string> adjustments, bool wasRecovered, int presenceConfirmCount)
        {
            // I5: single-session ceiling. Guards against overflow on absurdly long/corrupt
            // sessions the same clamp handles the "farmed for days" case.
            long ceilingMs = (long)config.SingleSessionCeilingSeconds * 1000L;
            if (creditedElapsedMs > ceilingMs) creditedElapsedMs = ceilingMs;
            if (creditedElapsedMs < 0) creditedElapsedMs = 0;

            int rawSeconds = ToSecondsClamped(rawElapsedMs);
            int creditedSecondsPreCap = ToSecondsClamped(creditedElapsedMs);

            int creditedSeconds;
            if (creditedSecondsPreCap < config.MinSessionSeconds)
            {
                // I4: below the floor, the whole session is rejected - no payout, no
                // building touched. Judged on the CREDITED length, not the raw one, so a
                // legitimate 90-minute session that got clipped to a moment by a reboot
                // (I6) is still judged fairly rather than double-punished.
                adjustments.Add(AdjustmentReason.MinSessionRejected);
                creditedSeconds = 0;
            }
            else
            {
                creditedSeconds = DailyCaps.Apply(creditedSecondsPreCap, usageSoFar, config, adjustments);
            }

            // D9: no branch on categoryId or category type anywhere in this formula.
            // Growth and leisure categories are paid by the identical rule - that IS the x1.0.
            int expAwarded = creditedSeconds * config.ExpPerSecond;
            int coinAwarded = creditedSeconds * config.CoinPerSecond;

            return new SessionRecord
            {
                sessionId = sessionId,
                categoryId = categoryId,
                startWallMs = startWallMs,
                endWallMs = endWallMs,
                bootTimeMs = startWallMs - startElapsedMs,
                monotonicElapsedMs = rawElapsedMs,
                lastConfirmedAtMs = Math.Max(0, lastConfirmedElapsedOffsetMs),
                rawSeconds = rawSeconds,
                creditedSeconds = creditedSeconds,
                expAwarded = expAwarded,
                coinAwarded = coinAwarded,
                appliedToBuildingId = creditedSeconds > 0 ? appliedToBuildingId : null,
                adjustments = adjustments.ToArray(),
                presenceConfirmCount = presenceConfirmCount,
                wasRecovered = wasRecovered,
            };
        }

        /// <summary>Converts milliseconds to whole seconds, clamped into int range so an
        /// absurd or corrupt millisecond value can never silently wrap around to a
        /// negative/garbage second count.</summary>
        private static int ToSecondsClamped(long ms)
        {
            if (ms <= 0) return 0;
            long seconds = ms / 1000;
            return seconds > int.MaxValue ? int.MaxValue : (int)seconds;
        }
    }
}
