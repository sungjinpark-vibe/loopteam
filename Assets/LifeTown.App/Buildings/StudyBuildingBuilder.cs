using UnityEngine;
using LifeTown.App.BuildingKit;
using LifeTown.App.Scene;

namespace LifeTown.App.Buildings
{
    /// <summary>
    /// Study (공부/Study category) -- third sibling in the cottage-built-from-<i>material</i>
    /// archetype (see <see cref="LibraryBuildingBuilder"/>, the gold density reference, and
    /// <see cref="GymBuildingBuilder"/>, the roof-icon reference). Matches both 1:1 in
    /// massing (same body/roof size/position, door/window layout, chimney, tier-ring
    /// convention) -- only the "material" theme changes, books/equipment to stationery:
    ///
    /// 1. Walls = a DENSE notebook shelf (<see cref="BuildingPrimitives.CreateItemWall"/>
    ///    driving <see cref="BuildingPrimitives.CreateNotebook"/>), packed edge to edge and
    ///    filling the full cell height exactly the way the Library's book spines do --
    ///    the explicit fix for the Gym round's "reads sparse" lesson: every cell is sized
    ///    from colWidth/rowHeight directly, never a small centered prop with backing
    ///    showing around it. A minority of cells are pencil bundles (3 pencils shoulder to
    ///    shoulder, also filling the full cell width) or a ruler laid flat, the stationery
    ///    set's answer to the Library's horizontal book wedges.
    /// 2. Roof = a PLAIN warm gable (same "keep the roof simple, let the ridge icon carry
    ///    the read" rule the Gym's brief established) topped by a graduation cap
    ///    (<see cref="BuildingPrimitives.CreateGraduationCap"/>) -- the single silhouette
    ///    element that says "Study" at a glance.
    /// 3. Coquette touch: exactly one pink pencil, loose on the ground by the entrance
    ///    (every wall/wall-cluster pencil stays in the non-pink stationery palette).
    /// 4. Cozy extras matching the Library/Gym list: warm amber-glass arched windows, a
    ///    chimney with smoke, a potted plant, a hanging sign with a small pencil emblem,
    ///    and loose notebook/pencil clusters on the ground by the entrance.
    ///
    /// Tier ring uses the category's own tone (study-blue #6FD0E8), matching the
    /// Gym's "ring stays category identity color" convention.
    /// </summary>
    public static class StudyBuildingBuilder
    {
        public static GameObject Build(Transform parent, Vector3 footprintCenter)
        {
            var root = new GameObject("Study (공부 Tier1-S3)");
            root.transform.SetParent(parent, false);
            root.transform.position = footprintCenter;

            var colors = CategoryPalette.Get(BuildingCategory.Study);

            // Fresh school-bright notebook covers -- deliberately non-pink (the coquette
            // pink is reserved for the single loose ground pencil), warm and varied so the
            // wall doesn't repeat visibly, same "several hues, no two adjacent alike"
            // approach the Library's spine palette uses.
            Color[] notebookColors =
            {
                CategoryPalette.FromHex("#E8637A"), // coral red
                CategoryPalette.FromHex("#4FA8D8"), // sky blue
                CategoryPalette.FromHex("#F2B134"), // marigold
                CategoryPalette.FromHex("#7BC96F"), // leaf green
                CategoryPalette.FromHex("#A97FD1"), // violet
                CategoryPalette.FromHex("#3FA79A"), // teal
            };
            Color spiralColor = CategoryPalette.FromHex("#C9CDD3");   // metal spiral binding
            Color pageColor = CategoryPalette.FromHex("#FBF1DE");     // consistent cream across every cottage
            Color pencilBody = CategoryPalette.FromHex("#F2B134");    // classic pencil yellow
            Color pencilTip = CategoryPalette.FromHex("#C98B4B");     // warm wood tip
            Color[] eraserColors = { CategoryPalette.FromHex("#E8637A"), CategoryPalette.FromHex("#7BC96F"), CategoryPalette.FromHex("#4FA8D8") };
            Color rulerBody = CategoryPalette.FromHex("#F2C879");     // pale amber plastic
            Color rulerMark = CategoryPalette.FromHex("#4A3220");
            Color wallBacking = CategoryPalette.FromHex("#5C4430");   // same warm wood backing every cottage shares
            Color woodTrim = CategoryPalette.FromHex("#8B6B4A");
            Color roofCover = CategoryPalette.FromHex("#C98A5C");     // warm cedar -- plain roof, per the Gym's own "keep it simple, ridge carries the icon" rule
            Color capColor = CategoryPalette.FromHex("#3A3D57");      // graduation-cap navy/charcoal
            Color capTrim = CategoryPalette.FromHex("#F2B134");       // gold button/tassel
            Color windowFrame = CategoryPalette.FromHex("#5C4430");
            Color windowGlow = CategoryPalette.FromHex("#FFCE7A");
            Color doorColor = CategoryPalette.FromHex("#4A3220");
            Color stoneColor = CategoryPalette.FromHex("#9C8878");
            Color smokeColor = new Color(0.88f, 0.88f, 0.86f, 1f);
            Color potColor = CategoryPalette.FromHex("#B5602E");
            Color leafColor = CategoryPalette.FromHex("#5FA06A");
            Color pencilPink = CategoryPalette.PrimaryPink;
            Color tierRingColor = colors.Base500;

            Vector3 baseOrigin = root.transform.position;

            // ---- Cottage body: identical size to the Library/Gym's, matching massing 1:1. ----
            Vector3 bodySize = new Vector3(1.30f, 0.50f, 1.00f);
            BuildingPrimitives.CreateShadedBox("CottageWalls", root.transform, bodySize, baseOrigin, woodTrim);
            float wallTopY = baseOrigin.y + bodySize.y;
            float frontZ = baseOrigin.z + bodySize.z * 0.5f;
            float sideX = baseOrigin.x + bodySize.x * 0.5f;

            // ---- Front + side walls: dense notebook/pencil/ruler cladding. ----
            Vector3 frontWallSize = new Vector3(bodySize.x * 0.93f, bodySize.y * 0.74f, 0.05f);
            Vector3 frontWallBase = new Vector3(baseOrigin.x, baseOrigin.y + bodySize.y * 0.10f, frontZ + 0.012f);
            BuildingPrimitives.CreateItemWall("FrontStationery", root.transform, frontWallSize, frontWallBase, wallBacking, columns: 10, rows: 2,
                (cellParent, cx, rowBaseY, rowHeight, colWidth, depth, cellFrontZ, seed) =>
                    BuildStationeryCell(cellParent, cx, rowBaseY, rowHeight, colWidth, depth, cellFrontZ, seed,
                        notebookColors, spiralColor, pageColor, pencilBody, pencilTip, eraserColors, rulerBody, rulerMark));

            Vector3 sideWallSize = new Vector3(bodySize.z * 0.90f, bodySize.y * 0.74f, 0.05f);
            Vector3 sideWallBase = new Vector3(sideX + 0.012f, baseOrigin.y + bodySize.y * 0.10f, baseOrigin.z);
            var sideWall = BuildingPrimitives.CreateItemWall("SideStationery", root.transform, sideWallSize, sideWallBase, wallBacking, columns: 6, rows: 2,
                (cellParent, cx, rowBaseY, rowHeight, colWidth, depth, cellFrontZ, seed) =>
                    BuildStationeryCell(cellParent, cx, rowBaseY, rowHeight, colWidth, depth, cellFrontZ, seed,
                        notebookColors, spiralColor, pageColor, pencilBody, pencilTip, eraserColors, rulerBody, rulerMark));
            sideWall.transform.rotation = Quaternion.Euler(0f, 90f, 0f);

            // ---- Roof: plain warm gable, same size/position as the Library/Gym's. ----
            Vector3 roofBaseCenter = new Vector3(baseOrigin.x, wallTopY, baseOrigin.z);
            Vector3 roofSize = new Vector3(1.66f, 0.48f, 1.20f);
            BuildingPrimitives.CreateGableRoof("Roof", root.transform, roofSize, roofBaseCenter, roofCover);
            float ridgeTopY = wallTopY + roofSize.y;

            // ---- Ridge icon: a graduation cap perched at the ridge peak -- the "reads
            // Study at a glance" element, the Gym's barbell / Library's open-book roof
            // played straight for a category with no "roof surface" equivalent. ----
            Vector3 capCenter = new Vector3(baseOrigin.x, ridgeTopY + 0.02f, baseOrigin.z);
            BuildingPrimitives.CreateGraduationCap("RidgeCap", root.transform, capCenter, boardSize: 0.52f, thickness: 0.03f, capColor, capTrim, capTrim);

            // ---- Door + hanging sign with a small pencil emblem. ----
            BuildingPrimitives.CreateArchedWindow("Door", root.transform,
                paneWidth: 0.20f, paneHeight: 0.28f, paneDepth: 0.05f,
                paneBottomCenter: new Vector3(baseOrigin.x, baseOrigin.y, frontZ + 0.05f),
                frameColor: doorColor, glassColor: doorColor);
            BuildHangingSign(root.transform, new Vector3(baseOrigin.x, baseOrigin.y + 0.34f, frontZ + 0.05f), doorColor, pencilBody, pencilTip);

            // ---- Windows: warm amber-glass arches flanking the door. ----
            float windowY = baseOrigin.y + bodySize.y * 0.40f;
            float windowXOffset = bodySize.x * 0.30f;
            float windowFrontZ = frontZ + 0.05f;
            foreach (float side in new[] { -1f, 1f })
            {
                string tag = side < 0f ? "L" : "R";
                float wx = baseOrigin.x + windowXOffset * side;
                Vector3 paneBottomCenter = new Vector3(wx, windowY, windowFrontZ);
                BuildingPrimitives.CreateArchedWindow($"Window{tag}", root.transform,
                    paneWidth: 0.14f, paneHeight: 0.16f, paneDepth: 0.04f, paneBottomCenter, windowFrame, windowGlow);
            }

            // ---- Chimney. ----
            Vector3 chimneyBase = new Vector3(baseOrigin.x + 0.34f, ridgeTopY - 0.10f, baseOrigin.z - 0.18f);
            BuildChimney(root.transform, chimneyBase, stoneColor, smokeColor);

            // ---- Entrance dressing: potted plant, notebook + pencil-bundle ground
            // clusters, and the single coquette pink pencil. ----
            BuildPottedPlant(root.transform, new Vector3(baseOrigin.x + 0.40f, baseOrigin.y, frontZ + 0.10f), potColor, leafColor);

            BuildNotebookStack(root.transform, "GroundStackA", new Vector3(baseOrigin.x - 0.46f, baseOrigin.y, frontZ + 0.02f), notebookColors, spiralColor, pageColor, 3, 1);
            BuildNotebookStack(root.transform, "GroundStackB", new Vector3(baseOrigin.x - 0.60f, baseOrigin.y, frontZ - 0.05f), notebookColors, spiralColor, pageColor, 2, 4);
            BuildingPrimitives.CreatePencil("GroundPencilYellow", root.transform,
                new Vector3(sideX + 0.03f, baseOrigin.y + 0.011f, baseOrigin.z + 0.32f), Vector3.forward,
                length: 0.22f, thickness: 0.024f, pencilBody, pencilTip, eraserColors[0]);

            // ---- Coquette touch: exactly one pink pencil, loose by the entrance. ----
            BuildingPrimitives.CreatePencil("CoquettePencil", root.transform,
                new Vector3(baseOrigin.x - 0.30f, baseOrigin.y + 0.009f, frontZ + 0.16f), Vector3.right,
                length: 0.18f, thickness: 0.02f, pencilPink, pencilTip, pencilPink);

            // ---- Tier ring: category's own tone. ----
            MeshPrimitives.CreateFlatRing(
                "TierRing", root.transform,
                0.85f, 0.95f,
                new Vector3(baseOrigin.x, baseOrigin.y + 0.01f, baseOrigin.z),
                tierRingColor);

            return root;
        }

