using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using TouchRPG.Combat.Core;
using TouchRPG.Combat.Input;
using TouchRPG.Combat.Pattern;

namespace TouchRPG.EditorTools
{
    /// <summary>
    /// Dev/QA screenshot capture harness (GDD §0 grants tooling to team discretion,
    /// same status as SceneBuilder/AutoPlayToggleButton/PatternTriggerButton). Drives
    /// the REAL CombatScene in Play Mode, triggers a plain P1 parry beat and a P5 relay
    /// beat via MonsterPatternPlayer.TriggerPatternById, and captures a PNG of each so
    /// the relay marker's distinct look (GDD §6.2: red ring + sequence badge + border
    /// pulse, vs the plain yellow parry) can be inspected side by side as evidence -
    /// rather than only asserted by a test.
    ///
    /// Capture technique: NOT ScreenCapture.CaptureScreenshot - the production Canvas
    /// renders Screen Space - Overlay (composited straight to the presented display),
    /// which does not exist in a headless batchmode session, so that API silently
    /// produces no file there (found empirically). Uses the same RenderTexture
    /// readback TapResolutionPlayModeTests already validated instead: temporarily
    /// switch the Canvas to Screen Space - Camera, render the main camera into an
    /// offscreen RenderTexture, then ReadPixels/EncodeToPNG - see CaptureCanvasPng.
    ///
    /// Run via Unity menu "TouchRPG/QA/Capture Relay Marker Screenshots" or in
    /// batchmode with -executeMethod TouchRPG.EditorTools.RelayMarkerScreenshotTool.CaptureBatch
    /// (NOT combined with -quit - the capture runs across many Play Mode Update ticks
    /// and calls EditorApplication.Exit itself once both screenshots are written, same
    /// "-quit truncates an in-progress run" gotcha as -runTests PlayMode).
    /// </summary>
    public static class RelayMarkerScreenshotTool
    {
        private const string OutputDir = "Logs/RelayMarkerScreenshots";

        private enum Stage
        {
            AwaitPlayer,
            TriggerP1,
            AwaitP1Marker,
            PrepareShotP1,
            ShotP1,
            SettleAfterP1,
            TriggerP5,
            AwaitP5Marker,
            PrepareShotP5,
            ShotP5,
            SettleAfterP5,
            TriggerP5ForBeam,
            AwaitRelayBeatForBeam,
            TapRelayBeatForBeam,
            AwaitBeam,
            PrepareShotBeam,
            ShotBeam,
            Done
        }

        private static Stage _stage;
        private static MonsterPatternPlayer _patternPlayer;
        private static CombatInputController _inputController;
        private static float _stageEnteredAt;
        private static bool _exitWhenDone;
        private static bool _restoreEnterPlayModeOptionsEnabled;
        private static EnterPlayModeOptions _restoreEnterPlayModeOptions;
        private static int _relayBeatIndex;
        private static ParryMarker _pendingRelayMarker;
        private static float _beamFoundAt = -1f;

        [MenuItem("TouchRPG/QA/Capture Relay Marker Screenshots")]
        public static void CaptureFromMenu()
        {
            _exitWhenDone = false;
            Begin();
        }

        /// <summary>Batchmode entry point - exits the editor process once both
        /// screenshots are written, so a caller invoking this via -executeMethod
        /// gets a normal process exit instead of hanging in Play Mode forever.</summary>
        public static void CaptureBatch()
        {
            _exitWhenDone = true;
            Begin();
        }

        private static void Begin()
        {
            Directory.CreateDirectory(OutputDir);
            EditorSceneManager.OpenScene("Assets/Scenes/CombatScene.unity");

            // Entering Play Mode with the project's normal (default) settings triggers a
            // full script domain reload, which wipes every static field in the Editor
            // AppDomain - including this class's own _stage/_patternPlayer bookkeeping
            // and its EditorApplication.update subscription. That silently stops this
            // state machine dead with no error (found empirically: the tool hung with no
            // further log output). Disabling domain reload for the duration of this
            // capture keeps our state alive across the Edit->Play transition; the
            // original project setting is restored once capture finishes (see Done stage)
            // so this tool never leaves a persistent change to EditorSettings.asset.
            _restoreEnterPlayModeOptionsEnabled = EditorSettings.enterPlayModeOptionsEnabled;
            _restoreEnterPlayModeOptions = EditorSettings.enterPlayModeOptions;
            EditorSettings.enterPlayModeOptionsEnabled = true;
            EditorSettings.enterPlayModeOptions = EnterPlayModeOptions.DisableDomainReload;

            _stage = Stage.AwaitPlayer;
            _patternPlayer = null;
            EditorApplication.update -= Tick;
            EditorApplication.update += Tick;
            EditorApplication.isPlaying = true;
        }

        private static void RestoreEnterPlayModeOptions()
        {
            EditorSettings.enterPlayModeOptionsEnabled = _restoreEnterPlayModeOptionsEnabled;
            EditorSettings.enterPlayModeOptions = _restoreEnterPlayModeOptions;
        }

