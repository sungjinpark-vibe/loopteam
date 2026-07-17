using System.Linq;
using UnityEngine;

namespace TouchRPG.Combat.Pattern
{
    /// <summary>
    /// GDD §3/§7.2: "패턴 시트 = 몬스터 1종의 전체 패턴 정의표 (§7 람팡 시트가 표준 양식)".
    /// A container of <see cref="MonsterPatternStep"/> assets for one monster. Any future
    /// monster reuses this exact class - only the step assets it references change.
    /// </summary>
    [CreateAssetMenu(fileName = "MonsterPatternSheet", menuName = "TouchRPG/Combat/Monster Pattern Sheet")]
    public class MonsterPatternSheet : ScriptableObject
    {
        public string monsterId = "lampang";
        public string displayName = "람팡";
        public MonsterPatternStep[] steps;

        public MonsterPatternStep[] GetStepsForPhase(int phase)
        {
            if (steps == null)
            {
                return System.Array.Empty<MonsterPatternStep>();
            }
            return steps.Where(s => s != null && s.minPhase <= phase).ToArray();
        }
    }
}
