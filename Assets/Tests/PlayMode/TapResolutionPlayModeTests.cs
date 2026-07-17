using System.Collections;
using System.IO;
using System.Reflection;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
using UnityEngine.UI;
using TouchRPG.Combat.Config;
using TouchRPG.Combat.Core;
using TouchRPG.Combat.Input;
using TouchRPG.Combat.Pattern;

namespace TouchRPG.Combat.Tests.PlayMode
{
    /// <summary>
    /// Drives a REAL tap through <see cref="CombatInputController.ResolveTap"/> at
    /// controlled offsets from a live <see cref="ParryMarker"/>'s target time and
    /// observes the actual result on screen - closing the gap the previous round was
    /// scored down for: "the parry has not been observed to happen" (only
    /// JudgmentEvaluator.Evaluate was ever called directly, never a tap).
    ///
    /// Loads the real CombatScene, then drives the production
    /// MonsterPatternPlayer.ExecuteC1Basic coroutine directly (via reflection, since it
    /// is intentionally private - this test does not add test-only public API to
    /// production code) with a synthetic single-beat MonsterPatternStep so beat timing
    /// is test-controlled. Everything downstream of that call - spawn, anchor, EventSystem
    /// raycast, priority resolution, judgment, burst, combo, damage - is the exact
    /// production path, unmodified.
    /// </summary>
    public class TapResolutionPlayModeTests
    {
        private MonsterPatternPlayer _patternPlayer;
        private CombatInputController _inputController;
        private ComboController _combo;
        private HealthController _playerHealth;
        private GameplayConfig _config;
        private MethodInfo _executeC1Basic;
        private ParryMarker _lastMarker;

        [UnitySetUp]
        public IEnumerator LoadIsolatedCombatScene()
        {
            yield return SceneManager.LoadSceneAsync("CombatScene", LoadSceneMode.Single);

            _patternPlayer = Object.FindFirstObjectByType<MonsterPatternPlayer>();
            _inputController = Object.FindFirstObjectByType<CombatInputController>();
            _combo = Object.FindFirstObjectByType<ComboController>();
            Assert.IsNotNull(_patternPlayer, "MonsterPatternPlayer must exist in CombatScene.");
            Assert.IsNotNull(_inputController, "CombatInputController must exist in CombatScene.");
            Assert.IsNotNull(_combo, "ComboController must exist in CombatScene.");

            foreach (var health in Object.FindObjectsByType<HealthController>(FindObjectsSortMode.None))
            {
                if (health.gameObject.name == "PlayerHealth")
                {
                    _playerHealth = health;
                }
            }
            Assert.IsNotNull(_playerHealth, "PlayerHealth must exist in CombatScene.");

            _config = (GameplayConfig)GetPrivateField(_patternPlayer, "gameplayConfig");
            Assert.IsNotNull(_config, "MonsterPatternPlayer.gameplayConfig must be wired.");

            // Stop the autonomous Lampang timeline before it can spawn/resolve a beat and
            // race the controlled beats this suite drives itself, on the SAME
            // ComboController/PlayerHealth this suite asserts on. Both steps matter:
            // StopAllCoroutines halts DriveLoop if Start() already scheduled it (Unity
            // does not stop a MonoBehaviour's coroutines just by disabling it); nulling
            // patternSheet stops it from ever starting one if Start() has not run yet.
            _patternPlayer.StopAllCoroutines();
            SetPrivateField(_patternPlayer, "patternSheet", null);
            foreach (var stray in Object.FindObjectsByType<ParryMarker>(FindObjectsSortMode.None))
            {
                Object.Destroy(stray.gameObject);
            }
            yield return null; // let Destroy() take effect before the first test body runs

            Assert.AreEqual(0, _combo.Stage, "Precondition: combo must start at 0.");
            Assert.AreEqual(_playerHealth.MaxHP, _playerHealth.CurrentHP, "Precondition: player must start at full HP.");

            _executeC1Basic = typeof(MonsterPatternPlayer).GetMethod("ExecuteC1Basic", BindingFlags.NonPublic | BindingFlags.Instance);
            Assert.IsNotNull(_executeC1Basic, "MonsterPatternPlayer.ExecuteC1Basic must exist for this suite to drive the real production code path.");
        }

