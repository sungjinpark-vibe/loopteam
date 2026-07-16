using System.Collections.Generic;

namespace LifeTown.Economy.Core.Models
{
    /// <summary>
    /// Live, non-persisted-except-for-recovery (spec §9). MUST survive process death (I2
    /// recovery) - this is exactly what <see cref="Settlement.CommitRecovered"/> resettles
    /// after a crash, a device reboot, or an app relaunch.
    /// </summary>
    public class RunningSession
    {
        public string sessionId;
        public string categoryId;
        public long startMonotonicMs;
        public long startWallMs;
        public long bootTimeMs;          // I6
        public long lastConfirmedAtMs;   // monotonic offset
        public long lastPingSentAtMs;
        public List<long[]> pauseIntervals = new List<long[]>(); // [startOffset, endOffset]
        public int presenceConfirmCount;
    }
}
