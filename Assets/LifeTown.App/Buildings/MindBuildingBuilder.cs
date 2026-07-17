using UnityEngine;
using LifeTown.App.BuildingKit;
using LifeTown.App.Scene;

namespace LifeTown.App.Buildings
{
    /// <summary>
    /// Mind / mindfulness (마음챙김/Mind category) -- sixth sibling in the
    /// cottage-built-from-<i>material</i> archetype (see <see cref="LibraryBuildingBuilder"/>
    /// for the density bar, <see cref="GymBuildingBuilder"/> for the roof-icon pattern).
    /// Matches both 1:1 in massing -- only the "material" theme changes, books/equipment
    /// to calm-corner objects:
    ///
    /// 1. Walls = a DENSE mindfulness-object cladding (<see cref="BuildingPrimitives.CreateItemWall"/>
    ///    cycling through 4 cell types every cell -- meditation cushions, candles, zen
    ///    stone cairns, tea cups reused from <see cref="BuildingPrimitives.CreateCoffeeCup"/>),
    ///    every item sized directly from the cell's own colWidth/rowHeight so it fills the
    ///    cell edge to edge, same density fix applied to every one of these 5 cottages.
    /// 2. Roof = a PLAIN warm gable topped by a layered lotus flower
    ///    (<see cref="BuildingPrimitives.CreateLotusRoofIcon"/>) -- "reads Mind at a glance".
    /// 3. Coquette touch: exactly one pink candle, loose on the ground by the entrance
    ///    (every wall candle stays warm peach/cream).
    /// 4. Cozy extras matching the rest of the village: warm amber-glass arched windows,
    ///    a chimney with smoke, a potted succulent, a hanging sign with a small candle
    ///    emblem, and a loose cushion/zen-stone cluster on the ground.
    ///
    /// Tier ring uses the category's own tone (soft peach #FFB37A).
    /// </summary>
    public static class MindBuildingBuilder
    {
        public static GameObject Build(Transform parent, Vector3 footprintCenter)
        {
            var root = new GameObject("Mind (마음챙김 Tier1-S3)");
            root.transform.SetParent(parent, false);
            root.transform.position = footprintCenter;

            var colors = CategoryPalette.Get(BuildingCategory.Mind);

            Color[] cushionColors =
            {
                CategoryPalette.FromHex("#FFB37A"), // soft peach (category's own tone)
                CategoryPalette.FromHex("#8FBFA0"), // sage green
                CategoryPalette.FromHex("#D8A6C9"), // dusty lilac
                CategoryPalette.FromHex("#E8C27A"), // warm sand
            };
            Color cushionTrim = CategoryPalette.FromHex("#7A5A3A");
            Color waxColor = CategoryPalette.FromHex("#FFF1E0");
            Color flameColor = CategoryPalette.FromHex("#FFA94D");
            Color[] stoneColors = { CategoryPalette.FromHex("#B8AFA0"), CategoryPalette.FromHex("#9C9080"), CategoryPalette.FromHex("#D8CFC0") };
            Color teaCupColor = CategoryPalette.FromHex("#F5EFE0");
            Color teaLidColor = CategoryPalette.FromHex("#8FBFA0");
            Color steamColor = new Color(0.9f, 0.9f, 0.9f, 1f);
            Color wallBacking = CategoryPalette.FromHex("#5C4430");
            Color woodTrim = CategoryPalette.FromHex("#8B6B4A");
            Color roofCover = CategoryPalette.FromHex("#C9A57A");      // plain warm sand roof, ridge carries the icon
            Color windowFrame = CategoryPalette.FromHex("#5C4430");
            Color windowGlow = CategoryPalette.FromHex("#FFCE7A");
            Color doorColor = CategoryPalette.FromHex("#4A3220");
            Color stoneWallColor = CategoryPalette.FromHex("#9C8878");
            Color smokeColor = new Color(0.88f, 0.88f, 0.86f, 1f);
            Color potColor = CategoryPalette.FromHex("#B5602E");
            Color leafColor = CategoryPalette.FromHex("#8FBFA0");
            Color[] lotusPetalColors = { CategoryPalette.FromHex("#FFB37A"), CategoryPalette.FromHex("#FFCFA3"), CategoryPalette.FromHex("#FFE3C4") };
            Color lotusCenter = CategoryPalette.FromHex("#E8C27A");
            Color candlePink = CategoryPalette.PrimaryPink;
            Color tierRingColor = colors.Base500;

            Vector3 baseOrigin = root.transform.position;

            Vector3 bodySize = new Vector3(1.30f, 0.50f, 1.00f);
            BuildingPrimitives.CreateShadedBox("CottageWalls", root.transform, bodySize, baseOrigin, woodTrim);
            float wallTopY = baseOrigin.y + bodySize.y;
            float frontZ = baseOrigin.z + bodySize.z * 0.5f;
            float sideX = baseOrigin.x + bodySize.x * 0.5f;

            Vector3 frontWallSize = new Vector3(bodySize.x * 0.93f, bodySize.y * 0.74f, 0.05f);
            Vector3 frontWallBase = new Vector3(baseOrigin.x, baseOrigin.y + bodySize.y * 0.10f, frontZ + 0.012f);
            BuildingPrimitives.CreateItemWall("FrontMind", root.transform, frontWallSize, frontWallBase, wallBacking, columns: 10, rows: 2,
                (cellParent, cx, rowBaseY, rowHeight, colWidth, depth, cellFrontZ, seed) =>
                    BuildMindCell(cellParent, cx, rowBaseY, rowHeight, colWidth, depth, cellFrontZ, seed, cushionColors, cushionTrim, waxColor, flameColor, stoneColors, teaCupColor, teaLidColor, steamColor));

            Vector3 sideWallSize = new Vector3(bodySize.z * 0.90f, bodySize.y * 0.74f, 0.05f);
            Vector3 sideWallBase = new Vector3(sideX + 0.012f, baseOrigin.y + bodySize.y * 0.10f, baseOrigin.z);
            var sideWall = BuildingPrimitives.CreateItemWall("SideMind", root.transform, sideWallSize, sideWallBase, wallBacking, columns: 6, rows: 2,
                (cellParent, cx, rowBaseY, rowHeight, colWidth, depth, cellFrontZ, seed) =>
                    BuildMindCell(cellParent, cx, rowBaseY, rowHeight, colWidth, depth, cellFrontZ, seed, cushionColors, cushionTrim, waxColor, flameColor, stoneColors, teaCupColor, teaLidColor, steamColor));
            sideWall.transform.rotation = Quaternion.Euler(0f, 90f, 0f);

            Vector3 roofBaseCenter = new Vector3(baseOrigin.x, wallTopY, baseOrigin.z);
            Vector3 roofSize = new Vector3(1.66f, 0.48f, 1.20f);
            BuildingPrimitives.CreateGableRoof("Roof", root.transform, roofSize, roofBaseCenter, roofCover);
            float ridgeTopY = wallTopY + roofSize.y;

            // ---- Ridge icon: a layered lotus flower -- "reads Mind at a glance". ----
            Vector3 lotusCenterPos = new Vector3(baseOrigin.x, ridgeTopY + 0.02f, baseOrigin.z);
            BuildingPrimitives.CreateLotusRoofIcon("RidgeLotus", root.transform, lotusCenterPos, radius: 0.30f, lotusPetalColors, lotusCenter);

            BuildingPrimitives.CreateArchedWindow("Door", root.transform,
                paneWidth: 0.20f, paneHeight: 0.28f, paneDepth: 0.05f,
                paneBottomCenter: new Vector3(baseOrigin.x, baseOrigin.y, frontZ + 0.05f),
                frameColor: doorColor, glassColor: doorColor);
            BuildHangingSign(root.transform, new Vector3(baseOrigin.x, baseOrigin.y + 0.34f, frontZ + 0.05f), doorColor, waxColor, flameColor);

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
            BuildChimney(root.transform, chimneyBase, stoneWallColor, smokeColor);

            BuildPottedPlant(root.transform, new Vector3(baseOrigin.x + 0.40f, baseOrigin.y, frontZ + 0.10f), potColor, leafColor);

            BuildingPrimitives.CreateCushion("GroundCushion", root.transform, new Vector3(baseOrigin.x - 0.46f, baseOrigin.y, frontZ + 0.02f), 0.10f, 0.055f, cushionColors[1], cushionTrim);
            BuildingPrimitives.CreateZenStoneStack("GroundStones", root.transform, new Vector3(baseOrigin.x - 0.58f, baseOrigin.y, frontZ - 0.04f), 0.055f, 3, stoneColors);

            // ---- Coquette touch: exactly one pink candle, loose by the entrance. ----
            BuildingPrimitives.CreateCandle("CoquetteCandle", root.transform, new Vector3(sideX + 0.03f, baseOrigin.y, baseOrigin.z + 0.32f), 0.03f, 0.09f, candlePink, flameColor);

            MeshPrimitives.CreateFlatRing(
                "TierRing", root.transform,
                0.85f, 0.95f,
                new Vector3(baseOrigin.x, baseOrigin.y + 0.01f, baseOrigin.z),
                tierRingColor);

            return root;
        }

