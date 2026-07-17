using UnityEngine;
using TouchRPG.Combat.Input;

namespace TouchRPG.Combat.Core
{
    /// <summary>
    /// GDD §6.1 파티층 slot. IN-7 (tap a warning-state portrait = cover action) is
    /// explicitly out of scope for this task ("leave clean seams, do NOT build them").
    /// This stub exists so priority resolution has a real PartyPortrait-priority
    /// candidate to test against, and so the party layer is visually present per
    /// §6.1's 4-layer requirement, even though tapping it does nothing yet.
    /// </summary>
    public class PartyPortraitSlot : MonoBehaviour, ITappable
    {
        public TapPriority Priority => TapPriority.PartyPortrait;
        public bool IsTappable => isActiveAndEnabled;

        public void OnTapped(Vector2 screenPosition)
        {
            // IN-7 cover action - future task. Intentional no-op seam.
        }
    }
}
