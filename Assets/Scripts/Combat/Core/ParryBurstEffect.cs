using UnityEngine;
using UnityEngine.UI;

namespace TouchRPG.Combat.Core
{
    /// <summary>Purely cosmetic scale+fade burst on parry resolution. GDD §6.2: gold for
    /// perfect, white for good (color decided by the caller, see ParryMarker).</summary>
    public class ParryBurstEffect : MonoBehaviour
    {
        [SerializeField] private float lifetimeSeconds = 0.35f;
        [SerializeField] private float endScale = 2.5f;

        private Image _image;
        private Color _baseColor;
        private float _elapsed;

        /// <param name="lifetimeSeconds">Defaults to the original 0.35s parry-burst pacing.
        /// Overridable so the SAME component can also serve as IN-6's per-tap ripple
        /// (short) and finish flourish (long) without a second effect class - GDD §6.2:
        /// "러시: ... 탭 파문 + ... 종료 피니시 연출."</param>
        /// <param name="endScale">Defaults to the original 2.5x parry-burst scale.</param>
        public static ParryBurstEffect Spawn(Transform anchor, Color color, float lifetimeSeconds = 0.35f, float endScale = 2.5f)
        {
            var go = new GameObject("ParryBurst", typeof(RectTransform));
            var rect = (RectTransform)go.transform;
            rect.SetParent(anchor, false);
            rect.sizeDelta = new Vector2(140f, 140f);

            var image = go.AddComponent<Image>();
            image.sprite = PlaceholderSprites.Ring;
            image.color = color;
            image.raycastTarget = false;

            var effect = go.AddComponent<ParryBurstEffect>();
            effect._image = image;
            effect._baseColor = color;
            effect.lifetimeSeconds = lifetimeSeconds;
            effect.endScale = endScale;
            return effect;
        }

        private void Update()
        {
            _elapsed += Time.deltaTime;
            float t = Mathf.Clamp01(_elapsed / lifetimeSeconds);
            transform.localScale = Vector3.one * Mathf.Lerp(1f, endScale, t);
            if (_image != null)
            {
                var c = _baseColor;
                c.a = Mathf.Lerp(1f, 0f, t);
                _image.color = c;
            }
            if (t >= 1f)
            {
                Destroy(gameObject);
            }
        }
    }
}
