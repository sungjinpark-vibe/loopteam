using UnityEngine;
using LifeTown.App.BuildingKit;
using LifeTown.App.Scene;

namespace LifeTown.App.Buildings
{
    /// <summary>
    /// Game (게임/Game category) -- seventh and final sibling in the
    /// cottage-built-from-<i>material</i> archetype (see <see cref="LibraryBuildingBuilder"/>
    /// for the density bar, <see cref="GymBuildingBuilder"/> for the roof-icon pattern).
    /// Matches both 1:1 in massing -- only the "material" theme changes, books/equipment
    /// to game gear:
    ///
    /// 1. Walls = a DENSE game-gear cladding (<see cref="BuildingPrimitives.CreateItemWall"/>
    ///    cycling through 4 cell types every cell -- controllers, arcade
    ///    joystick+buttons, dice, pixel hearts), every item sized directly from the
    ///    cell's own colWidth/rowHeight so it fills the cell edge to edge, the same
    ///    density fix applied to every one of these 5 cottages. The category's own base
    ///    tone is already pink (#FF8FA3), so the wall's own palette deliberately AVOIDS
    ///    pink/magenta (purple, blue, red-orange, gold, teal instead) -- keeping the
    ///    brief's "exactly one" coquette pink legible as a deliberate accent rather than
    ///    blending into an already-pink category identity.
    /// 2. Roof = a PLAIN warm gable topped by a big game controller
    ///    (<see cref="BuildingPrimitives.CreateGameController"/>) on the ridge -- "reads
    ///    Game at a glance".
    /// 3. Coquette touch: exactly one small pink controller, loose on the ground by the
    ///    entrance -- the wall's own controllers/buttons/hearts all stay non-pink.
    /// 4. Cozy extras matching the rest of the village: warm amber-glass arched windows,
    ///    a chimney with smoke, a potted plant, a hanging sign with a small die emblem,
    ///    and a loose dice/heart cluster on the ground.
    ///
    /// Tier ring uses the category's own tone (playful pink #FF8FA3) -- distinct in kind
    /// from the coquette PrimaryPink (a warmer, lighter tone), same as every other
    /// cottage's ring convention.
    /// </summary>
    public static class GameBuildingBuilder
    {
        public static GameObject Build(Transform parent, Vector3 footprintCenter)
        {
            var root = new GameObject("Game (게임 Tier1-S3)");
            root.transform.SetParent(parent, false);
            root.transform.position = footprintCenter;

            var colors = CategoryPalette.Get(BuildingCategory.Game);

            // Playful arcade brights -- deliberately non-pink (see class doc); the
            // category's own pink identity lives only in the tier ring, and the coquette
            // pink lives only on the one loose ground controller.
            Color[] gearColors =
            {
                CategoryPalette.FromHex("#8B6DBF"), // arcade purple
                CategoryPalette.FromHex("#4FA8D8"), // arcade blue
                CategoryPalette.FromHex("#E4572E"), // arcade red-orange
                CategoryPalette.FromHex("#F2B134"), // arcade gold
                CategoryPalette.FromHex("#3FA79A"), // arcade teal
            };
            Color controllerBody = CategoryPalette.FromHex("#3A3D57");  // dark charcoal shell, buttons pop against it
            Color dpadColor = CategoryPalette.FromHex("#EDEAE0");
            Color dieBody = CategoryPalette.FromHex("#EDEAE0");
            Color diePip = CategoryPalette.FromHex("#3A3D57");
            Color wallBacking = CategoryPalette.FromHex("#5C4430");
            Color woodTrim = CategoryPalette.FromHex("#8B6B4A");
            Color roofCover = CategoryPalette.FromHex("#7A6BAE");       // plain warm-purple roof, ridge carries the icon
            Color windowFrame = CategoryPalette.FromHex("#5C4430");
            Color windowGlow = CategoryPalette.FromHex("#FFCE7A");
            Color doorColor = CategoryPalette.FromHex("#4A3220");
            Color stoneColor = CategoryPalette.FromHex("#9C8878");
            Color smokeColor = new Color(0.88f, 0.88f, 0.86f, 1f);
            Color potColor = CategoryPalette.FromHex("#B5602E");
            Color leafColor = CategoryPalette.FromHex("#5FA06A");
            Color controllerPink = CategoryPalette.PrimaryPink;
            Color tierRingColor = colors.Base500;

            Vector3 baseOrigin = root.transform.position;

            Vector3 bodySize = new Vector3(1.30f, 0.50f, 1.00f);
            BuildingPrimitives.CreateShadedBox("CottageWalls", root.transform, bodySize, baseOrigin, woodTrim);
            float wallTopY = baseOrigin.y + bodySize.y;
            float frontZ = baseOrigin.z + bodySize.z * 0.5f;
            float sideX = baseOrigin.x + bodySize.x * 0.5f;

            Vector3 frontWallSize = new Vector3(bodySize.x * 0.93f, bodySize.y * 0.74f, 0.05f);
            Vector3 frontWallBase = new Vector3(baseOrigin.x, baseOrigin.y + bodySize.y * 0.10f, frontZ + 0.012f);
            BuildingPrimitives.CreateItemWall("FrontGame", root.transform, frontWallSize, frontWallBase, wallBacking, columns: 10, rows: 2,
                (cellParent, cx, rowBaseY, rowHeight, colWidth, depth, cellFrontZ, seed) =>
                    BuildGameCell(cellParent, cx, rowBaseY, rowHeight, colWidth, depth, cellFrontZ, seed, gearColors, controllerBody, dpadColor, dieBody, diePip));

            Vector3 sideWallSize = new Vector3(bodySize.z * 0.90f, bodySize.y * 0.74f, 0.05f);
            Vector3 sideWallBase = new Vector3(sideX + 0.012f, baseOrigin.y + bodySize.y * 0.10f, baseOrigin.z);
            var sideWall = BuildingPrimitives.CreateItemWall("SideGame", root.transform, sideWallSize, sideWallBase, wallBacking, columns: 6, rows: 2,
                (cellParent, cx, rowBaseY, rowHeight, colWidth, depth, cellFrontZ, seed) =>
                    BuildGameCell(cellParent, cx, rowBaseY, rowHeight, colWidth, depth, cellFrontZ, seed, gearColors, controllerBody, dpadColor, dieBody, diePip));
            sideWall.transform.rotation = Quaternion.Euler(0f, 90f, 0f);

            Vector3 roofBaseCenter = new Vector3(baseOrigin.x, wallTopY, baseOrigin.z);
            Vector3 roofSize = new Vector3(1.66f, 0.48f, 1.20f);
            BuildingPrimitives.CreateGableRoof("Roof", root.transform, roofSize, roofBaseCenter, roofCover);
            float ridgeTopY = wallTopY + roofSize.y;

            // ---- Ridge icon: a big game controller -- "reads Game at a glance". ----
            Vector3 controllerCenter = new Vector3(baseOrigin.x, ridgeTopY + 0.10f, baseOrigin.z);
            BuildingPrimitives.CreateGameController("RidgeController", root.transform, controllerCenter,
                width: 0.55f, height: 0.20f, depth: 0.24f, controllerBody, dpadColor, gearColors);

            BuildingPrimitives.CreateArchedWindow("Door", root.transform,
                paneWidth: 0.20f, paneHeight: 0.28f, paneDepth: 0.05f,
                paneBottomCenter: new Vector3(baseOrigin.x, baseOrigin.y, frontZ + 0.05f),
                frameColor: doorColor, glassColor: doorColor);
            BuildHangingSign(root.transform, new Vector3(baseOrigin.x, baseOrigin.y + 0.34f, frontZ + 0.05f), doorColor, dieBody, diePip);

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

            BuildingPrimitives.CreateDie("GroundDieA", root.transform, new Vector3(baseOrigin.x - 0.46f, baseOrigin.y, frontZ + 0.02f), 0.07f, dieBody, diePip);
            BuildingPrimitives.CreateDie("GroundDieB", root.transform, new Vector3(baseOrigin.x - 0.58f, baseOrigin.y, frontZ - 0.03f), 0.05f, dieBody, diePip);
            BuildingPrimitives.CreatePixelHeart("GroundHeart", root.transform, new Vector3(sideX + 0.05f, baseOrigin.y, baseOrigin.z + 0.30f), 0.02f, gearColors[2]);

            // ---- Coquette touch: exactly one small pink controller, loose by the entrance. ----
            BuildingPrimitives.CreateGameController("CoquetteController", root.transform,
                new Vector3(baseOrigin.x - 0.30f, baseOrigin.y + 0.03f, frontZ + 0.14f), width: 0.16f, height: 0.06f, depth: 0.10f,
                controllerPink, dpadColor, new[] { dpadColor, dpadColor, dpadColor, dpadColor });

            MeshPrimitives.CreateFlatRing(
                "TierRing", root.transform,
                0.85f, 0.95f,
                new Vector3(baseOrigin.x, baseOrigin.y + 0.01f, baseOrigin.z),
                tierRingColor);

            return root;
        }

