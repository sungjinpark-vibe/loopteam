using UnityEngine;
using UnityEngine.UI;

namespace TouchRPG.Combat.Core
{
    /// <summary>
    /// GDD §5.2 MUST: "성공 연출은 파티원 초상 → 몬스터로 빛이 '이어지는' 흐름 (협동감의 시각화)."
    /// Scoped to the solo relay flow only, per this task's brief - a general multi-party
    /// beam routing system is explicitly out of scope while party is still a 1-person
    /// stub (see PartyPortraitSlot). Spawned once by
    /// <see cref="TouchRPG.Combat.Pattern.MonsterPatternPlayer.ExecuteC3Relay"/> when a
    /// full relay sequence succeeds, pointing from the party portrait anchor to the
    /// monster part anchor the relay beats were drawn on.
    ///
    /// Built at runtime rather than authored as a scene prefab - same technique as
    /// <see cref="GroundTelegraphLine"/>/<see cref="ParryBurstEffect"/>: a single,
    /// self-updating, self-destroying GameObject with no persistent scene footprint.
    /// Not pooled (unlike ParryBurstEffect) - a full relay success is a rare, sequence-
    /// gating event, not a per-frame/per-tap hotspot, so pooling would add complexity
    /// with no measurable GC benefit.
    ///
    /// Color: GDD §6.4 MUST caps gameplay color at exactly 4 fixed channels (see
    /// GameplayColors) - this reuses the Relay (red) channel rather than introducing a
    /// 5th "success light" color, since the beam IS the relay's own success telegraph,
    /// not a new gameplay concept.
    /// </summary>
    public class RelayLightBeamEffect : MonoBehaviour
    {
        private const float ThicknessPixels = 14f;
        private const float FadeInFraction = 0.2f; // PROVISIONAL cosmetic pacing, team discretion per GDD §0.

        private RectTransform _rect;
        private Image _image;
        private Transform _source;
        private Transform _target;
        private float _lifetimeSeconds;
        private float _elapsed;

        /// <param name="parent">A RectTransform anywhere under the combat Canvas (callers
        /// pass the same markerLayer ParryMarker instances spawn into) - used only to
        /// FIND that Canvas; the beam is actually parented directly under it, not under
        /// <paramref name="parent"/> itself. This matters because markerLayer is nested
        /// INSIDE the GDD §6.1 몬스터층 panel, which renders BEHIND the later 전장층/파티층
        /// panels in sibling order - a beam parented there would have its
        /// party-to-battlefield segment drawn underneath those panels' opaque
        /// backgrounds and be invisible (found empirically: the beam rendered zero
        /// visible pixels until this fix). Parenting under the Canvas itself makes the
        /// beam the LAST sibling of all four layer panels, i.e. always on top,
        /// regardless of which layers its two endpoints belong to.</param>
        /// <param name="source">Party portrait anchor (GDD §6.1 파티층, bottom).</param>
        /// <param name="target">Monster part anchor the relay's beats were drawn on.</param>
        /// <param name="lifetimeSeconds">PROVISIONAL staging value (team discretion, GDD §0) -
        /// not a judgment number, purely presentation timing.</param>
        public static RelayLightBeamEffect Spawn(Transform parent, Transform source, Transform target, float lifetimeSeconds = 0.6f)
        {
            if (parent == null || source == null || target == null)
            {
                return null;
            }

            var canvas = parent.GetComponentInParent<Canvas>();
            Transform spawnParent = canvas != null ? canvas.transform : parent;

            var go = new GameObject("RelayLightBeam", typeof(RectTransform));
            var rect = (RectTransform)go.transform;
            rect.SetParent(spawnParent, false);
            rect.pivot = new Vector2(0.5f, 0.5f);

            // No sprite assigned - Image falls back to a plain filled white rect (same
            // technique as DodgeZone's guide line), which is exactly what a beam needs.
            var image = go.AddComponent<Image>();
            image.color = GameplayColors.Relay;
            image.raycastTarget = false;

            var effect = go.AddComponent<RelayLightBeamEffect>();
            effect._rect = rect;
            effect._image = image;
            effect._source = source;
            effect._target = target;
            effect._lifetimeSeconds = Mathf.Max(0.05f, lifetimeSeconds);
            effect._elapsed = 0f;
            effect.UpdateBeamTransform();
            return effect;
        }

        private void Update()
        {
            _elapsed += Time.deltaTime;
            float t = Mathf.Clamp01(_elapsed / _lifetimeSeconds);

            UpdateBeamTransform(); // keep aligned even if either anchor moves mid-flight.

            if (_image != null)
            {
                var c = GameplayColors.Relay;
                c.a = t < FadeInFraction
                    ? Mathf.Lerp(0f, 1f, t / FadeInFraction)
                    : Mathf.Lerp(1f, 0f, (t - FadeInFraction) / (1f - FadeInFraction));
                _image.color = c;
            }

            if (t >= 1f)
            {
                Destroy(gameObject);
            }
        }

        /// <summary>
        /// Does ALL of its math in the beam's OWN PARENT's local space (via
        /// InverseTransformPoint), never mixing world-space deltas into a LOCAL field
        /// like sizeDelta/anchoredPosition - same convention DodgeZone's guide line
        /// uses. This matters concretely here because the Canvas root's own
        /// RectTransform carries a non-1 lossyScale (Unity's normal Screen Space -
        /// Overlay setup), so a world-space distance between two anchors is NOT the
        /// same number as the local/canvas-unit distance sizeDelta expects - assigning
        /// the world-space number directly (an earlier version of this method) rendered
        /// a beam roughly 1/100th the correct length (found empirically: a ~290px gap
        /// produced a ~6-unit sizeDelta, invisible against the UI).
        /// </summary>
        private void UpdateBeamTransform()
        {
            if (_rect == null || _rect.parent == null || _source == null || _target == null)
            {
                return;
            }

            Vector3 aLocal = _rect.parent.InverseTransformPoint(_source.position);
            Vector3 bLocal = _rect.parent.InverseTransformPoint(_target.position);
            _rect.anchoredPosition = (Vector2)((aLocal + bLocal) * 0.5f);

            Vector2 delta = bLocal - aLocal;
            float distance = delta.magnitude;
            _rect.sizeDelta = new Vector2(distance, ThicknessPixels);

            float angle = Mathf.Atan2(delta.y, delta.x) * Mathf.Rad2Deg;
            _rect.localRotation = Quaternion.Euler(0f, 0f, angle);
        }
    }
}
