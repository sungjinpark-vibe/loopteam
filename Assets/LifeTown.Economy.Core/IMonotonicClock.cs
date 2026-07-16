namespace LifeTown.Economy.Core
{
    /// <summary>
    /// The single time source for the entire economy (spec §7.3, integrity clamp I1).
    ///
    /// <see cref="ElapsedMs"/> MUST be monotonic: it never runs backward and is immune to
    /// wall-clock edits. On the real device implementation (AndroidMonotonicClock, which
    /// lives in LifeTown.Platform and is deliberately NOT part of this assembly) it also
    /// survives app suspension via `SystemClock.elapsedRealtime`.
    ///
    /// <see cref="WallMs"/> is Unix epoch milliseconds and exists ONLY for display and for
    /// bucketing "which calendar day" a session belongs to. It must never be used to
    /// compute a session's duration - that is exactly the thing I1 defends against.
    /// </summary>
    public interface IMonotonicClock
    {
        /// <summary>Monotonic milliseconds. Never wall-clock-derived. Never used for display.</summary>
        long ElapsedMs { get; }

        /// <summary>Unix epoch milliseconds. Display + day-bucketing ONLY - never duration.</summary>
        long WallMs { get; }
    }
}
