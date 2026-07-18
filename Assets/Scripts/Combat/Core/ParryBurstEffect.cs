using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace TouchRPG.Combat.Core
{
    /// <summary>Purely cosmetic scale+fade burst on parry resolution. GDD §6.2: gold for
    /// perfect, white for good (color decided by the caller, see ParryMarker).
    ///
    /// Pooled rather than Instantiate/Destroy-per-call: RushZone (IN-6) spawns one of
    /// these per landed tap as its "탭 파문" (GDD §6.2), which is the single
    /// highest-frequency touch moment in the whole build (IN-6 is deliberately the ONE
    /// mash-rewarded input) - a fresh GameObject + AddComponent&lt;Image&gt; +
    /// AddComponent&lt;ParryBurstEffect&gt; on every mashed tap was flagged as an
    /// unpooled GC hotspot exactly there. Spawn() now reuses a finished instance from a
    /// small static pool instead of allocating a new one whenever one is available.</summary>
    public class ParryBurstEffect : MonoBehaviour
    {
        private const int MaxPoolSize = 24;
        private static readonly Stack<ParryBurstEffect> Pool = new Stack<ParryBurstEffect>();

        [SerializeField] private float lifetimeSeconds = 0.35f;
        [SerializeField] private float endScale = 2.5f;

        private RectTransform _rect;
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
            ParryBurstEffect effect = null;
            while (Pool.Count > 0 && effect == null)
            {
                // A pooled entry can become a destroyed Unity object (e.g. scene unload
                // between tests) without ever going through Release() - skip those rather
                // than handing back a stale reference.
                effect = Pool.Pop();
            }

            if (effect == null)
            {
                var go = new GameObject("ParryBurst", typeof(RectTransform));
                var rect = (RectTransform)go.transform;
                rect.sizeDelta = new Vector2(140f, 140f);

                var image = go.AddComponent<Image>();
                image.sprite = PlaceholderSprites.Ring;
                image.raycastTarget = false;

                effect = go.AddComponent<ParryBurstEffect>();
                effect._rect = rect;
                effect._image = image;
            }

            effect._rect.SetParent(anchor, false);
            effect._rect.anchoredPosition = Vector2.zero;
            effect.transform.localScale = Vector3.one;
            effect.gameObject.SetActive(true);
            effect._image.color = color;
            effect._baseColor = color;
            effect.lifetimeSeconds = lifetimeSeconds;
            effect.endScale = endScale;
            effect._elapsed = 0f;
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
                Release();
            }
        }

        private void Release()
        {
            gameObject.SetActive(false);
            if (Pool.Count < MaxPoolSize)
            {
                Pool.Push(this);
            }
            else
            {
                Destroy(gameObject);
            }
        }
    }
}
