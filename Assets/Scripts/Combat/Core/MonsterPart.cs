using System;
using UnityEngine;
using TouchRPG.Combat.Input;

namespace TouchRPG.Combat.Core
{
    /// <summary>
    /// One tappable monster body part (IN-1: "탭 몬스터 몸체(부위) = 기본 공격, 부위별 판정
    /// 존재"). Also the anchor target that parry markers attach to — GDD §6.1 (MUST):
    /// "패링 마커는 몬스터 부위에 앵커링". <see cref="PartId"/> is the key
    /// <see cref="TouchRPG.Combat.Pattern.MonsterPatternStep.anchorPartId"/> resolves
    /// against via <see cref="MonsterPartRegistry"/>.
    /// </summary>
    public class MonsterPart : MonoBehaviour, ITappable
    {
        [SerializeField] private string partId = "body";

        public string PartId => partId;
        public TapPriority Priority => TapPriority.MonsterPart;
        public bool IsTappable => isActiveAndEnabled;

        public event Action<MonsterPart> OnBasicAttack;

        public void OnTapped(Vector2 screenPosition)
        {
            OnBasicAttack?.Invoke(this);
        }
    }
}
