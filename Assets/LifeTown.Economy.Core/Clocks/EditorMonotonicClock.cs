using System;
using System.Diagnostics;

namespace LifeTown.Economy.Core
{
    /// <summary>
    /// Editor + Standalone fallback (spec §7.3.1). Process-scoped: it does not survive app
    /// suspension or process death, which is acceptable ONLY because there is no adversary
    /// and no OS-level suspension in the Editor/Standalone context this covers.
    ///
    /// The production Android path (`SystemClock.elapsedRealtime` via AndroidJavaClass)
    /// deliberately does NOT live here - it belongs to LifeTown.Platform, which references
    /// UnityEngine. This assembly only ever knows the <see cref="IMonotonicClock"/> seam.
    /// </summary>
    public sealed class EditorMonotonicClock : IMonotonicClock
    {
        private readonly Stopwatch _stopwatch = Stopwatch.StartNew();

        public long ElapsedMs => _stopwatch.ElapsedMilliseconds;

        public long WallMs => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    }
}
