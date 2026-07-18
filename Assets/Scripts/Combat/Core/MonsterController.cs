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
                if (part == null)
                {
                    continue;
                }
                part.OnBasicAttack += HandleBasicAttack;
                if (part is ChargeAttackController charge)
                {
                    charge.OnChargedAttackReleased += HandleChargedAttack;
                }
            }
        }

        private void HandleBasicAttack(MonsterPart part)
        {
            int damage = demoNumbers != null ? demoNumbers.basicAttackDamage : 1;
            health.TakeDamage(damage);
        }

        /// <summary>IN-5 release (GDD §4.1): a full charge deals the dedicated charge
        /// damage number, kept separate from IN-1's basicAttackDamage so a charged hit
        /// is visibly heavier - "고딜·고리스크" (high damage, high risk).</summary>
        private void HandleChargedAttack()
        {
            int damage = demoNumbers != null ? demoNumbers.chargeAttackDamage : 1;
            health.TakeDamage(damage);
        }
    }
}
