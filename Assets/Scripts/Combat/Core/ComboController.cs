using System;
using UnityEngine;
using TouchRPG.Combat.Config;

namespace TouchRPG.Combat.Core
{
    /// <summary>
    /// GDD §4.4: +1 stage per perfect parry (capped at the [TBD-1] provisional cap),
    /// good parries/dodges maintain but never raise, a hit resets to 0, and a
    /// successful cover action mitigates a reset to a floor(50%) loss instead
    /// (seam only in this task — no IN-7 caller exists in P0 solo content yet).
    /// </summary>
    public class ComboController : MonoBehaviour
    {
        [SerializeField] private GameplayConfig config;

        public int Stage { get; private set; }
        public event Action<int> OnStageChanged;

        public void Configure(GameplayConfig gameplayConfig)
        {
            config = gameplayConfig;
        }

        public void RegisterPerfect()
        {
            int cap = config != null ? config.comboCapStages_TBD1 : int.MaxValue;
            Stage = Mathf.Min(Stage + 1, cap);
            OnStageChanged?.Invoke(Stage);
        }

        public void RegisterGood()
        {
            // GDD §4.4: "굿 패링·회피 성공은 배율을 올리지 않고 유지만 한다." Intentional no-op.
        }

        public void RegisterHit()
        {
            if (config == null || config.comboResetOnHit)
            {
                Stage = 0;
                OnStageChanged?.Invoke(Stage);
            }
        }

        public void RegisterCoveredHit()
        {
            float mitigation = config != null ? config.coverMitigationFraction : 0.5f;
            Stage = Mathf.FloorToInt(Stage * mitigation);
            OnStageChanged?.Invoke(Stage);
        }

        public float CurrentDamageMultiplier => config != null ? config.GetDamageMultiplier(Stage) : 1f;
    }
}
