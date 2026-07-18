using System;
using UnityEngine;
using UnityEngine.UI;
using TouchRPG.Combat.Config;
using TouchRPG.Combat.Input;

namespace TouchRPG.Combat.Core
{
    /// <summary>
    /// GDD §6.2 relay marker info: "릴레이 마커: 붉은 링 + 순번." Sequence numbers are
    /// 1-based (e.g. SequenceIndex=2, SequenceTotal=3 renders "2/3"). This task's scope
    /// is the solo relay substitute (GDD §5.2) only, which - being the entire chain end
    /// to end with no other party members - is ALWAYS "내 차례" (my turn): every beat
    /// carrying this info fires the full §6.2 triple signal (opaque + border pulse +
    /// haptic). A real multi-party relay (not built in P0) would instead flip a
    /// separate "is my turn" flag per beat based on which party member is due; that is
    /// explicitly out of scope here - see PartyPortraitSlot's remark.
    /// </summary>
    public readonly struct RelayMarkerInfo
    {
        public readonly int SequenceIndex;
        public readonly int SequenceTotal;

        public RelayMarkerInfo(int sequenceIndex, int sequenceTotal)
        {
            SequenceIndex = sequenceIndex;
            SequenceTotal = sequenceTotal;
        }
    }

    /// <summary>
    /// GDD §6.2 (MUST): "패링 마커: 노란 이중 링. 외곽 링이 내곽으로 수축, 겹침 순간 = 퍼펙트.
    /// 수축 속도가 곧 리듬 정보다." The outer ring scales down from a wide start toward the
    /// fixed-size inner ring; full overlap happens exactly at <see cref="_targetTime"/>.
    /// Judgment is computed purely from tap-time vs target-time using
    /// <see cref="JudgmentEvaluator"/> and the injected <see cref="GameplayConfig"/> windows
    /// — the visual contraction never itself decides perfect/good/miss, it only shows the
    /// rhythm. This is what makes "edit the config, behavior changes" true independent of art.
    /// Anchoring to the monster part (GDD §6.1 MUST) is the caller's job: set
    /// transform.position to the part's world position after spawning.
    /// </summary>
    public class ParryMarker : MonoBehaviour, ITappable
    {
        private const float OuterStartScale = 2.4f;
        private const float OverlapScale = 1f; // outer ring's scale when it exactly matches the inner ring

        // Relay-only cosmetics (GDD §6.2: "릴레이 마커: 붉은 링 + 순번. 내 차례: 불투명 + 테두리
        // 펄스 + 햅틱, MUST"). PROVISIONAL staging values - team discretion per GDD §0, not
        // judgment numbers.
        private const float RelayBorderPulseSizePixels = 210f; // outside the 150x150 ring pair - reads as a border, not a 3rd ring.
        private const float RelayBorderPulseSpeed = 8f; // radians/sec, ~1.3Hz - a readable "pulse", not a strobe.
        private const float RelayBorderPulseMinAlpha = 0.35f;
        private const float RelayBorderPulseMaxAlpha = 0.9f;

        [SerializeField] private RectTransform outerRing;
        [SerializeField] private RectTransform innerRing;
        [SerializeField] private Image outerRingImage;
        [SerializeField] private Image innerRingImage;
        [SerializeField] private Image tapArea;

        private GameplayConfig _config;
        private float _spawnTime;
        private float _targetTime;
        private bool _resolved;
        private float? _perfectWindowOverride;
        private float? _goodWindowOverride;
        private RelayMarkerInfo? _relayInfo;
        private Text _relaySequenceText;
        private RectTransform _relayBorderPulseRect;
        private Image _relayBorderPulseImage;

        public event Action<ParryMarker, ParryJudgment> OnResolved;

        public TapPriority Priority => TapPriority.ParryMarker;
        public bool IsTappable => !_resolved && isActiveAndEnabled;

        /// <summary>Polling alternative to <see cref="OnResolved"/> for callers that would
        /// otherwise need a per-instance closure just to await one result (e.g.
        /// MonsterPatternPlayer's beat coroutines) — a plain `while (!IsResolved) yield
        /// return null;` costs nothing to allocate.</summary>
        public bool IsResolved => _resolved;

