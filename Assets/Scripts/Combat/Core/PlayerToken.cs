using UnityEngine;

namespace TouchRPG.Combat.Core
{
    /// <summary>Player avatar in the battlefield layer. Moves toward a tapped ground
    /// point (IN-4). Movement mechanics beyond "이동" aren't specified in the GDD, so this
    /// is a deliberately simple, non-gameplay-affecting placeholder (staging detail,
    /// team discretion per GDD §0) — swap for real locomotion whenever that's designed.</summary>
    public class PlayerToken : MonoBehaviour
    {
        [SerializeField] private RectTransform battlefieldPanel;
        [SerializeField] private RectTransform self;
        [SerializeField] private float moveSpeedPixelsPerSecond = 900f;

        [Tooltip("Multiplier applied to moveSpeedPixelsPerSecond for an IN-3 dodge dash " +
                 "(GDD §3: '회피 존... 탭 시 자동 대시'). PROVISIONAL staging value - the GDD " +
                 "names no dash-speed number, only that it is an automatic dash distinct from " +
                 "ordinary IN-4 walking.")]
        [SerializeField] private float dashSpeedMultiplier = 4f;

        private float? _targetX;
        private bool _isDashing;

        /// <summary>Battlefield-local anchored position, exposed read-only so other
        /// battlefield-layer objects (e.g. DodgeZone's guide line) can compute relative
        /// positions without reaching into this component's private RectTransform.</summary>
        public Vector2 LocalPosition => self != null ? self.anchoredPosition : Vector2.zero;

        public void MoveTowardScreenPoint(Vector2 screenPoint)
        {
            if (battlefieldPanel == null)
            {
                return;
            }
            if (RectTransformUtility.ScreenPointToLocalPointInRectangle(battlefieldPanel, screenPoint, null, out var local))
            {
                _targetX = local.x;
                _isDashing = false;
            }
        }

        /// <summary>IN-3 (GDD §4.1/§6.2): moves toward a battlefield-local point at
        /// <see cref="dashSpeedMultiplier"/>x normal speed - the automatic dash a
        /// successful dodge-zone tap triggers, as opposed to an ordinary IN-4 walk.</summary>
        public void DashTo(Vector2 battlefieldLocalPoint)
        {
            _targetX = battlefieldLocalPoint.x;
            _isDashing = true;
        }

        /// <summary>GDD §7.2 P3 실패: "중피해+넉백" - forces a fast move AWAY from
        /// <paramref name="sourceBattlefieldLocalPoint"/> (the missed dodge zone), as
        /// opposed to <see cref="DashTo"/> which moves TOWARD a chosen point. Deliberately
        /// reuses the dash-speed channel (direction is what differs, not pacing) rather
        /// than introducing a second provisional speed number.</summary>
        public void KnockbackAwayFrom(Vector2 sourceBattlefieldLocalPoint, float distancePixels)
        {
            if (self == null)
            {
                return;
            }
            Vector2 current = self.anchoredPosition;
            Vector2 direction = current - sourceBattlefieldLocalPoint;
            if (direction.sqrMagnitude < 1f)
            {
                direction = Vector2.right; // fallback when knocked back from directly on top
            }
            direction.Normalize();

            Vector2 target = current + direction * distancePixels;
            if (battlefieldPanel != null)
            {
                float halfWidth = battlefieldPanel.rect.width * 0.5f;
                target.x = Mathf.Clamp(target.x, -halfWidth, halfWidth);
            }
            _targetX = target.x;
            _isDashing = true;
        }

        private void Update()
        {
            if (_targetX == null || self == null)
            {
                return;
            }
            float speed = moveSpeedPixelsPerSecond * (_isDashing ? dashSpeedMultiplier : 1f);
            var pos = self.anchoredPosition;
            pos.x = Mathf.MoveTowards(pos.x, _targetX.Value, speed * Time.deltaTime);
            self.anchoredPosition = pos;
            if (Mathf.Approximately(pos.x, _targetX.Value))
            {
                _targetX = null;
                _isDashing = false;
            }
        }
    }
}
