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
    /// Deliberately does NOT pass -nographics: batchmode camera.Render() needs a real
    /// graphics device on Windows to produce non-empty pixels.
    /// </summary>
    public static class SpikeRenderer
    {
        const int Width = 1024;
        const int Height = 1280;
        const string ScenesFolder = "Assets/LifeTown.App/Scenes";
        const string SceneAssetPath = ScenesFolder + "/SpikeLibrary.unity";
        const string OutputFileName = "spike-building.png";

        [MenuItem("LifeTown/Spike/Render Library PNG")]
        public static void RenderPng()
        {
            RenderTexture rt = null;
            Texture2D tex = null;
            Camera cam = null;

            try
            {
                var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

                var footprintCenter = Vector3.zero;
                cam = IsoSceneSetup.BuildScene(footprintCenter, focusHeight: 1.0f);
                LibraryBuildingBuilder.Build(null, footprintCenter);

                SaveSceneAsset(scene);

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
                string outPath = Path.Combine(LogsDir(), OutputFileName);
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

        static void SaveSceneAsset(UnityEngine.SceneManagement.Scene scene)
        {
            if (!AssetDatabase.IsValidFolder(ScenesFolder))
                AssetDatabase.CreateFolder("Assets/LifeTown.App", "Scenes");
            EditorSceneManager.SaveScene(scene, SceneAssetPath);
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
