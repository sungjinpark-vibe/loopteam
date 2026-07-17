using System;
using UnityEngine;

namespace TouchRPG.Combat.Core
{
    /// <summary>
    /// Minimal shared HP holder, used for both the monster and the player. Max HP is
    /// supplied by the caller (see TouchRPG.Combat.Config.P0DemoNumbers) rather than
    /// hardcoded here — this class only owns the current/max bookkeeping and events.
    /// </summary>
    public class HealthController : MonoBehaviour
    {
        [SerializeField] private int maxHP = 100;

        public int MaxHP => maxHP;
        public int CurrentHP { get; private set; }
        public float HpFraction => maxHP <= 0 ? 0f : (float)CurrentHP / maxHP;

        /// <summary>current, max</summary>
        public event Action<int, int> OnHealthChanged;

        private void Awake()
        {
            CurrentHP = maxHP;
        }

        public void Configure(int newMaxHP)
        {
            maxHP = newMaxHP;
            CurrentHP = newMaxHP;
            OnHealthChanged?.Invoke(CurrentHP, maxHP);
        }

        public void TakeDamage(int amount)
        {
            if (amount <= 0)
            {
                return;
            }
            CurrentHP = Mathf.Max(0, CurrentHP - amount);
            OnHealthChanged?.Invoke(CurrentHP, maxHP);
        }
    }
}