        private static void Tick()
        {
            if (!EditorApplication.isPlaying)
            {
                return;
            }

            switch (_stage)
            {
                case Stage.AwaitPlayer:
                    _patternPlayer = Object.FindFirstObjectByType<MonsterPatternPlayer>();
                    if (_patternPlayer != null)
                    {
                        // Stop the auto-cycling demo loop so it cannot spawn a competing
                        // marker while this tool drives a specific pattern manually -
                        // same technique LampangP4P5P7ScenePlayModeTests uses. Also kills
                        // any beat coroutine the auto-cycle may have already started
                        // before this frame (e.g. a P1 whose 2nd beat is still pending) -
                        // left alive, it would spawn an unrelated marker mid-capture and
                        // get mistaken for a relay beat (found empirically).
                        _patternPlayer.SetAutoPlayEnabled(false);
                        _patternPlayer.StopAllCoroutines();
                        _inputController = Object.FindFirstObjectByType<CombatInputController>();
                        DestroyAllMarkers();
                        Advance(Stage.TriggerP1);
                    }
                    break;

                case Stage.TriggerP1:
                    _patternPlayer.TriggerPatternById("P1");
                    Advance(Stage.AwaitP1Marker);
                    break;

                case Stage.AwaitP1Marker:
                    if (Object.FindFirstObjectByType<ParryMarker>() != null || TimedOut(2f))
                    {
                        Advance(Stage.PrepareShotP1);
                    }
                    break;

                case Stage.PrepareShotP1:
                    BeginCanvasCapture();
                    Advance(Stage.ShotP1);
                    break;

                case Stage.ShotP1:
                    // One frame after switching the Canvas to Camera space (see
                    // BeginCanvasCapture) - same "yield return null; camera.Render();"
                    // gap TapResolutionPlayModeTests uses, so CanvasScaler has settled
                    // before the readback.
                    EndCanvasCapture(Path.Combine(OutputDir, "p1_yellow_parry_marker.png"));
                    Advance(Stage.SettleAfterP1);
                    break;

                case Stage.SettleAfterP1:
                    if (TimedOut(0.1f))
                    {
                        // P1 has a 2nd beat still pending in its own coroutine at this
                        // point (offset 2.4s, not yet reached) - kill it before moving on,
                        // same reasoning as the AwaitPlayer stage above.
                        _patternPlayer.StopAllCoroutines();
                        DestroyAllMarkers();
                        Advance(Stage.TriggerP5);
                    }
                    break;

                case Stage.TriggerP5:
                    _patternPlayer.TriggerPatternById("P5");
                    Advance(Stage.AwaitP5Marker);
                    break;

                case Stage.AwaitP5Marker:
                    // GDD §5.2 P5 beat 1 spawns ~0.2s after step start (beatOffsetSeconds
                    // 1.0 - telegraphLeadSeconds 0.8) - wait a bit past that so the border
                    // pulse/sequence badge are both visibly on screen, not just spawned.
                    if ((Object.FindFirstObjectByType<ParryMarker>() != null && TimedOut(0.5f)) || TimedOut(3f))
                    {
                        Advance(Stage.PrepareShotP5);
                    }
                    break;

                case Stage.PrepareShotP5:
                    BeginCanvasCapture();
                    Advance(Stage.ShotP5);
                    break;

                case Stage.ShotP5:
                    EndCanvasCapture(Path.Combine(OutputDir, "p5_red_relay_marker.png"));
                    Advance(Stage.SettleAfterP5);
                    break;

                case Stage.SettleAfterP5:
                    if (TimedOut(0.1f))
                    {
                        // The first P5 trigger's relay coroutine is still parked waiting
                        // on its (now-destroyed) beat-1 marker to resolve - kill it before
                        // starting the second, fully-tapped P5 run.
                        _patternPlayer.StopAllCoroutines();
                        DestroyAllMarkers();
                        _relayBeatIndex = 0;
                        Advance(Stage.TriggerP5ForBeam);
                    }
                    break;

                // ── GDD §5.2 MUST: drive a FULL successful relay (all 3 beats tapped
                // on time) to capture the success light beam (party portrait -> monster)
                // as actual pixel evidence, not just a test assertion. ────────────────

                case Stage.TriggerP5ForBeam:
                    _patternPlayer.TriggerPatternById("P5");
                    Advance(Stage.AwaitRelayBeatForBeam);
                    break;

                case Stage.AwaitRelayBeatForBeam:
                    _pendingRelayMarker = Object.FindFirstObjectByType<ParryMarker>();
                    if (_pendingRelayMarker != null && Time.time >= _pendingRelayMarker.TargetTime)
                    {
                        Advance(Stage.TapRelayBeatForBeam);
                    }
                    else if (TimedOut(3f))
                    {
                        // Safety valve - if a beat never arrives, stop retrying forever.
                        _beamFoundAt = -1f;
                        Advance(Stage.AwaitBeam);
                    }
                    break;

                case Stage.TapRelayBeatForBeam:
                    if (_pendingRelayMarker != null && _inputController != null)
                    {
                        _inputController.ResolveTap(_pendingRelayMarker.transform.position);
                        // Destroy immediately rather than waiting out its fade (same
                        // reasoning as LampangP4P5P7ScenePlayModeTests.P5_SoloRelaySuccess...):
                        // a resolved-but-not-yet-destroyed marker could otherwise alias
                        // the next beat's genuinely new one in the poll below.
                        Object.Destroy(_pendingRelayMarker.gameObject);
                        _pendingRelayMarker = null;
                    }
                    _relayBeatIndex++;
                    if (_relayBeatIndex >= 3)
                    {
                        _beamFoundAt = -1f;
                        Advance(Stage.AwaitBeam);
                    }
                    else
                    {
                        Advance(Stage.AwaitRelayBeatForBeam);
                    }
                    break;

                case Stage.AwaitBeam:
                    var beam = Object.FindFirstObjectByType<RelayLightBeamEffect>();
                    if (beam != null && _beamFoundAt < 0f)
                    {
                        _beamFoundAt = Time.realtimeSinceStartup;
                    }
                    // Wait past the beam's own fade-IN (RelayLightBeamEffect.FadeInFraction
                    // of its lifetime) so the capture lands near peak opacity, not the
                    // near-invisible first frame or two right after Spawn().
                    bool beamSettled = _beamFoundAt >= 0f && Time.realtimeSinceStartup - _beamFoundAt >= 0.15f;
                    if (beamSettled || TimedOut(2f))
                    {
                        Advance(Stage.PrepareShotBeam);
                    }
                    break;

                case Stage.PrepareShotBeam:
                    BeginCanvasCapture();
                    Advance(Stage.ShotBeam);
                    break;

                case Stage.ShotBeam:
                    EndCanvasCapture(Path.Combine(OutputDir, "p5_relay_success_light_beam.png"));
                    Advance(Stage.Done);
                    break;

                case Stage.Done:
                    if (TimedOut(0.1f))
                    {
                        EditorApplication.update -= Tick;
                        EditorApplication.isPlaying = false;
                        RestoreEnterPlayModeOptions();
                        Debug.Log($"[RelayMarkerScreenshotTool] Screenshots written to {Path.GetFullPath(OutputDir)}");
                        if (_exitWhenDone)
                        {
                            EditorApplication.Exit(0);
                        }
                    }
                    break;
            }
        }

