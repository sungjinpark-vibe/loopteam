using UnityEngine;
using LifeTown.App.BuildingKit;
using LifeTown.App.Scene;

namespace LifeTown.App.Buildings
{
    /// <summary>
    /// Gym (운동/Exercise category) -- the cottage-built-from-<i>material</i> archetype's
    /// second sibling, matching <see cref="LibraryBuildingBuilder"/> 1:1 in massing and
    /// style (director: "build it as the Gym's sibling... reuse everything structural").
    /// Body size, roof size/position, door/window layout, chimney, and tier-ring
    /// convention are the exact same numbers as the Library cottage -- only the "material"
    /// theme changes, books to gym equipment:
    ///
    /// 1. Walls = <see cref="BuildingPrimitives.CreateEquipmentWall"/> (the direct
    ///    equipment-set counterpart to CreateBookSpineWall, same cell-based structure):
    ///    weight-plate stacks (the strongest cue, most cells), a few horizontal dumbbell
    ///    racks, a couple of kettlebells.
    /// 2. Roof = a PLAIN <see cref="BuildingPrimitives.CreateGableRoof"/> (deliberately not
    ///    an equipment-themed roof surface -- the brief's own call: "keep the gable roof
    ///    surface itself simple/warm... let the ridge [icon] be the icon") with a big
    ///    <see cref="BuildingPrimitives.CreateBarbell"/> laid along the ridge -- the
    ///    Library's open-book roof has a direct equivalent, not a re-skin of the same
    ///    primitive, because a barbell has no "pages" analog worth forcing.
    /// 3. Coquette touch: one pink gym towel draped over a small rail by the door (the
    ///    equipment-set equivalent of the Library's ribbon bookmark).
    /// 4. Cozy extras matching the Library's list: warm amber-glass arched windows (no
    ///    awnings this round -- the brief's own Gym cozy-detail list omits them, unlike
    ///    the Library's explicit ask), a chimney with smoke, a potted plant, a hanging
    ///    sign with a small dumbbell emblem, and loose weight-plate/dumbbell clusters on
    ///    the ground by the entrance (the equipment equivalent of the Library's book
    ///    piles).
    ///
    /// Tier ring stays the category's own tone (Exercise mint-green base500), same
    /// "material palette can go rich, the ring stays the category identity color"
    /// convention the Library's purple ring established.
    /// </summary>
    public static class GymBuildingBuilder
    {
        public static GameObject Build(Transform parent, Vector3 footprintCenter)
        {
            var root = new GameObject("Gym (운동 Tier1-S3)");
            root.transform.SetParent(parent, false);
            root.transform.position = footprintCenter;

            var colors = CategoryPalette.Get(BuildingCategory.Exercise);

            // Warm athletic palette -- bumper-plate colors (saturated but not candy),
            // matte charcoal plate bodies, a soft chrome-grey for bars/handles, and the
            // same warm-wood tones the Library used for its own rack/trim, so the two
            // buildings read as siblings in the same village (brief's item 5).
            Color[] plateColors =
            {
                CategoryPalette.FromHex("#C1443F"), // bumper red
                CategoryPalette.FromHex("#3D6FA8"), // bumper blue
                CategoryPalette.FromHex("#4C9A5B"), // bumper green
                CategoryPalette.FromHex("#D9B23C"), // bumper yellow
            };
            Color plateBody = CategoryPalette.FromHex("#33302C");   // matte charcoal plate body
            Color hubColor = CategoryPalette.FromHex("#1C1A18");    // dark hub
            Color handleGrey = CategoryPalette.FromHex("#C7C8C5");  // soft chrome handle/bar
            Color wallBacking = CategoryPalette.FromHex("#5C4430"); // same warm wood backing as the Library
            Color woodTrim = CategoryPalette.FromHex("#8B6B4A");    // same warm wood body tone as the Library
            Color roofCover = CategoryPalette.FromHex("#B5764A");   // plain warm clay/mat roof tone (brief: keep the roof surface simple)
            Color windowFrame = CategoryPalette.FromHex("#5C4430");
            Color windowGlow = CategoryPalette.FromHex("#FFCE7A");  // same warm amber as the Library
            Color doorColor = CategoryPalette.FromHex("#4A3220");
            Color stoneColor = CategoryPalette.FromHex("#9C8878");
            Color smokeColor = new Color(0.88f, 0.88f, 0.86f, 1f);
            Color potColor = CategoryPalette.FromHex("#B5602E");
            Color leafColor = CategoryPalette.FromHex("#5FA06A");
            Color towelPink = CategoryPalette.PrimaryPink;
            Color tierRingColor = colors.Base500; // brief: ring stays the category's own tone

            Vector3 baseOrigin = root.transform.position;

            // ---- Cottage body: identical size to the Library's, per the brief's "match
            // 1:1 in massing". ----
            Vector3 bodySize = new Vector3(1.30f, 0.50f, 1.00f);
            BuildingPrimitives.CreateShadedBox("CottageWalls", root.transform, bodySize, baseOrigin, woodTrim);
            float wallTopY = baseOrigin.y + bodySize.y;
            float frontZ = baseOrigin.z + bodySize.z * 0.5f;
            float sideX = baseOrigin.x + bodySize.x * 0.5f;

            // ---- Front wall: packed gym equipment, same proud-of-the-body convention as
            // the Library's book spines. ----
            Vector3 frontWallSize = new Vector3(bodySize.x * 0.93f, bodySize.y * 0.74f, 0.05f);
            Vector3 frontWallBase = new Vector3(baseOrigin.x, baseOrigin.y + bodySize.y * 0.10f, frontZ + 0.012f);
            BuildingPrimitives.CreateEquipmentWall("FrontEquip", root.transform, frontWallSize, frontWallBase,
                plateColors, plateBody, hubColor, handleGrey, wallBacking, columns: 8, rows: 2);

            // ---- Side wall (+X, the face the iso camera actually sees): same panel,
            // rotated 90 degrees around its own already-correctly-placed pivot -- the
            // exact technique the Library's side spine wall uses. ----
            Vector3 sideWallSize = new Vector3(bodySize.z * 0.90f, bodySize.y * 0.74f, 0.05f);
            Vector3 sideWallBase = new Vector3(sideX + 0.012f, baseOrigin.y + bodySize.y * 0.10f, baseOrigin.z);
            var sideEquip = BuildingPrimitives.CreateEquipmentWall("SideEquip", root.transform, sideWallSize, sideWallBase,
                plateColors, plateBody, hubColor, handleGrey, wallBacking, columns: 5, rows: 2);
            sideEquip.transform.rotation = Quaternion.Euler(0f, 90f, 0f);

            // ---- Roof: a PLAIN gable (same size/position as the Library's roof, for
            // matching massing) -- the brief's own call to keep the roof surface simple
            // and let the ridge barbell be the icon, rather than forcing an
            // equipment-themed re-skin of the open-book roof archetype. ----
            Vector3 roofBaseCenter = new Vector3(baseOrigin.x, wallTopY, baseOrigin.z);
            Vector3 roofSize = new Vector3(1.66f, 0.48f, 1.20f);
            BuildingPrimitives.CreateGableRoof("Roof", root.transform, roofSize, roofBaseCenter, roofCover);
            float ridgeTopY = wallTopY + roofSize.y;

            // ---- Ridge icon: a big barbell laid along the ridge (world Z, matching the
            // roof's own ridge axis exactly -- see CreateBarbell's doc comment on why this
            // is the one safe axis for its plates to face correctly). This is the Gym's
            // answer to the Library's open-book roof: the one silhouette element that
            // reads "gym" at a glance. ----
            Vector3 barbellCenter = new Vector3(baseOrigin.x, ridgeTopY + 0.05f, baseOrigin.z);
            BuildingPrimitives.CreateBarbell("RidgeBarbell", root.transform, barbellCenter, Vector3.forward,
                barLength: roofSize.z * 0.92f, barThickness: 0.035f, plateRadius: 0.135f, platesPerSide: 3,
                barColor: handleGrey, plateColors: plateColors, plateBodyColor: plateBody, hubColor: hubColor);

            // ---- Door: same arched-panel-as-door reuse the Library uses (frame color ==
            // glass color collapses CreateArchedWindow into a solid door). ----
            BuildingPrimitives.CreateArchedWindow("Door", root.transform,
                paneWidth: 0.20f, paneHeight: 0.28f, paneDepth: 0.05f,
                paneBottomCenter: new Vector3(baseOrigin.x, baseOrigin.y, frontZ + 0.05f),
                frameColor: doorColor, glassColor: doorColor);
            BuildHangingSign(root.transform, new Vector3(baseOrigin.x, baseOrigin.y + 0.34f, frontZ + 0.05f), doorColor, handleGrey, plateColors[0]);

            // ---- Windows: warm amber-glass arches flanking the door -- same position as
            // the Library's, no awnings this round (the brief's Gym cozy-detail list
            // doesn't ask for them, unlike the Library's explicit "open-book awning" ask). ----
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

            // ---- Chimney: same construction and position as the Library's, recoloured to
            // match this cottage's stone tone (unchanged from the Library's, both already
            // warm-neutral). ----
            Vector3 chimneyBase = new Vector3(baseOrigin.x + 0.34f, ridgeTopY - 0.10f, baseOrigin.z - 0.18f);
            BuildChimney(root.transform, chimneyBase, stoneColor, smokeColor);

            // ---- Entrance dressing: a potted plant, plus loose weight-plate/dumbbell
            // clusters on the ground -- the equipment equivalent of the Library's loose
            // book piles. ----
            BuildPottedPlant(root.transform, new Vector3(baseOrigin.x + 0.40f, baseOrigin.y, frontZ + 0.10f), potColor, leafColor);

            BuildingPrimitives.CreateWeightPlateStack("GroundStackA", root.transform,
                new Vector3(baseOrigin.x - 0.46f, baseOrigin.y, frontZ + 0.02f), 0.075f, 3, plateColors, plateBody, hubColor);
            BuildingPrimitives.CreateWeightPlateStack("GroundStackB", root.transform,
                new Vector3(baseOrigin.x - 0.60f, baseOrigin.y, frontZ - 0.05f), 0.06f, 2, plateColors, plateBody, hubColor);
            BuildingPrimitives.CreateDumbbell("GroundDumbbell", root.transform,
                new Vector3(sideX + 0.03f, baseOrigin.y + 0.045f, baseOrigin.z + 0.32f), Vector3.forward,
                barLength: 0.22f, barThickness: 0.03f, bellRadius: 0.05f, barColor: handleGrey, bellColor: plateColors[2]);

            // ---- Coquette touch: one pink gym towel draped over a small rail beside the
            // door -- the equipment-set equivalent of the Library's ribbon bookmark. ----
            Vector3 railCenter = new Vector3(baseOrigin.x - 0.26f, baseOrigin.y + 0.24f, frontZ + 0.04f);
            BuildTowelOnRail(root.transform, railCenter, handleGrey, towelPink);

            // ---- Tier ring: same convention as the Library, sized to enclose this
            // cottage's identical footprint, colored the category's own tone. ----
            MeshPrimitives.CreateFlatRing(
                "TierRing", root.transform,
                0.85f, 0.95f,
                new Vector3(baseOrigin.x, baseOrigin.y + 0.01f, baseOrigin.z),
                tierRingColor);

            return root;
        }