        /// <summary>One packed stationery cell: mostly notebooks (varied cover color and
        /// height, same "shortfall reads as a shelf" idea the Library's spines use, though
        /// notebooks never leave a shortfall gap here since every notebook already fills
        /// nearly the full cell), a minority split between a shoulder-to-shoulder pencil
        /// bundle and a flat ruler.</summary>
        static void BuildStationeryCell(Transform parent, float cellCenterX, float rowBaseY, float rowHeight, float colWidth, float depth, float cellFrontZ, int seed,
            Color[] notebookColors, Color spiralColor, Color pageColor, Color pencilBody, Color pencilTip, Color[] eraserColors, Color rulerBody, Color rulerMark)
        {
            float itemZ = cellFrontZ - depth * 0.28f;
            int cellType = seed % 5;

            if (cellType == 4 && (seed / 5) % 2 == 0)
            {
                int count = 3;
                float pencilThickness = (colWidth * 0.86f) / count;
                float pencilLength = rowHeight * 0.94f;
                for (int i = 0; i < count; i++)
                {
                    float x = cellCenterX - colWidth * 0.43f + pencilThickness * (i + 0.5f);
                    BuildingPrimitives.CreatePencil($"Pencil_{seed}_{i}", parent,
                        new Vector3(x, rowBaseY + pencilLength * 0.5f, itemZ), Vector3.up, pencilLength, pencilThickness * 0.72f,
                        pencilBody, pencilTip, eraserColors[(seed + i) % eraserColors.Length]);
                }
            }
            else if (cellType == 4)
            {
                BuildingPrimitives.CreateRuler($"Ruler_{seed}", parent,
                    new Vector3(cellCenterX, rowBaseY + rowHeight * 0.28f, itemZ), Vector3.right,
                    colWidth * 0.92f, rowHeight * 0.20f, depth * 0.5f, rulerBody, rulerMark);
            }
            else
            {
                int heightBucket = seed % 4;
                float heightFactor = Mathf.Min(0.72f + heightBucket * 0.09f, 0.98f);
                float h = rowHeight * heightFactor;
                Color cover = notebookColors[seed % notebookColors.Length];
                BuildingPrimitives.CreateNotebook($"Notebook_{seed}", parent,
                    new Vector3(colWidth * 0.88f, h, depth * 0.5f),
                    new Vector3(cellCenterX, rowBaseY, itemZ), cover, spiralColor, pageColor);
            }
        }

