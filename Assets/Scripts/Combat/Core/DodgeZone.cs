using System;
using UnityEngine;
using UnityEngine.UI;
using TouchRPG.Combat.Input;

namespace TouchRPG.Combat.Core
{
    /// <summary>
    /// GDD §4.1/§6.2 IN-3: "회피 존... 탭 시 자동 대시." Visual language is MUST per §6.2:
    /// "회피 존: 청색 원 + 캐릭터로부터의 유도선 + 내부 시계방향 잔여시간 게이지." A tap inside
    /// the zone before its window expires triggers <see cref="PlayerToken.DashTo"/> (a fast
    /// automatic move out of the zone, away from its center); an unanswered zone resolves
    /// <see cref="DodgeResult.Miss"/> when its window closes. GDD §4.2 priority (parry &gt;
    /// dodge &gt; party &gt; monster &gt; ground) is enforced entirely by
    /// TapPriority/CombatInputController - this class only needs to report the right
    /// <see cref="TapPriority.DodgeZone"/> tier; nothing here changes when a marker
    /// overlaps it, which is exactly what makes the priority rule hold with no exceptions.
    /// </summary>
    public class DodgeZone : MonoBehaviour, ITappable
    {
        private const float GuideLineThicknessPixels = 6f;
        private const float DashClearMarginPixels = 40f;

        [SerializeField] private Image zoneImage;
        [SerializeField] private Image gaugeImage;
        [SerializeField] private Image tapArea;

        private RectTransform _self;
        private RectTransform _battlefieldPanel;
        private PlayerToken _playerToken;
        private RectTransform _guideLine;
        private Image _guideLineImage;

        private float _windowSeconds;
        private float _radiusPixels;
        private float _spawnTime;
        private bool _resolved;

        public event Action<DodgeZone, DodgeResult> OnResolved;

        public TapPriority Priority => TapPriority.DodgeZone;
        public bool IsTappable => !_resolved && isActiveAndEnabled;
        public bool IsResolved => _resolved;
        public DodgeResult Result { get; private set; }

        /// <summary>Battlefield-local anchored position - exposed so a failure outcome
        /// (e.g. P3's GDD §7.2 "중피해+넉백") can knock the player back AWAY from this
        /// zone's position without MonsterPatternPlayer reaching into a private field.</summary>
        public Vector2 LocalPosition => _self != null ? _self.anchoredPosition : Vector2.zero;

        private void Awake()
        {
            _self = (RectTransform)transform;
        }

        /// <param name="windowSeconds">GDD §4.3: "회피 존 | 존 표시 후 만료까지 탭 | 패턴별
        /// 표시 시간 상이" - always caller-supplied from GameplayConfig (e.g.
        /// dodgeZoneP3WindowSeconds/castP6WindowSeconds), never hardcoded here.</param>
        /// <param name="radiusPixels">Zone radius, used only to compute where the dash
        /// lands clear of the zone - PROVISIONAL staging value, not a judgment number.</param>
        public void Initialize(float windowSeconds, float radiusPixels, PlayerToken playerToken, RectTransform battlefieldPanel)
        {
            _windowSeconds = Mathf.Max(0.05f, windowSeconds);
            _radiusPixels = radiusPixels;
            _playerToken = playerToken;
            _battlefieldPanel = battlefieldPanel;
            _spawnTime = Time.time;
            _resolved = false;

            if (zoneImage != null)
            {
                // Translucent base fill so the brighter gauge on top (below) actually
                // reads as a distinct layer instead of matching pixel-for-pixel.
                var baseColor = GameplayColors.Dodge;
                baseColor.a = 0.35f;
                zoneImage.color = baseColor;
            }
            if (gaugeImage != null)
            {
                // Contrast TINT of the same Dodge channel (see GameplayColors.Brighten) -
                // this is what makes the clockwise remaining-time depletion (§6.2 MUST)
                // visible on screen instead of disappearing into an identical fill.
                gaugeImage.color = GameplayColors.Brighten(GameplayColors.Dodge);
                gaugeImage.type = Image.Type.Filled;
                gaugeImage.fillMethod = Image.FillMethod.Radial360;
                gaugeImage.fillClockwise = true;
                gaugeImage.fillAmount = 1f;
            }
            if (tapArea != null)
            {
                tapArea.raycastTarget = true;
            }

            BuildGuideLine();
        }

        private void BuildGuideLine()
        {
            if (_battlefieldPanel == null)
            {
                return;
            }
            var go = new GameObject("DodgeGuideLine", typeof(RectTransform));
            _guideLine = (RectTransform)go.transform;
            _guideLine.SetParent(_battlefieldPanel, false);
            _guideLine.anchorMin = new Vector2(0.5f, 0.5f);
            _guideLine.anchorMax = new Vector2(0.5f, 0.5f);
            _guideLine.pivot = new Vector2(0.5f, 0.5f);

            _guideLineImage = go.AddComponent<Image>();
            _guideLineImage.color = GameplayColors.Dodge;
            _guideLineImage.raycastTarget = false;
            UpdateGuideLine();
        }

        private void Update()
        {
            if (_resolved)
            {
                return;
            }

            float t = Mathf.Clamp01((Time.time - _spawnTime) / _windowSeconds);
            if (gaugeImage != null)
            {
                gaugeImage.fillAmount = 1f - t; // clockwise remaining-time depletion, GDD §6.2
            }
            UpdateGuideLine();

            if (t >= 1f)
            {
                Resolve(DodgeResult.Miss);
            }
        }

        private void UpdateGuideLine()
        {
            if (_guideLine == null || _playerToken == null)
            {
                return;
            }
            Vector2 playerPos = _playerToken.LocalPosition;
            Vector2 zonePos = _self.anchoredPosition;
            Vector2 delta = zonePos - playerPos;
            float distance = delta.magnitude;

            _guideLine.anchoredPosition = playerPos + delta * 0.5f;
            _guideLine.sizeDelta = new Vector2(distance, GuideLineThicknessPixels);
            float angle = Mathf.Atan2(delta.y, delta.x) * Mathf.Rad2Deg;
            _guideLine.localRotation = Quaternion.Euler(0f, 0f, angle);
        }

        public void OnTapped(Vector2 screenPosition)
        {
            if (_resolved)
            {
                return;
            }
            DashPlayerOut();
            Resolve(DodgeResult.Success);
        }

        private void DashPlayerOut()
        {
            if (_playerToken == null)
            {
                return;
            }
            Vector2 zonePos = _self.anchoredPosition;
            Vector2 playerPos = _playerToken.LocalPosition;
            Vector2 direction = playerPos - zonePos;
            if (direction.sqrMagnitude < 1f)
            {
                direction = Vector2.right; // fallback when spawned exactly on the player
            }
            direction.Normalize();

            Vector2 dashTarget = zonePos + direction * (_radiusPixels + DashClearMarginPixels);
            if (_battlefieldPanel != null)
            {
                float halfWidth = _battlefieldPanel.rect.width * 0.5f;
                dashTarget.x = Mathf.Clamp(dashTarget.x, -halfWidth, halfWidth);
            }
            _playerToken.DashTo(dashTarget);
        }

        private void Resolve(DodgeResult result)
        {
            _resolved = true;
            Result = result;
            if (tapArea != null)
            {
                tapArea.raycastTarget = false;
            }
            if (_guideLine != null)
            {
                Destroy(_guideLine.gameObject);
            }
            OnResolved?.Invoke(this, result);
            Destroy(gameObject, 0.3f);
        }
    }
}
