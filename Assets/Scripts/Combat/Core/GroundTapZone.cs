using UnityEngine;
using TouchRPG.Combat.Input;

namespace TouchRPG.Combat.Core
{
    /// <summary>IN-4: tap on bare ground (no marker) = move. Lowest priority in GDD §4.2's
    /// resolution order, which is exactly why it works as the input-priority fallback.</summary>
    public class GroundTapZone : MonoBehaviour, ITappable
    {
        [SerializeField] private PlayerToken playerToken;

        public TapPriority Priority => TapPriority.Ground;
        public bool IsTappable => isActiveAndEnabled;

        public void OnTapped(Vector2 screenPosition)
        {
            if (playerToken != null)
            {
                playerToken.MoveTowardScreenPoint(screenPosition);
            }
        }
    }
}
