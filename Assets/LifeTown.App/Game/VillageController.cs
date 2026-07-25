using System;
using System.Collections.Generic;
using UnityEngine;
using LifeTown.App.BuildingKit;
using LifeTown.Economy.Core;
using LifeTown.Economy.Core.Models;
using LifeTown.Platform.Clocks;
using LifeTown.Platform.Persistence;

namespace LifeTown.App.Game
{
    /// <summary>One category cottage already placed by <see cref="LifeTown.App.Village.VillageLayoutBuilder"/>,
    /// linked to the categoryId it represents. Populated in code (see
    /// <see cref="VillageController.Configure"/>) and serialized into the scene so the
    /// wiring survives a scene save/reload without re-running the village builder.</summary>
    [Serializable]
    public struct CategoryBuildingLink
    {
        public string categoryId;
        public GameObject buildingRoot;
    }

    /// <summary>
    /// The first playable slice of the core loop (00-mvp-spec.md §4 steps ③-⑤, scoped to
    /// this task): tap one of the 7 village cottages → a focus timer runs on the real
    /// <see cref="IMonotonicClock"/> → <see cref="SaveGameService"/> settles it through
    /// <c>LifeTown.Economy.Core.Settlement</c> → EXP/coin land and the tapped building's
    /// level visibly grows.
    ///
    /// UI is deliberately <c>OnGUI</c> (IMGUI), not uGUI/TextMeshPro: this project has no
    /// <c>com.unity.ugui</c>/<c>com.unity.textmesh</c> package installed (see
    /// Packages/manifest.json — only the UI/IMGUI *modules* are present) and no Korean-
    /// capable font asset exists yet, so on-screen labels are English placeholders for
    /// this wiring slice. Swapping to the real S2/S4/S5 art (docs/design mockups) is a
    /// follow-up UI task, not a change to the session/economy wiring this class owns.
    ///
    /// OUT OF SCOPE here (left for the dedicated build/place task): buying or placing new
    /// buildings, timed construction, merges, the presence-ping confirmation overlay (I2
    /// still runs correctly underneath with <c>lastConfirmedAtMs = 0</c> — it simply never
    /// fires for a session under ~70 minutes, exactly as designed).
    /// </summary>
    public sealed class VillageController : MonoBehaviour
    {
        [SerializeField] List<CategoryBuildingLink> buildingLinks = new List<CategoryBuildingLink>();
        [SerializeField] Camera worldCamera;

        enum UiState { Idle, Running, Result }

        // Matches the spec's own canonical example (00-mvp-spec.md §4.1: "25분 = 1,500 EXP + 1,500 코인").
        const long DebugSkipMs = 25 * 60_000L;

        SaveGameService _save;
        IMonotonicClock _clock;
        Dictionary<string, BuildingTapTarget> _targets;
        BuildingTapTarget _activeTarget;
        UiState _uiState = UiState.Idle;
        long _sessionStartElapsedMs;
        SessionRecord _lastRecord;

        /// <summary>Called right after the village is built (editor tooling or a future
        /// runtime bootstrap) to wire each visual cottage to its category before the scene
        /// is saved/played.</summary>
        public void Configure(IEnumerable<CategoryBuildingLink> links, Camera camera)
        {
            buildingLinks = new List<CategoryBuildingLink>(links);
            worldCamera = camera;
        }

        void Start()
        {
            if (worldCamera == null) worldCamera = Camera.main;

            _clock = Application.platform == RuntimePlatform.Android
                ? (IMonotonicClock)new AndroidMonotonicClock()
                : new EditorMonotonicClock();
            var repo = new SaveFileRepository(SavePaths.DefaultSaveFilePath);
            _save = new SaveGameService(repo, _clock);

            _targets = new Dictionary<string, BuildingTapTarget>();
            foreach (var link in buildingLinks)
            {
                if (link.buildingRoot == null) continue;
                var def = CategoryCatalog.ById(link.categoryId);
                if (def == null) continue;

                var target = link.buildingRoot.GetComponent<BuildingTapTarget>();
                if (target == null) target = link.buildingRoot.AddComponent<BuildingTapTarget>();
                EnsureCollider(link.buildingRoot); // must run before Init/SetLevel ever scales the root
                target.Init(def);
                _targets[def.id] = target;
            }
            RefreshAllLevels();
        }

        void RefreshAllLevels()
        {
            foreach (var building in _save.Save.town.buildings)
                if (_targets.TryGetValue(building.categoryId, out var target))
                    target.SetLevel(building.level);
        }

