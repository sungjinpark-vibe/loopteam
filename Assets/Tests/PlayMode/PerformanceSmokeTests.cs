using System.Collections;
using System.Diagnostics;
using System.Reflection;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.Profiling;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
using Debug = UnityEngine.Debug;

namespace TouchRPG.Combat.Tests.PlayMode
{
    /// <summary>
    /// Captures MEASURED performance evidence for the running combat loop: frame time,
    /// GC allocation, AND draw calls. Draw calls specifically were previously
    /// unmeasured entirely - the prior run happened under -batchmode -nographics
    /// (where nothing rasterizes, so any figure would read ~0 regardless of real UI
    /// cost) and no mechanism existed to read it at all.
    ///
    /// Draw-call measurement approach: <see cref="Unity.Profiling.ProfilerRecorder"/>
    /// with ProfilerCategory.Render was tried first (it is the modern, public,
    /// cross-platform API) but was confirmed EMPIRICALLY, by enumerating every
    /// available Render-category recorder via ProfilerRecorderHandle.GetAvailable, to
    /// not expose "Draw Calls Count"/"Batches Count"/"SetPass Calls Count" at all under
    /// this project's Built-in Render Pipeline (those low-level counters are wired up
    /// for SRP - URP/HDRP - not BIRP; switching render pipeline is out of scope for
    /// this task and would be a stack change). Falling back to
    /// UnityEditor.UnityStats.drawCalls via reflection instead - the same internal
    /// counter that drives the Game View "Stats" overlay for BIRP, and the standard way
    /// this number has been read from BIRP for years. Editor-only (guarded, with a
    /// graceful "unavailable" path) - acceptable here because this project only ever
    /// runs through the Unity Editor (batchmode), never as a built Player.
    ///
    /// This is a smoke ceiling (catches a runaway regression, e.g. an accidental
    /// per-frame allocation storm or a draw-call explosion from unbatched UI) rather
    /// than a strict performance gate - the GDD does not specify a frame-budget or
    /// draw-call number for P0 to hold this test to, and inventing one would be
    /// exactly the hallucinated-number failure mode GDD §0 forbids.
    ///
    /// IMPORTANT — running this suite: run PlayMode tests WITHOUT -nographics for the
    /// draw-call figure to reflect real rendering cost (batchmode without -nographics
    /// still exits cleanly via -runTests and holds no project lock).
    /// </summary>
    public class PerformanceSmokeTests
    {
        private const int SampleFrames = 180; // ~3s at 60fps - long enough to span a full Lampang P1 step (beats at 1.0s/2.4s + repeat gap)

        [UnityTest]
        public IEnumerator CombatScene_RunningForAFullPatternCycle_ReportsFrameTimeGcAllocationAndDrawCalls()
        {
            yield return SceneManager.LoadSceneAsync("CombatScene", LoadSceneMode.Single);
            yield return null; // let the first frame settle post-load

            var camera = Camera.main;
            bool drawCallReaderAvailable = TryGetEditorDrawCalls(out _);

            float maxFrameSeconds = 0f;
            float totalFrameSeconds = 0f;
            long gcAllocBefore = Profiler.GetTotalAllocatedMemoryLong();
            var stopwatch = Stopwatch.StartNew();

            long drawCallsSum = 0;
            int drawCallsMax = 0;
            int drawCallsSamples = 0;

            for (int i = 0; i < SampleFrames; i++)
            {
                float frameStart = Time.realtimeSinceStartup;
                yield return null;
                // batchmode's automatic per-frame camera render is not guaranteed to
                // populate rendering stats without a presented window, so - exactly
                // like the pixel-evidence capture in TapResolutionPlayModeTests - force
                // one real render per sampled frame. This measures the same UI the
                // player would actually see; it draws nothing beyond what CombatScene
                // already renders each frame in a normal, windowed run.
                if (camera != null)
                {
                    camera.Render();
                }
                float frameSeconds = Time.realtimeSinceStartup - frameStart;
                totalFrameSeconds += frameSeconds;
                if (frameSeconds > maxFrameSeconds)
                {
                    maxFrameSeconds = frameSeconds;
                }

                if (drawCallReaderAvailable && TryGetEditorDrawCalls(out int drawCalls))
                {
                    drawCallsSum += drawCalls;
                    if (drawCalls > drawCallsMax) drawCallsMax = drawCalls;
                    drawCallsSamples++;
                }
            }

            stopwatch.Stop();
            long gcAllocAfter = Profiler.GetTotalAllocatedMemoryLong();
            long gcAllocDeltaBytes = gcAllocAfter - gcAllocBefore;
            float avgFrameMs = (totalFrameSeconds / SampleFrames) * 1000f;
            float maxFrameMs = maxFrameSeconds * 1000f;
            float avgDrawCalls = drawCallsSamples > 0 ? (float)drawCallsSum / drawCallsSamples : 0f;

            Debug.Log($"[PerformanceSmokeTests] {SampleFrames} frames of CombatScene with Lampang P1 running: " +
                      $"avg frame = {avgFrameMs:F2}ms, max frame = {maxFrameMs:F2}ms, " +
                      $"total allocated memory delta over the window = {gcAllocDeltaBytes / 1024f:F1} KB, " +
                      $"wall time = {stopwatch.Elapsed.TotalSeconds:F2}s, " +
                      $"draw calls (UnityStats, BIRP): samples={drawCallsSamples}, avg={avgDrawCalls:F1}, max={drawCallsMax} " +
                      "(meaningful only when run WITHOUT -nographics - under -nographics nothing rasterizes and this reads ~0).");

            // Smoke ceiling only, deliberately generous (250ms) - not a GDD-specified
            // frame budget, just a stall/regression tripwire.
            Assert.Less(maxFrameMs, 250f, "A single frame took unexpectedly long (>250ms) - possible stall or regression.");

            // The draw-call measurement itself must have actually happened - this is
            // what converts "unmeasured" into "measured, logged, evidence-backed".
            // Deliberately NOT asserting a ceiling number on the draw-call count itself
            // (no GDD-specified budget exists for one - see class remark).
            Assert.IsTrue(drawCallReaderAvailable, "UnityEditor.UnityStats.drawCalls must be reachable via reflection in this Editor session - draw calls must be measurable, not merely logged as unavailable.");
            Assert.Greater(drawCallsSamples, 0, "Expected at least one successful draw-call sample across the run.");
        }

        /// <summary>Reflects into the internal UnityEditor.UnityStats.drawCalls
        /// property - see the class remark for why (ProfilerRecorder does not expose
        /// this stat under the Built-in Render Pipeline). Returns false, with
        /// <paramref name="drawCalls"/> left at 0, if the type/property cannot be
        /// found or read for any reason (different Unity version, running outside the
        /// Editor, etc.) - a genuine "unavailable" is reported as false, never faked.</summary>
        private static bool TryGetEditorDrawCalls(out int drawCalls)
        {
            drawCalls = 0;
#if UNITY_EDITOR
            try
            {
                var statsType = System.Type.GetType("UnityEditor.UnityStats,UnityEditor");
                var prop = statsType?.GetProperty("drawCalls", BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static);
                if (prop == null)
                {
                    return false;
                }
                drawCalls = (int)prop.GetValue(null);
                return true;
            }
            catch
            {
                return false;
            }
#else
            return false;
#endif
        }
    }
}
