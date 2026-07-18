using UnityEngine;

namespace TouchRPG.Combat.Pattern
{
    /// <summary>
    /// Isolates P4's real/fake 50/50 pick (GDD §7.2: "볼주머니 페이크... 참는 판단 요구")
    /// plus its dev/QA-only forced-outcome override from MonsterPatternPlayer's
    /// coroutine-driving responsibilities - split out for the same single-responsibility
    /// reason as FailureDamageResolver. Plain C# class (no MonoBehaviour/ScriptableObject
    /// needed): it holds one piece of short-lived state and has no scene lifecycle.
    /// </summary>
    public class P4FakeOutcomePicker
    {
        private bool? _forcedOverride;

        /// <summary>Dev/QA-only: forces the NEXT resolution to be real or fake instead of
        /// the normal 50/50 randomness. Consumed once, then reverts to random.</summary>
        public void ForceNext(bool isReal)
        {
            _forcedOverride = isReal;
        }

        public bool ResolveIsReal()
        {
            if (_forcedOverride.HasValue)
            {
                bool result = _forcedOverride.Value;
                _forcedOverride = null;
                return result;
            }
            // PROVISIONAL 50/50 - GDD names no fake frequency number, only the qualitative
            // "참는 판단 요구" rhythm note. Team-discretion staging value.
            return Random.value < 0.5f;
        }
    }
}
