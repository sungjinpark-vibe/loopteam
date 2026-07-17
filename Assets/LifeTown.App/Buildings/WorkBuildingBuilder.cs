using UnityEngine;
using LifeTown.App.BuildingKit;
using LifeTown.App.Scene;

namespace LifeTown.App.Buildings
{
    /// <summary>
    /// Work (일/Work category) -- fourth sibling in the cottage-built-from-<i>material</i>
    /// archetype (see <see cref="LibraryBuildingBuilder"/> for the density bar, and
    /// <see cref="GymBuildingBuilder"/> for the roof-icon pattern). Matches both 1:1 in
    /// massing -- only the "material" theme changes, books/equipment to office gear:
    ///
    /// 1. Walls = a DENSE office-supply cladding (<see cref="BuildingPrimitives.CreateItemWall"/>
    ///    cycling through 4 cell types every cell, no plain/empty cells -- laptops,
    ///    briefcases, coffee cups, folder stacks), every item sized directly from the
    ///    cell's own colWidth/rowHeight so it fills the cell the way the Library's book
    ///    spines do (the explicit fix for the Gym round's "reads sparse" lesson).
    /// 2. Roof = a PLAIN warm gable topped by a big briefcase (<see cref="BuildingPrimitives.CreateBriefcase"/>)
    ///    on the ridge -- the single silhouette element that says "Work" at a glance.
    /// 3. Coquette touch: exactly one pink coffee mug, loose on the ground by the entrance
    ///    (every wall/cluster mug stays cream-and-navy).
    /// 4. Cozy extras matching the Library/Gym/Study list: warm amber-glass arched
    ///    windows, a chimney with smoke, a potted plant, a hanging sign with a small
    ///    briefcase emblem, and loose folder/coffee-cup clusters on the ground.
    ///
    /// Tier ring uses the category's own tone (warm gold #FFD066).
    /// </summary>
    public static class WorkBuildingBuilder
    {
        public static GameObject Build(Transform parent, Vector3 footprintCenter)
        {
            var root = new GameObject("Work (일 Tier1-S3)");
            root.transform.SetParent(parent, false);
            root.transform.position = footprintCenter;

            var colors = CategoryPalette.Get(BuildingCategory.Work);

            Color laptopBody = CategoryPalette.FromHex("#D6D3C9");     // pale silver -- kept light so it doesn't blend into the dark folders/briefcase against the wood backing
            Color screenGlow = CategoryPalette.FromHex("#5AC8E0");     // cool glowing screen, strong contrast against the silver deck
            Color briefcaseBody = CategoryPalette.FromHex("#6B4A2D");  // leather brown
            Color briefcaseTrim = CategoryPalette.FromHex("#FFD066");  // gold hardware
            Color handleGrey = CategoryPalette.FromHex("#C7C8C5");
            Color cupColor = CategoryPalette.FromHex("#FBF1DE");       // cream ceramic
            Color lidColor = CategoryPalette.FromHex("#FFD066");       // gold lid -- pops against the cream cup instead of blending
            Color steamColor = new Color(0.9f, 0.9f, 0.9f, 1f);
            Color[] folderColors =
            {
                CategoryPalette.FromHex("#FFD066"), // gold
                CategoryPalette.FromHex("#3A3D57"), // navy
                CategoryPalette.FromHex("#B5602E"), // rust
                CategoryPalette.FromHex("#7A8B99"), // slate
            };
            Color tabColor = CategoryPalette.FromHex("#FBF1DE");
            Color wallBacking = CategoryPalette.FromHex("#5C4430");
            Color woodTrim = CategoryPalette.FromHex("#8B6B4A");
            Color roofCover = CategoryPalette.FromHex("#C9A24A");      // warm brass -- plain roof, ridge carries the icon
            Color windowFrame = CategoryPalette.FromHex("#5C4430");
            Color windowGlow = CategoryPalette.FromHex("#FFCE7A");
            Color doorColor = CategoryPalette.FromHex("#4A3220");
            Color stoneColor = CategoryPalette.FromHex("#9C8878");
            Color smokeColor = new Color(0.88f, 0.88f, 0.86f, 1f);
            Color potColor = CategoryPalette.FromHex("#B5602E");
            Color leafColor = CategoryPalette.FromHex("#5FA06A");
            Color mugPink = CategoryPalette.PrimaryPink;
            Color tierRingColor = colors.Base500;

            Vector3 baseOrigin = root.transform.position;

            Vector3 bodySize = new Vector3(1.30f, 0.50f, 1.00f);
            BuildingPrimitives.CreateShadedBox("CottageWalls", root.transform, bodySize, baseOrigin, woodTrim);
            float wallTopY = baseOrigin.y + bodySize.y;
            float frontZ = baseOrigin.z + bodySize.z * 0.5f;
            float sideX = baseOrigin.x + bodySize.x * 0.5f;

            Vector3 frontWallSize = new Vector3(bodySize.x * 0.93f, bodySize.y * 0.74f, 0.05f);
            Vector3 frontWallBase = new Vector3(baseOrigin.x, baseOrigin.y + bodySize.y * 0.10f, frontZ + 0.012f);
            BuildingPrimitives.CreateItemWall("FrontOffice", root.transform, frontWallSize, frontWallBase, wallBacking, columns: 10, rows: 2,
                (cellParent, cx, rowBaseY, rowHeight, colWidth, depth, cellFrontZ, seed) =>
                    BuildOfficeCell(cellParent, cx, rowBaseY, rowHeight, colWidth, depth, cellFrontZ, seed,
                        laptopBody, screenGlow, briefcaseBody, briefcaseTrim, handleGrey, cupColor, lidColor, steamColor, folderColors, tabColor));

            Vector3 sideWallSize = new Vector3(bodySize.z * 0.90f, bodySize.y * 0.74f, 0.05f);
            Vector3 sideWallBase = new Vector3(sideX + 0.012f, baseOrigin.y + bodySize.y * 0.10f, baseOrigin.z);
            var sideWall = BuildingPrimitives.CreateItemWall("SideOffice", root.transform, sideWallSize, sideWallBase, wallBacking, columns: 6, rows: 2,
                (cellParent, cx, rowBaseY, rowHeight, colWidth, depth, cellFrontZ, seed) =>
                    BuildOfficeCell(cellParent, cx, rowBaseY, rowHeight, colWidth, depth, cellFrontZ, seed,
                        laptopBody, screenGlow, briefcaseBody, briefcaseTrim, handleGrey, cupColor, lidColor, steamColor, folderColors, tabColor));
            sideWall.transform.rotation = Quaternion.Euler(0f, 90f, 0f);

            Vector3 roofBaseCenter = new Vector3(baseOrigin.x, wallTopY, baseOrigin.z);
            Vector3 roofSize = new Vector3(1.66f, 0.48f, 1.20f);
            BuildingPrimitives.CreateGableRoof("Roof", root.transform, roofSize, roofBaseCenter, roofCover);
            float ridgeTopY = wallTopY + roofSize.y;

            // ---- Ridge icon: a big briefcase standing on the ridge -- "reads Work at a glance". ----
            Vector3 briefcaseCenter = new Vector3(baseOrigin.x, ridgeTopY + 0.02f, baseOrigin.z);
            BuildingPrimitives.CreateBriefcase("RidgeBriefcase", root.transform, briefcaseCenter, width: 0.42f, height: 0.30f, depth: 0.14f, briefcaseBody, briefcaseTrim, handleGrey);

            BuildingPrimitives.CreateArchedWindow("Door", root.transform,
                paneWidth: 0.20f, paneHeight: 0.28f, paneDepth: 0.05f,
                paneBottomCenter: new Vector3(baseOrigin.x, baseOrigin.y, frontZ + 0.05f),
                frameColor: doorColor, glassColor: doorColor);
            BuildHangingSign(root.transform, new Vector3(baseOrigin.x, baseOrigin.y + 0.34f, frontZ + 0.05f), doorColor, briefcaseBody, briefcaseTrim, handleGrey);

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

            BuildingPrimitives.CreateFolderStack("GroundFolders", root.transform, new Vector3(baseOrigin.x - 0.46f, baseOrigin.y, frontZ + 0.02f), 0.16f, 0.11f, 6, folderColors, tabColor);
            BuildingPrimitives.CreateCoffeeCup("GroundCup", root.transform, new Vector3(baseOrigin.x - 0.60f, baseOrigin.y, frontZ - 0.05f), 0.045f, 0.06f, cupColor, lidColor, steamColor);

            // ---- Coquette touch: exactly one pink coffee mug, loose by the entrance. ----
            BuildingPrimitives.CreateCoffeeCup("CoquetteMug", root.transform, new Vector3(sideX + 0.03f, baseOrigin.y, baseOrigin.z + 0.32f), 0.05f, 0.065f, mugPink, mugPink, steamColor);

            MeshPrimitives.CreateFlatRing(
                "TierRing", root.transform,
                0.85f, 0.95f,
                new Vector3(baseOrigin.x, baseOrigin.y + 0.01f, baseOrigin.z),
                tierRingColor);

            return root;
        }