        static void BuildChimney(Transform parent, Vector3 baseCenter, Color stoneColor, Color smokeColor)
        {
            Vector3 chimneySize = new Vector3(0.09f, 0.16f, 0.09f);
            BuildingPrimitives.CreateShadedBox("Chimney", parent, chimneySize, baseCenter, stoneColor);
            float topY = baseCenter.y + chimneySize.y;
            BuildingPrimitives.CreateAccentBlob("SmokePuff1", parent, 0.032f, new Vector3(baseCenter.x, topY + 0.03f, baseCenter.z), smokeColor);
            BuildingPrimitives.CreateAccentBlob("SmokePuff2", parent, 0.048f, new Vector3(baseCenter.x + 0.02f, topY + 0.09f, baseCenter.z), smokeColor);
        }

        /// <summary>A small wooden sign hanging from a short bracket, with a tiny pencil
        /// emblem in front of it -- the Study cottage's door-sign accent, matching the
        /// Gym's dumbbell-emblem sign.</summary>
        static void BuildHangingSign(Transform parent, Vector3 doorTopCenter, Color woodColor, Color pencilBody, Color pencilTip)
        {
            Vector3 bracketSize = new Vector3(0.03f, 0.03f, 0.05f);
            BuildingPrimitives.CreateAccentBox("SignBracket", parent, bracketSize, doorTopCenter, woodColor);
            Vector3 signSize = new Vector3(0.22f, 0.055f, 0.02f);
            Vector3 signBase = new Vector3(doorTopCenter.x, doorTopCenter.y + bracketSize.y - 0.015f, doorTopCenter.z + 0.02f);
            BuildingPrimitives.CreateAccentBox("SignBoard", parent, signSize, signBase, woodColor);

            Vector3 emblemCenter = new Vector3(doorTopCenter.x, signBase.y + signSize.y * 2.0f, signBase.z + 0.015f);
            BuildingPrimitives.CreatePencil("SignEmblem", parent, emblemCenter, Vector3.right, length: 0.11f, thickness: 0.014f, pencilBody, pencilTip, pencilBody);
        }

