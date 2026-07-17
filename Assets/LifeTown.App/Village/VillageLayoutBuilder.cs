using UnityEngine;
using LifeTown.App.BuildingKit;
using LifeTown.App.Buildings;

namespace LifeTown.App.Village
{
    /// <summary>
    /// T007's first village slice: places all 7 category cottages (each already its own
    /// approved cottage-built-from-material archetype) on one shared ground plot as a
    /// single cohesive scene, instead of 7 isolated per-building renders. Pure
    /// composition/layout -- every building is built by calling its own existing
    /// `Build(parent, footprintCenter)` unchanged, then the whole returned root is
    /// rotated in place where a facing needs to flip. No new building geometry, no
    /// gameplay, no data hookup (that's explicitly out of scope for this pass).
    ///
    /// Layout: two gently staggered rows framing a small central plaza/path, storybook
    /// -village style rather than a rigid grid --
    ///   - FRONT row (closer to camera, +Z): Library, Study, Gym, Work -- rotated 180
    ///     degrees so their doors face back toward the plaza (they'd otherwise face
    ///     away from the village, out toward the camera).
    ///   - BACK row (-Z), gap-staggered against the front row so nothing lines up in a
    ///     rigid grid: Hobby, Mind, Game -- kept at their natural orientation, whose
    ///     doors already face +Z, i.e. also toward the plaza.
    ///   Every door therefore faces the shared central path, the classic "village green"
    ///   read, and every roof icon still reads clearly above its own building.
    /// A central path (a flat sandy strip + loose stepping-stone blobs) runs along the
    /// row gap, and a handful of cheap plaza props (two trees, two lamp posts, one
    /// bench -- all built from existing accent-box/accent-blob primitives, no new
    /// BuildingKit additions needed) tie the plaza together without over-building.
    /// </summary>
    public static class VillageLayoutBuilder
    {
        /// <summary>Half-extent (X) of the row of building centers -- used both to place
        /// buildings and to size the ground plane/path/camera framing around them.</summary>
        public const float RowHalfSpanX = 3.3f;
        public const float RowZ = 1.3f;

        public static GameObject Build(Transform parent)
        {
            var root = new GameObject("Village");
            root.transform.SetParent(parent, false);

            // ---- Front row: doors rotated to face the plaza (-Z becomes their "out"
            // direction after a 180-degree turn around their own footprint center). ----
            FaceInward(LibraryBuildingBuilder.Build(root.transform, new Vector3(-RowHalfSpanX, 0f, RowZ)));
            FaceInward(StudyBuildingBuilder.Build(root.transform, new Vector3(-RowHalfSpanX / 3f, 0f, RowZ)));
            FaceInward(GymBuildingBuilder.Build(root.transform, new Vector3(RowHalfSpanX / 3f, 0f, RowZ)));
            FaceInward(WorkBuildingBuilder.Build(root.transform, new Vector3(RowHalfSpanX, 0f, RowZ)));

            // ---- Back row: natural orientation already faces +Z, i.e. also toward the
            // plaza -- staggered against the front row's 4-wide spacing by using 3
            // evenly-spaced slots instead, so nothing lines up in a rigid grid. ----
            HobbyBuildingBuilder.Build(root.transform, new Vector3(-RowHalfSpanX * 0.66f, 0f, -RowZ));
            MindBuildingBuilder.Build(root.transform, new Vector3(0f, 0f, -RowZ));
            GameBuildingBuilder.Build(root.transform, new Vector3(RowHalfSpanX * 0.66f, 0f, -RowZ));

            BuildPath(root.transform);
            BuildPlazaProps(root.transform);

            return root;
        }

        /// <summary>Turns a just-built cottage 180 degrees around its own footprint
        /// center (its own world position, already set by Build) so its door -- always
        /// authored facing +Z -- faces -Z instead. Every cottage's front wall is
        /// left-right symmetric (windows/gable mirrored around its own center), so this
        /// flip reads as a clean about-face, not a lopsided rebuild.</summary>
        static void FaceInward(GameObject builtRoot)
        {
            builtRoot.transform.rotation = Quaternion.Euler(0f, 180f, 0f);
        }

        /// <summary>A warm sandy path connecting the two rows through the plaza gap: one
        /// flat ribbon along the row axis plus a scatter of flattened stepping-stone
        /// blobs for a cobble cue -- cheap, matches every other "flatten a blob" texture
        /// trick already used throughout BuildingPrimitives.</summary>
        static void BuildPath(Transform parent)
        {
            Color pathColor = CategoryPalette.FromHex("#D9C6A0");
            Color stoneColor = CategoryPalette.FromHex("#C9B48A");

            BuildingPrimitives.CreateAccentBox("VillagePath", parent,
                new Vector3(RowHalfSpanX * 2f + 0.8f, 0.006f, RowZ * 2f - 0.35f),
                new Vector3(0f, 0.001f, 0f), pathColor);

            for (int i = -4; i <= 4; i++)
            {
                float x = i * (RowHalfSpanX * 2f / 8f);
                var stone = BuildingPrimitives.CreateAccentBlob($"PathStone{i}", parent, 0.08f,
                    new Vector3(x, 0.004f, (i % 2 == 0) ? 0.15f : -0.15f), stoneColor);
                stone.transform.localScale = new Vector3(1f, 0.12f, 0.9f);
            }
        }

