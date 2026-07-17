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

        public event Action<ParryMarker, ParryJudgment> OnResolved;

        public TapPriority Priority => TapPriority.ParryMarker;
        public bool IsTappable => !_resolved && isActiveAndEnabled;

        /// <param name="targetTime">Time.time at which the rings fully overlap — the beat.</param>
        /// <param name="telegraphLeadSeconds">How long before targetTime the outer ring
        /// starts visibly contracting. Cosmetic pacing only (GDD §0 grants staging detail
        /// to team discretion); does not affect judgment math.</param>
        public void Initialize(GameplayConfig config, float targetTime, float telegraphLeadSeconds)
        {
            _config = config;
            _targetTime = targetTime;
            _spawnTime = targetTime - Mathf.Max(0.01f, telegraphLeadSeconds);
            _resolved = false;

            if (outerRingImage != null) outerRingImage.color = GameplayColors.Parry;
            if (innerRingImage != null) innerRingImage.color = GameplayColors.Parry;
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
            if (Time.time - _targetTime > _config.goodWindowSeconds)
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

        private void Resolve(float tapTime)
        {
            _resolved = true;
            var judgment = JudgmentEvaluator.Evaluate(tapTime, _targetTime, _config.perfectWindowSeconds, _config.goodWindowSeconds);

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
