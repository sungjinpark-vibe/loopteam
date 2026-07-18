using System;
using UnityEngine;
using UnityEngine.UI;
using TouchRPG.Combat.Config;
using TouchRPG.Combat.Input;

namespace TouchRPG.Combat.Core
{
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
        public void Initialize(GameplayConfig config, float targetTime, float telegraphLeadSeconds,
            Color? markerColorOverride = null, float? perfectWindowOverrideSeconds = null, float? goodWindowOverrideSeconds = null)
        {
            _config = config;
            _targetTime = targetTime;
            _spawnTime = targetTime - Mathf.Max(0.01f, telegraphLeadSeconds);
            _resolved = false;
            _perfectWindowOverride = perfectWindowOverrideSeconds;
            _goodWindowOverride = goodWindowOverrideSeconds;

            var color = markerColorOverride ?? GameplayColors.Parry;
            if (outerRingImage != null) outerRingImage.color = color;
            if (innerRingImage != null) innerRingImage.color = color;
            if (outerRingImage != null) outerRingImage.enabled = true;
            if (innerRingImage != null) innerRingImage.enabled = true;
            if (tapArea != null) tapArea.raycastTarget = true;
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