        void Update()
        {
            if (_uiState != UiState.Idle || worldCamera == null) return;

            Vector3? screenPos = null;
            if (Input.GetMouseButtonDown(0)) screenPos = Input.mousePosition;
            else if (Input.touchCount > 0 && Input.GetTouch(0).phase == TouchPhase.Began) screenPos = Input.GetTouch(0).position;
            if (screenPos == null) return;

            var ray = worldCamera.ScreenPointToRay(screenPos.Value);
            if (Physics.Raycast(ray, out var hit, 100f))
            {
                var target = hit.collider.GetComponentInParent<BuildingTapTarget>();
                if (target != null) StartSessionFor(target);
            }
        }

        void StartSessionFor(BuildingTapTarget target)
        {
            _save.StartSession(target.CategoryId);
            _sessionStartElapsedMs = _clock.ElapsedMs;
            _activeTarget = target;
            _uiState = UiState.Running;
        }

        void FinishActive(long debugOffsetMs)
        {
            _lastRecord = _save.FinishSession(debugOffsetMs);
            if (_activeTarget != null && _lastRecord != null)
            {
                var building = _save.Save.town.buildings.Find(b => b.buildingId == _activeTarget.BuildingId);
                if (building != null) _activeTarget.SetLevel(building.level);
            }
            _uiState = UiState.Result;
        }

        static void EnsureCollider(GameObject root)
        {
            if (root.GetComponent<Collider>() != null) return;
            var renderers = root.GetComponentsInChildren<Renderer>();
            if (renderers.Length == 0) return;

            var bounds = renderers[0].bounds;
            for (int i = 1; i < renderers.Length; i++) bounds.Encapsulate(renderers[i].bounds);

            var col = root.AddComponent<BoxCollider>();
            col.center = root.transform.InverseTransformPoint(bounds.center);
            col.size = bounds.size; // root has no rotation and scale=1 at this point (see call-site ordering)
        }

        // ---- OnGUI placeholder view — see class doc for why IMGUI, not uGUI ----

        void OnGUI()
        {
            DrawLevelLabels();
            if (_uiState == UiState.Running) DrawRunningPanel();
            else if (_uiState == UiState.Result) DrawResultPanel();
        }

        void DrawLevelLabels()
        {
            if (_targets == null || worldCamera == null) return;
            foreach (var target in _targets.Values)
            {
                var screen = worldCamera.WorldToScreenPoint(target.transform.position + Vector3.up * 0.9f);
                if (screen.z < 0) continue;
                var rect = new Rect(screen.x - 30f, Screen.height - screen.y - 10f, 60f, 20f);
                GUI.Label(rect, $"Lv.{target.CurrentLevel}");
            }
        }

        void DrawRunningPanel()
        {
            long elapsedMs = Math.Max(0, _clock.ElapsedMs - _sessionStartElapsedMs);
            int elapsedSeconds = (int)(elapsedMs / 1000);
            var ts = TimeSpan.FromSeconds(elapsedSeconds);

            var rect = new Rect(20, 20, 300, 150);
            GUI.Box(rect, string.Empty);
            GUILayout.BeginArea(rect);
            GUILayout.Space(6);
            GUILayout.Label($"{_activeTarget.DisplayName} session");
            GUILayout.Label($"Elapsed: {ts:mm\\:ss}");
            GUILayout.Label($"(preview) +{elapsedSeconds} EXP / +{elapsedSeconds} coin");
            if (GUILayout.Button("Finish")) FinishActive(0);
            if (GUILayout.Button($"Debug skip ({DebugSkipMs / 60_000}min)")) FinishActive(DebugSkipMs);
            GUILayout.EndArea();
        }

        void DrawResultPanel()
        {
            var rect = new Rect(20, 20, 320, 220);
            GUI.Box(rect, string.Empty);
            GUILayout.BeginArea(rect);
            GUILayout.Space(6);
            GUILayout.Label("Session result");
            if (_lastRecord == null)
            {
                GUILayout.Label("No session was running.");
            }
            else
            {
                GUILayout.Label($"{_lastRecord.creditedSeconds}s credited (of {_lastRecord.rawSeconds}s)");
                GUILayout.Label($"+{_lastRecord.expAwarded} EXP  +{_lastRecord.coinAwarded} coin");
                if (_lastRecord.adjustments != null)
                    foreach (var a in _lastRecord.adjustments) GUILayout.Label("- " + a);
                GUILayout.Label($"Wallet: {_save.Save.wallet.coin} coin");
            }
            if (GUILayout.Button("OK"))
            {
                _uiState = UiState.Idle;
                _activeTarget = null;
                _lastRecord = null;
            }
            GUILayout.EndArea();
        }
    }
}