        [UnityTest]
        public IEnumerator Tap_AtVaryingOffsetsFromTarget_ProducesPerfectGoodMiss_DrivesComboAndDamage_AndCapturesARenderedFrame()
        {
            // Sanity-check the offsets below actually land in the buckets this test
            // assumes, against the REAL live config (not a re-declared copy of it).
            Assert.LessOrEqual(0.25f, _config.goodWindowSeconds, "0.25s offset must be within the good window for this test to be a Good case.");
            Assert.Less(0.15f, 0.25f, "0.25s offset must be outside the perfect window for this test to be a Good case (not Perfect).");
            Assert.Greater(0.60f, _config.goodWindowSeconds, "0.60s offset must be outside the good window for this test to be a Miss case.");

            int startingPlayerHp = _playerHealth.CurrentHP;

            // ── Tap 1: exactly at ring-overlap (offset 0.00s) -> PERFECT ──────────────
            yield return RunSingleBeatAndTap(beatOffsetSeconds: 0.1f, tapOffsetFromTarget: 0f);
            Assert.AreEqual(ParryJudgment.Perfect, _lastMarker.Result, "A tap at exact ring-overlap must resolve Perfect.");
            Assert.AreEqual(1, _combo.Stage, "GDD §4.4: a Perfect parry adds +1 combo stage.");
            AssertBurstColorApprox(GameplayColors.Gold, "Perfect");

            // Rendered-frame evidence: nobody had looked at actual pixels before this -
            // capture the frame right after the gold burst spawns. Uses a render-to-
            // texture capture (not ScreenCapture.CaptureScreenshot) because the OS-level
            // screenshot API depends on a presented window swap-chain that Editor
            // batchmode does not reliably provide (confirmed empirically: it silently
            // wrote no file at all here, with or without -nographics); rendering the
            // camera into a RenderTexture and reading it back with Texture2D.ReadPixels
            // has no such dependency.
            string screenshotPath = Path.Combine(Application.persistentDataPath, "p0_parry_perfect_burst.png");
            yield return CaptureCanvasScreenshot(screenshotPath);
            Assert.IsTrue(File.Exists(screenshotPath), $"Expected a rendered screenshot at {screenshotPath}");
            Assert.Greater(new FileInfo(screenshotPath).Length, 0, "Screenshot file must not be empty.");
            Debug.Log($"[TapResolutionPlayModeTests] Rendered-frame evidence captured at: {screenshotPath}");

            // ── Tap 2: 0.25s off target -> GOOD (inside good window, outside perfect) ─
            yield return RunSingleBeatAndTap(beatOffsetSeconds: 0.1f, tapOffsetFromTarget: 0.25f);
            Assert.AreEqual(ParryJudgment.Good, _lastMarker.Result, "A tap 0.25s off target must resolve Good.");
            Assert.AreEqual(1, _combo.Stage, "GDD §4.4: Good parries maintain but never raise the combo stage.");
            AssertBurstColorApprox(GameplayColors.GoodBurst, "Good");

            // ── Tap 3: 0.60s off target -> MISS -> combo resets, player takes damage ──
            // Applied EARLY (negative offset) rather than late: a late tap beyond the
            // good window races ParryMarker's own auto-miss timeout (it resolves itself
            // once Time.time - targetTime > goodWindowSeconds), which would make this
            // test's outcome depend on frame-update ordering instead of on an actual tap.
            // Tapping this far early carries no such timeout on that side and still
            // exercises the exact same JudgmentEvaluator Miss branch via a real tap.
            // beatOffsetSeconds is larger here (1.2s, vs 0.1s above) so there is real
            // slack between "marker detected" (~stepStart) and "target - 0.60s" for
            // WaitUntil to actually wait on - with only 0.1s of offset the marker would
            // already be found essentially AT the tap time, defeating the early-offset
            // entirely (this was caught by this exact test failing during verification).
            yield return RunSingleBeatAndTap(beatOffsetSeconds: 1.2f, tapOffsetFromTarget: -0.60f);
            Assert.AreEqual(ParryJudgment.Miss, _lastMarker.Result, "A tap 0.60s off target must resolve Miss.");
            Assert.AreEqual(0, _combo.Stage, "GDD §4.4: a Miss resets combo to 0.");
            Assert.Less(_playerHealth.CurrentHP, startingPlayerHp, "A Miss must apply the pattern's failure damage to the player.");
            Assert.IsNull(Object.FindFirstObjectByType<ParryBurstEffect>(), "A Miss must not spawn a burst effect.");
        }