        /// <summary>Small stone chimney with a two-puff smoke curl -- identical
        /// construction to the Library's, kept as a self-contained copy per this kit's
        /// established "call shape, not shared bespoke code" convention.</summary>
        static void BuildChimney(Transform parent, Vector3 baseCenter, Color stoneColor, Color smokeColor)
        {
            Vector3 chimneySize = new Vector3(0.09f, 0.16f, 0.09f);
            BuildingPrimitives.CreateShadedBox("Chimney", parent, chimneySize, baseCenter, stoneColor);
            float topY = baseCenter.y + chimneySize.y;
            BuildingPrimitives.CreateAccentBlob("SmokePuff1", parent, 0.032f, new Vector3(baseCenter.x, topY + 0.03f, baseCenter.z), smokeColor);
            BuildingPrimitives.CreateAccentBlob("SmokePuff2", parent, 0.048f, new Vector3(baseCenter.x + 0.02f, topY + 0.09f, baseCenter.z), smokeColor);
        }

        /// <summary>A small wooden sign hanging from a short bracket, with a tiny dumbbell
        /// emblem in front of it -- the Gym's readable-at-a-glance rooftop-emblem idea
        /// from the original T004 spike, carried over as a door-sign accent instead.</summary>
        static void BuildHangingSign(Transform parent, Vector3 doorTopCenter, Color woodColor, Color barColor, Color bellColor)
        {
            Vector3 bracketSize = new Vector3(0.03f, 0.03f, 0.05f);
            BuildingPrimitives.CreateAccentBox("SignBracket", parent, bracketSize, doorTopCenter, woodColor);
            Vector3 signSize = new Vector3(0.22f, 0.055f, 0.02f);
            Vector3 signBase = new Vector3(doorTopCenter.x, doorTopCenter.y + bracketSize.y - 0.015f, doorTopCenter.z + 0.02f);
            BuildingPrimitives.CreateAccentBox("SignBoard", parent, signSize, signBase, woodColor);

            Vector3 emblemCenter = new Vector3(doorTopCenter.x, signBase.y + signSize.y * 1.4f, signBase.z + 0.015f);
            BuildingPrimitives.CreateDumbbell("SignEmblem", parent, emblemCenter, Vector3.right,
                barLength: 0.10f, barThickness: 0.012f, bellRadius: 0.022f, barColor: barColor, bellColor: bellColor);
        }

