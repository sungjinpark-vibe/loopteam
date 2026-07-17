using UnityEngine;

namespace TouchRPG.Combat.Core
{
    /// <summary>Resolves a pattern step's <c>anchorPartId</c> string to the actual monster
    /// part transform in the scene, so parry markers can anchor to it (GDD §6.1 MUST).</summary>
    public class MonsterPartRegistry : MonoBehaviour
    {
        [SerializeField] private MonsterPart[] parts;

        public Transform GetPartTransform(string partId)
        {
            if (parts == null)
            {
                return null;
            }
            foreach (var part in parts)
            {
                if (part != null && part.PartId == partId)
                {
                    return part.transform;
                }
            }
            return null;
        }

        public MonsterPart[] Parts => parts;
    }
}
