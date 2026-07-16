namespace LifeTown.Economy.Core
{
    /// <summary>
    /// Test double (spec §7.3.1, §7.3.3). Lets EditMode tests fast-forward hours of
    /// "elapsed" session time in microseconds of real wall time by calling
    /// <see cref="Advance"/> instead of actually waiting - this is what makes the
    /// I1-I7 integrity checks (spec §10, Q01-Q08) runnable headlessly, with no device
    /// and no PlayMode, inside gate/gate.ps1 in under two seconds.
    /// </summary>
    public sealed class FakeClock : IMonotonicClock
    {
        public long ElapsedMs { get; set; }
        public long WallMs { get; set; }

        /// <summary>
        /// Advances both clocks together by the same amount - the ordinary case (normal
        /// passage of time, nothing suspicious happening). To simulate a reboot or a
        /// manual wall-clock edit, set <see cref="ElapsedMs"/> and <see cref="WallMs"/>
        /// independently instead of calling this.
        /// </summary>
        public void Advance(long ms)
        {
            ElapsedMs += ms;
            WallMs += ms;
        }
    }
}
