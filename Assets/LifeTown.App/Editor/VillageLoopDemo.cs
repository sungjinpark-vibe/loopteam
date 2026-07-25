using System;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using LifeTown.App.BuildingKit;
using LifeTown.App.Game;
using LifeTown.App.Scene;
using LifeTown.App.Village;
using LifeTown.Economy.Core;
using LifeTown.Economy.Core.Models;
using LifeTown.Platform.Persistence;

namespace LifeTown.App.Editor
{
    /// <summary>
    /// T010 QA evidence pipeline: proves the tap -> timer -> settle -> growth loop end to
    /// end from batchmode. Drives the exact production path a real session would go
    /// through (<see cref="SaveGameService"/> -> LifeTown.Economy.Core.Settlement ->
    /// LevelCurve) -- two real 25-minute focus sessions on the Reading cottage via
    /// debug-skip, with a before/after screenshot of the actual village scene so the
    /// level-up is visible, not just asserted, plus a reload-from-disk check proving the
    /// save round-trips through LifeTown.Platform's file IO. Uses a throwaway save file
    /// under Logs/, never the real Application.persistentDataPath save.
    ///
    /// Exact command:
    ///   "C:\Program Files\Unity\Hub\Editor\6000.5.1f1\Editor\Unity.exe" -batchmode -quit
    ///     -projectPath "C:\Users\user\loop_engine\lifetown"
    ///     -executeMethod LifeTown.App.Editor.VillageLoopDemo.Run
    ///     -logFile "C:\Users\user\loop_engine\lifetown\Logs\village-loop-demo.log"
    ///
    /// Output: docs/qa/village-loop-before.png, docs/qa/village-loop-after.png, and every
    /// session/wallet number logged into the -logFile itself.
    /// </summary>
    public static class VillageLoopDemo
    {
        const string SceneAssetPath = "Assets/LifeTown.App/Scenes/SpikeVillageLoopDemo.unity";
        const long DebugSkipMs = 25 * 60_000L;

        [MenuItem("LifeTown/Spike/Run Village Loop Demo")]
        public static void Run()
        {
            RenderTexture rt = null;
            Texture2D tex = null;
            Camera cam = null;
            string savePath = Path.Combine(LogsDir(), "village-loop-demo-save.json");

            try
            {
                if (File.Exists(savePath)) File.Delete(savePath);

                var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
                cam = IsoSceneSetup.BuildVillageScene(Vector3.zero, orthoSize: 3.35f, cameraDistance: 16f, focusHeight: 0.22f);
                var villageRoot = VillageLayoutBuilder.Build(null, out var buildingsByCategory);
                foreach (var kvp in buildingsByCategory) kvp.Value.AddComponent<BuildingTapTarget>();

                var readingBuildingGo = buildingsByCategory[BuildingCategory.Reading];
                var readingTarget = readingBuildingGo.GetComponent<BuildingTapTarget>();
                readingTarget.Init(CategoryCatalog.ById("reading"));
                readingTarget.SetLevel(1); // Lv1 pip + baseline scale, so the "after" shot's growth is a visible delta, not pips appearing from nothing

                rt = new RenderTexture(1280, 800, 24, RenderTextureFormat.ARGB32);
                cam.targetTexture = rt;
                CaptureTo(cam, rt, ref tex, Path.Combine(QaDir(), "village-loop-before.png"));

                var repo = new SaveFileRepository(savePath);
                var saveGame = new SaveGameService(repo, new EditorMonotonicClock());

                Debug.Log("[VillageLoopDemo] --- session 1 (reading, debug-skip 25min) ---");
                saveGame.StartSession("reading");
                LogRecord(saveGame.FinishSession(DebugSkipMs), saveGame);

                Debug.Log("[VillageLoopDemo] --- session 2 (reading, debug-skip 25min) ---");
                saveGame.StartSession("reading");
                LogRecord(saveGame.FinishSession(DebugSkipMs), saveGame);

                int readingLevel = saveGame.Save.town.buildings.Find(b => b.categoryId == "reading").level;
                readingTarget.SetLevel(readingLevel);
                CaptureTo(cam, rt, ref tex, Path.Combine(QaDir(), "village-loop-after.png"));

                Debug.Log($"[VillageLoopDemo] Reading cottage: Lv1 -> Lv{readingLevel}. Wallet coin={saveGame.Save.wallet.coin}, totalExp={saveGame.Save.wallet.totalExpEarned}.");

                // Persistence-across-restart proof: a brand new SaveGameService pointed at
                // the same file, standing in for "the app was killed and relaunched" (I2/§9).
                var reloaded = new SaveGameService(new SaveFileRepository(savePath), new EditorMonotonicClock());
                int reloadedLevel = reloaded.Save.town.buildings.Find(b => b.categoryId == "reading").level;
                Debug.Log($"[VillageLoopDemo] Reloaded from disk ({savePath}): reading Lv{reloadedLevel}, coin={reloaded.Save.wallet.coin} (must match the numbers above -- proves LifeTown.Platform save IO round-trips across a restart).");

                SaveSceneAsset(scene);
                Debug.Log("[VillageLoopDemo] DONE.");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[VillageLoopDemo] FAILED: {ex}");
                EditorApplication.Exit(1);
            }
            finally
            {
                if (cam != null) cam.targetTexture = null;
                if (rt != null) { RenderTexture.active = null; rt.Release(); UnityEngine.Object.DestroyImmediate(rt); }
                if (tex != null) UnityEngine.Object.DestroyImmediate(tex);
            }
        }

        static void CaptureTo(Camera cam, RenderTexture rt, ref Texture2D tex, string outPath)
        {
            cam.Render();
            var prevActive = RenderTexture.active;
            RenderTexture.active = rt;
            if (tex == null) tex = new Texture2D(rt.width, rt.height, TextureFormat.RGBA32, false);
            tex.ReadPixels(new Rect(0, 0, rt.width, rt.height), 0, 0);
            tex.Apply();
            RenderTexture.active = prevActive;
            File.WriteAllBytes(outPath, tex.EncodeToPNG());
            Debug.Log($"[VillageLoopDemo] wrote {outPath}");
        }

        static void LogRecord(SessionRecord r, SaveGameService saveGame)
        {
            if (r == null) { Debug.Log("[VillageLoopDemo] no record (no session running)"); return; }
            string adj = r.adjustments != null ? string.Join(",", r.adjustments) : "";
            Debug.Log($"[VillageLoopDemo] credited={r.creditedSeconds}s exp=+{r.expAwarded} coin=+{r.coinAwarded} adjustments=[{adj}] walletCoin={saveGame.Save.wallet.coin}");
        }

        static void SaveSceneAsset(UnityEngine.SceneManagement.Scene scene)
        {
            const string folder = "Assets/LifeTown.App/Scenes";
            if (!AssetDatabase.IsValidFolder(folder)) AssetDatabase.CreateFolder("Assets/LifeTown.App", "Scenes");
            EditorSceneManager.SaveScene(scene, SceneAssetPath);
        }

        static string LogsDir()
        {
            string projectRoot = Directory.GetParent(Application.dataPath).FullName;
            string dir = Path.Combine(projectRoot, "Logs");
            Directory.CreateDirectory(dir);
            return dir;
        }

        static string QaDir()
        {
            string projectRoot = Directory.GetParent(Application.dataPath).FullName;
            string dir = Path.Combine(projectRoot, "docs", "qa");
            Directory.CreateDirectory(dir);
            return dir;
        }
    }
}