        /// <summary>Valid only once <see cref="IsResolved"/> is true.</summary>
        public ParryJudgment Result { get; private set; }

        /// <summary>Time.time at which this beat's rings fully overlap. Exposed so a test
        /// can schedule a tap at a controlled offset from the real judgment target,
        /// rather than guessing at frame timing.</summary>
        public float TargetTime => _targetTime;

        /// <param name="targetTime">Time.time at which the rings fully overlap — the beat.</param>
        /// <param name="telegraphLeadSeconds">How long before targetTime the outer ring
        /// starts visibly contracting. Cosmetic pacing only (GDD §0 grants staging detail
        /// to team discretion); does not affect judgment math.</param>
        /// <param name="markerColorOverride">Defaults to the GDD §6.2 yellow parry color.
        /// Used by C-3 relay beats (GDD §6.2: "릴레이 마커: 붉은 링") to draw the SAME ring
        /// component in the reserved red relay channel instead of forking a second marker
        /// class just to change a color.</param>
        /// <param name="perfectWindowOverrideSeconds">Defaults to
        /// <see cref="GameplayConfig.perfectWindowSeconds"/>. Used by the C-3 relay solo
        /// substitute, whose window is a single GDD §12 constant
        /// (relay.solo.window), not the shared perfect/good pair - see
        /// MonsterPatternPlayer.ExecuteC3Relay for why perfect==good there.</param>
        /// <param name="goodWindowOverrideSeconds">Defaults to
        /// <see cref="GameplayConfig.goodWindowSeconds"/>. See
        /// <paramref name="perfectWindowOverrideSeconds"/>.</param>
        /// <param name="relayInfo">Null for a normal (non-relay) parry beat. Set by
        /// MonsterPatternPlayer.ExecuteC3Relay for every C-3 relay beat - draws the
        /// GDD §6.2 sequence badge and fires the "내 차례" triple signal (opaque +
        /// border pulse + haptic). See <see cref="RelayMarkerInfo"/>.</param>
        public void Initialize(GameplayConfig config, float targetTime, float telegraphLeadSeconds,
            Color? markerColorOverride = null, float? perfectWindowOverrideSeconds = null, float? goodWindowOverrideSeconds = null,
            RelayMarkerInfo? relayInfo = null)
        {
            _config = config;
            _targetTime = targetTime;
            _spawnTime = targetTime - Mathf.Max(0.01f, telegraphLeadSeconds);
            _resolved = false;
            _perfectWindowOverride = perfectWindowOverrideSeconds;
            _goodWindowOverride = goodWindowOverrideSeconds;
            _relayInfo = relayInfo;

            // GDD §6.2 signal 1 ("불투명" opaque) - explicit even though GameplayColors'
            // channels already default to alpha 1, so this reads as a deliberate signal
            // rather than an accident of the Color struct's default.
            var color = markerColorOverride ?? GameplayColors.Parry;
            color.a = 1f;
            if (outerRingImage != null) outerRingImage.color = color;
            if (innerRingImage != null) innerRingImage.color = color;
            if (outerRingImage != null) outerRingImage.enabled = true;
            if (innerRingImage != null) innerRingImage.enabled = true;
            if (tapArea != null) tapArea.raycastTarget = true;

            ApplyRelayVisuals(relayInfo);
        }

