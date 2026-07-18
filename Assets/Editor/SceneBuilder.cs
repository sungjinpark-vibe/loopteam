using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.SceneManagement;
using UnityEngine.UI;
using TouchRPG.Combat.Config;
using TouchRPG.Combat.Core;
using TouchRPG.Combat.Input;
using TouchRPG.Combat.Pattern;

namespace TouchRPG.EditorTools
{
    /// <summary>
    /// Procedurally builds the P0 combat scene and its data assets. Editor-only tool
    /// (GDD §0 grants asset pipeline/tooling to team discretion). Idempotent: re-running
    /// regenerates the scene from scratch and reuses existing data assets if present, so
    /// there is a single reproducible source for the whole scene instead of a hand-built
    /// .unity file nobody can diff sensibly.
    ///
    /// Run via Unity menu "TouchRPG/Build Combat Scene (P0)" or in batchmode with
    /// -executeMethod TouchRPG.EditorTools.SceneBuilder.BuildCombatScene
    /// </summary>
    public static class SceneBuilder
    {
        private const string ScenePath = "Assets/Scenes/CombatScene.unity";
        private const string ConfigDir = "Assets/Data/Config";
        private const string PatternDir = "Assets/Data/Patterns";

        // Portrait reference resolution (GDD §1: 세로 화면 고정).
        private static readonly Vector2 ReferenceResolution = new Vector2(1080, 1920);

        // Green, deliberately NOT the blue reserved for the GDD §4.5 dodge-zone channel -
        // used for the player's own token/portrait, which is decorative identity, not a
        // gameplay-meaning marker.
        private static readonly Color PlayerAvatarColor = new Color(0.30f, 0.68f, 0.42f);

        [MenuItem("TouchRPG/Build Combat Scene (P0)")]
        public static void BuildCombatScene()
        {
            // Data assets are ensured to exist BEFORE the scene switch (so first-time
            // creation writes real files to disk), but the object references used for
            // wiring are (re)loaded AFTER EditorSceneManager.NewScene below. A freshly
            // created ScriptableObject instance held only by a transient editor-script
            // local variable is NOT considered "in use" by anything once the scene it
            // was created alongside gets torn down by NewScene - Unity can unload it,
            // leaving a Unity "fake-null" object that still passes ordinary C# null
            // checks in this same method but serializes as {fileID: 0} everywhere it
            // was wired. Re-loading by path after the switch sidesteps that entirely.
            GetOrCreateConfig();
            GetOrCreateDemoNumbers();
            GetOrCreatePatternSheet();

            ConfigurePortraitPlayerSettings();

            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            var config = AssetDatabase.LoadAssetAtPath<GameplayConfig>(ConfigDir + "/GameplayConfig.asset");
            var demoNumbers = AssetDatabase.LoadAssetAtPath<P0DemoNumbers>(ConfigDir + "/P0DemoNumbers.asset");
            var patternSheet = AssetDatabase.LoadAssetAtPath<MonsterPatternSheet>(PatternDir + "/Lampang_PatternSheet.asset");

            BuildCamera();
            var eventSystem = BuildEventSystem();
            var canvasRoot = BuildCanvas();
            var inputController = BuildInputController();

            var infoLayer = BuildLayerPanel("InfoLayer", canvasRoot, 0.90f, 1.00f, new Color(0.08f, 0.08f, 0.10f, 0.85f));
            // Neutral gray, deliberately NOT blue - blue is the reserved GDD §4.5 dodge-zone
            // channel and this is only a structural layer background, not a gameplay signal.
            var monsterLayer = BuildLayerPanel("MonsterLayer", canvasRoot, 0.40f, 0.90f, new Color(0.5f, 0.5f, 0.5f, 0.25f));
            var battlefieldLayer = BuildLayerPanel("BattlefieldLayer", canvasRoot, 0.15f, 0.40f, new Color(0.30f, 0.55f, 0.30f, 0.35f));
            var partyLayer = BuildLayerPanel("PartyLayer", canvasRoot, 0.00f, 0.15f, new Color(0.10f, 0.10f, 0.15f, 0.85f));

            var templatesRoot = BuildTemplatesRoot(canvasRoot);
            var parryMarkerTemplate = BuildParryMarkerTemplate(templatesRoot);
            var dodgeZoneTemplate = BuildDodgeZoneTemplate(templatesRoot);
            var rushZoneTemplate = BuildRushZoneTemplate(templatesRoot);

            // ── Info layer: monster name + HP bar with phase ticks (GDD §5.1/§6.1) ──
            var monsterNameText = BuildText("MonsterNameText", infoLayer, "람팡", 42, Color.white,
                new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(20f, -14f), new Vector2(400f, 50f), TextAnchor.UpperLeft);

            var hpBarBg = BuildImage("HealthBarBackground", infoLayer, PlaceholderSprites.RoundedRect,
                new Color(0.15f, 0.15f, 0.15f, 1f), new Vector2(0.5f, 0f), new Vector2(0.5f, 0f),
                new Vector2(0f, 46f), new Vector2(1000f, 40f), false);
            // Orange, deliberately NOT the saturated red used for the GDD §4.5 relay channel -
            // this is HP-bar chrome, not a relay signal, and must not visually rhyme with one.
            var hpBarFill = BuildImage("HealthBarFill", hpBarBg.transform, PlaceholderSprites.RoundedRect,
                new Color(0.85f, 0.45f, 0.15f, 1f), Vector2.zero, Vector2.zero, Vector2.zero, Vector2.zero, false);
            StretchFull(hpBarFill.rectTransform);
            hpBarFill.type = Image.Type.Filled;
            hpBarFill.fillMethod = Image.FillMethod.Horizontal;
            hpBarFill.fillAmount = 1f;

            var tickHigh = BuildImage("TickHigh70", hpBarBg.transform, PlaceholderSprites.RoundedRect,
                new Color(1f, 1f, 1f, 0.9f), Vector2.zero, Vector2.zero, Vector2.zero, new Vector2(3f, 40f), false);
            var tickLow = BuildImage("TickLow35", hpBarBg.transform, PlaceholderSprites.RoundedRect,
                new Color(1f, 1f, 1f, 0.9f), Vector2.zero, Vector2.zero, Vector2.zero, new Vector2(3f, 40f), false);

            var comboText = BuildText("ComboText", infoLayer, string.Empty, 30, GameplayColors.Gold,
                new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(-20f, -14f), new Vector2(260f, 40f), TextAnchor.UpperRight);

            // ── Monster layer: chunky squirrel silhouette with visible cheek pouches ──
            var monsterRoot = new GameObject("MonsterRoot", typeof(RectTransform)).GetComponent<RectTransform>();
            monsterRoot.SetParent(monsterLayer, false);
            monsterRoot.anchorMin = new Vector2(0.5f, 0.5f);
            monsterRoot.anchorMax = new Vector2(0.5f, 0.5f);
            monsterRoot.anchoredPosition = Vector2.zero;

            var furColor = new Color(0.62f, 0.42f, 0.24f); // decorative, non-gameplay colour - unrestricted
            var furColorDark = new Color(0.48f, 0.32f, 0.18f);

            // IN-5 (GDD §4.1): the Body part specifically doubles as the charge-attack
            // target ("길게 누르고 떼기... 대상: 몬스터 몸체"), so it carries
            // ChargeAttackController (a MonsterPart subclass) instead of a plain MonsterPart -
            // a quick tap still falls back to an ordinary IN-1 basic attack (see
            // ChargeAttackController.OnHoldReleased).
            var bodyImg = BuildImage("Body", monsterRoot, PlaceholderSprites.RoundedRect, furColor,
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0f, -40f), new Vector2(420f, 380f), true);
            var body = bodyImg.gameObject.AddComponent<ChargeAttackController>();
            SetPrivateField(body, "partId", "body");
            var chargeGaugeImg = BuildImage("ChargeGauge", bodyImg.transform, PlaceholderSprites.Ring, GameplayColors.Gold,
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(460f, 420f), false);
            chargeGaugeImg.type = Image.Type.Filled;
            chargeGaugeImg.fillMethod = Image.FillMethod.Radial360;
            chargeGaugeImg.enabled = false;
            SetPrivateField(body, "chargeGaugeImage", chargeGaugeImg);

