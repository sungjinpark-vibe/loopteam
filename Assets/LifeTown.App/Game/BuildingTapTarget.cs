using UnityEngine;
using LifeTown.App.BuildingKit;

namespace LifeTown.App.Game
{
    /// <summary>
    /// Thin view-state holder a tapped village cottage carries: which category it is and
    /// its live level (for the growth cue). Owns no economy math and no persistence —
    /// <see cref="VillageController"/>/<see cref="SaveGameService"/> are the only writers;
    /// this just renders what <see cref="SetLevel"/> is told.
    ///
    /// The "visible growth" cue is two cheap, art-free signals rather than new sprites per
    /// level (no art resources exist for this yet — see class docs across the App layer
    /// for the standing "placeholder when art is missing" rule): the whole cottage scales
    /// up slightly per level, and a row of small category-coloured pips (one per level)
    /// floats above the roofline.
    /// </summary>
    public sealed class BuildingTapTarget : MonoBehaviour
    {
        public string CategoryId { get; private set; }
        public string BuildingId { get; private set; }
        public string DisplayName { get; private set; }
        public Color Color { get; private set; }
        public int CurrentLevel { get; private set; } = 1;

        Transform _pipRoot;
        float _baseTopOffset; // world-space (renderer top Y - transform.position.y) measured once at level-1 scale

        public void Init(CategoryDef def)
        {
            CategoryId = def.id;
            BuildingId = def.id; // MVP slice: one building per category — see SaveGameService's class doc
            DisplayName = def.displayName;
            Color = def.color;
            _baseTopOffset = ComputeRendererTopY() - transform.position.y;
        }

        public void SetLevel(int level)
        {
            CurrentLevel = Mathf.Max(1, level);
            transform.localScale = Vector3.one * (1f + 0.08f * (CurrentLevel - 1)); // Lv1 = 1.0x .. Lv5 = 1.32x
            RebuildPips();
        }

        void RebuildPips()
        {
            if (_pipRoot != null) Object.Destroy(_pipRoot.gameObject);
            var go = new GameObject("LevelPips");
            _pipRoot = go.transform;
            _pipRoot.SetParent(transform, false);

            float topY = transform.position.y + _baseTopOffset * transform.localScale.y + 0.12f;
            const float spacing = 0.10f;
            float startX = transform.position.x - spacing * (CurrentLevel - 1) * 0.5f;

            for (int i = 0; i < CurrentLevel; i++)
            {
                BuildingPrimitives.CreateAccentBlob($"Pip{i}", _pipRoot, 0.035f,
                    new Vector3(startX + i * spacing, topY, transform.position.z), Color);
            }
        }

        float ComputeRendererTopY()
        {
            var renderers = GetComponentsInChildren<Renderer>();
            if (renderers.Length == 0) return transform.position.y + 0.7f;

            float top = renderers[0].bounds.max.y;
            for (int i = 1; i < renderers.Length; i++)
                if (renderers[i].bounds.max.y > top) top = renderers[i].bounds.max.y;
            return top;
        }
    }
}