        // Kept well inside the plaza gap (small |X|, near Z=0) and short -- round-1
        // evidence: trees placed further out at the back row's own X (+/-2.178) sat
        // right in the iso camera's sightline to the front row's own roof icons (the
        // Work cottage's briefcase was almost entirely hidden behind a tree canopy at
        // that position), even though the tree was nowhere near the building in world
        // space -- true-iso projection can put a near-camera foreground prop directly
        // over a far building's roofline on screen. Centering props tightly around the
        // plaza avoids every building's own roof-icon sightline instead of relying on
        // trial-and-error per building.
        static void BuildPlazaProps(Transform parent)
        {
            BuildTree(parent, new Vector3(-0.75f, 0f, 0f));
            BuildTree(parent, new Vector3(0.75f, 0f, 0f));
            BuildLampPost(parent, new Vector3(-1.85f, 0f, 0.15f));
            BuildLampPost(parent, new Vector3(1.85f, 0f, 0.15f));
            BuildBench(parent, new Vector3(0f, 0f, 0.42f));
        }

        static void BuildTree(Transform parent, Vector3 baseCenter)
        {
            Color trunk = CategoryPalette.FromHex("#6B4A2D");
            Color leaf = CategoryPalette.FromHex("#5FA06A");
            Color leafLight = CategoryPalette.FromHex("#7BC96F");

            Vector3 trunkSize = new Vector3(0.05f, 0.17f, 0.05f);
            BuildingPrimitives.CreateAccentBox("TreeTrunk", parent, trunkSize, baseCenter, trunk);

            var canopy = BuildingPrimitives.CreateAccentBlob("TreeCanopy", parent, 0.14f,
                new Vector3(baseCenter.x, baseCenter.y + trunkSize.y + 0.10f, baseCenter.z), leaf);
            canopy.transform.localScale = new Vector3(1f, 1.15f, 1f);

            var canopyTop = BuildingPrimitives.CreateAccentBlob("TreeCanopyTop", parent, 0.09f,
                new Vector3(baseCenter.x + 0.04f, baseCenter.y + trunkSize.y + 0.20f, baseCenter.z + 0.02f), leafLight);
            canopyTop.transform.localScale = new Vector3(1f, 1.05f, 1f);
        }

        static void BuildLampPost(Transform parent, Vector3 baseCenter)
        {
            Color poleColor = CategoryPalette.FromHex("#3A3D57");
            Color glowColor = CategoryPalette.FromHex("#FFCE7A");

            Vector3 poleSize = new Vector3(0.025f, 0.30f, 0.025f);
            BuildingPrimitives.CreateAccentBox("LampPole", parent, poleSize, baseCenter, poleColor);
            BuildingPrimitives.CreateAccentBox("LampArm", parent, new Vector3(0.05f, 0.018f, 0.018f),
                new Vector3(baseCenter.x, baseCenter.y + poleSize.y, baseCenter.z), poleColor);

            var glow = BuildingPrimitives.CreateAccentBlob("LampGlow", parent, 0.032f,
                new Vector3(baseCenter.x, baseCenter.y + poleSize.y + 0.01f, baseCenter.z), glowColor);
            glow.transform.localScale = new Vector3(1f, 0.85f, 1f);
        }

        static void BuildBench(Transform parent, Vector3 baseCenter)
        {
            Color woodColor = CategoryPalette.FromHex("#8B6B4A");

            BuildingPrimitives.CreateAccentBox("BenchSeat", parent, new Vector3(0.24f, 0.02f, 0.09f),
                new Vector3(baseCenter.x, baseCenter.y + 0.05f, baseCenter.z), woodColor);
            BuildingPrimitives.CreateAccentBox("BenchBack", parent, new Vector3(0.24f, 0.09f, 0.016f),
                new Vector3(baseCenter.x, baseCenter.y + 0.07f, baseCenter.z - 0.04f), woodColor);

            foreach (var side in new[] { -1f, 1f })
            {
                BuildingPrimitives.CreateAccentBox($"BenchLeg{(side < 0f ? "L" : "R")}", parent,
                    new Vector3(0.02f, 0.05f, 0.09f),
                    new Vector3(baseCenter.x + side * 0.10f, baseCenter.y, baseCenter.z), woodColor);
            }
        }
    }
}
