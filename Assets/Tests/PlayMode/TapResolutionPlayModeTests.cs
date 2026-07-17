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
    /// observes the actual result on screen. Loads the real CombatScene, then drives
    /// the production MonsterPatternPlayer.ExecuteC1Basic coroutine directly (via
    /// reflection, since it is intentionally private - this test does not add
    /// test-only public API to production code) with a synthetic single-beat
    /// MonsterPatternStep so beat timing is test-controlled. Everything downstream of
    /// that call - spawn, anchor, EventSystem raycast, priority resolution, judgment,
    /// burst, combo, damage - is the exact production path, unmodified.
    ///
    /// IMPORTANT — running this suite: the rendered-pixel evidence in
    /// <see cref="Tap_AtVaryingOffsetsFromTarget_ProducesPerfectGoodMiss_DrivesComboAndDamage_AndCapturesARenderedFrame"/>
    /// requires an ACTUAL rasterizer. Run PlayMode tests WITHOUT -nographics
    /// (batchmode without -nographics still exits cleanly via -runTests and holds no
    /// project lock — confirmed empirically). Under -nographics, Camera.Render()
    /// produces no geometry and the capture comes back as a flat clear-color frame
    /// with zero gold/yellow pixels — that is exactly the failure this suite now
    /// asserts against directly (see AssertRegionHasColor/AssertImageHasNoColor
    /// below), rather than trusting File.Exists && length &gt; 0 (which passes on a
    /// blank image and was the previous round's gap).
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
            DestroyAllMarkers();
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

            // ── Rendered-frame evidence #1: IDLE, before anything has spawned. ────────
            // Establishes the "before" baseline: zero gold pixels anywhere on screen.
            // Without this, a burst-frame gold-pixel hit could not distinguish "the
            // burst actually rendered" from "gold was already on screen for some other
            // reason" (e.g. a stray leftover object).
            string idlePath = Path.Combine(Application.persistentDataPath, "p0_idle.png");
            Texture2D idleFrame = null;
            yield return CaptureCanvasScreenshot(idlePath, tex => idleFrame = tex);
            AssertImageHasNoColorAnywhere(idleFrame, GameplayColors.Gold, "IDLE frame (before any beat)");
            Object.Destroy(idleFrame);
            Debug.Log($"[TapResolutionPlayModeTests] Rendered-frame evidence (idle) captured at: {idlePath}");

            // ── Tap 1: exactly at ring-overlap (offset 0.00s) -> PERFECT ──────────────
            // Uses a real 1s telegraph (matching Lampang P1's own beat pacing) instead
            // of the near-instant 0.1s used for taps 2/3 below, specifically so there is
            // real wall-clock time to capture a mid-contraction frame before the beat
            // resolves.
            ParryMarker marker = null;
            yield return SpawnBeatAndWaitForMarkerCoroutine(1.0f, "cheek_pouch", m => marker = m);
            _lastMarker = marker;
            Vector2 screenPoint = marker.transform.position; // ScreenSpaceOverlay canvas: world pos == screen pos

            // ── Rendered-frame evidence #2: RING-OVERLAP (mid-contraction). ───────────
            // Captured ~0.5s before the target time, i.e. partway through the outer
            // ring's contraction toward the inner ring - the double yellow ring must
            // actually be on screen, anchored at the monster's cheek pouch, at this
            // point (GDD §6.2 MUST: marker anchors to the monster part, not the screen).
            yield return new WaitUntil(() => Time.time >= marker.TargetTime - 0.5f);
            yield return null;
            string midPath = Path.Combine(Application.persistentDataPath, "p0_ring_overlap.png");
            Texture2D midFrame = null;
            yield return CaptureCanvasScreenshot(midPath, tex => midFrame = tex);
            AssertRegionHasColor(midFrame, screenPoint, 120, GameplayColors.Parry,
                "RING-OVERLAP frame: expected the yellow double ring near its monster-part anchor");
            Object.Destroy(midFrame);
            Debug.Log($"[TapResolutionPlayModeTests] Rendered-frame evidence (ring-overlap) captured at: {midPath}");

            yield return new WaitUntil(() => Time.time >= marker.TargetTime);
            _inputController.ResolveTap(screenPoint);
            yield return null; // let OnResolved -> ApplyJudgment -> combo/health settle
            yield return null;

            Assert.AreEqual(ParryJudgment.Perfect, _lastMarker.Result, "A tap at exact ring-overlap must resolve Perfect.");
            Assert.AreEqual(1, _combo.Stage, "GDD §4.4: a Perfect parry adds +1 combo stage.");
            AssertBurstColorApprox(GameplayColors.Gold, "Perfect");

            // ── Rendered-frame evidence #3: PERFECT BURST, pixels not just component color.
            string burstPath = Path.Combine(Application.persistentDataPath, "p0_parry_perfect_burst.png");
            Texture2D burstFrame = null;
            yield return CaptureCanvasScreenshot(burstPath, tex => burstFrame = tex);
            AssertRegionHasColor(burstFrame, screenPoint, 160, GameplayColors.Gold,
                "PERFECT BURST frame: expected gold pixels near the resolved marker's anchor");
            Object.Destroy(burstFrame);
            Debug.Log($"[TapResolutionPlayModeTests] Rendered-frame evidence (perfect burst) captured at: {burstPath}");

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

        // ── Mashed / rapid input guards (GDD's mis-input guard extends to double-input) ──

        [UnityTest]
        public IEnumerator MashedInput_DoubleTapSameMarker_ResolvesOnlyOnce()
        {
            yield return RunSingleBeatAndTap(beatOffsetSeconds: 0.1f, tapOffsetFromTarget: 0f);
            Assert.AreEqual(ParryJudgment.Perfect, _lastMarker.Result, "Precondition: first tap must resolve Perfect.");
            Assert.AreEqual(1, _combo.Stage, "Precondition: combo must be 1 after the first tap.");

            Vector2 screenPoint = _lastMarker.transform.position;
            int burstCountBefore = CountBursts();
            int playerHpBefore = _playerHealth.CurrentHP;

            // Mash: two more taps at the exact same screen point, on an already-resolved
            // marker, back to back in consecutive frames. ParryMarker._resolved (set the
            // instant the first tap lands) and IsTappable (=> false once resolved) exist
            // specifically to make these no-ops - this exercises that guard with a real
            // ResolveTap call rather than only asserting the field exists.
            _inputController.ResolveTap(screenPoint);
            yield return null;
            _inputController.ResolveTap(screenPoint);
            yield return null;

            Assert.AreEqual(1, _combo.Stage, "A mashed re-tap on an already-resolved marker must not re-register as a second Perfect.");
            Assert.AreEqual(burstCountBefore, CountBursts(), "Mashing an already-resolved marker must not spawn a second burst.");
            Assert.AreEqual(playerHpBefore, _playerHealth.CurrentHP, "Mashing an already-resolved Perfect marker must not apply damage.");
        }

        [UnityTest]
        public IEnumerator MashedInput_TapDuringPostResolveDestroyDelay_DoesNotDoubleResolve()
        {
            yield return RunSingleBeatAndTap(beatOffsetSeconds: 0.1f, tapOffsetFromTarget: 0f);
            Assert.AreEqual(ParryJudgment.Perfect, _lastMarker.Result, "Precondition: first tap must resolve Perfect.");
            Assert.AreEqual(1, _combo.Stage, "Precondition: combo must be 1 after the first tap.");

            Vector2 screenPoint = _lastMarker.transform.position;
            int burstCountBefore = CountBursts();

            // Resolve() schedules Destroy(gameObject, 0.4f) so the burst/fade is visible
            // for a while after resolution - the marker is NOT gone immediately. Tap the
            // same point partway through that window (well before the 0.4s destroy
            // fires) under REAL elapsed time, not just "the same Update frame", to
            // confirm tapArea.raycastTarget being turned off in Resolve() actually holds
            // the raycaster from ever finding this marker as a candidate again.
            yield return new WaitForSeconds(0.15f);
            Assert.IsNotNull(_lastMarker, "Marker should still exist mid-fade (destroyed at 0.4s post-resolve, we are at 0.15s).");
            _inputController.ResolveTap(screenPoint);
            yield return null;

            Assert.AreEqual(1, _combo.Stage, "A tap during the post-resolve fade window must not re-register.");
            Assert.AreEqual(burstCountBefore, CountBursts(), "A tap during the fade window must not spawn a second burst.");
        }

        [UnityTest]
        public IEnumerator MashedInput_TwoOverlappingMarkers_SingleTapResolvesExactlyOne()
        {
            var template = (ParryMarker)GetPrivateField(_patternPlayer, "parryMarkerTemplate");
            var layer = (RectTransform)GetPrivateField(_patternPlayer, "markerLayer");
            Assert.IsNotNull(template, "MonsterPatternPlayer.parryMarkerTemplate must be wired.");
            Assert.IsNotNull(layer, "MonsterPatternPlayer.markerLayer must be wired.");

            DestroyAllMarkers();
            yield return null;

            // Two independent beats scheduled to the SAME anchor point and SAME target
            // time - the schema explicitly allows overlapping/simultaneous beats (see
            // MonsterPatternPlayer's doc comment on independent per-beat coroutines), so
            // this is a real, reachable case, not a synthetic corner: e.g. two markers
            // spawned in the same frame while the player's finger is already mashing.
            // Derived from the ACTUAL runtime Screen.width/height, not a hardcoded
            // reference-resolution constant (1080x1920) - the test runner's real window
            // size need not match the CanvasScaler's reference resolution, and a
            // hardcoded point landing outside the true screen silently misses every
            // raycast (caught by this exact test failing during verification: both
            // markers came back unresolved because the tap hit nothing at all).
            Vector3 anchorPos = new Vector3(Screen.width * 0.5f, Screen.height * 0.5f, 0f); // canvas-center screen point
            float targetTime = Time.time + 0.3f;

            var markerA = Object.Instantiate(template, layer);
            markerA.gameObject.SetActive(true);
            markerA.transform.position = anchorPos;
            markerA.Initialize(_config, targetTime, 0.3f);

            var markerB = Object.Instantiate(template, layer);
            markerB.gameObject.SetActive(true);
            markerB.transform.position = anchorPos;
            markerB.Initialize(_config, targetTime, 0.3f);

            yield return null; // let both become active/tappable this frame

            yield return new WaitUntil(() => Time.time >= targetTime);
            _inputController.ResolveTap(anchorPos);
            yield return null;

            bool aResolved = markerA.IsResolved;
            bool bResolved = markerB.IsResolved;
            Assert.IsTrue(aResolved ^ bResolved,
                $"A single tap over two overlapping ParryMarkers must resolve EXACTLY one (got A={aResolved}, B={bResolved}).");

            if (markerA != null) Object.Destroy(markerA.gameObject);
            if (markerB != null) Object.Destroy(markerB.gameObject);
        }

        // ── helpers ──────────────────────────────────────────────────────────────

        private static int CountBursts() => Object.FindObjectsByType<ParryBurstEffect>(FindObjectsSortMode.None).Length;

        private static void DestroyAllMarkers()
        {
            foreach (var stray in Object.FindObjectsByType<ParryMarker>(FindObjectsSortMode.None))
            {
                Object.Destroy(stray.gameObject);
            }
        }

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
            var marker = default(ParryMarker);
            yield return SpawnBeatAndWaitForMarkerCoroutine(beatOffsetSeconds, anchorPartId, m => marker = m);
            _lastMarker = marker;

            float tapAt = marker.TargetTime + tapOffsetFromTarget;
            yield return new WaitUntil(() => Time.time >= tapAt);

            Vector2 screenPoint = marker.transform.position; // ScreenSpaceOverlay canvas: world pos == screen pos
            _inputController.ResolveTap(screenPoint);

            yield return null; // let OnResolved -> ApplyJudgment -> combo/health settle
            yield return null; // and RunBeat's group.Remaining-- / ExecuteC1Basic's wait settle
        }

        /// <summary>Coroutine form of the spawn-only step, used both by
        /// <see cref="RunSingleBeatAndTap"/> and directly by the render-evidence test
        /// (which needs to capture frames between spawn and tap).</summary>
        private IEnumerator SpawnBeatAndWaitForMarkerCoroutine(float beatOffsetSeconds, string anchorPartId, System.Action<ParryMarker> onSpawned)
        {
            // A resolved ParryMarker is not destroyed immediately (Resolve() schedules
            // Destroy(gameObject, 0.4f) so its burst/fade is visible) - so a marker from
            // a PREVIOUS call to this helper can still exist and be findable when the
            // next beat starts. Without this cleanup, the search loop below could pick
            // up that stale, already-resolved marker instead of the new one, silently
            // reporting the previous beat's Result/TargetTime for this one.
            DestroyAllMarkers();
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
            onSpawned(marker);
        }

        /// <summary>Renders the scene's Canvas to a RenderTexture sized to the ACTUAL
        /// runtime Screen.width/height (not a hardcoded constant - CanvasScaler's
        /// ScaleWithScreenSize sizes the canvas to the real Screen dimensions, so a
        /// mismatched capture size would misalign captured pixels against screen-space
        /// coordinates like ParryMarker.transform.position) and writes it to disk as a
        /// PNG. Temporarily switches the Canvas from Screen Space - Overlay (its real,
        /// production render mode) to Screen Space - Camera, because Overlay canvases
        /// are composited directly to the presented display and are not visible to any
        /// Camera.Render() / RenderTexture readback. The scene is reloaded fresh for
        /// every test ([UnitySetUp]), so this mutation never leaks into another test.
        /// Hands the readable Texture2D back to the caller via <paramref name="onCaptured"/>
        /// for pixel-level assertions - the caller owns disposing it (Object.Destroy).</summary>
        private static IEnumerator CaptureCanvasScreenshot(string path, System.Action<Texture2D> onCaptured)
        {
            var canvas = Object.FindFirstObjectByType<Canvas>();
            var camera = Camera.main;
            Assert.IsNotNull(canvas, "Expected a Canvas in the scene to capture.");
            Assert.IsNotNull(camera, "Expected a Main Camera in the scene to render through.");

            int width = Mathf.Max(1, Screen.width);
            int height = Mathf.Max(1, Screen.height);
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
            rt.Release();
            Object.Destroy(rt);

            onCaptured(tex);
        }

        /// <summary>Asserts at least one pixel within <paramref name="radiusPx"/> of
        /// <paramref name="centerScreenPoint"/> approximately matches
        /// <paramref name="target"/>. This is the pixel-level check the previous round
        /// was missing entirely - it reads the ACTUAL rendered frame, not a component's
        /// .color field, which can be correct even when nothing visible reached the
        /// screen (e.g. under -nographics).</summary>
        private static void AssertRegionHasColor(Texture2D tex, Vector2 centerScreenPoint, int radiusPx, Color target, string context)
        {
            Assert.IsNotNull(tex, $"{context}: no captured frame to inspect.");
            bool found = RegionContainsColorApprox(tex, centerScreenPoint, radiusPx, target, tolerance: 0.10f);
            Assert.IsTrue(found, $"{context}. Searched a {radiusPx}px radius around {centerScreenPoint} in a {tex.width}x{tex.height} " +
                                  $"frame for a pixel near RGB({target.r:F2},{target.g:F2},{target.b:F2}) and found none - the expected " +
                                  "visual did not actually render.");
        }

        private static void AssertImageHasNoColorAnywhere(Texture2D tex, Color target, string context)
        {
            Assert.IsNotNull(tex, $"{context}: no captured frame to inspect.");
            bool found = ImageContainsColorAnywhere(tex, target, tolerance: 0.10f);
            Assert.IsFalse(found, $"{context}: expected NO pixel near RGB({target.r:F2},{target.g:F2},{target.b:F2}) yet, but found one - " +
                                   "something is rendering this color before it should.");
        }

        private static bool RegionContainsColorApprox(Texture2D tex, Vector2 centerScreenPoint, int radiusPx, Color target, float tolerance)
        {
            Color32[] pixels = tex.GetPixels32();
            int width = tex.width, height = tex.height;
            int cx = Mathf.Clamp(Mathf.RoundToInt(centerScreenPoint.x), 0, width - 1);
            int cy = Mathf.Clamp(Mathf.RoundToInt(centerScreenPoint.y), 0, height - 1);
            byte tol = (byte)Mathf.RoundToInt(tolerance * 255f);
            int xMin = Mathf.Max(0, cx - radiusPx), xMax = Mathf.Min(width - 1, cx + radiusPx);
            int yMin = Mathf.Max(0, cy - radiusPx), yMax = Mathf.Min(height - 1, cy + radiusPx);
            Color32 t = target;
            for (int y = yMin; y <= yMax; y++)
            {
                int row = y * width;
                for (int x = xMin; x <= xMax; x++)
                {
                    Color32 p = pixels[row + x];
                    if (System.Math.Abs(p.r - t.r) <= tol && System.Math.Abs(p.g - t.g) <= tol && System.Math.Abs(p.b - t.b) <= tol)
                    {
                        return true;
                    }
                }
            }
            return false;
        }

        private static bool ImageContainsColorAnywhere(Texture2D tex, Color target, float tolerance)
        {
            Color32[] pixels = tex.GetPixels32();
            byte tol = (byte)Mathf.RoundToInt(tolerance * 255f);
            Color32 t = target;
            for (int i = 0; i < pixels.Length; i += 3) // stride: full-image scan, sampled every 3rd pixel is plenty dense
            {
                Color32 p = pixels[i];
                if (System.Math.Abs(p.r - t.r) <= tol && System.Math.Abs(p.g - t.g) <= tol && System.Math.Abs(p.b - t.b) <= tol)
                {
                    return true;
                }
            }
            return false;
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
