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

        // Reused across every tap instead of `new PointerEventData(eventSystem)` per
        // resolution - this is the hot path the whole loop exists to exercise, so a
        // fresh managed allocation on every single finger-down is worth avoiding.
        // PointerEventData carries no per-tap state this class reads back afterward
        // (only .position, overwritten below before each raycast), so reuse is safe.
        private PointerEventData _pointerEventData;

        // IN-5 hold tracking (GDD §4.1: "차지 중 패링 불가" - charging occupies the game's
        // one input channel). At most one hold is ever active at a time - P-2 (GDD §2)
        // means there is exactly one gesture/one finger of intent, so a second concurrent
        // touch during a hold is deliberately ignored below rather than starting a
        // second, independent hold.
        private bool _holdActive;
        private IHoldable _activeHoldable;
        private float _holdStartTime;
        private int _holdTouchId = -1;

        public bool IsHoldActive => _holdActive;

        private void Awake()
        {
            if (eventSystem == null)
            {
                eventSystem = EventSystem.current;
            }
        }

        private void Update()
        {
            // Touch-only platforms (mobile - GDD §1's primary target) simulate a mouse
            // event from the primary touch, so GetMouseButtonDown(0) AND a Began touch
            // can both fire for one physical tap in the same frame. Handling both paths
            // unconditionally would resolve the same tap twice - e.g. a perfect parry
            // immediately followed by an unintended ground-move on the same finger-down.
            // When any touch is active this frame, touches are authoritative and the
            // (possibly synthesized) mouse path is skipped; mouse is only read when
            // there is no touch at all, which is exactly editor/PC testing.
            if (UnityEngine.Input.touchCount > 0)
            {
                for (int i = 0; i < UnityEngine.Input.touchCount; i++)
                {
                    var touch = UnityEngine.Input.GetTouch(i);
                    if (touch.phase == TouchPhase.Began)
                    {
                        ResolveTap(touch.position);
                        if (_holdActive && _holdTouchId < 0)
                        {
                            _holdTouchId = touch.fingerId;
                        }
                    }
                    else if (_holdActive && touch.fingerId == _holdTouchId &&
                             (touch.phase == TouchPhase.Ended || touch.phase == TouchPhase.Canceled))
                    {
                        ReleaseHold();
                    }
                }
                return;
            }

            if (UnityEngine.Input.GetMouseButtonDown(0))
            {
                ResolveTap(UnityEngine.Input.mousePosition);
            }
            else if (_holdActive && UnityEngine.Input.GetMouseButtonUp(0))
            {
                ReleaseHold();
            }
        }

        /// <summary>Runs one full tap resolution: raycast the UI, gather every
        /// ITappable under the point, and dispatch to the single priority winner. While
        /// a hold (IN-5 charge) is active, ALL new taps are suppressed here - this is
        /// what makes GDD §4.1's "차지 중 패링 불가" true structurally: an incoming parry
        /// marker cannot be answered during a hold because taps simply never reach it,
        /// so it resolves via its own auto-miss timeout exactly like an ignored one.</summary>
        public void ResolveTap(Vector2 screenPosition)
        {
            if (eventSystem == null || _holdActive)
            {
                return;
            }

            if (_pointerEventData == null)
            {
                _pointerEventData = new PointerEventData(eventSystem);
            }
            _pointerEventData.position = screenPosition;
            _raycastResults.Clear();
            eventSystem.RaycastAll(_pointerEventData, _raycastResults);

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
            if (winner == null)
            {
                return;
            }

            if (winner is IHoldable holdable)
            {
                _holdActive = true;
                _activeHoldable = holdable;
                _holdStartTime = Time.time;
                holdable.OnHoldStarted();
                return;
            }

            winner.OnTapped(screenPosition);
        }

        /// <summary>Ends the active hold (release), firing <see cref="IHoldable.OnHoldReleased"/>
        /// with the real elapsed duration. Public so tests can drive it directly instead
        /// of only through simulated Input state.</summary>
        public void ReleaseHold()
        {
            if (!_holdActive)
            {
                return;
            }
            float heldSeconds = Time.time - _holdStartTime;
            var holdable = _activeHoldable;
            _holdActive = false;
            _activeHoldable = null;
            _holdTouchId = -1;
            holdable?.OnHoldReleased(heldSeconds);
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
