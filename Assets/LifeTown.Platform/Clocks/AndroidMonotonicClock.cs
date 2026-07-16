using System;
using LifeTown.Economy.Core;
using UnityEngine;

namespace LifeTown.Platform.Clocks
{
    /// <summary>
    /// Production Android time source (spec §7.3.1, integrity clamp I1). Bridges into
    /// <c>android.os.SystemClock.elapsedRealtime()</c>, which counts milliseconds since
    /// boot INCLUDING deep sleep and is immune to wall-clock edits - exactly what I1
    /// requires, and the reason none of the obvious Unity alternatives qualify
    /// (<c>Time.time</c>/<c>Time.unscaledTime</c> are frame-based and stop when not
    /// rendering; <c>Time.realtimeSinceStartupAsDouble</c> does not survive deep sleep and
    /// resets on process death; <see cref="System.Diagnostics.Stopwatch"/> is
    /// process-scoped; <c>DateTime.UtcNow</c> is exactly the wall clock this defends
    /// against - see spec §7.3.1's comparison table).
    ///
    /// <see cref="WallMs"/> is ordinary Unix-epoch wall time, used only for display and
    /// day-bucketing (never for duration) - identical contract to
    /// <see cref="EditorMonotonicClock"/>.
    ///
    /// This type deliberately contains no reboot/tamper-detection logic and no economy
    /// arithmetic (§7.4) - it only supplies two numbers. Reboot/tamper detection lives in
    /// <see cref="LifeTown.Platform.ClockIntegrity.RebootTamperGuard"/>, which is driven by
    /// the <see cref="IMonotonicClock"/> seam and is therefore fully EditMode-testable with
    /// <c>FakeClock</c>. This class itself is only required to COMPILE and be structurally
    /// correct under the editor gate: <see cref="AndroidJavaClass"/> has no real device
    /// behind it off-device, so its actual runtime correctness can only be observed on a
    /// physical Android build, not in EditMode - by design, none of the testable logic
    /// depends on that happening.
    /// </summary>
    public sealed class AndroidMonotonicClock : IMonotonicClock
    {
        private readonly AndroidJavaClass _sysClock = new AndroidJavaClass("android.os.SystemClock");

        /// <summary>Monotonic milliseconds since device boot, including deep sleep.</summary>
        public long ElapsedMs => _sysClock.CallStatic<long>("elapsedRealtime");

        /// <summary>Unix epoch milliseconds. Display + day-bucketing ONLY - never duration.</summary>
        public long WallMs => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    }
}