        /// <summary>
        /// GDD §6.2 MUST: "릴레이 마커: 붉은 링 + 순번. 내 차례: 불투명 + 테두리 펄스 + 햅틱
        /// (3중 신호)." Builds the sequence badge / border-pulse ring at runtime (same
        /// technique as PlaceholderSprites-driven effects elsewhere - GroundTelegraphLine,
        /// ParryBurstEffect) rather than requiring these on every ParryMarker prefab
        /// instance in every scene. Signal 3 (haptic) fires once here; signal 2 (border
        /// pulse) animates continuously in Update() while active.
        /// </summary>
        private void ApplyRelayVisuals(RelayMarkerInfo? relayInfo)
        {
            if (!relayInfo.HasValue)
            {
                if (_relaySequenceText != null) _relaySequenceText.gameObject.SetActive(false);
                if (_relayBorderPulseRect != null) _relayBorderPulseRect.gameObject.SetActive(false);
                return;
            }

            EnsureRelayVisuals();
            _relaySequenceText.text = $"{relayInfo.Value.SequenceIndex}/{relayInfo.Value.SequenceTotal}";
            _relaySequenceText.gameObject.SetActive(true);
            _relayBorderPulseRect.gameObject.SetActive(true);

            TriggerRelayHaptic(); // signal 3 of 3 - see that method's remark on Editor/PC verifiability.
        }

        private void EnsureRelayVisuals()
        {
            if (_relaySequenceText != null && _relayBorderPulseImage != null)
            {
                return;
            }

            var borderGo = new GameObject("RelayBorderPulse", typeof(RectTransform));
            _relayBorderPulseRect = (RectTransform)borderGo.transform;
            _relayBorderPulseRect.SetParent(transform, false);
            _relayBorderPulseRect.anchorMin = new Vector2(0.5f, 0.5f);
            _relayBorderPulseRect.anchorMax = new Vector2(0.5f, 0.5f);
            _relayBorderPulseRect.pivot = new Vector2(0.5f, 0.5f);
            _relayBorderPulseRect.anchoredPosition = Vector2.zero;
            _relayBorderPulseRect.sizeDelta = new Vector2(RelayBorderPulseSizePixels, RelayBorderPulseSizePixels);
            _relayBorderPulseImage = borderGo.AddComponent<Image>();
            _relayBorderPulseImage.sprite = PlaceholderSprites.Ring;
            _relayBorderPulseImage.raycastTarget = false;
            borderGo.transform.SetAsFirstSibling(); // behind the rings/tap area - a background glow, not an obstruction.

            var textGo = new GameObject("RelaySequenceBadge", typeof(RectTransform));
            var textRect = (RectTransform)textGo.transform;
            textRect.SetParent(transform, false);
            textRect.anchorMin = new Vector2(0.5f, 0.5f);
            textRect.anchorMax = new Vector2(0.5f, 0.5f);
            textRect.pivot = new Vector2(0.5f, 0.5f);
            textRect.anchoredPosition = Vector2.zero;
            textRect.sizeDelta = new Vector2(140f, 60f);
            _relaySequenceText = textGo.AddComponent<Text>();
            // Same builtin-font convention as ComboUI/PhaseIndicatorUI/HealthBarUI - plain
            // UnityEngine.UI.Text, not TextMeshPro, so this doesn't add a new UI dependency.
            _relaySequenceText.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            _relaySequenceText.fontSize = 40;
            _relaySequenceText.fontStyle = FontStyle.Bold;
            _relaySequenceText.alignment = TextAnchor.MiddleCenter;
            _relaySequenceText.color = Color.white;
            _relaySequenceText.raycastTarget = false;
            textGo.transform.SetAsLastSibling(); // above the rings, so the number stays readable.
        }

        /// <summary>
        /// GDD §6.2 relay triple signal, 3rd signal ("햅틱"). Handheld.Vibrate() already
        /// no-ops silently on platforms with no vibration motor (desktop/WebGL); the
        /// explicit Application.isEditor guard exists so this is a clearly DOCUMENTED
        /// no-op in the Editor rather than relying on whatever Handheld happens to do
        /// there. IMPORTANT: this means the haptic signal cannot be felt or otherwise
        /// observed in an Editor/PC test run - only code-confirmed by reading this path.
        /// </summary>
        private static void TriggerRelayHaptic()
        {
            if (Application.isEditor)
            {
                return;
            }
            Handheld.Vibrate();
        }