        static void BuildPottedPlant(Transform parent, Vector3 baseCenter, Color potColor, Color leafColor)
        {
            Vector3 potSize = new Vector3(0.07f, 0.06f, 0.07f);
            BuildingPrimitives.CreateAccentBox("PlantPot", parent, potSize, baseCenter, potColor);
            var leaf = BuildingPrimitives.CreateAccentBlob("PlantLeaf", parent, 0.055f,
                new Vector3(baseCenter.x, baseCenter.y + potSize.y + 0.035f, baseCenter.z), leafColor);
            leaf.transform.localScale = new Vector3(1f, 1.3f, 1f);
        }

        /// <summary>A loose stack of `count` notebooks (<see cref="BuildingPrimitives.CreateNotebook"/>),
        /// deterministically nudged/yawed by `seed` -- the ground-level counterpart to
        /// <see cref="LibraryBuildingBuilder"/>'s BuildBookPile.</summary>
        static void BuildNotebookStack(Transform parent, string name, Vector3 baseCenter, Color[] palette, Color spiralColor, Color pageColor, int count, int seed)
        {
            float currentY = baseCenter.y;
            float baseWidth = 0.15f, baseDepth = 0.02f, baseHeight = 0.05f;
            for (int i = 0; i < count; i++)
            {
                float shrink = 1f - i * 0.10f;
                Vector3 size = new Vector3(baseWidth * shrink, baseHeight * (0.9f + (i % 2) * 0.10f), baseDepth * shrink * 5f);
                float xNudge = ((seed + i * 5) % 7 - 3) * 0.006f;
                float zNudge = ((seed + i * 3) % 5 - 2) * 0.005f;
                Vector3 origin = new Vector3(baseCenter.x + xNudge, currentY, baseCenter.z + zNudge);
                Color cover = palette[(seed + i * 2) % palette.Length];

                var notebook = BuildingPrimitives.CreateNotebook($"{name}_Notebook{i}", parent, size, origin, cover, spiralColor, pageColor);
                float yaw = ((seed + i * 4) % 9 - 4) * 2.2f;
                notebook.transform.rotation = Quaternion.Euler(0f, yaw, 0f);

                currentY += size.y;
            }
        }
    }
}
