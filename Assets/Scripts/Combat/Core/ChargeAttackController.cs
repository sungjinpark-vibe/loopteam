using System;
using UnityEngine;
using UnityEngine.UI;
using TouchRPG.Combat.Input;

namespace TouchRPG.Combat.Core
{
    /// <summary>
    /// IN-5 (GDD §4.1): "길게 누르고 떼기, 대상: 몬스터 몸체. 차지 공격. 차지 중 패링 불가
    /// (고딜·고리스크)." Subclasses <see cref="MonsterPart"/> (same priority tier and
    /// registry membership as every other tappable monster part) and additionally
    /// implements <see cref="IHoldable"/>, which is what routes a press-down on this part
    /// into the hold lifecycle instead of an instant tap - see
    /// <see cref="CombatInputController.ResolveTap"/>.
    ///
    /// "차지 중 패링 불가" is enforced by CombatInputController itself (ALL other taps are
    /// suppressed while any hold is active), not duplicated here - this class only owns
    /// deciding what a release means: a release shorter than
    /// <see cref="minHoldSecondsForCharge"/> is treated as an ordinary IN-1 tap (reuses
    /// <see cref="MonsterPart.RaiseBasicAttack"/> so the target does not lose its basic-attack
    /// behavior just because it also accepts holds); a longer release fires the charged
    /// attack via <see cref="OnChargedAttackReleased"/>.
    /// </summary>
    public class ChargeAttackController : MonsterPart, IHoldable
    {
        [SerializeField] private Image chargeGaugeImage;

        [Tooltip("Minimum hold duration (seconds) to count as a charged attack rather than " +
                 "an ordinary IN-1 tap. PROVISIONAL staging value - GDD gives no number, only " +
                 "the qualitative 'press-and-hold-and-release' vocabulary entry.")]
        [SerializeField] private float minHoldSecondsForCharge = 0.35f;

        [Tooltip("Hold duration treated as a FULL charge for the visual gauge. PROVISIONAL " +
                 "staging value (cosmetic pacing only, does not gate the charge/no-charge " +
                 "decision - that is minHoldSecondsForCharge above).")]
        [SerializeField] private float fullChargeSeconds = 1.2f;

        private bool _charging;
        private float _holdStartTime;

        /// <summary>Fired on release once the hold cleared minHoldSecondsForCharge - the
        /// actual charge-attack damage number lives in P0DemoNumbers.chargeAttackDamage,
        /// applied by MonsterController (which already owns "monster takes damage").</summary>
        public event Action OnChargedAttackReleased;

        public bool IsCharging => _charging;

        public void OnHoldStarted()
        {
            _charging = true;
            _holdStartTime = Time.time;
            SetGaugeFraction(0f);
            if (chargeGaugeImage != null) chargeGaugeImage.enabled = true;
        }

        private void Update()
        {
            if (!_charging)
            {
                return;
            }
            float elapsed = Time.time - _holdStartTime;
            SetGaugeFraction(Mathf.Clamp01(elapsed / Mathf.Max(0.01f, fullChargeSeconds)));
        }

        public void OnHoldReleased(float heldSeconds)
        {
            _charging = false;
            SetGaugeFraction(0f);
            if (chargeGaugeImage != null) chargeGaugeImage.enabled = false;

            if (heldSeconds < minHoldSecondsForCharge)
            {
                // Quick tap fallback - GDD §4.1's IN-1 target ("몬스터 몸체") overlaps IN-5's,
                // so a short press-release here is read as an ordinary basic attack rather
                // than a failed/aborted charge.
                RaiseBasicAttack();
                return;
            }

            OnChargedAttackReleased?.Invoke();
        }

        private void SetGaugeFraction(float fraction)
        {
            if (chargeGaugeImage != null)
            {
                chargeGaugeImage.fillAmount = fraction;
            }
        }
    }
}