        private static void DestroyAllMarkers()
        {
            foreach (var stray in Object.FindObjectsByType<ParryMarker>(FindObjectsSortMode.None))
            {
                Object.Destroy(stray.gameObject);
            }
        }

        // ── Canvas -> RenderTexture -> PNG readback (same technique as
        // TapResolutionPlayModeTests.CaptureCanvasScreenshot) ───────────────────────

        private static Canvas _capturedCanvas;
        private static RenderMode _previousRenderMode;
        private static Camera _previousWorldCamera;
        private static RenderTexture _previousTargetTexture;
        private static RenderTexture _captureRt;
        private static Camera _captureCamera;

        private static void BeginCanvasCapture()
        {
            _capturedCanvas = Object.FindFirstObjectByType<Canvas>();
            _captureCamera = Camera.main;
            if (_capturedCanvas == null || _captureCamera == null)
            {
                return;
            }

            int width = Mathf.Max(1, Screen.width);
            int height = Mathf.Max(1, Screen.height);
            _captureRt = new RenderTexture(width, height, 24);

            _previousRenderMode = _capturedCanvas.renderMode;
            _previousWorldCamera = _capturedCanvas.worldCamera;
            _previousTargetTexture = _captureCamera.targetTexture;

            _capturedCanvas.renderMode = RenderMode.ScreenSpaceCamera;
            _capturedCanvas.worldCamera = _captureCamera;
            _captureCamera.targetTexture = _captureRt;
        }

        private static void EndCanvasCapture(string path)
        {
            if (_capturedCanvas == null || _captureCamera == null || _captureRt == null)
            {
                Debug.LogWarning("[RelayMarkerScreenshotTool] No Canvas/Camera found - skipping screenshot.");
                return;
            }

            _captureCamera.Render();

            var previousActive = RenderTexture.active;
            RenderTexture.active = _captureRt;
            var tex = new Texture2D(_captureRt.width, _captureRt.height, TextureFormat.RGB24, false);
            tex.ReadPixels(new Rect(0, 0, _captureRt.width, _captureRt.height), 0, 0);
            tex.Apply();
            RenderTexture.active = previousActive;

            File.WriteAllBytes(path, tex.EncodeToPNG());
            Object.Destroy(tex);

            _capturedCanvas.renderMode = _previousRenderMode;
            _capturedCanvas.worldCamera = _previousWorldCamera;
            _captureCamera.targetTexture = _previousTargetTexture;
            _captureRt.Release();
            Object.Destroy(_captureRt);
            _captureRt = null;
        }

        private static void Advance(Stage next)
        {
            _stage = next;
            _stageEnteredAt = Time.realtimeSinceStartup;
        }

        private static bool TimedOut(float seconds)
        {
            return Time.realtimeSinceStartup - _stageEnteredAt >= seconds;
        }
    }
}
