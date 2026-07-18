using UnityEngine;
using UnityEngine.UI;

namespace TouchRPG.Combat.Core
{
    /// <summary>
    /// GDD §7.2 P3 row '예고': "지면 붉은 라인" - a brief vertical ground-line telegraph
    /// shown just before a C-2 dodge zone appears at the same x position, distinct from
    /// the dodge zone's own circle+gauge (§6.2).
    ///
    /// Color tie-break (documented per this task's GDD-wins rule, applied here to an
    /// internal GDD conflict rather than a brief-vs-GDD one): §4.5's classification-color
    /// table is explicit and MUST ("색 채널 4색... 고정") that C-2's telegraph channel is
    /// BLUE ("파랑 (지면 회피 존)"), while §7.2's P3 row prose uses the word "붉은" (red)
    /// informally. §4.5 is the canonical, fixed channel assignment across the whole game;
    /// §7.2's row text is per-pattern flavor description. Rendering this in red would
    /// both introduce a channel meaning collision (red is reserved for C-3/relay per
    /// §4.5) and directly contradict §4.5's own explicit C-2=blue mapping, so this uses
    /// GameplayColors.Dodge instead - still recognizably "this is a C-2 telegraph"
    /// (§4.5's fixed intent), without violating the 4-channel MUST.
    /// </summary>
    public class GroundTelegraphLine : MonoBehaviour
    {
        private const float LineWidthPixels = 20f;
        private const float BaseAlpha = 0.85f;

        private Image _image;
        private float _durationSeconds;
        private float _elapsed;

        public static GroundTelegraphLine Spawn(RectTransform battlefieldPanel, float x, float durationSeconds)
        {
            var go = new GameObject("GroundTelegraphLine", typeof(RectTransform));
            var rect = (RectTransform)go.transform;
            rect.SetParent(battlefieldPanel, false);
            rect.anchorMin = new Vector2(0.5f, 0f);
            rect.anchorMax = new Vector2(0.5f, 1f);
            rect.pivot = new Vector2(0.5f, 0.5f);
            rect.anchoredPosition = new Vector2(x, 0f);
            rect.sizeDelta = new Vector2(LineWidthPixels, 0f);

            var image = go.AddComponent<Image>();
            var color = GameplayColors.Dodge;
            color.a = BaseAlpha;
            image.color = color;
            image.raycastTarget = false;

            var line = go.AddComponent<GroundTelegraphLine>();
            line._image = image;
            line._durationSeconds = Mathf.Max(0.05f, durationSeconds);
            return line;
        }

        private void Update()
        {
            _elapsed += Time.deltaTime;
            float t = Mathf.Clamp01(_elapsed / _durationSeconds);
            if (_image != null)
            {
                var c = GameplayColors.Dodge;
                c.a = Mathf.Lerp(BaseAlpha, 0f, t); // fades out as the real dodge zone takes over
                _image.color = c;
            }
            if (t >= 1f)
            {
                Destroy(gameObject);
            }
        }
    }
}