            // Belly (GDD §7.2 P7 anchor "배 연타" - the C-4 groggy rush target, IN-6).
            var bellyImg = BuildImage("Belly", monsterRoot, PlaceholderSprites.Circle, new Color(0.86f, 0.66f, 0.42f),
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0f, -110f), new Vector2(170f, 170f), true);
            var belly = bellyImg.gameObject.AddComponent<MonsterPart>();
            SetPrivateField(belly, "partId", "belly");

            var tailImg = BuildImage("Tail", monsterRoot, PlaceholderSprites.Circle, furColorDark,
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-260f, -60f), new Vector2(260f, 260f), true);
            var tail = tailImg.gameObject.AddComponent<MonsterPart>();
            SetPrivateField(tail, "partId", "tail");

            var earL = BuildImage("EarL", monsterRoot, PlaceholderSprites.Circle, furColorDark,
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-90f, 190f), new Vector2(90f, 90f), false);
            var earR = BuildImage("EarR", monsterRoot, PlaceholderSprites.Circle, furColorDark,
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(90f, 190f), new Vector2(90f, 90f), false);

            var headImg = BuildImage("Head", monsterRoot, PlaceholderSprites.Circle, furColor,
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0f, 140f), new Vector2(260f, 260f), true);
            var head = headImg.gameObject.AddComponent<MonsterPart>();
            SetPrivateField(head, "partId", "head");

            // Cheek pouches: right one is the canonical GDD §7.2 P1 anchor ("cheek_pouch");
            // left is a decorative twin that is also independently tappable for texture.
            var cheekPouchLeftImg = BuildImage("CheekPouchLeft", monsterRoot, PlaceholderSprites.Circle, new Color(0.78f, 0.58f, 0.36f),
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-95f, 110f), new Vector2(110f, 110f), true);
            var cheekPouchLeft = cheekPouchLeftImg.gameObject.AddComponent<MonsterPart>();
            SetPrivateField(cheekPouchLeft, "partId", "cheek_pouch_left");

            var cheekPouchRightImg = BuildImage("CheekPouchRight", monsterRoot, PlaceholderSprites.Circle, new Color(0.78f, 0.58f, 0.36f),
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(95f, 110f), new Vector2(110f, 110f), true);
            var cheekPouchRight = cheekPouchRightImg.gameObject.AddComponent<MonsterPart>();
            SetPrivateField(cheekPouchRight, "partId", "cheek_pouch");

            // GDD §7.2 P4 MUST: real/fake tell lives ONLY in monster animation - see
            // LampangCheekTellAnimator's own remark.
            var cheekTellAnimatorGo = new GameObject("LampangCheekTellAnimator");
            cheekTellAnimatorGo.transform.SetParent(monsterLayer, false);
            var cheekTellAnimator = cheekTellAnimatorGo.AddComponent<LampangCheekTellAnimator>();
            SetPrivateField(cheekTellAnimator, "cheekLeft", cheekPouchLeftImg.rectTransform);
            SetPrivateField(cheekTellAnimator, "cheekRight", cheekPouchRightImg.rectTransform);

            var markerLayer = new GameObject("MarkerLayer", typeof(RectTransform)).GetComponent<RectTransform>();
            markerLayer.SetParent(monsterLayer, false);
            StretchFull(markerLayer);
            var markerLayerImage = markerLayer.gameObject.AddComponent<Image>();
            markerLayerImage.color = Color.clear;
            markerLayerImage.raycastTarget = false;

            var partRegistryGo = new GameObject("MonsterPartRegistry");
            partRegistryGo.transform.SetParent(monsterLayer, false);
            var partRegistry = partRegistryGo.AddComponent<MonsterPartRegistry>();
            SetPrivateArrayField(partRegistry, "parts", new Object[] { body, belly, head, tail, cheekPouchLeft, cheekPouchRight });

            // ── Battlefield layer: ground + player token ──
            var groundImg = BuildImage("Ground", battlefieldLayer, PlaceholderSprites.RoundedRect,
                new Color(0.20f, 0.32f, 0.18f, 1f), Vector2.zero, Vector2.zero, Vector2.zero, Vector2.zero, true);
            StretchFull(groundImg.rectTransform);
            var groundZone = groundImg.gameObject.AddComponent<GroundTapZone>();

            var playerImg = BuildImage("PlayerToken", battlefieldLayer, PlaceholderSprites.Circle,
                PlayerAvatarColor, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),
                Vector2.zero, new Vector2(90f, 90f), false);
            var playerToken = playerImg.gameObject.AddComponent<PlayerToken>();
            SetPrivateField(playerToken, "battlefieldPanel", battlefieldLayer);
            SetPrivateField(playerToken, "self", playerImg.rectTransform);
            SetPrivateField(groundZone, "playerToken", playerToken);

            // ── Party layer: solo portrait slot (party stub) ──
            var partySlotImg = BuildImage("PartySlot_Solo", partyLayer, PlaceholderSprites.Circle,
                PlayerAvatarColor, new Vector2(0.12f, 0.5f), new Vector2(0.12f, 0.5f),
                Vector2.zero, new Vector2(110f, 110f), true);
            partySlotImg.gameObject.AddComponent<PartyPortraitSlot>();
            BuildText("SoloLabel", partySlotImg.transform, "YOU", 20, Color.white,
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(100f, 30f), TextAnchor.MiddleCenter);

            // ── Combat systems (non-visual) ──
            var systemsRoot = new GameObject("CombatSystems");

            var monsterHealthGo = new GameObject("MonsterHealth");
            monsterHealthGo.transform.SetParent(systemsRoot.transform, false);
            var monsterHealth = monsterHealthGo.AddComponent<HealthController>();
            SetPrivateField(monsterHealth, "maxHP", demoNumbers.monsterMaxHP);

            var playerHealthGo = new GameObject("PlayerHealth");
            playerHealthGo.transform.SetParent(systemsRoot.transform, false);
            var playerHealth = playerHealthGo.AddComponent<HealthController>();
            SetPrivateField(playerHealth, "maxHP", demoNumbers.playerMaxHP);

            var monsterControllerGo = new GameObject("MonsterController");
            monsterControllerGo.transform.SetParent(systemsRoot.transform, false);
            var monsterController = monsterControllerGo.AddComponent<MonsterController>();
            SetPrivateField(monsterController, "health", monsterHealth);
            SetPrivateField(monsterController, "partRegistry", partRegistry);
            SetPrivateField(monsterController, "demoNumbers", demoNumbers);

            var comboGo = new GameObject("ComboController");
            comboGo.transform.SetParent(systemsRoot.transform, false);
            var combo = comboGo.AddComponent<ComboController>();
            SetPrivateField(combo, "config", config);

            var patternPlayerGo = new GameObject("MonsterPatternPlayer");
            patternPlayerGo.transform.SetParent(systemsRoot.transform, false);
            var patternPlayer = patternPlayerGo.AddComponent<MonsterPatternPlayer>();
            SetPrivateField(patternPlayer, "patternSheet", patternSheet);
            SetPrivateField(patternPlayer, "gameplayConfig", config);
            SetPrivateField(patternPlayer, "demoNumbers", demoNumbers);
            SetPrivateField(patternPlayer, "partRegistry", partRegistry);
            SetPrivateField(patternPlayer, "combo", combo);
            SetPrivateField(patternPlayer, "playerHealth", playerHealth);
            SetPrivateField(patternPlayer, "monsterHealth", monsterHealth);
            SetPrivateField(patternPlayer, "markerLayer", markerLayer);
            SetPrivateField(patternPlayer, "parryMarkerTemplate", parryMarkerTemplate);
            SetPrivateField(patternPlayer, "dodgeZoneTemplate", dodgeZoneTemplate);
            SetPrivateField(patternPlayer, "rushZoneTemplate", rushZoneTemplate);
            SetPrivateField(patternPlayer, "battlefieldPanel", battlefieldLayer);
            SetPrivateField(patternPlayer, "playerToken", playerToken);
            SetPrivateField(patternPlayer, "cheekTellAnimator", cheekTellAnimator);

            BuildDemoControlPanel(canvasRoot, patternPlayer);

            // ── UI bindings ──
            var healthBarUiGo = hpBarBg.gameObject;
            var healthBarUi = healthBarUiGo.AddComponent<HealthBarUI>();
            SetPrivateField(healthBarUi, "target", monsterHealth);
            SetPrivateField(healthBarUi, "fillImage", hpBarFill);
            SetPrivateField(healthBarUi, "tickHighMark", tickHigh.rectTransform);
            SetPrivateField(healthBarUi, "tickLowMark", tickLow.rectTransform);
            SetPrivateField(healthBarUi, "config", config);
            SetPrivateField(healthBarUi, "monsterNameText", monsterNameText);
            SetPrivateField(healthBarUi, "monsterDisplayName", "람팡");

            var comboUi = comboText.gameObject.AddComponent<ComboUI>();
            SetPrivateField(comboUi, "combo", combo);
            SetPrivateField(comboUi, "comboText", comboText);

            SetPrivateField(inputController, "eventSystem", eventSystem);

            Directory.CreateDirectory("Assets/Scenes");
            EditorSceneManager.SaveScene(scene, ScenePath);
            AddSceneToBuildSettings(ScenePath);
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();

            Debug.Log("[SceneBuilder] Combat scene built at " + ScenePath);
        }

        // ── Data assets ──────────────────────────────────────────────────────────

        private static GameplayConfig GetOrCreateConfig()
        {
            Directory.CreateDirectory(ConfigDir);
            string path = ConfigDir + "/GameplayConfig.asset";
            var existing = AssetDatabase.LoadAssetAtPath<GameplayConfig>(path);
            if (existing != null)
            {
                return existing;
            }
            var config = ScriptableObject.CreateInstance<GameplayConfig>();
            AssetDatabase.CreateAsset(config, path);
            // MUST flush immediately: a freshly-CreateAsset'd object does not get a
            // stable cross-file fileID until it is actually written to disk. Wiring a
            // reference to it into a scene object BEFORE this point silently serializes
            // as {fileID: 0} (null) when the scene is later saved - found via the
            // PlayMode smoke test (ParryMarker never spawned because patternSheet/
            // gameplayConfig/demoNumbers all came back null on every consumer).
            AssetDatabase.SaveAssets();
            AssetDatabase.ImportAsset(path);
            return config;
        }

        private static P0DemoNumbers GetOrCreateDemoNumbers()
        {
            Directory.CreateDirectory(ConfigDir);
            string path = ConfigDir + "/P0DemoNumbers.asset";
            var existing = AssetDatabase.LoadAssetAtPath<P0DemoNumbers>(path);
            if (existing != null)
            {
                return existing;
            }
            var numbers = ScriptableObject.CreateInstance<P0DemoNumbers>();
            AssetDatabase.CreateAsset(numbers, path);
            AssetDatabase.SaveAssets();
            AssetDatabase.ImportAsset(path);
            return numbers;
        }

        private static MonsterPatternSheet GetOrCreatePatternSheet()
        {
            Directory.CreateDirectory(PatternDir);
            string p1Path = PatternDir + "/Lampang_P1_AcornThrow.asset";
            var p1 = AssetDatabase.LoadAssetAtPath<MonsterPatternStep>(p1Path);
            if (p1 == null)
            {
                p1 = ScriptableObject.CreateInstance<MonsterPatternStep>();
                p1.patternId = "P1";
                p1.displayName = "도토리 투척";
                p1.classification = PatternClass.C1_Basic;
                p1.anchorPartId = "cheek_pouch";
                // Beat 1's offset (1.0s) equals its own telegraph lead (1.0s), so the
                // outer ring's full contraction is visible from the very start of the
                // step - an offset shorter than the lead would spawn the ring already
                // partway contracted. Beat 2's spawn time (2.4 - 1.0 = 1.4s) is scheduled
                // after beat 1's good window closes at the latest (target 1.0s + good
                // window 0.35s = 1.35s), so the two beats' telegraphs never visually
                // overlap even though they are scheduled independently (see
                // MonsterPatternPlayer.RunBeat) and do not wait on each other's outcome.
                p1.parryBeats = new[]
                {
                    new ParryBeat { beatOffsetSeconds = 1.0f, telegraphLeadSeconds = 1.0f },
                    new ParryBeat { beatOffsetSeconds = 2.4f, telegraphLeadSeconds = 1.0f }
                };
                p1.minPhase = 1;
                p1.failureSeverity = FailureSeverity.Small;
                p1.rhythmNote = "정박 2연 (학습용) - GDD §7.2 Lampang P1";
                AssetDatabase.CreateAsset(p1, p1Path);
                AssetDatabase.SaveAssets();
                AssetDatabase.ImportAsset(p1Path);
            }

            // P7 must exist BEFORE P5 is created, since P5.triggeredOnSuccess references
            // it directly (GDD §7.2 P7 row: "예고: P5 성공 시").
            var p7 = GetOrCreateStep("Lampang_P7_BellyFlipGroggy", "P7", step =>
            {
                step.displayName = "뒤집힘 그로기";
                step.classification = PatternClass.C4_Groggy;
                step.anchorPartId = "belly";
                step.parryBeats = System.Array.Empty<ParryBeat>();
                step.minPhase = 2;
                step.failureSeverity = FailureSeverity.None;
                step.rushRequiredTaps = 8;
                step.rhythmNote = "GDD §7.2 P7 - P5 성공 시에만 발동. 배 연타 6s(GameplayConfig." +
                    "groggyRushDurationSeconds). IN-6과 함께 이 게임 전체에서 유일하게 연타가 " +
                    "보상되는 두 구간 중 하나 - 정상 플레이(오토사이클)에서는 절대 단독 발동하지 " +
                    "않고, MonsterPatternPlayer.TriggerPatternById(dev/QA)만 예외로 우회한다.";
            });

            var p2 = GetOrCreateStep("Lampang_P2_TailSwipe", "P2", step =>
            {
                step.displayName = "꼬리치기";
                step.classification = PatternClass.C1_Basic;
                step.anchorPartId = "tail";
                // "반박자 지연(엇박)" (GDD §7.2 리듬 특성) is expressed purely as an OFFSET
                // choice, not a different judgment window - the beat still resolves against
                // the shared ±0.15/±0.35 windows from GameplayConfig, same as every other
                // C1 pattern.
                step.parryBeats = new[] { new ParryBeat { beatOffsetSeconds = 1.75f, telegraphLeadSeconds = 1.0f } };
                step.minPhase = 2;
                step.failureSeverity = FailureSeverity.Medium;
                step.rhythmNote = "GDD §7.2 P2 - 예고 후 반박자 지연(엇박). 판정 윈도우는 ±0.35s로 " +
                    "P1과 동일 - 난이도는 이 beatOffsetSeconds의 지연폭에서 나온다(새 판정 윈도우 아님).";
            });

            var p3 = GetOrCreateStep("Lampang_P3_RollingCharge", "P3", step =>
            {
                step.displayName = "구르기 돌진";
                step.classification = PatternClass.C2_HeavyAttack;
                step.anchorPartId = string.Empty; // ground-anchored (GDD §6.1 전장층), not a monster part
                step.parryBeats = System.Array.Empty<ParryBeat>();
                step.dodgeZoneCount = 1;
                step.minPhase = 1;
                step.failureSeverity = FailureSeverity.Medium;
                step.rhythmNote = "GDD §7.2 P3 - 존 위치 좌우 랜덤. 윈도우 1.2s는 " +
                    "GameplayConfig.dodgeZoneP3WindowSeconds에서 읽는다(중복 저장하지 않음).";
            });

            var p4 = GetOrCreateStep("Lampang_P4_CheekFake", "P4", step =>
            {
                step.displayName = "볼주머니 페이크";
                step.classification = PatternClass.C1_Basic;
                step.isFakeVariant = true;
                step.anchorPartId = "cheek_pouch";
                step.parryBeats = new[] { new ParryBeat { beatOffsetSeconds = 1.2f, telegraphLeadSeconds = 1.2f } };
                step.minPhase = 3;
                // Honest missed-REAL-beat tier (matches sibling C1 patterns). The fake's
                // "조기 탭 시 카운터 피격" is hardcoded in MonsterPatternPlayer.ExecuteC1FakeVariant
                // independently of this field - it never reads step.failureSeverity.
                step.failureSeverity = FailureSeverity.Small;
                step.rhythmNote = "GDD §7.2 P4 - 참는 판단 요구. 실제/가짜는 몬스터 애니메이션" +
                    "(볼 좌우대칭)에서만 구분되며 마커 자체는 완전히 동일하다(MUST).";
            });

            var p6 = GetOrCreateStep("Lampang_P6_AcornRain", "P6", step =>
            {
                step.displayName = "도토리 비";
                step.classification = PatternClass.C5_CastAoE;
                step.anchorPartId = string.Empty;
                step.parryBeats = System.Array.Empty<ParryBeat>();
                step.dodgeZoneCount = 3;
                step.minPhase = 3;
                step.failureSeverity = FailureSeverity.Small;
                step.rhythmNote = "GDD §7.2 P6 - 다중 낙하점, 회피 실패마다 개별 소피해(다단). " +
                    "윈도우 2.0s는 GameplayConfig.castP6WindowSeconds에서 읽는다.";
            });

            var p5 = GetOrCreateStep("Lampang_P5_TailSpin", "P5", step =>
            {
                step.displayName = "대회전 꼬리";
                step.classification = PatternClass.C3_Relay;
                step.anchorPartId = "tail";
                // GDD §5.2: solo substitute = 2~3 tap consecutive sequence. Reuses 3 here.
                step.parryBeats = new[]
                {
                    new ParryBeat { beatOffsetSeconds = 1.0f, telegraphLeadSeconds = 0.8f },
                    new ParryBeat { beatOffsetSeconds = 2.2f, telegraphLeadSeconds = 0.8f },
                    new ParryBeat { beatOffsetSeconds = 3.4f, telegraphLeadSeconds = 0.8f }
                };
                step.minPhase = 2;
                step.failureSeverity = FailureSeverity.Small;
                step.triggeredOnSuccess = p7;
                step.rhythmNote = "GDD §7.2 P5 - 솔로 대체: 연속 3탭 시퀀스(§5.2, 실제 파티/네트워킹 " +
                    "아님). 윈도우는 relay.solo.window(±0.35s, GDD §4.3 '파티가 더 쉬워야 한다') - " +
                    "성공 시 P7(뒤집힘 그로기) 발동.";
            });

            string sheetPath = PatternDir + "/Lampang_PatternSheet.asset";
            var sheet = AssetDatabase.LoadAssetAtPath<MonsterPatternSheet>(sheetPath);
            var allSteps = new[] { p1, p2, p3, p4, p5, p6, p7 };
            if (sheet == null)
            {
                sheet = ScriptableObject.CreateInstance<MonsterPatternSheet>();
                sheet.monsterId = "lampang";
                sheet.displayName = "람팡";
                sheet.steps = allSteps;
                AssetDatabase.CreateAsset(sheet, sheetPath);
                AssetDatabase.SaveAssets();
                AssetDatabase.ImportAsset(sheetPath);
            }
            else if (sheet.steps == null || sheet.steps.Length != allSteps.Length)
            {
                // Upgrade path: a sheet asset checked in before this task (T001) only
                // listed P1 - extend it to the full GDD §7.2 table (P1-P7) rather than
                // leaving it stale.
                sheet.steps = allSteps;
                EditorUtility.SetDirty(sheet);
                AssetDatabase.SaveAssets();
            }
            return sheet;
        }

        /// <summary>Idempotent load-or-create for one MonsterPatternStep asset. Mirrors
        /// P1's own hand-written load-or-create block above (kept as-is for minimal diff
        /// to already-reviewed T001 code); every P2-P7 asset goes through this instead so
        /// adding an 8th pattern later needs zero new boilerplate, only a new configure
        /// callback.</summary>
        private static MonsterPatternStep GetOrCreateStep(string fileName, string patternId, System.Action<MonsterPatternStep> configure)
        {
            string path = PatternDir + "/" + fileName + ".asset";
            var existing = AssetDatabase.LoadAssetAtPath<MonsterPatternStep>(path);
            if (existing != null)
            {
                return existing;
            }
            var step = ScriptableObject.CreateInstance<MonsterPatternStep>();
            step.patternId = patternId;
            configure(step);
            AssetDatabase.CreateAsset(step, path);
            AssetDatabase.SaveAssets();
            AssetDatabase.ImportAsset(path);
            return step;
        }

        // ── Player settings (portrait-fixed, GDD §1/§11) ────────────────────────

        private static void ConfigurePortraitPlayerSettings()
        {
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.Portrait;
            PlayerSettings.allowedAutorotateToPortrait = true;
            PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;
            PlayerSettings.allowedAutorotateToLandscapeLeft = false;
            PlayerSettings.allowedAutorotateToLandscapeRight = false;
        }

        // ── Scene scaffolding helpers ───────────────────────────────────────────

        private static void BuildCamera()
        {
            var camGo = new GameObject("Main Camera", typeof(Camera));
            var cam = camGo.GetComponent<Camera>();
            cam.orthographic = true;
            cam.backgroundColor = new Color(0.05f, 0.05f, 0.07f);
            cam.clearFlags = CameraClearFlags.SolidColor;
            camGo.tag = "MainCamera";
        }

        private static EventSystem BuildEventSystem()
        {
            var go = new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));
            return go.GetComponent<EventSystem>();
        }

        private static RectTransform BuildCanvas()
        {
            var canvasGo = new GameObject("Canvas", typeof(RectTransform), typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            var canvas = canvasGo.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;

            var scaler = canvasGo.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = ReferenceResolution;
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            scaler.matchWidthOrHeight = 0.5f;

            return canvasGo.GetComponent<RectTransform>();
        }

        private static CombatInputController BuildInputController()
        {
            var go = new GameObject("CombatInputController");
            return go.AddComponent<CombatInputController>();
        }

        /// <summary>anchorMin/MaxY are bottom-based fractions of the screen height.</summary>
        private static RectTransform BuildLayerPanel(string name, RectTransform parent, float anchorMinY, float anchorMaxY, Color debugTint)
        {
            var go = new GameObject(name, typeof(RectTransform));
            var rect = go.GetComponent<RectTransform>();
            rect.SetParent(parent, false);
            rect.anchorMin = new Vector2(0f, anchorMinY);
            rect.anchorMax = new Vector2(1f, anchorMaxY);
            rect.offsetMin = Vector2.zero;
            rect.offsetMax = Vector2.zero;

            var image = go.AddComponent<Image>();
            image.sprite = null;
            image.color = debugTint;
            image.raycastTarget = false;
            return rect;
        }

        private static RectTransform BuildTemplatesRoot(RectTransform canvasRoot)
        {
            var go = new GameObject("Templates (disabled)", typeof(RectTransform));
            var rect = go.GetComponent<RectTransform>();
            rect.SetParent(canvasRoot, false);
            go.SetActive(false);
            return rect;
        }

        private static ParryMarker BuildParryMarkerTemplate(RectTransform templatesRoot)
        {
            var root = new GameObject("ParryMarkerTemplate", typeof(RectTransform));
            var rootRect = root.GetComponent<RectTransform>();
            rootRect.SetParent(templatesRoot, false);
            rootRect.sizeDelta = new Vector2(150f, 150f);

            var outer = BuildImage("OuterRing", rootRect, PlaceholderSprites.Ring, GameplayColors.Parry,
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(150f, 150f), false);
            var inner = BuildImage("InnerRing", rootRect, PlaceholderSprites.Ring, GameplayColors.Parry,
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(150f, 150f), false);
            var tapArea = BuildImage("TapArea", rootRect, PlaceholderSprites.Circle, new Color(1f, 1f, 1f, 0f),
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(220f, 220f), true);

            var marker = root.AddComponent<ParryMarker>();
            SetPrivateField(marker, "outerRing", outer.rectTransform);
            SetPrivateField(marker, "innerRing", inner.rectTransform);
            SetPrivateField(marker, "outerRingImage", outer);
            SetPrivateField(marker, "innerRingImage", inner);
            SetPrivateField(marker, "tapArea", tapArea);
            return marker;
        }

        /// <summary>IN-3 (GDD §4.1/§6.2) template. Root anchors are (0.5,0.5)/(0.5,0.5) -
        /// unlike ParryMarker (positioned via world-space transform.position), DodgeZone is
        /// positioned via anchoredPosition relative to the battlefield panel so it can be
        /// compared directly against PlayerToken.LocalPosition, which uses the same
        /// center-anchored convention.</summary>
        private static DodgeZone BuildDodgeZoneTemplate(RectTransform templatesRoot)
        {
            var zoneImg = BuildImage("DodgeZoneTemplate", templatesRoot, PlaceholderSprites.Circle, GameplayColors.Dodge,
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(260f, 260f), false);
            var gaugeImg = BuildImage("Gauge", zoneImg.transform, PlaceholderSprites.Circle, GameplayColors.Dodge,
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(260f, 260f), false);
            gaugeImg.type = Image.Type.Filled;
            gaugeImg.fillMethod = Image.FillMethod.Radial360;
            var tapArea = BuildImage("TapArea", zoneImg.transform, PlaceholderSprites.Circle, new Color(1f, 1f, 1f, 0f),
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(300f, 300f), true);

            var zone = zoneImg.gameObject.AddComponent<DodgeZone>();
            SetPrivateField(zone, "zoneImage", zoneImg);
            SetPrivateField(zone, "gaugeImage", gaugeImg);
            SetPrivateField(zone, "tapArea", tapArea);
            return zone;
        }

        /// <summary>IN-6 (GDD §4.1/§6.2) template. Positioned via world-space
        /// transform.position exactly like ParryMarker (it anchors to a monster part, e.g.
        /// "belly" - GDD §7.2 P7), not anchoredPosition.</summary>
        private static RushZone BuildRushZoneTemplate(RectTransform templatesRoot)
        {
            var zoneImg = BuildImage("RushZoneTemplate", templatesRoot, PlaceholderSprites.Circle, GameplayColors.Gold,
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(300f, 300f), false);
            var gaugeImg = BuildImage("Gauge", zoneImg.transform, PlaceholderSprites.Ring, GameplayColors.Gold,
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(300f, 300f), false);
            gaugeImg.type = Image.Type.Filled;
            gaugeImg.fillMethod = Image.FillMethod.Radial360;
            var tapArea = BuildImage("TapArea", zoneImg.transform, PlaceholderSprites.Circle, new Color(1f, 1f, 1f, 0f),
                new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(320f, 320f), true);

            var zone = zoneImg.gameObject.AddComponent<RushZone>();
            SetPrivateField(zone, "zoneImage", zoneImg);
            SetPrivateField(zone, "gaugeImage", gaugeImg);
            SetPrivateField(zone, "tapArea", tapArea);
            return zone;
        }

        /// <summary>Dev/QA-only overlay (GDD §0: "내부 툴" is team discretion) so each of
        /// P1-P7 can be independently triggered/observed per this task's brief, without
        /// waiting on MonsterPatternPlayer's auto-cycling DriveLoop. Docked to the right
        /// edge, drawn on top of the GDD §6.1 gameplay layers - NOT itself part of that
        /// layer spec, so it does not consume any of the four layers' vertical budget.</summary>
        private static void BuildDemoControlPanel(RectTransform canvasRoot, MonsterPatternPlayer patternPlayer)
        {
            var panel = new GameObject("DemoControlPanel (dev/QA only)", typeof(RectTransform));
            var panelRect = panel.GetComponent<RectTransform>();
            panelRect.SetParent(canvasRoot, false);
            panelRect.anchorMin = new Vector2(1f, 0f);
            panelRect.anchorMax = new Vector2(1f, 1f);
            panelRect.pivot = new Vector2(1f, 1f);
            panelRect.sizeDelta = new Vector2(110f, 0f);
            panelRect.anchoredPosition = Vector2.zero;

            string[] patternIds = { "P1", "P2", "P3", "P4", "P5", "P6", "P7" };
            float y = -10f;
            const float buttonHeight = 44f;
            const float spacing = 6f;

            for (int i = 0; i < patternIds.Length; i++)
            {
                var buttonImg = BuildImage($"Trigger_{patternIds[i]}", panelRect, PlaceholderSprites.RoundedRect,
                    new Color(0.15f, 0.15f, 0.18f, 0.85f), new Vector2(1f, 1f), new Vector2(1f, 1f),
                    new Vector2(-6f, y), new Vector2(96f, buttonHeight), true);
                var button = buttonImg.gameObject.AddComponent<Button>();
                button.targetGraphic = buttonImg;
                BuildText($"Label_{patternIds[i]}", buttonImg.transform, patternIds[i], 24, Color.white,
                    Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, TextAnchor.MiddleCenter);

                var trigger = buttonImg.gameObject.AddComponent<PatternTriggerButton>();
                SetPrivateField(trigger, "patternPlayer", patternPlayer);
                SetPrivateField(trigger, "patternId", patternIds[i]);
                UnityEditor.Events.UnityEventTools.AddPersistentListener(button.onClick, trigger.TriggerPattern);

                y -= buttonHeight + spacing;
            }

            var toggleImg = BuildImage("Toggle_AutoPlay", panelRect, PlaceholderSprites.RoundedRect,
                new Color(0.25f, 0.20f, 0.05f, 0.85f), new Vector2(1f, 1f), new Vector2(1f, 1f),
                new Vector2(-6f, y), new Vector2(96f, buttonHeight), true);
            var toggleButton = toggleImg.gameObject.AddComponent<Button>();
            toggleButton.targetGraphic = toggleImg;
            BuildText("Label_AutoPlay", toggleImg.transform, "AUTO", 18, Color.white,
                Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, TextAnchor.MiddleCenter);

            var toggle = toggleImg.gameObject.AddComponent<AutoPlayToggleButton>();
            SetPrivateField(toggle, "patternPlayer", patternPlayer);
            UnityEditor.Events.UnityEventTools.AddPersistentListener(toggleButton.onClick, toggle.ToggleAutoPlay);
        }

        private static Image BuildImage(string name, Transform parent, Sprite sprite, Color color,
            Vector2 anchorMin, Vector2 anchorMax, Vector2 anchoredPosition, Vector2 size, bool raycastTarget)
        {
            var go = new GameObject(name, typeof(RectTransform));
            var rect = go.GetComponent<RectTransform>();
            rect.SetParent(parent, false);
            rect.anchorMin = anchorMin;
            rect.anchorMax = anchorMax;
            rect.anchoredPosition = anchoredPosition;
            rect.sizeDelta = size;

            var image = go.AddComponent<Image>();
            image.sprite = sprite;
            image.color = color;
            image.raycastTarget = raycastTarget;
            image.type = Image.Type.Simple;
            return image;
        }

        private static Text BuildText(string name, Transform parent, string content, int fontSize, Color color,
            Vector2 anchorMin, Vector2 anchorMax, Vector2 anchoredPosition, Vector2 size, TextAnchor alignment)
        {
            var go = new GameObject(name, typeof(RectTransform));
            var rect = go.GetComponent<RectTransform>();
            rect.SetParent(parent, false);
            rect.anchorMin = anchorMin;
            rect.anchorMax = anchorMax;
            rect.anchoredPosition = anchoredPosition;
            rect.sizeDelta = size;

            var text = go.AddComponent<Text>();
            text.text = content;
            text.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            text.fontSize = fontSize;
            text.color = color;
            text.alignment = alignment;
            text.raycastTarget = false;
            return text;
        }

        private static void StretchFull(RectTransform rect)
        {
            rect.anchorMin = Vector2.zero;
            rect.anchorMax = Vector2.one;
            rect.offsetMin = Vector2.zero;
            rect.offsetMax = Vector2.zero;
        }

        private static void AddSceneToBuildSettings(string scenePath)
        {
            var scenes = EditorBuildSettings.scenes;
            foreach (var s in scenes)
            {
                if (s.path == scenePath)
                {
                    return;
                }
            }
            var newScenes = new EditorBuildSettingsScene[scenes.Length + 1];
            scenes.CopyTo(newScenes, 0);
            newScenes[scenes.Length] = new EditorBuildSettingsScene(scenePath, true);
            EditorBuildSettings.scenes = newScenes;
        }

        // ── Reflection helpers for wiring private [SerializeField] references ──

        private static void SetPrivateField(Object target, string fieldName, Object value)
        {
            var so = new SerializedObject(target);
            var prop = so.FindProperty(fieldName);
            if (prop == null)
            {
                Debug.LogError($"[SceneBuilder] field '{fieldName}' not found on {target.GetType().Name}");
                return;
            }
            prop.objectReferenceValue = value;
            so.ApplyModifiedPropertiesWithoutUndo();
        }

        private static void SetPrivateField(Object target, string fieldName, int value)
        {
            var so = new SerializedObject(target);
            var prop = so.FindProperty(fieldName);
            if (prop == null)
            {
                Debug.LogError($"[SceneBuilder] field '{fieldName}' not found on {target.GetType().Name}");
                return;
            }
            prop.intValue = value;
            so.ApplyModifiedPropertiesWithoutUndo();
        }

        private static void SetPrivateField(Object target, string fieldName, string value)
        {
            var so = new SerializedObject(target);
            var prop = so.FindProperty(fieldName);
            if (prop == null)
            {
                Debug.LogError($"[SceneBuilder] field '{fieldName}' not found on {target.GetType().Name}");
                return;
            }
            prop.stringValue = value;
            so.ApplyModifiedPropertiesWithoutUndo();
        }

        private static void SetPrivateArrayField(Object target, string fieldName, Object[] values)
        {
            var so = new SerializedObject(target);
            var prop = so.FindProperty(fieldName);
            if (prop == null)
            {
                Debug.LogError($"[SceneBuilder] field '{fieldName}' not found on {target.GetType().Name}");
                return;
            }
            prop.arraySize = values.Length;
            for (int i = 0; i < values.Length; i++)
            {
                prop.GetArrayElementAtIndex(i).objectReferenceValue = values[i];
            }
            so.ApplyModifiedPropertiesWithoutUndo();
        }
    }
}
