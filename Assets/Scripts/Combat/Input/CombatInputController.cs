using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;

namespace TouchRPG.Combat.Input
{
    /// <summary>
    /// Turns a raw tap (mouse-down in editor, touch-began on device) into exactly one
    /// resolved <see cref="ITappable"/> per GDD §4.2's fixed priority order. P-2 (GDD §2):
    /// the whole game speaks one gesture, tap — this class is the single point where a
    /// screen-space tap is interpreted, so it is also the single place a second gesture
    /// could sneak in. Do not add gesture handling here without director approval.
    /// </summary>
    public class CombatInputController : MonoBehaviour
    {
        [SerializeField] private EventSystem eventSystem;

        private readonly List<RaycastResult> _raycastResults = new List<RaycastResult>();
        private readonly List<ITappable> _candidates = new List<ITappable>();

        private void Awake()
        {
            if (eventSystem == null)
            {
                eventSystem = EventSystem.current;
            }
        }

        private void Update()
        {
            if (UnityEngine.Input.GetMouseButtonDown(0))
            {
                ResolveTap(UnityEngine.Input.mousePosition);
            }

            for (int i = 0; i < UnityEngine.Input.touchCount; i++)
            {
                var touch = UnityEngine.Input.GetTouch(i);
                if (touch.phase == TouchPhase.Began)
                {
                    ResolveTap(touch.position);
                }
            }
        }

        /// <summary>Runs one full tap resolution: raycast the UI, gather every
        /// ITappable under the point, and dispatch to the single priority winner.</summary>
        public void ResolveTap(Vector2 screenPosition)
        {
            if (eventSystem == null)
            {
                return;
            }

            var pointerData = new PointerEventData(eventSystem) { position = screenPosition };
            _raycastResults.Clear();
            eventSystem.RaycastAll(pointerData, _raycastResults);

            _candidates.Clear();
            foreach (var result in _raycastResults)
            {
                var tappable = result.gameObject.GetComponentInParent<ITappable>();
                if (tappable != null && tappable.IsTappable && !_candidates.Contains(tappable))
                {
                    _candidates.Add(tappable);
                }
            }

            var winner = ResolvePriority(_candidates);
            winner?.OnTapped(screenPosition);
        }

        /// <summary>
        /// Pure GDD §4.2 priority resolution, deliberately independent of Unity's
        /// EventSystem/raycasting so it is directly unit-testable in EditMode with
        /// plain fakes. Higher <see cref="TapPriority"/> wins; ties keep the first seen.
        /// </summary>
        public static ITappable ResolvePriority(IReadOnlyList<ITappable> candidates)
        {
            ITappable best = null;
            for (int i = 0; i < candidates.Count; i++)
            {
                var candidate = candidates[i];
                if (best == null || candidate.Priority > best.Priority)
                {
                    best = candidate;
                }
            }
            return best;
        }
    }
}
