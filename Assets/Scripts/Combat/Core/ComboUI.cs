using UnityEngine;
using UnityEngine.UI;

namespace TouchRPG.Combat.Core
{
    /// <summary>Displays the current combo stage (GDD §4.4).</summary>
    public class ComboUI : MonoBehaviour
    {
        [SerializeField] private ComboController combo;
        [SerializeField] private Text comboText;

        private void Start()
        {
            if (combo == null)
            {
                return;
            }
            combo.OnStageChanged += HandleStageChanged;
            HandleStageChanged(combo.Stage);
        }

        private void HandleStageChanged(int stage)
        {
            if (comboText != null)
            {
                comboText.text = stage > 0 ? $"COMBO x{stage}" : string.Empty;
            }
        }
    }
}