        /// <summary>One packed office cell: cycles evenly through all 4 item types (no
        /// plain/minority split -- every item here is already a "hero" prop, so density
        /// comes from ALWAYS filling the cell from its own colWidth/rowHeight, not from a
        /// majority/minority mix like the Library's spines).</summary>
        static void BuildOfficeCell(Transform parent, float cellCenterX, float rowBaseY, float rowHeight, float colWidth, float depth, float cellFrontZ, int seed,
            Color laptopBody, Color screenGlow, Color briefcaseBody, Color briefcaseTrim, Color handleGrey, Color cupColor, Color lidColor, Color steamColor, Color[] folderColors, Color tabColor)
        {
            float itemZ = cellFrontZ - depth * 0.15f;
            int cellType = seed % 4;

            switch (cellType)
            {
                case 0:
                    BuildingPrimitives.CreateLaptop($"Laptop_{seed}", parent,
                        new Vector3(cellCenterX, rowBaseY, itemZ), colWidth * 0.86f, rowHeight * 0.55f, rowHeight * 0.82f, 98f, laptopBody, screenGlow);
                    break;
                case 1:
                    BuildingPrimitives.CreateBriefcase($"Briefcase_{seed}", parent,
                        new Vector3(cellCenterX, rowBaseY, itemZ), colWidth * 0.85f, rowHeight * 0.90f, depth * 0.6f, briefcaseBody, briefcaseTrim, handleGrey);
                    break;
                case 2:
                    BuildingPrimitives.CreateCoffeeCup($"Cup_{seed}", parent,
                        new Vector3(cellCenterX, rowBaseY, itemZ), colWidth * 0.32f, rowHeight * 0.70f, cupColor, lidColor, steamColor);
                    break;
                default:
                    int count = Mathf.Max(5, Mathf.RoundToInt(rowHeight * 0.9f / 0.026f));
                    BuildingPrimitives.CreateFolderStack($"Folders_{seed}", parent,
                        new Vector3(cellCenterX, rowBaseY, itemZ), colWidth * 0.85f, depth * 0.5f, count, folderColors, tabColor);
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

        /// <summary>A small wooden sign hanging from a short bracket, with a tiny briefcase
        /// emblem in front of it.</summary>
        static void BuildHangingSign(Transform parent, Vector3 doorTopCenter, Color woodColor, Color briefcaseBody, Color briefcaseTrim, Color handleGrey)
        {
            Vector3 bracketSize = new Vector3(0.03f, 0.03f, 0.05f);
            BuildingPrimitives.CreateAccentBox("SignBracket", parent, bracketSize, doorTopCenter, woodColor);
            Vector3 signSize = new Vector3(0.22f, 0.055f, 0.02f);
            Vector3 signBase = new Vector3(doorTopCenter.x, doorTopCenter.y + bracketSize.y - 0.015f, doorTopCenter.z + 0.02f);
            BuildingPrimitives.CreateAccentBox("SignBoard", parent, signSize, signBase, woodColor);

            Vector3 emblemCenter = new Vector3(doorTopCenter.x, signBase.y + signSize.y * 1.6f, signBase.z + 0.015f);
            BuildingPrimitives.CreateBriefcase("SignEmblem", parent, emblemCenter, width: 0.10f, height: 0.075f, depth: 0.035f, briefcaseBody, briefcaseTrim, handleGrey);
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
