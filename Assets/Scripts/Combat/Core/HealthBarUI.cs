using UnityEngine;
using UnityEngine.UI;
using TouchRPG.Combat.Config;

namespace TouchRPG.Combat.Core
{
    /// <summary>
    /// GDD §5.1 / §6.1: HP bar with phase-boundary tick marks always visible
    /// ("페이즈 경계(70%, 35%)는 HP 바에 눈금으로 상시 노출한다"). Tick positions are read
    /// from <see cref="GameplayConfig"/> (§12 phase.boundaries), not hardcoded.
    /// </summary>
    public class HealthBarUI : MonoBehaviour
    {
        [SerializeField] private HealthController target;
        [SerializeField] private Image fillImage;
        [SerializeField] private RectTransform tickHighMark;
        [SerializeField] private RectTransform tickLowMark;
        [SerializeField] private GameplayConfig config;
        [SerializeField] private Text monsterNameText;
        [SerializeField] private string monsterDisplayName = "람팡";

        private void Start()
        {
            if (monsterNameText != null)
            {
                monsterNameText.text = monsterDisplayName;
            }

            if (config != null)
            {
                PositionTick(tickHighMark, config.phaseBoundaryHighPercent / 100f);
                PositionTick(tickLowMark, config.phaseBoundaryLowPercent / 100f);
            }

            if (target != null)
            {
                target.OnHealthChanged += HandleHealthChanged;
                HandleHealthChanged(target.CurrentHP, target.MaxHP);
            }
        }

        private static void PositionTick(RectTransform tick, float fraction)
        {
            if (tick == null)
            {
                return;
            }
            tick.anchorMin = new Vector2(fraction, 0f);
            tick.anchorMax = new Vector2(fraction, 1f);
            tick.anchoredPosition = Vector2.zero;
        }

        private void HandleHealthChanged(int current, int max)
        {
            if (fillImage != null)
            {
                fillImage.fillAmount = max <= 0 ? 0f : (float)current / max;
            }
        }
    }
}
