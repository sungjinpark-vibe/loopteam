using UnityEngine;

namespace TouchRPG.Combat.Core
{
    /// <summary>
    /// GDD §4.3 (MUST, externalized per GDD §0): classifies a tap against the parry
    /// windows. Pure function — the caller supplies the window widths (always read
    /// from <see cref="TouchRPG.Combat.Config.GameplayConfig"/>, never a literal here),
    /// which is what lets "edit the config, behavior changes" hold without touching
    /// this file at all.
    /// </summary>
    public static class JudgmentEvaluator
    {
        public static ParryJudgment Evaluate(float tapTime, float targetTime, float perfectWindowSeconds, float goodWindowSeconds)
        {
            float diff = Mathf.Abs(tapTime - targetTime);
            if (diff <= perfectWindowSeconds)
            {
                return ParryJudgment.Perfect;
            }
            if (diff <= goodWindowSeconds)
            {
                return ParryJudgment.Good;
            }
            return ParryJudgment.Miss;
        }
    }
}
