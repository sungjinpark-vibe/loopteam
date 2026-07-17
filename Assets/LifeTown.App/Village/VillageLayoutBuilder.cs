using UnityEngine;
using LifeTown.App.BuildingKit;
using LifeTown.App.Buildings;

namespace LifeTown.App.Village
{
    /// <summary>
    /// T007's village slice -- v2 polish pass on the v1 layout (director: "keep the
    /// buildings themselves unchanged -- only improve the arrangement, the ground, and
    /// the composition"). Every building is still built by calling its own existing
    /// `Build(parent, footprintCenter)` unchanged; only WHERE they're placed, HOW they're
    /// oriented, and what the ground under them looks like changed.
    ///
    /// Two v1 lessons this round fixes:
    ///
    /// 1. FACING. v1 rotated the front row 180 degrees so doors would face the plaza --
    ///    but every cottage's DENSE decorated wall (book spines/weight plates/notebooks/
    ///    paint/etc, built via CreateItemWall or CreateBookSpineWall/CreateEquipmentWall)
    ///    lives on the same two faces the door does (+Z front wall, +X side wall after
    ///    the side panel's own 90-degree rotate-in-place). Those are exactly the two
    ///    faces this iso camera (looking from the (1,1,1) octant) can see. Rotating a
    ///    building 180 degrees therefore doesn't just turn the door -- it turns the
    ///    DECORATED walls away from the camera too, showing the plain unclad back
    ///    instead (v1's "dense wall hidden, plain gable showing" bug). v2's fix: leave
    ///    every cottage at its natural, un-rotated orientation. +Z and +X already face
    ///    this exact camera by construction, so every building's richest wall reads
    ///    clearly, and it also reads as a coherent design choice (every house "faces the
    ///    same way", like a real village oriented for the sun) rather than a bug.
    ///
    /// 2. LAYOUT RHYTHM. v1's back row used an arbitrary *0.66 offset that didn't line
    ///    up cleanly against the front row's own spacing. v2 uses ONE shared spacing
    ///    unit (2.2) for both rows: front row at the unit's own +/-0.5/+/-1.5 multiples,
    ///    back row at the unit's +/-1/0 multiples -- which places every back-row
    ///    building exactly on the midpoint between two front-row buildings, a clean
    ///    checkerboard/brick rhythm instead of a near-miss stagger.
    ///
    /// Ground (docs/design/spike-village-v2.png's other big ask) is now built HERE, not
    /// by IsoSceneSetup (moved out of the generic scene helper since it's village
    /// composition, not scene furniture): a tri-toned grass-over-soil block (a visible
    /// bevel instead of v1's flat floating slab), soft tone-variation patches, a
    /// comb-shaped path (one east-west spine + a spur toward every building column),
    /// scattered flower tufts/small bushes/stepping stones, and grass blobs softening
    /// the plot's corners. Every tall prop (trees/lamps/bench) stays inside the same
    /// tight central safe-zone v1's fix landed on (small |X|, near Z=0) -- the
    /// iso-projection occlusion trap (a near-camera prop sitting in the sightline to a
    /// far building's roof icon) doesn't care how "designed" the rest of the layout is.
    /// </summary>
    public static class VillageLayoutBuilder
    {
        const float Spacing = 2.2f;
        const float RowZ = 1.3f;

        // Union of both rows' X columns, each tagged with its own row Z -- front row at
        // +/-0.5/+/-1.5 spacing multiples, back row at 0/+/-1 multiples, so every
        // back-row column sits exactly on the midpoint between two front-row columns
        // (a clean checkerboard rhythm, not an arbitrary stagger).
        static readonly (float x, float rowZ)[] FrontColumns = { (-1.5f * Spacing, RowZ), (-0.5f * Spacing, RowZ), (0.5f * Spacing, RowZ), (1.5f * Spacing, RowZ) };
        static readonly (float x, float rowZ)[] BackColumns = { (-Spacing, -RowZ), (0f, -RowZ), (Spacing, -RowZ) };