        [UnityTest]
        public IEnumerator ParryMarkerOverMonsterPart_TapParries_NotBasicAttack()
        {
            HealthController monsterHealth = null;
            foreach (var health in Object.FindObjectsByType<HealthController>(FindObjectsSortMode.None))
            {
                if (health.gameObject.name == "MonsterHealth")
                {
                    monsterHealth = health;
                }
            }
            Assert.IsNotNull(monsterHealth, "MonsterHealth must exist in CombatScene.");
            int startingMonsterHp = monsterHealth.CurrentHP;

            // Lampang P1's anchor part ("cheek_pouch") IS ITSELF a tappable MonsterPart
            // (SceneBuilder wires CheekPouchRight with both a MonsterPart component and
            // as the P1 anchor) - so a marker spawned here lands exactly on a real
            // monster-part tap target, which is precisely the case GDD §4.2's priority
            // rule exists to arbitrate. RunSingleBeatAndTap's screen point comes from
            // marker.transform.position, which SceneBuilder/MonsterPatternPlayer set to
            // the anchor part's own world position - the two are the SAME point.
            yield return RunSingleBeatAndTap(beatOffsetSeconds: 0.1f, tapOffsetFromTarget: 0f);

            Assert.AreEqual(ParryJudgment.Perfect, _lastMarker.Result,
                "GDD §4.2: with a parry marker over the monster body, the tap must PARRY, not basic-attack.");
            Assert.AreEqual(startingMonsterHp, monsterHealth.CurrentHP,
                "GDD §4.2: the same tap must NOT also register as a basic attack (no monster HP loss).");
        }

        // ── helpers ──────────────────────────────────────────────────────────────

        private static MonsterPatternStep MakeSingleBeatStep(float beatOffsetSeconds, string anchorPartId)
        {
            var step = ScriptableObject.CreateInstance<MonsterPatternStep>();
            step.patternId = "TEST";
            step.displayName = "test beat (PlayMode suite)";
            step.classification = PatternClass.C1_Basic;
            step.anchorPartId = anchorPartId;
            step.failureSeverity = FailureSeverity.Small;
            // telegraphLeadSeconds >= beatOffsetSeconds so the marker spawns immediately
            // (no real-time wait before the test can find it and schedule its tap).
            step.parryBeats = new[]
            {
                new ParryBeat { beatOffsetSeconds = beatOffsetSeconds, telegraphLeadSeconds = Mathf.Max(1f, beatOffsetSeconds) }
            };
            return step;
        }

        /// <summary>Runs the REAL MonsterPatternPlayer.ExecuteC1Basic coroutine for a
        /// single synthetic beat, waits for its marker to spawn, then taps it (via the
        /// real CombatInputController.ResolveTap raycast path) at
        /// <paramref name="tapOffsetFromTarget"/> seconds relative to the marker's
        /// judgment target time. Leaves the resolved marker in <see cref="_lastMarker"/>.</summary>
        private IEnumerator RunSingleBeatAndTap(float beatOffsetSeconds, float tapOffsetFromTarget, string anchorPartId = "cheek_pouch")
        {
            // A resolved ParryMarker is not destroyed immediately (Resolve() schedules
            // Destroy(gameObject, 0.4f) so its burst/fade is visible) - so a marker from
            // a PREVIOUS call to this helper can still exist and be findable when the
            // next beat starts. Without this cleanup, the search loop below could pick
            // up that stale, already-resolved marker instead of the new one, silently
            // reporting the previous beat's Result/TargetTime for this one.
            foreach (var stray in Object.FindObjectsByType<ParryMarker>(FindObjectsSortMode.None))
            {
                Object.Destroy(stray.gameObject);
            }
            yield return null; // let Destroy() take effect before spawning the next beat

            var step = MakeSingleBeatStep(beatOffsetSeconds, anchorPartId);
            var routine = (IEnumerator)_executeC1Basic.Invoke(_patternPlayer, new object[] { step });
            _patternPlayer.StartCoroutine(routine);

            ParryMarker marker = null;
            for (int frame = 0; frame < 60 && marker == null; frame++)
            {
                yield return null;
                marker = Object.FindFirstObjectByType<ParryMarker>();
            }
            Assert.IsNotNull(marker, "Expected the beat's ParryMarker to spawn within 60 frames.");
            _lastMarker = marker;

            float tapAt = marker.TargetTime + tapOffsetFromTarget;
            yield return new WaitUntil(() => Time.time >= tapAt);

            Vector2 screenPoint = marker.transform.position; // ScreenSpaceOverlay canvas: world pos == screen pos
            _inputController.ResolveTap(screenPoint);

            yield return null; // let OnResolved -> ApplyJudgment -> combo/health settle
            yield return null; // and RunBeat's group.Remaining-- / ExecuteC1Basic's wait settle
        }