        /// <summary>One packed game-gear cell: cycles evenly through all 4 item types,
        /// each sized directly from the cell's own colWidth/rowHeight.</summary>
        static void BuildGameCell(Transform parent, float cellCenterX, float rowBaseY, float rowHeight, float colWidth, float depth, float cellFrontZ, int seed,
            Color[] gearColors, Color controllerBody, Color dpadColor, Color dieBody, Color diePip)
        {
            float itemZ = cellFrontZ - depth * 0.15f;
            int cellType = seed % 4;

            switch (cellType)
            {
                case 0:
                    BuildingPrimitives.CreateGameController($"Controller_{seed}", parent,
                        new Vector3(cellCenterX, rowBaseY, itemZ), colWidth * 0.90f, rowHeight * 0.55f, rowHeight * 0.35f,
                        controllerBody, dpadColor, gearColors);
                    break;
                case 1:
                    BuildingPrimitives.CreateArcadeStick($"Stick_{seed}", parent,
                        new Vector3(cellCenterX, rowBaseY, itemZ), Mathf.Min(colWidth, rowHeight) * 0.36f, rowHeight * 0.5f,
                        gearColors[seed % gearColors.Length], CategoryPalette.FromHex("#C7C8C5"), gearColors[(seed + 2) % gearColors.Length]);
                    break;
                case 2:
                    BuildingPrimitives.CreateDie($"Die_{seed}", parent,
                        new Vector3(cellCenterX, rowBaseY, itemZ), Mathf.Min(colWidth, rowHeight) * 0.82f, dieBody, diePip);
                    break;
                default:
                    BuildingPrimitives.CreatePixelHeart($"Heart_{seed}", parent,
                        new Vector3(cellCenterX, rowBaseY, itemZ), Mathf.Min(colWidth, rowHeight) * 0.15f, gearColors[(seed + 1) % gearColors.Length]);
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

        /// <summary>A small wooden sign hanging from a short bracket, with a tiny die
        /// emblem in front of it.</summary>
        static void BuildHangingSign(Transform parent, Vector3 doorTopCenter, Color woodColor, Color dieBody, Color diePip)
        {
            Vector3 bracketSize = new Vector3(0.03f, 0.03f, 0.05f);
            BuildingPrimitives.CreateAccentBox("SignBracket", parent, bracketSize, doorTopCenter, woodColor);
            Vector3 signSize = new Vector3(0.22f, 0.055f, 0.02f);
            Vector3 signBase = new Vector3(doorTopCenter.x, doorTopCenter.y + bracketSize.y - 0.015f, doorTopCenter.z + 0.02f);
            BuildingPrimitives.CreateAccentBox("SignBoard", parent, signSize, signBase, woodColor);

            Vector3 emblemCenter = new Vector3(doorTopCenter.x, signBase.y + signSize.y * 1.6f, signBase.z + 0.015f);
            BuildingPrimitives.CreateDie("SignEmblem", parent, emblemCenter, 0.05f, dieBody, diePip);
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
