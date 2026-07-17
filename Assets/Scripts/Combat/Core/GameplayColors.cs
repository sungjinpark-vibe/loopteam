using UnityEngine;

namespace TouchRPG.Combat.Core
{
    /// <summary>
    /// GDD §4.5 / §6.4 (MUST): gameplay colour is fixed at exactly 4 channels — yellow
    /// = parry, blue = dodge, red = relay, gold = reward. Adding a gameplay colour is
    /// MUST NOT. Every visual that carries gameplay meaning (telegraph, marker, result
    /// burst) must draw from this single source rather than defining its own color, so
    /// a 5th channel cannot be introduced by accident in some far-off script.
    /// Decorative, non-gameplay colors (fur, background tint) are NOT restricted by
    /// this rule and do not belong here.
    /// </summary>
    public static class GameplayColors
    {
        public static readonly Color Parry = new Color(1f, 0.85f, 0.10f); // yellow
        public static readonly Color Dodge = new Color(0.20f, 0.55f, 1f); // blue
        public static readonly Color Relay = new Color(0.90f, 0.15f, 0.15f); // red
        public static readonly Color Gold = new Color(1f, 0.78f, 0.20f); // gold (reward / perfect burst)
        public static readonly Color GoodBurst = Color.white; // GDD §6.2: good = white burst
    }
}