        public static GameObject Build(Transform parent)
        {
            var root = new GameObject("Village");
            root.transform.SetParent(parent, false);

            BuildGround(root.transform);

            // ---- Front row: natural orientation -- +Z decorated wall and door already
            // face this camera, no rotation needed (see class doc, lesson 1). ----
            LibraryBuildingBuilder.Build(root.transform, new Vector3(FrontColumns[0].x, 0f, RowZ));
            StudyBuildingBuilder.Build(root.transform, new Vector3(FrontColumns[1].x, 0f, RowZ));
            GymBuildingBuilder.Build(root.transform, new Vector3(FrontColumns[2].x, 0f, RowZ));
            WorkBuildingBuilder.Build(root.transform, new Vector3(FrontColumns[3].x, 0f, RowZ));

            // ---- Back row: same natural orientation -- their +Z front wall faces
            // toward the plaza/front row, so these doors read as facing the shared
            // space, while the front row's face the outer approach. ----
            HobbyBuildingBuilder.Build(root.transform, new Vector3(BackColumns[0].x, 0f, -RowZ));
            MindBuildingBuilder.Build(root.transform, new Vector3(BackColumns[1].x, 0f, -RowZ));
            GameBuildingBuilder.Build(root.transform, new Vector3(BackColumns[2].x, 0f, -RowZ));

            BuildPathNetwork(root.transform);
            BuildPlazaProps(root.transform);
            BuildGroundDetails(root.transform);

            return root;
        }

        // ================================================================
        // Ground: a tri-toned grass-over-soil block instead of v1's flat slab.
        // ================================================================

        const float GroundWidth = 9.8f;
        const float GroundDepth = 6.2f;
        const float GroundHeight = 0.20f;

        static void BuildGround(Transform parent)
        {
            Color grassTop = CategoryPalette.FromHex("#BFE6CC");
            Color grassEdge = CategoryPalette.FromHex("#A8D4B8"); // slightly deeper green at the visible top-edge bevel
            Color soilSide = CategoryPalette.FromHex("#C9A876");  // warm soil/sand -- the "this is land, not a decal" cue

            // Bottom-center convention like every other primitive in this kit: the box's
            // TOP face must land exactly at y=0 (where every building's own floor sits),
            // so its baseCenter is offset downward by the full height.
            BuildingPrimitives.CreateShadedBoxCustomTones("GroundBlock", parent,
                new Vector3(GroundWidth, GroundHeight, GroundDepth),
                new Vector3(0f, -GroundHeight, 0f),
                topColor: grassTop, frontColor: grassEdge, sideColor: soilSide);

            // Corner-softening blobs: flattened grass-tone domes overlapping the block's
            // four corners so the silhouette reads as an irregular plot edge rather than
            // a hard rectangle, without the cost of hand-authoring a chamfered mesh.
            foreach (var corner in new[] { (-1f, -1f), (-1f, 1f), (1f, -1f), (1f, 1f) })
            {
                var blob = BuildingPrimitives.CreateAccentBlob($"GroundCorner_{corner.Item1}_{corner.Item2}", parent, 0.9f,
                    new Vector3(corner.Item1 * GroundWidth * 0.5f, -0.02f, corner.Item2 * GroundDepth * 0.5f), grassTop);
                blob.transform.localScale = new Vector3(1f, 0.05f, 1f);
            }

            // Soft tone-variation patches: a handful of large, very flat, slightly
            // different-toned blobs resting on the grass -- subtle warmth/shade
            // variation instead of one flat fill, kept away from the building/path
            // footprints so they read as ground texture, not clutter.
            Color patchA = CategoryPalette.FromHex("#CFEAD6"); // a touch lighter/fresher
            Color patchB = CategoryPalette.FromHex("#AFDCC0"); // a touch deeper/shaded
            Vector2[] patchSpots =
            {
                new Vector2(-3.9f, 1.9f), new Vector2(3.9f, -1.9f), new Vector2(-3.6f, -2.0f),
                new Vector2(3.6f, 2.0f), new Vector2(0f, 2.5f), new Vector2(0f, -2.5f),
            };
            for (int i = 0; i < patchSpots.Length; i++)
            {
                var patch = BuildingPrimitives.CreateAccentBlob($"GrassPatch{i}", parent, 0.55f,
                    new Vector3(patchSpots[i].x, 0.003f, patchSpots[i].y), i % 2 == 0 ? patchA : patchB);
                patch.transform.localScale = new Vector3(1.5f, 0.03f, 1.1f);
            }
        }

        // ================================================================
        // Path: one east-west spine plus a spur toward every building column --
        // reads as a real path network connecting the whole plaza, not one strip.
        // ================================================================

