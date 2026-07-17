using UnityEngine;

namespace TouchRPG.Combat.Input
{
    /// <summary>
    /// Anything a tap can land on. GDD §2 supporting principle: "탭 가능한 모든 것은
    /// 마커가 있고, 마커 없는 곳 탭은 이동이다" — every tappable thing carries a marker
    /// of some kind, and a tap where none exists is movement (the Ground implementation).
    /// </summary>
    public interface ITappable
    {
        TapPriority Priority { get; }

        /// <summary>False disqualifies this target from priority resolution entirely
        /// (e.g. a resolved/expiring parry marker should not still win a tap).</summary>
        bool IsTappable { get; }

        void OnTapped(Vector2 screenPosition);
    }
}
