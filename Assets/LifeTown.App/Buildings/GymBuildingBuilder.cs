using UnityEngine;
using LifeTown.App.BuildingKit;
using LifeTown.App.Scene;

namespace LifeTown.App.Buildings
{
    /// <summary>
    /// Building #2: a Gym (운동/Exercise category), built to be the deliberate silhouette
    /// counterpoint to <see cref="LibraryBuildingBuilder"/> -- tall/narrow gable tower vs.
    /// wide/low flat-roof hall. Same BuildingKit calls, same tri-tone formula, same
    /// base+upper+roof+prop+ring composition rhythm as the Library (rubric V4:
    /// extensibility means a new category is new numbers, not new code), just with a
    /// different silhouette recipe: a low wall block, a shallow "clerestory" setback block
    /// (a raised strip for high windows -- the real-gym reason a wide box gets a second,
    /// shorter tier instead of a taller one), and a flat overhanging roof slab (built with
    /// the same <see cref="BuildingPrimitives.CreateShadedBox"/> used for walls -- a flat
    /// roof is just a short, wide, wide-footprint box; no new primitive was needed).
    /// </summary>
    public static class GymBuildingBuilder
    {
        public static GameObject Build(Transform parent, Vector3 footprintCenter)
        {
            var root = new GameObject("Gym (운동 Tier1-S3)");
            root.transform.SetParent(parent, false);
            root.transform.position = footprintCenter;

            var colors = CategoryPalette.Get(BuildingCategory.Exercise);
            Color base500 = colors.Base500;
            Color ink = colors.Ink;

            // Same warm "lit from within" glass tone as the Library -- an "occupied"
            // signal that reads independent of category (T004 #5).
            Color glass = CategoryPalette.FromHex("#FFEFC2");

            // ---- Base block (S1): wide, low hall -- the opposite proportions from the
            // Library's tall/narrow tower (1.50 wide x 0.85 deep x only 0.40 tall). ----
            Vector3 baseSize = new Vector3(1.50f, 0.40f, 0.85f);
            Vector3 baseOrigin = root.transform.position;
            BuildingPrimitives.CreateShadedBox("Walls", root.transform, baseSize, baseOrigin, base500);
            float baseTopY = baseOrigin.y + baseSize.y;

            // ---- Clerestory block (S2 addition): a shorter, setback upper strip (a real
            // gym's raised high-window band) instead of the Library's full-height second
            // storey -- keeps the tier-evolution language (base + added block) while the
            // building stays low overall. ----
            Vector3 upperSize = new Vector3(baseSize.x * 0.62f, 0.14f, baseSize.z * 0.62f);
            Vector3 upperOrigin = new Vector3(baseOrigin.x, baseTopY, baseOrigin.z);
            BuildingPrimitives.CreateShadedBox("Clerestory", root.transform, upperSize, upperOrigin, base500);
            float upperTopY = upperOrigin.y + upperSize.y;

            // ---- Roof (S3 addition): a flat, overhanging slab -- deliberately NOT the
            // Library's steep gable, per the brief's "distinct silhouette by shape" ask.
            // Built with the same CreateShadedBox used for walls: a flat roof is just a
            // wide, short box, so it still gets the tri-tone shading for free. ----
            Vector3 roofSize = new Vector3(baseSize.x * 1.15f, 0.11f, baseSize.z * 1.15f);
            Vector3 roofOrigin = new Vector3(baseOrigin.x, upperTopY, baseOrigin.z);
            BuildingPrimitives.CreateShadedBox("Roof", root.transform, roofSize, roofOrigin, base500);
            float roofTopY = roofOrigin.y + roofSize.y;

            // ---- Rooftop emblem: a small dumbbell, centred on the flat roof so it's the
            // first thing seen (director feedback -- building TYPE must read from a
            // recognizable rooftop object, not just silhouette/color). ----
            BuildDumbbellEmblem(root.transform, new Vector3(baseOrigin.x, roofTopY + 0.03f, baseOrigin.z), ink);

            // ---- Big entrance door: wide flat ink panel on the base block's front (+Z)
            // wall, sized up from the Library's door per the brief's "big entrance". ----
            float baseFrontZ = baseOrigin.z + baseSize.z * 0.5f;
            BuildingPrimitives.CreateAccentBox(
                "Door", root.transform,
                new Vector3(0.46f, 0.28f, 0.045f),
                new Vector3(baseOrigin.x, baseOrigin.y, baseFrontZ + 0.02f),
                ink);

            // ---- Signage plate: same T004 #3.2 S2 rule as the Library -- a flat
            // category.ink rectangle reading "occupied" with no text needed. ----
            BuildingPrimitives.CreateAccentBox(
                "SignagePlate", root.transform,
                new Vector3(0.55f, 0.09f, 0.02f),
                new Vector3(baseOrigin.x, baseOrigin.y + 0.32f, baseFrontZ + 0.015f),
                ink);

            // ---- Two square windows flanking the door: framed the same way as the
            // Library's window (an ink frame pane behind a smaller glass pane) for the same
            // reason -- an unframed glass rectangle skews into an unreadable parallelogram
            // under true-iso projection. Square (no arch cap) here on purpose: it reads as
            // a plainer, modern gym-hall window rather than the Library's arched one. ----
            float windowY = baseOrigin.y + 0.22f;
            float windowXOffset = baseSize.x * 0.30f;
            Vector3 paneSize = new Vector3(0.16f, 0.16f, 0.045f);
            float frameMargin = 0.03f;
            Vector3 frameSize = new Vector3(paneSize.x + frameMargin * 2f, paneSize.y + frameMargin * 2f, paneSize.z * 0.6f);
            foreach (float side in new[] { -1f, 1f })
            {
                float x = baseOrigin.x + windowXOffset * side;
                BuildingPrimitives.CreateAccentBox(
                    "WindowFrame", root.transform, frameSize,
                    new Vector3(x, windowY, baseFrontZ + 0.012f), ink);
                BuildingPrimitives.CreateAccentBox(
                    "WindowPane", root.transform, paneSize,
                    new Vector3(x, windowY, baseFrontZ + 0.03f), glass);
            }

            // ---- Prop: the Library's wall-mounted lantern, same geometry, just recoloured
            // via the category tokens above and moved beside this building's wider door
            // (T004 #5's "one recolour-only prop, identical geometry across categories"). ----
            float lanternX = baseOrigin.x + baseSize.x * 0.5f - 0.08f;
            float lanternY = baseOrigin.y + 0.16f;
            BuildingPrimitives.CreateAccentBox(
                "WallLanternArm", root.transform,
                new Vector3(0.05f, 0.03f, 0.05f),
                new Vector3(lanternX, lanternY, baseFrontZ + 0.02f),
                ink);
            BuildingPrimitives.CreateAccentBlob(
                "WallLanternHead", root.transform,
                0.045f,
                new Vector3(lanternX, lanternY + 0.06f, baseFrontZ + 0.05f),
                glass);

            // ---- Coquette touch: the Library's exact tied-bow construction (proven to
            // render correctly under true-iso), moved from a gable apex (which this
            // building doesn't have) to the flat roof's front edge, so the identity
            // language ("one coquette touch per building") holds without gambling on new
            // unproven geometry. ----
            float roofFrontZ = baseOrigin.z + roofSize.z * 0.5f;
            Vector3 bowCenter = new Vector3(baseOrigin.x, roofTopY + 0.03f, roofFrontZ - 0.06f);
            BuildCoquetteBow(root.transform, bowCenter);

            // ---- Tier ring: same maxed-tier convention as the Library, sized up to sit
            // under this building's wider footprint. ----
            MeshPrimitives.CreateFlatRing(
                "TierRing", root.transform,
                0.85f, 0.95f,
                new Vector3(baseOrigin.x, baseOrigin.y + 0.01f, baseOrigin.z),
                base500);

            return root;
        }