        static void BuildPathNetwork(Transform parent)
        {
            Color pathColor = CategoryPalette.FromHex("#D9C6A0");
            Color stoneColor = CategoryPalette.FromHex("#C9B48A");

            BuildingPrimitives.CreateAccentBox("PathSpine", parent,
                new Vector3(Spacing * 3f + 0.6f, 0.008f, 0.42f),
                new Vector3(0f, 0.002f, 0f), pathColor);

            foreach (var col in FrontColumns)
            {
                float len = col.rowZ - 0.55f; // stop short of the tier ring, doesn't need to touch the door exactly
                BuildingPrimitives.CreateAccentBox($"PathSpurF_{col.x}", parent,
                    new Vector3(0.30f, 0.007f, len), new Vector3(col.x, 0.0015f, len * 0.5f), pathColor);
            }
            foreach (var col in BackColumns)
            {
                float len = -col.rowZ - 0.55f;
                BuildingPrimitives.CreateAccentBox($"PathSpurB_{col.x}", parent,
                    new Vector3(0.30f, 0.007f, len), new Vector3(col.x, 0.0015f, -len * 0.5f), pathColor);
            }

            // Stepping stones scattered along the spine for a cobble read.
            for (int i = -5; i <= 5; i++)
            {
                float x = i * (Spacing * 3f / 11f);
                var stone = BuildingPrimitives.CreateAccentBlob($"PathStone{i}", parent, 0.075f,
                    new Vector3(x, 0.005f, (i % 2 == 0) ? 0.13f : -0.13f), stoneColor);
                stone.transform.localScale = new Vector3(1f, 0.12f, 0.9f);
            }
        }

        // ================================================================
        // Plaza props: kept inside the same tight central safe-zone v1 landed on after
        // its own briefcase-occlusion fix (small |X|, near Z=0) -- true-iso projection
        // can put a near-camera prop directly over a far building's roofline regardless
        // of how far apart they are in world space, so "stay small and central" is the
        // reliable rule, not "avoid this one building's exact column".
        // ================================================================

        static void BuildPlazaProps(Transform parent)
        {
            BuildTree(parent, new Vector3(-0.75f, 0f, 0.05f));
            BuildTree(parent, new Vector3(0.75f, 0f, 0.05f));
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

        // ================================================================
        // Ground details: flower tufts / small bushes -- all low enough (well under
        // roofline height) that unlike trees/lamps they carry no roof-icon occlusion
        // risk no matter where they're scattered, so these are free to spread across
        // the whole plot for an "inviting, not clinical" ground.
        // ================================================================

        static void BuildGroundDetails(Transform parent)
        {
            Color[] petalColors =
            {
                CategoryPalette.FromHex("#E8637A"), CategoryPalette.FromHex("#F2B134"),
                CategoryPalette.FromHex("#4FA8D8"), CategoryPalette.FromHex("#FF9EC4"),
            };
            Vector2[] flowerSpots =
            {
                new Vector2(-2.7f, 0.55f), new Vector2(2.7f, -0.55f), new Vector2(-0.55f, -0.5f),
                new Vector2(0.55f, 0.55f), new Vector2(-3.8f, -0.4f), new Vector2(3.8f, 0.4f),
                new Vector2(-1.6f, -0.55f), new Vector2(1.6f, 0.55f),
            };
            for (int i = 0; i < flowerSpots.Length; i++)
                BuildFlowerTuft(parent, new Vector3(flowerSpots[i].x, 0f, flowerSpots[i].y), petalColors[i % petalColors.Length]);

            Color bushColor = CategoryPalette.FromHex("#5FA06A");
            Vector2[] bushSpots = { new Vector2(-1.65f, 1.0f), new Vector2(1.65f, -1.0f), new Vector2(0f, -1.9f) };
            foreach (var spot in bushSpots)
                BuildBush(parent, new Vector3(spot.x, 0f, spot.y), bushColor);
        }

        static void BuildFlowerTuft(Transform parent, Vector3 baseCenter, Color petalColor)
        {
            Color stemColor = CategoryPalette.FromHex("#5FA06A");
            var stem = BuildingPrimitives.CreateAccentBlob("FlowerStem", parent, 0.02f, baseCenter, stemColor);
            stem.transform.localScale = new Vector3(0.8f, 0.6f, 0.8f);

            foreach (var side in new[] { -1f, 0f, 1f })
            {
                var petal = BuildingPrimitives.CreateAccentBlob($"FlowerPetal{side}", parent, 0.022f,
                    new Vector3(baseCenter.x + side * 0.026f, baseCenter.y + 0.02f, baseCenter.z), petalColor);
                petal.transform.localScale = new Vector3(1f, 0.7f, 1f);
            }
        }

        static void BuildBush(Transform parent, Vector3 baseCenter, Color leafColor)
        {
            var bush = BuildingPrimitives.CreateAccentBlob("Bush", parent, 0.075f,
                new Vector3(baseCenter.x, baseCenter.y + 0.05f, baseCenter.z), leafColor);
            bush.transform.localScale = new Vector3(1.2f, 0.75f, 1.0f);
        }
    }
}
