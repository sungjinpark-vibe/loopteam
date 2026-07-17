using UnityEngine;
using TouchRPG.Combat.Config;

namespace TouchRPG.Combat.Core
{
    /// <summary>Wires IN-1 basic-attack taps on any monster part to monster HP loss.</summary>
    public class MonsterController : MonoBehaviour
    {
        [SerializeField] private HealthController health;
        [SerializeField] private MonsterPartRegistry partRegistry;
        [SerializeField] private P0DemoNumbers demoNumbers;

        private void Awake()
        {
            if (partRegistry == null || partRegistry.Parts == null)
            {
                return;
            }
            foreach (var part in partRegistry.Parts)
            {
                if (part != null)
                {
                    part.OnBasicAttack += HandleBasicAttack;
                }
            }
        }

        private void HandleBasicAttack(MonsterPart part)
        {
            int damage = demoNumbers != null ? demoNumbers.basicAttackDamage : 1;
            health.TakeDamage(damage);
        }
    }
}
