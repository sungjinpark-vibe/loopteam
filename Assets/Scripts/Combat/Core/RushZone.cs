using System;
using UnityEngine;
using UnityEngine.UI;
using TouchRPG.Combat.Input;

namespace TouchRPG.Combat.Core
{
    /// <summary>
    /// IN-6 (GDD §4.1/§4.5/§6.2): "연타, 대상: 그로기 약점 영역... 러시. 그로기 구간 전용."
    /// GDD explicitly calls this out as "연타가 보상되는 유일한 구간" (the ONLY window where
    /// repeat-tapping is rewarded) - every OTHER tappable in this game (ParryMarker,
    /// DodgeZone, MonsterPart, ChargeAttackController) is single-shot: a second tap on an
    /// already-resolved target is explicitly a no-op. This class is the ONE deliberate
    /// exception, and it must not leak - nothing else in the codebase re-arms IsTappable
    /// after resolving. Visual per §6.2: "러시: 약점 부위 대형 원 + 탭 파문 + 진행 게이지 +
    /// 종료 피니시 연출."
    /// </summary>
    public class RushZone : MonoBehaviour, ITappable
    {
        [SerializeField] private Image zoneImage;
        [SerializeField] private Image gaugeImage;
        [SerializeField] private Image tapArea;

        private int _tapCount;
        private int _requiredTaps;
        private float _windowSeconds;
        private float _spawnTime;
        private bool _finished;
        private bool _expired;

        /// <summary>Fired once per landed tap - lets a caller (MonsterPatternPlayer) apply
        /// a per-tap reward (e.g. monster damage) without RushZone itself needing to know
        /// about HealthController/P0DemoNumbers.</summary>
        public event Action<RushZone> OnTapLanded;

        /// <summary>Fired exactly once, when the gauge reaches 100% (finish flourish).</summary>
        public event Action<RushZone> OnFinished;

        /// <summary>Fired if the window closes before the gauge filled.</summary>
        public event Action<RushZone> OnExpired;

        public TapPriority Priority => TapPriority.MonsterPart; // GDD §4.2 groups IN-1/IN-5/IN-6 under the same "몬스터 부위" tier
        public bool IsTappable => !_finished && !_expired && isActiveAndEnabled;
        public bool IsFinished => _finished;

        public void Initialize(float windowSeconds, int requiredTaps)
        {
            _windowSeconds = Mathf.Max(0.1f, windowSeconds);
            _requiredTaps = Mathf.Max(1, requiredTaps);
            _tapCount = 0;
            _spawnTime = Time.time;
            _finished = false;
            _expired = false;

            if (zoneImage != null)
            {
                // Translucent base fill (same reasoning as DodgeZone) so the brighter
                // progress gauge on top is a visibly distinct layer, not an identical
                // color rendering an invisible fillAmount change.
                var baseColor = GameplayColors.Gold;
                baseColor.a = 0.35f;
                zoneImage.color = baseColor; // C-4 groggy channel, GDD §4.5
            }
            if (gaugeImage != null)
            {
                // Contrast TINT of the same Gold channel - makes the progress gauge
                // (§6.2 MUST) actually readable tap-by-tap instead of blending into the
                // zone fill beneath it.
                gaugeImage.color = GameplayColors.Brighten(GameplayColors.Gold);
                gaugeImage.type = Image.Type.Filled;
                gaugeImage.fillMethod = Image.FillMethod.Radial360;
                gaugeImage.fillAmount = 0f;
            }
            if (tapArea != null) tapArea.raycastTarget = true;
        }

        private void Update()
        {
            if (_finished || _expired)
            {
                return;
            }
            if (Time.time - _spawnTime >= _windowSeconds)
            {
                _expired = true;
                if (tapArea != null) tapArea.raycastTarget = false;
                OnExpired?.Invoke(this);
                Destroy(gameObject, 0.2f);
            }
        }

        public void OnTapped(Vector2 screenPosition)
        {
            // Deliberately NOT guarded by "already tapped this frame" or similar - every
            // tap while the zone is live counts. This is the intentional, isolated
            // exception to the rest of the game's mash-guard convention.
            if (_finished || _expired)
            {
                return;
            }

            _tapCount++;
            float progress = Mathf.Clamp01((float)_tapCount / _requiredTaps);
            if (gaugeImage != null) gaugeImage.fillAmount = progress;

            SpawnRipple();
            OnTapLanded?.Invoke(this);

            if (_tapCount >= _requiredTaps)
            {
                Finish();
            }
        }

        private void SpawnRipple()
        {
            // Small, quick burst distinct from the finish flourish - GDD §6.2 "탭 파문".
            ParryBurstEffect.Spawn(transform, GameplayColors.Gold, lifetimeSeconds: 0.2f, endScale: 1.6f);
        }

        private void Finish()
        {
            _finished = true;
            if (tapArea != null) tapArea.raycastTarget = false;
            // Bigger, longer burst - GDD §6.2 "종료 피니시 연출".
            ParryBurstEffect.Spawn(transform, GameplayColors.Gold, lifetimeSeconds: 0.6f, endScale: 3.5f);
            OnFinished?.Invoke(this);
            Destroy(gameObject, 0.6f);
        }
    }
}
