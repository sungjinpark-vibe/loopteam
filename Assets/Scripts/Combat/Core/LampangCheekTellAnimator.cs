using System.Collections;
using UnityEngine;

namespace TouchRPG.Combat.Core
{
    /// <summary>
    /// GDD §7.2 P4 (MUST): "애니메이션 단서: 진짜 = 볼 좌우대칭 부풀림 / 가짜 = 한쪽만 부풀림."
    /// This is the ONLY place the real/fake tell may live (GDD MUST §6.2/§2 supporting
    /// principle "화면이 아니라 몬스터를 보게 만든다") - never on the ParryMarker itself, which
    /// looks identical either way. Purely a placeholder scale-tween (GDD §0 grants staging/
    /// effect detail to team discretion); swap for real character animation whenever art
    /// exists.
    /// </summary>
    public class LampangCheekTellAnimator : MonoBehaviour
    {
        [SerializeField] private RectTransform cheekLeft;
        [SerializeField] private RectTransform cheekRight;

        [Tooltip("How long the puff-up holds before settling back. PROVISIONAL staging value " +
                 "- cosmetic pacing only, not a judgment/gameplay number.")]
        [SerializeField] private float tellDurationSeconds = 0.8f;

        [Tooltip("Scale multiplier applied to a puffed cheek. PROVISIONAL staging value.")]
        [SerializeField] private float puffScale = 1.35f;

        private Vector3 _leftBaseScale = Vector3.one;
        private Vector3 _rightBaseScale = Vector3.one;
        private Coroutine _running;

        private void Awake()
        {
            if (cheekLeft != null) _leftBaseScale = cheekLeft.localScale;
            if (cheekRight != null) _rightBaseScale = cheekRight.localScale;
        }

        /// <param name="isReal">GDD §7.2 MUST: true = both cheeks puff symmetrically; false
        /// (fake) = only the canonical anchor cheek ("cheek_pouch", right) puffs.</param>
        public void PlayTell(bool isReal)
        {
            if (_running != null)
            {
                StopCoroutine(_running);
            }
            _running = StartCoroutine(RunTell(isReal));
        }

        private IEnumerator RunTell(bool isReal)
        {
            SetScale(cheekRight, _rightBaseScale * puffScale);
            if (isReal)
            {
                SetScale(cheekLeft, _leftBaseScale * puffScale);
            }

            yield return new WaitForSeconds(tellDurationSeconds);

            SetScale(cheekRight, _rightBaseScale);
            SetScale(cheekLeft, _leftBaseScale);
            _running = null;
        }

        private static void SetScale(RectTransform rect, Vector3 scale)
        {
            if (rect != null)
            {
                rect.localScale = scale;
            }
        }
    }
}
