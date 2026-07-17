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

        private float? _targetX;

        public void MoveTowardScreenPoint(Vector2 screenPoint)
        {
            if (battlefieldPanel == null)
            {
                return;
            }
            if (RectTransformUtility.ScreenPointToLocalPointInRectangle(battlefieldPanel, screenPoint, null, out var local))
            {
                _targetX = local.x;
            }
        }

        private void Update()
        {
            if (_targetX == null || self == null)
            {
                return;
            }
            var pos = self.anchoredPosition;
            pos.x = Mathf.MoveTowards(pos.x, _targetX.Value, moveSpeedPixelsPerSecond * Time.deltaTime);
            self.anchoredPosition = pos;
            if (Mathf.Approximately(pos.x, _targetX.Value))
            {
                _targetX = null;
            }
        }
    }
}
