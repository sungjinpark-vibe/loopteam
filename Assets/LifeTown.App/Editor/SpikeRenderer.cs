using System;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using LifeTown.App.Buildings;
using LifeTown.App.Scene;

namespace LifeTown.App.Editor
{
    /// <summary>
    /// The T007 spike's batchmode screenshot pipeline. Builds a fresh scene (ground tile +
    /// isometric camera + soft light + the Library building), renders the orthographic
    /// camera to a RenderTexture, and saves a PNG -- all from one static method so a
    /// director/QA can see the result without opening the editor by hand.
    ///
    /// Exact command (run from repo root or anywhere; paths are absolute):
    ///   "C:\Program Files\Unity\Hub\Editor\6000.5.1f1\Editor\Unity.exe" -batchmode -quit
    ///     -projectPath "C:\Users\user\loop_engine\lifetown"
    ///     -executeMethod LifeTown.App.Editor.SpikeRenderer.RenderPng
    ///     -logFile "C:\Users\user\loop_engine\lifetown\Logs\spike-render.log"
    ///
    /// Output: C:\Users\user\loop_engine\lifetown\Logs\spike-building.png
    /// Also saves the built scene to Assets/LifeTown.App/Scenes/SpikeLibrary.unity so it
    /// can be opened and inspected directly in the editor, not just as a screenshot.
    ///
    /// RenderGymPng is the same pipeline pointed at the Gym building (see
    /// GymBuildingBuilder) -- swap -executeMethod for
    /// LifeTown.App.Editor.SpikeRenderer.RenderGymPng to get
    /// Logs\spike-gym.png / Assets/LifeTown.App/Scenes/SpikeGym.unity instead.
    ///
    /// Deliberately does NOT pass -nographics: batchmode camera.Render() needs a real
    /// graphics device on Windows to produce non-empty pixels.
    /// </summary>
    public static class SpikeRenderer
    {
        const int Width = 1024;
        const int Height = 1280;
        const string ScenesFolder = "Assets/LifeTown.App/Scenes";
        const string SceneAssetPath = ScenesFolder + "/SpikeLibrary.unity";
        const string GymSceneAssetPath = ScenesFolder + "/SpikeGym.unity";
        const string OutputFileName = "spike-building.png";
        const string GymOutputFileName = "spike-gym.png";

        [MenuItem("LifeTown/Spike/Render Library PNG")]
        public static void RenderPng()
        {
            // focusHeight lowered from 1.0 (v1's tall tower, ~2.07 total height) to 0.45
            // for v2's book-stack archetype: 4 flat stacked books + a shallow open-book
            // crown top out around ~0.90 total, so the old focus height would leave the
            // building low in frame the same way the Gym's does at its own scale.
            RenderBuilding(SceneAssetPath, OutputFileName, focusHeight: 0.45f,
                footprintCenter => LibraryBuildingBuilder.Build(null, footprintCenter));
        }

        /// <summary>
        /// Same pipeline as <see cref="RenderPng"/>, pointed at the Gym instead of the
        /// Library. Lower focusHeight than the Library's (1.0) because the Gym's whole
        /// silhouette tops out around 0.65 vs. the Library's ~2.07 -- centring the camera
        /// on the same world-space focus height would leave the Gym low in frame.
        /// </summary>
        [MenuItem("LifeTown/Spike/Render Gym PNG")]
        public static void RenderGymPng()
        {
            RenderBuilding(GymSceneAssetPath, GymOutputFileName, focusHeight: 0.45f,
                footprintCenter => GymBuildingBuilder.Build(null, footprintCenter));
        }

        static void RenderBuilding(string sceneAssetPath, string outputFileName, float focusHeight, System.Action<Vector3> buildBuilding)
        {
            RenderTexture rt = null;
            Texture2D tex = null;
            Camera cam = null;

            try
            {
                var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

                var footprintCenter = Vector3.zero;
                cam = IsoSceneSetup.BuildScene(footprintCenter, focusHeight);
                buildBuilding(footprintCenter);

                SaveSceneAsset(scene, sceneAssetPath);

                rt = new RenderTexture(Width, Height, 24, RenderTextureFormat.ARGB32);
                cam.targetTexture = rt;
                cam.Render();

                var prevActive = RenderTexture.active;
                RenderTexture.active = rt;
                tex = new Texture2D(Width, Height, TextureFormat.RGBA32, false);
                tex.ReadPixels(new Rect(0, 0, Width, Height), 0, 0);
                tex.Apply();
                RenderTexture.active = prevActive;

                byte[] png = tex.EncodeToPNG();
                string outPath = Path.Combine(LogsDir(), outputFileName);
                File.WriteAllBytes(outPath, png);

                Debug.Log($"[SpikeRenderer] wrote {png.Length} bytes to {outPath}");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[SpikeRenderer] FAILED: {ex}");
                EditorApplication.Exit(1);
            }
            finally
            {
                if (cam != null) cam.targetTexture = null;
                if (rt != null)
                {
                    RenderTexture.active = null;
                    rt.Release();
                    UnityEngine.Object.DestroyImmediate(rt);
                }
                if (tex != null) UnityEngine.Object.DestroyImmediate(tex);
            }
        }

        static void SaveSceneAsset(UnityEngine.SceneManagement.Scene scene, string sceneAssetPath)
        {
            if (!AssetDatabase.IsValidFolder(ScenesFolder))
                AssetDatabase.CreateFolder("Assets/LifeTown.App", "Scenes");
            EditorSceneManager.SaveScene(scene, sceneAssetPath);
        }

        static string LogsDir()
        {
            string projectRoot = Directory.GetParent(Application.dataPath).FullName;
            string dir = Path.Combine(projectRoot, "Logs");
            Directory.CreateDirectory(dir);
            return dir;
        }
    }
}
