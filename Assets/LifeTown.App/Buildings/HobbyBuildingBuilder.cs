using UnityEngine;
using LifeTown.App.BuildingKit;
using LifeTown.App.Scene;

namespace LifeTown.App.Buildings
{
    /// <summary>
    /// Hobby / creation (취미창작/Hobby category) -- fifth sibling in the
    /// cottage-built-from-<i>material</i> archetype (see <see cref="LibraryBuildingBuilder"/>
    /// for the density bar, <see cref="GymBuildingBuilder"/> for the roof-icon pattern).
    /// Matches both 1:1 in massing -- only the "material" theme changes, books/equipment
    /// to art supplies:
    ///
    /// 1. Walls = a DENSE art-supply cladding (<see cref="BuildingPrimitives.CreateItemWall"/>
    ///    cycling through 4 cell types every cell -- paint tubes, brush jars, palettes,
    ///    yarn balls), every item sized directly from the cell's own colWidth/rowHeight
    ///    so it fills the cell edge to edge, the Library-density fix applied consistently
    ///    across every one of these 5 new cottages.
    /// 2. Roof = a PLAIN warm gable topped by a big palette with a crossing paintbrush
    ///    (<see cref="BuildingPrimitives.CreatePaintPalette"/> + <see cref="BuildingPrimitives.CreateBrush"/>)
    ///    on the ridge -- "reads Hobby at a glance".
    /// 3. Coquette touch: exactly one pink yarn ball, loose on the ground by the entrance
    ///    (every wall dab/yarn stays in the rainbow-minus-pink palette).
    /// 4. Cozy extras matching the rest of the village: warm amber-glass arched windows,
    ///    a chimney with smoke, a potted plant, a hanging sign with a small brush emblem,
    ///    and a loose paint-tube/yarn cluster on the ground.
    ///
    /// Tier ring uses the category's own tone (sage-teal #6FBFA6).
    /// </summary>
    public static class HobbyBuildingBuilder
    {
        public static GameObject Build(Transform parent, Vector3 footprintCenter)
        {
            var root = new GameObject("Hobby (취미창작 Tier1-S3)");
            root.transform.SetParent(parent, false);
            root.transform.position = footprintCenter;

            var colors = CategoryPalette.Get(BuildingCategory.Hobby);

            // Rainbow-but-not-pink paint palette -- the coquette pink is reserved for the
            // single loose ground yarn ball.
            Color[] paintColors =
            {
                CategoryPalette.FromHex("#E4572E"), // poppy red
                CategoryPalette.FromHex("#F2B134"), // marigold
                CategoryPalette.FromHex("#6FBFA6"), // sage teal (category's own tone)
                CategoryPalette.FromHex("#4FA8D8"), // sky blue
                CategoryPalette.FromHex("#8B6DBF"), // violet
                CategoryPalette.FromHex("#7BC96F"), // leaf green
            };
            Color tubeCapColor = CategoryPalette.FromHex("#EDEAE0");   // off-white cap, most tubes share this
            Color jarColor = CategoryPalette.FromHex("#B7CFC9");       // pale glass-green jar
            Color brushHandle = CategoryPalette.FromHex("#8B6B4A");    // warm wood handle
            Color paletteWood = CategoryPalette.FromHex("#8B6B4A");
            Color yarnWrap = CategoryPalette.FromHex("#3A3D57");
            Color wallBacking = CategoryPalette.FromHex("#5C4430");
            Color woodTrim = CategoryPalette.FromHex("#8B6B4A");
            Color roofCover = CategoryPalette.FromHex("#C98A6A");      // plain warm terracotta roof, ridge carries the icon
            Color windowFrame = CategoryPalette.FromHex("#5C4430");
            Color windowGlow = CategoryPalette.FromHex("#FFCE7A");
            Color doorColor = CategoryPalette.FromHex("#4A3220");
            Color stoneColor = CategoryPalette.FromHex("#9C8878");
            Color smokeColor = new Color(0.88f, 0.88f, 0.86f, 1f);
            Color potColor = CategoryPalette.FromHex("#B5602E");
            Color leafColor = CategoryPalette.FromHex("#5FA06A");
            Color yarnPink = CategoryPalette.PrimaryPink;
            Color tierRingColor = colors.Base500;

            Vector3 baseOrigin = root.transform.position;

            Vector3 bodySize = new Vector3(1.30f, 0.50f, 1.00f);
            BuildingPrimitives.CreateShadedBox("CottageWalls", root.transform, bodySize, baseOrigin, woodTrim);
            float wallTopY = baseOrigin.y + bodySize.y;
            float frontZ = baseOrigin.z + bodySize.z * 0.5f;
            float sideX = baseOrigin.x + bodySize.x * 0.5f;

            Vector3 frontWallSize = new Vector3(bodySize.x * 0.93f, bodySize.y * 0.74f, 0.05f);
            Vector3 frontWallBase = new Vector3(baseOrigin.x, baseOrigin.y + bodySize.y * 0.10f, frontZ + 0.012f);
            BuildingPrimitives.CreateItemWall("FrontArt", root.transform, frontWallSize, frontWallBase, wallBacking, columns: 10, rows: 2,
                (cellParent, cx, rowBaseY, rowHeight, colWidth, depth, cellFrontZ, seed) =>
                    BuildArtCell(cellParent, cx, rowBaseY, rowHeight, colWidth, depth, cellFrontZ, seed, paintColors, tubeCapColor, jarColor, brushHandle, paletteWood, yarnWrap));

            Vector3 sideWallSize = new Vector3(bodySize.z * 0.90f, bodySize.y * 0.74f, 0.05f);
            Vector3 sideWallBase = new Vector3(sideX + 0.012f, baseOrigin.y + bodySize.y * 0.10f, baseOrigin.z);
            var sideWall = BuildingPrimitives.CreateItemWall("SideArt", root.transform, sideWallSize, sideWallBase, wallBacking, columns: 6, rows: 2,
                (cellParent, cx, rowBaseY, rowHeight, colWidth, depth, cellFrontZ, seed) =>
                    BuildArtCell(cellParent, cx, rowBaseY, rowHeight, colWidth, depth, cellFrontZ, seed, paintColors, tubeCapColor, jarColor, brushHandle, paletteWood, yarnWrap));
            sideWall.transform.rotation = Quaternion.Euler(0f, 90f, 0f);

            Vector3 roofBaseCenter = new Vector3(baseOrigin.x, wallTopY, baseOrigin.z);
            Vector3 roofSize = new Vector3(1.66f, 0.48f, 1.20f);
            BuildingPrimitives.CreateGableRoof("Roof", root.transform, roofSize, roofBaseCenter, roofCover);
            float ridgeTopY = wallTopY + roofSize.y;

            // ---- Ridge icon: a big palette with a crossing brush -- "reads Hobby at a glance". ----
            Vector3 paletteCenter = new Vector3(baseOrigin.x, ridgeTopY + 0.03f, baseOrigin.z);
            BuildingPrimitives.CreatePaintPalette("RidgePalette", root.transform, paletteCenter, radius: 0.30f, paintColors, paletteWood);
            Vector3 brushCenter = new Vector3(baseOrigin.x + 0.02f, ridgeTopY + 0.14f, baseOrigin.z);
            var brush = BuildingPrimitives.CreateBrush("RidgeBrush", root.transform, brushCenter, Vector3.forward,
                length: 0.60f, handleThickness: 0.03f, tipLength: 0.14f, brushHandle, tubeCapColor, paintColors[0]);
            brush.transform.RotateAround(brushCenter, Vector3.up, 35f);

            BuildingPrimitives.CreateArchedWindow("Door", root.transform,
                paneWidth: 0.20f, paneHeight: 0.28f, paneDepth: 0.05f,
                paneBottomCenter: new Vector3(baseOrigin.x, baseOrigin.y, frontZ + 0.05f),
                frameColor: doorColor, glassColor: doorColor);
            BuildHangingSign(root.transform, new Vector3(baseOrigin.x, baseOrigin.y + 0.34f, frontZ + 0.05f), doorColor, brushHandle, tubeCapColor, paintColors[2]);

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

            Vector3 chimneyBase = new Vector3(baseOrigin.x + 0.34f, ridgeTopY - 0.10f, baseOrigin.z - 0.18f);
            BuildChimney(root.transform, chimneyBase, stoneColor, smokeColor);

            BuildPottedPlant(root.transform, new Vector3(baseOrigin.x + 0.40f, baseOrigin.y, frontZ + 0.10f), potColor, leafColor);

            BuildingPrimitives.CreatePaintTube("GroundTubeA", root.transform, new Vector3(baseOrigin.x - 0.46f, baseOrigin.y, frontZ + 0.02f), 0.032f, 0.16f, paintColors[0], tubeCapColor);
            BuildingPrimitives.CreatePaintTube("GroundTubeB", root.transform, new Vector3(baseOrigin.x - 0.55f, baseOrigin.y, frontZ - 0.02f), 0.028f, 0.14f, paintColors[3], tubeCapColor);
            BuildingPrimitives.CreateYarnBall("GroundYarn", root.transform, new Vector3(sideX + 0.05f, baseOrigin.y, baseOrigin.z + 0.32f), 0.06f, paintColors[4], yarnWrap);

            // ---- Coquette touch: exactly one pink yarn ball, loose by the entrance. ----
            BuildingPrimitives.CreateYarnBall("CoquetteYarn", root.transform, new Vector3(baseOrigin.x - 0.30f, baseOrigin.y, frontZ + 0.16f), 0.05f, yarnPink, Color.Lerp(yarnPink, Color.white, 0.3f));

            MeshPrimitives.CreateFlatRing(
                "TierRing", root.transform,
                0.85f, 0.95f,
                new Vector3(baseOrigin.x, baseOrigin.y + 0.01f, baseOrigin.z),
                tierRingColor);

            return root;
        }

