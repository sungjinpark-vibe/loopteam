using System.Collections;
using System.Diagnostics;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.Profiling;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
using Debug = UnityEngine.Debug;

namespace TouchRPG.Combat.Tests.PlayMode
{
    /// <summary>
    /// Captures MEASURED performance evidence for the running combat loop. Previously
    /// no frame time, GC allocation figure, or any other profiling number existed
    /// anywhere in this project's evidence - "could not verify" is not "passed". This is
    /// a smoke ceiling (catches a runaway regression, e.g. an accidental per-frame
    /// allocation storm) rather than a strict performance gate - the GDD does not
    /// specify a frame-budget number for P0 to hold this test to, and inventing one
    /// would be exactly the hallucinated-number failure mode GDD §0 forbids.
    /// </summary>
    public class PerformanceSmokeTests
    {
        private const int SampleFrames = 180; // ~3s at 60fps - long enough to span a full Lampang P1 step (beats at 1.0s/2.4s + repeat gap)

        [UnityTest]
        public IEnumerator CombatScene_RunningForAFullPatternCycle_ReportsFrameTimeAndGcAllocation()
        {
            yield return SceneManager.LoadSceneAsync("CombatScene", LoadSceneMode.Single);
            yield return null; // let the first frame settle post-load

            float maxFrameSeconds = 0f;
            float totalFrameSeconds = 0f;
            long gcAllocBefore = Profiler.GetTotalAllocatedMemoryLong();
            var stopwatch = Stopwatch.StartNew();

            for (int i = 0; i < SampleFrames; i++)
            {
                float frameStart = Time.realtimeSinceStartup;
                yield return null;
                float frameSeconds = Time.realtimeSinceStartup - frameStart;
                totalFrameSeconds += frameSeconds;
                if (frameSeconds > maxFrameSeconds)
                {
                    maxFrameSeconds = frameSeconds;
                }
            }

            stopwatch.Stop();
            long gcAllocAfter = Profiler.GetTotalAllocatedMemoryLong();
            long gcAllocDeltaBytes = gcAllocAfter - gcAllocBefore;
            float avgFrameMs = (totalFrameSeconds / SampleFrames) * 1000f;
            float maxFrameMs = maxFrameSeconds * 1000f;

            Debug.Log($"[PerformanceSmokeTests] {SampleFrames} frames of CombatScene with Lampang P1 running: " +
                      $"avg frame = {avgFrameMs:F2}ms, max frame = {maxFrameMs:F2}ms, " +
                      $"total allocated memory delta over the window = {gcAllocDeltaBytes / 1024f:F1} KB, " +
                      $"wall time = {stopwatch.Elapsed.TotalSeconds:F2}s.");

            // Smoke ceiling only, deliberately generous (250ms) - not a GDD-specified
            // frame budget, just a stall/regression tripwire.
            Assert.Less(maxFrameMs, 250f, "A single frame took unexpectedly long (>250ms) - possible stall or regression.");
        }
    }
}