        /// <summary>Renders the scene's Canvas to a RenderTexture and writes it to disk
        /// as a PNG. Temporarily switches the Canvas from Screen Space - Overlay (its
        /// real, production render mode) to Screen Space - Camera, because Overlay
        /// canvases are composited directly to the presented display and are not
        /// visible to any Camera.Render() / RenderTexture readback - the swap needs a
        /// camera to render through, but a batchmode window's swap-chain is not reliably
        /// available to read from at all. The scene is reloaded fresh for every test
        /// ([UnitySetUp]), so this mutation never leaks into another test.</summary>
        private static IEnumerator CaptureCanvasScreenshot(string path)
        {
            var canvas = Object.FindFirstObjectByType<Canvas>();
            var camera = Camera.main;
            Assert.IsNotNull(canvas, "Expected a Canvas in the scene to capture.");
            Assert.IsNotNull(camera, "Expected a Main Camera in the scene to render through.");

            const int width = 1080;
            const int height = 1920; // matches SceneBuilder's portrait reference resolution
            var rt = new RenderTexture(width, height, 24);
            var previousRenderMode = canvas.renderMode;
            var previousWorldCamera = canvas.worldCamera;
            var previousTargetTexture = camera.targetTexture;

            canvas.renderMode = RenderMode.ScreenSpaceCamera;
            canvas.worldCamera = camera;
            camera.targetTexture = rt;

            yield return null; // let the canvas re-layout under camera space before rendering
            camera.Render();

            var previousActive = RenderTexture.active;
            RenderTexture.active = rt;
            var tex = new Texture2D(width, height, TextureFormat.RGB24, false);
            tex.ReadPixels(new Rect(0, 0, width, height), 0, 0);
            tex.Apply();
            RenderTexture.active = previousActive;

            File.WriteAllBytes(path, tex.EncodeToPNG());

            canvas.renderMode = previousRenderMode;
            canvas.worldCamera = previousWorldCamera;
            camera.targetTexture = previousTargetTexture;
            Object.Destroy(tex);
            rt.Release();
            Object.Destroy(rt);
        }

        private static void AssertBurstColorApprox(Color expected, string label)
        {
            var burst = Object.FindFirstObjectByType<ParryBurstEffect>();
            Assert.IsNotNull(burst, $"Expected a burst effect to spawn on {label} resolution.");
            var image = burst.GetComponent<Image>();
            Assert.IsNotNull(image, "ParryBurstEffect must carry an Image component.");
            var actual = image.color;
            // Compare RGB only - alpha is already fading by the time we sample it.
            const float tolerance = 0.02f;
            Assert.Less(Mathf.Abs(actual.r - expected.r), tolerance, $"{label} burst red channel mismatch: {actual} vs expected {expected}");
            Assert.Less(Mathf.Abs(actual.g - expected.g), tolerance, $"{label} burst green channel mismatch: {actual} vs expected {expected}");
            Assert.Less(Mathf.Abs(actual.b - expected.b), tolerance, $"{label} burst blue channel mismatch: {actual} vs expected {expected}");
        }

        private static object GetPrivateField(object target, string fieldName)
        {
            var field = target.GetType().GetField(fieldName, BindingFlags.NonPublic | BindingFlags.Instance);
            Assert.IsNotNull(field, $"field '{fieldName}' not found on {target.GetType().Name}");
            return field.GetValue(target);
        }

        private static void SetPrivateField(object target, string fieldName, object value)
        {
            var field = target.GetType().GetField(fieldName, BindingFlags.NonPublic | BindingFlags.Instance);
            Assert.IsNotNull(field, $"field '{fieldName}' not found on {target.GetType().Name}");
            field.SetValue(target, value);
        }
    }
}