        /// <summary>One packed calm-corner cell: cycles evenly through all 4 item types,
        /// each sized directly from the cell's own colWidth/rowHeight.</summary>
        static void BuildMindCell(Transform parent, float cellCenterX, float rowBaseY, float rowHeight, float colWidth, float depth, float cellFrontZ, int seed,
            Color[] cushionColors, Color cushionTrim, Color waxColor, Color flameColor, Color[] stoneColors, Color teaCupColor, Color teaLidColor, Color steamColor)
        {
            float itemZ = cellFrontZ - depth * 0.15f;
            int cellType = seed % 4;

            switch (cellType)
            {
                case 0:
                    BuildingPrimitives.CreateCushion($"Cushion_{seed}", parent,
                        new Vector3(cellCenterX, rowBaseY, itemZ), Mathf.Min(colWidth, rowHeight) * 0.48f, rowHeight * 0.50f,
                        cushionColors[seed % cushionColors.Length], cushionTrim);
                    break;
                case 1:
                    BuildingPrimitives.CreateCandle($"Candle_{seed}", parent,
                        new Vector3(cellCenterX, rowBaseY, itemZ), Mathf.Min(colWidth * 0.32f, rowHeight * 0.14f), rowHeight * 0.78f,
                        waxColor, flameColor);
                    break;
                case 2:
                    BuildingPrimitives.CreateZenStoneStack($"Stones_{seed}", parent,
                        new Vector3(cellCenterX, rowBaseY, itemZ), Mathf.Min(colWidth, rowHeight) * 0.34f, 3, stoneColors);
                    break;
                default:
                    BuildingPrimitives.CreateCoffeeCup($"TeaCup_{seed}", parent,
                        new Vector3(cellCenterX, rowBaseY, itemZ), Mathf.Min(colWidth * 0.30f, rowHeight * 0.22f), rowHeight * 0.62f,
                        teaCupColor, teaLidColor, steamColor);
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

        /// <summary>A small wooden sign hanging from a short bracket, with a tiny candle
        /// emblem in front of it.</summary>
        static void BuildHangingSign(Transform parent, Vector3 doorTopCenter, Color woodColor, Color waxColor, Color flameColor)
        {
            Vector3 bracketSize = new Vector3(0.03f, 0.03f, 0.05f);
            BuildingPrimitives.CreateAccentBox("SignBracket", parent, bracketSize, doorTopCenter, woodColor);
            Vector3 signSize = new Vector3(0.22f, 0.055f, 0.02f);
            Vector3 signBase = new Vector3(doorTopCenter.x, doorTopCenter.y + bracketSize.y - 0.015f, doorTopCenter.z + 0.02f);
            BuildingPrimitives.CreateAccentBox("SignBoard", parent, signSize, signBase, woodColor);

            Vector3 emblemBase = new Vector3(doorTopCenter.x, signBase.y + signSize.y, signBase.z + 0.015f);
            BuildingPrimitives.CreateCandle("SignEmblem", parent, emblemBase, 0.012f, 0.03f, waxColor, flameColor);
        }

        static void BuildPottedPlant(Transform parent, Vector3 baseCenter, Color potColor, Color leafColor)
        {
            Vector3 potSize = new Vector3(0.07f, 0.06f, 0.07f);
            BuildingPrimitives.CreateAccentBox("PlantPot", parent, potSize, baseCenter, potColor);
            var leaf = BuildingPrimitives.CreateAccentBlob("PlantLeaf", parent, 0.05f,
                new Vector3(baseCenter.x, baseCenter.y + potSize.y + 0.03f, baseCenter.z), leafColor);
            leaf.transform.localScale = new Vector3(1f, 1.1f, 1f);
        }
    }
}
