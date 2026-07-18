using UnityEngine;
using TouchRPG.Combat.Pattern;

namespace TouchRPG.Combat.Core
{
    /// <summary>
    /// Dev/QA-only demo control (GDD §0: "내부 툴" is team discretion, no query needed).
    /// One instance per pattern button so each of P1-P7 can be triggered independently
    /// from the UI without waiting on <see cref="MonsterPatternPlayer"/>'s auto-cycling
    /// DriveLoop - this is what makes "each pattern independently triggerable and
    /// observable" (this task's brief) concretely demonstrable. Not part of the GDD's
    /// player-facing UI spec (§6.1).
    /// </summary>
    public class PatternTriggerButton : MonoBehaviour
    {
        [SerializeField] private MonsterPatternPlayer patternPlayer;
        [SerializeField] private string patternId = "P1";

        /// <summary>Parameterless on purpose - wired as a Button.onClick PERSISTENT
        /// listener via UnityEventTools in SceneBuilder, which only supports
        /// zero-argument methods for a plain (non-generic) UnityEvent.</summary>
        public void TriggerPattern()
        {
            if (patternPlayer != null)
            {
                patternPlayer.TriggerPatternById(patternId);
            }
        }
    }
}
