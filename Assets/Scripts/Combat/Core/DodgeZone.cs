using UnityEngine;
using TouchRPG.Combat.Input;

namespace TouchRPG.Combat.Core
{
    /// <summary>
    /// GDD §6.1/§6.2 dodge zone (IN-3). C-2/C-5 patterns that spawn dodge zones are out
    /// of scope for this task ("leave clean seams, do NOT build them") — no instance of
    /// this component is placed in the P0 scene. It exists purely so the priority
    /// resolver's full ordering (parry &gt; dodge &gt; party &gt; monster &gt; ground) is a real,
    /// testable class hierarchy rather than a gap to fill in later.
    /// </summary>
    public class DodgeZone : MonoBehaviour, ITappable
    {
        public TapPriority Priority => TapPriority.DodgeZone;
        public bool IsTappable => isActiveAndEnabled;

        public void OnTapped(Vector2 screenPosition)
        {
            // IN-3 dodge - future task (C-2/C-5 patterns). Intentional no-op seam.
        }
    }
}