        private void Update()
        {
            if (_resolved)
            {
                return;
            }

            float t = Mathf.InverseLerp(_spawnTime, _targetTime, Time.time);
            float outerScale = Mathf.Lerp(OuterStartScale, OverlapScale, Mathf.Clamp01(t));
            if (outerRing != null)
            {
                outerRing.localScale = Vector3.one * outerScale;
            }

            if (_relayInfo.HasValue && _relayBorderPulseImage != null)
            {
                // GDD §6.2 signal 2 of 3 ("테두리 펄스" border pulse) - continuous, distinct
                // from the outer ring's one-shot contraction above.
                float pulse = 0.5f + 0.5f * Mathf.Sin(Time.time * RelayBorderPulseSpeed);
                var pulseColor = GameplayColors.Brighten(GameplayColors.Relay, 0.25f);
                pulseColor.a = Mathf.Lerp(RelayBorderPulseMinAlpha, RelayBorderPulseMaxAlpha, pulse);
                _relayBorderPulseImage.color = pulseColor;
                _relayBorderPulseRect.localScale = Vector3.one * Mathf.Lerp(0.96f, 1.08f, pulse);
            }

            // Nobody tapped before the good window closed - auto-resolve as a miss.
            // Guarded against a marker enabled without Initialize() (no config yet) -
            // every other field access in this class is already null-guarded; this one
            // was not, and threw an NRE every frame until Initialize ran.
            float goodWindowForTimeout = _goodWindowOverride ?? (_config != null ? _config.goodWindowSeconds : 0f);
            if ((_goodWindowOverride != null || _config != null) && Time.time - _targetTime > goodWindowForTimeout)
            {
                Resolve(Time.time);
            }
        }

        public void OnTapped(Vector2 screenPosition)
        {
            if (_resolved)
            {
                return;
            }
            Resolve(Time.time);
        }

        /// <summary>
        /// GDD §7.2 P4 (MUST): "페이크: 진짜와 동일하게 시작, 발동 직전 회색 소멸." Called
        /// externally by MonsterPatternPlayer when a fake beat's dissolve point is reached
        /// and the player correctly held back (never tapped). Turns the rings grey and
        /// disables further input WITHOUT running the normal Perfect/Good/Miss judgment
        /// path - holding back on a fake is neither a hit nor a parry, so it must not fire
        /// <see cref="OnResolved"/>, spawn a burst, or apply damage. Deliberately only
        /// changes color/opacity (never ring shape/size) so this cannot itself become an
        /// alternate marker-side tell - GDD MUST: the real/fake tell lives only in monster
        /// animation.
        /// </summary>
        public void DissolveAsFake()
        {
            if (_resolved)
            {
                return;
            }
            _resolved = true;
            if (tapArea != null) tapArea.raycastTarget = false;
            var grey = new Color(0.55f, 0.55f, 0.55f, 0.6f);
            if (outerRingImage != null) outerRingImage.color = grey;
            if (innerRingImage != null) innerRingImage.color = grey;
            Destroy(gameObject, 0.4f);
        }

        private void Resolve(float tapTime)
        {
            _resolved = true;
            float perfectWindow = _perfectWindowOverride ?? (_config != null ? _config.perfectWindowSeconds : 0f);
            float goodWindow = _goodWindowOverride ?? (_config != null ? _config.goodWindowSeconds : 0f);
            var judgment = JudgmentEvaluator.Evaluate(tapTime, _targetTime, perfectWindow, goodWindow);
            Result = judgment;

            if (tapArea != null) tapArea.raycastTarget = false;
            if (outerRingImage != null) outerRingImage.enabled = false;
            if (innerRingImage != null) innerRingImage.enabled = false;
            if (_relayBorderPulseRect != null) _relayBorderPulseRect.gameObject.SetActive(false);
            if (_relaySequenceText != null) _relaySequenceText.gameObject.SetActive(false);

            if (judgment != ParryJudgment.Miss)
            {
                // GDD §6.2: perfect burst = gold, good = white.
                var burstColor = judgment == ParryJudgment.Perfect ? GameplayColors.Gold : GameplayColors.GoodBurst;
                ParryBurstEffect.Spawn(transform, burstColor);
            }

            OnResolved?.Invoke(this, judgment);
            Destroy(gameObject, 0.4f);
        }
    }
}
