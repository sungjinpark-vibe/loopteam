using UnityEngine;
using TouchRPG.Combat.Pattern;

namespace TouchRPG.Combat.Core
{
    /// <summary>Dev/QA-only demo control: pauses/resumes MonsterPatternPlayer's
    /// auto-cycling DriveLoop so a manual PatternTriggerButton trigger can be observed in
    /// isolation without the next auto-cycled step spawning on top of it.</summary>
    public class AutoPlayToggleButton : MonoBehaviour
    {
        [SerializeField] private MonsterPatternPlayer patternPlayer;

        public void ToggleAutoPlay()
        {
            if (patternPlayer != null)
            {
                patternPlayer.SetAutoPlayEnabled(!patternPlayer.AutoPlayEnabled);
            }
        }
    }
}