        /// <summary>A small potted plant: identical construction to the Library's.</summary>
        static void BuildPottedPlant(Transform parent, Vector3 baseCenter, Color potColor, Color leafColor)
        {
            Vector3 potSize = new Vector3(0.07f, 0.06f, 0.07f);
            BuildingPrimitives.CreateAccentBox("PlantPot", parent, potSize, baseCenter, potColor);
            var leaf = BuildingPrimitives.CreateAccentBlob("PlantLeaf", parent, 0.055f,
                new Vector3(baseCenter.x, baseCenter.y + potSize.y + 0.035f, baseCenter.z), leafColor);
            leaf.transform.localScale = new Vector3(1f, 1.3f, 1f);
        }

        /// <summary>
        /// The Gym's one coquette touch: a short wall-mounted rail (a thin horizontal bar,
        /// echoing the equipment theme) with a pink towel draped over it -- a single flat
        /// strip hanging down the front face, same "thin proud accent box" technique the
        /// Library's ribbon bookmark uses, without the swallowtail (a towel's cut end is
        /// straight, not notched).
        /// </summary>
        static void BuildTowelOnRail(Transform parent, Vector3 railCenter, Color railColor, Color towelPink)
        {
            BuildingPrimitives.CreateAccentBox("TowelRail", parent,
                new Vector3(0.14f, 0.016f, 0.016f), railCenter, railColor);

            float towelWidth = 0.075f, towelDepth = 0.014f, towelLength = 0.16f;
            Vector3 towelTop = new Vector3(railCenter.x, railCenter.y + 0.01f, railCenter.z + 0.014f);
            BuildingPrimitives.CreateAccentBox("Towel", parent,
                new Vector3(towelWidth, towelLength, towelDepth),
                new Vector3(towelTop.x, towelTop.y - towelLength, towelTop.z), towelPink);
        }
    }
}