        /// <summary>One packed art-supply cell: cycles evenly through all 4 item types,
        /// each sized directly from the cell's own colWidth/rowHeight so it fills the cell
        /// the way the Library's book spines do.</summary>
        static void BuildArtCell(Transform parent, float cellCenterX, float rowBaseY, float rowHeight, float colWidth, float depth, float cellFrontZ, int seed,
            Color[] paintColors, Color tubeCapColor, Color jarColor, Color brushHandle, Color paletteWood, Color yarnWrap)
        {
            float itemZ = cellFrontZ - depth * 0.15f;
            int cellType = seed % 4;

            switch (cellType)
            {
                case 0:
                    BuildingPrimitives.CreatePaintTube($"Tube_{seed}", parent,
                        new Vector3(cellCenterX, rowBaseY, itemZ), Mathf.Min(colWidth * 0.42f, rowHeight * 0.16f), rowHeight * 0.92f,
                        paintColors[seed % paintColors.Length], tubeCapColor);
                    break;
                case 1:
                    BuildingPrimitives.CreateBrushJar($"Jar_{seed}", parent,
                        new Vector3(cellCenterX, rowBaseY, itemZ), Mathf.Min(colWidth * 0.40f, rowHeight * 0.30f), rowHeight * 0.55f,
                        jarColor, paintColors, brushHandle);
                    break;
                case 2:
                    BuildingPrimitives.CreatePaintPalette($"Palette_{seed}", parent,
                        new Vector3(cellCenterX, rowBaseY, itemZ), Mathf.Min(colWidth, rowHeight) * 0.46f, paintColors, paletteWood);
                    break;
                default:
                    BuildingPrimitives.CreateYarnBall($"Yarn_{seed}", parent,
                        new Vector3(cellCenterX, rowBaseY, itemZ), Mathf.Min(colWidth, rowHeight) * 0.44f,
                        paintColors[(seed + 2) % paintColors.Length], yarnWrap);
                    break;
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

        /// <summary>A small wooden sign hanging from a short bracket, with a tiny brush
        /// emblem in front of it.</summary>
        static void BuildHangingSign(Transform parent, Vector3 doorTopCenter, Color woodColor, Color brushHandle, Color ferruleColor, Color tipColor)
        {
            Vector3 bracketSize = new Vector3(0.03f, 0.03f, 0.05f);
            BuildingPrimitives.CreateAccentBox("SignBracket", parent, bracketSize, doorTopCenter, woodColor);
            Vector3 signSize = new Vector3(0.22f, 0.055f, 0.02f);
            Vector3 signBase = new Vector3(doorTopCenter.x, doorTopCenter.y + bracketSize.y - 0.015f, doorTopCenter.z + 0.02f);
            BuildingPrimitives.CreateAccentBox("SignBoard", parent, signSize, signBase, woodColor);

            Vector3 emblemCenter = new Vector3(doorTopCenter.x, signBase.y + signSize.y * 2.4f, signBase.z + 0.015f);
            BuildingPrimitives.CreateBrush("SignEmblem", parent, emblemCenter, Vector3.right, length: 0.12f, handleThickness: 0.014f, tipLength: 0.03f, brushHandle, ferruleColor, tipColor);
        }

        static void BuildPottedPlant(Transform parent, Vector3 baseCenter, Color potColor, Color leafColor)
        {
            Vector3 potSize = new Vector3(0.07f, 0.06f, 0.07f);
            BuildingPrimitives.CreateAccentBox("PlantPot", parent, potSize, baseCenter, potColor);
            var leaf = BuildingPrimitives.CreateAccentBlob("PlantLeaf", parent, 0.055f,
                new Vector3(baseCenter.x, baseCenter.y + potSize.y + 0.035f, baseCenter.z), leafColor);
            leaf.transform.localScale = new Vector3(1f, 1.3f, 1f);
        }
    }
}