        /// <summary>Identical construction to LibraryBuildingBuilder.BuildCoquetteBow --
        /// duplicated rather than shared to keep each builder a self-contained, copyable
        /// pattern per T004's "call shape, not shared bespoke code" extensibility note.</summary>
        static void BuildCoquetteBow(Transform parent, Vector3 center)
        {
            Color pink = CategoryPalette.PrimaryPink;
            var bow = new GameObject("CoquetteBow");
            bow.transform.SetParent(parent, false);
            bow.transform.position = center;

            Vector3 spreadAxis = IsoSceneSetup.ScreenRight;
            const float loopOffset = 0.065f;

            foreach (var side in new[] { -1f, 1f })
            {
                Vector3 loopCenter = center + spreadAxis * (loopOffset * side) + Vector3.up * 0.01f;
                var loop = BuildingPrimitives.CreateAccentBlob("BowLoop", bow.transform, 0.06f, loopCenter, pink);
                loop.transform.localScale = new Vector3(1.35f, 1.0f, 0.55f);
            }
            BuildingPrimitives.CreateAccentBlob("BowKnot", bow.transform, 0.04f, center + IsoSceneSetup.IsoDirection * 0.02f, pink);
        }

        /// <summary>
        /// A small dumbbell: a thin bar box rotated to lie along IsoSceneSetup.ScreenRight
        /// (the true on-screen horizontal axis, same technique the Library's bow uses for
        /// its two loops) with a round plate blob at each end. Quaternion.FromToRotation
        /// maps the box's default local +X edge onto that axis directly, so this is correct
        /// regardless of Unity's rotation-sign convention -- no hand-derived angle needed.
        /// </summary>
        static void BuildDumbbellEmblem(Transform parent, Vector3 center, Color color)
        {
            var emblem = new GameObject("DumbbellEmblem");
            emblem.transform.SetParent(parent, false);
            emblem.transform.position = center;

            Vector3 axis = IsoSceneSetup.ScreenRight;
            const float plateOffset = 0.11f;
            const float plateRadius = 0.055f;

            var bar = BuildingPrimitives.CreateAccentBox(
                "DumbbellBar", emblem.transform,
                new Vector3(plateOffset * 2f, 0.03f, 0.03f),
                center, color);
            bar.transform.rotation = Quaternion.FromToRotation(Vector3.right, axis);

            foreach (var side in new[] { -1f, 1f })
            {
                Vector3 plateCenter = center + axis * (plateOffset * side);
                var plate = BuildingPrimitives.CreateAccentBlob("DumbbellPlate", emblem.transform, plateRadius, plateCenter, color);
                plate.transform.localScale = new Vector3(0.8f, 1.25f, 0.8f); // taller than wide -- reads as a weight-plate disc, not a ball
            }
        }
    }
}
