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

        /// <summary>
        /// Fires exactly once, the instant CurrentHP transitions from &gt;0 to 0 (e.g. a
        /// killing blow on the monster - GDD §5.1 phase 3 ends at HP 0%). Does NOT re-fire
        /// on subsequent TakeDamage calls once already at 0 - consumers (e.g. hunt
        /// completion) rely on this firing exactly once per depletion, not once per hit.
        /// </summary>
        public event Action OnDepleted;

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
            if (amount <= 0 || CurrentHP <= 0)
            {
                return;
            }
            int previous = CurrentHP;
            CurrentHP = Mathf.Max(0, CurrentHP - amount);
            OnHealthChanged?.Invoke(CurrentHP, maxHP);
            if (previous > 0 && CurrentHP == 0)
            {
                OnDepleted?.Invoke();
            }
        }
    }
}
