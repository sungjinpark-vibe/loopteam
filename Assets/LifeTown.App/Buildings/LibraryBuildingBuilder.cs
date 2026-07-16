using UnityEngine;
using LifeTown.App.BuildingKit;
using LifeTown.App.Scene;

namespace LifeTown.App.Buildings
{
    /// <summary>
    /// The T007 go/no-go spike building: a Library (독서/Reading category). Archetype per
    /// docs/design/01-asset-strategy.md #3 step 1: "gentle gable roof, small arched
    /// window." Composed at the T004 #3.2 S3 (maxed Tier1) stage -- base block + upper
    /// setback block + roof cap + a prop -- so the tier/level visual language (rubric V3)
    /// is legible on this single instance, plus a ground-level tier ring and one
    /// coquette touch (a small tied bow pinned to the front gable, per the task brief's
    /// "pick one" list).
    ///
    /// Everything here is assembled from BuildingPrimitives/MeshPrimitives calls with
    /// concrete numbers -- there is no bespoke mesh sculpted for "Library" specifically;
    /// a Study or Work building would be the same call shape with a different
    /// BuildingCategory and different archetype numbers (rubric V4: extensibility).
    /// </summary>
    public static class LibraryBuildingBuilder
    {
        public static GameObject Build(Transform parent, Vector3 footprintCenter)
        {
            var root = new GameObject("Library (독서 Tier1-S3)");
            root.transform.SetParent(parent, false);
            root.transform.position = footprintCenter;

            var colors = CategoryPalette.Get(BuildingCategory.Reading);
            Color base500 = colors.Base500;
            Color ink = colors.Ink;

            // Warm "lit from within" glass tone (T004 #5: window-lights read as occupied
            // regardless of the scene's own light direction).
            Color glass = CategoryPalette.FromHex("#FFEFC2");

            // ---- Base block (S1): the bare mass. Tall footprint per the brief's
            // "tall, steep pitched roof" ask. ----
            Vector3 baseSize = new Vector3(0.85f, 0.95f, 0.70f);
            Vector3 baseOrigin = root.transform.position;
            BuildingPrimitives.CreateShadedBox("Walls", root.transform, baseSize, baseOrigin, base500);
            float baseTopY = baseOrigin.y + baseSize.y;

            // ---- Upper block (S2 addition): same base + one added block, setback 20%,
            // height +0.4-ish per T004 #3.2. ----
            Vector3 upperSize = new Vector3(baseSize.x * 0.75f, 0.50f, baseSize.z * 0.75f);
            Vector3 upperOrigin = new Vector3(baseOrigin.x, baseTopY, baseOrigin.z);
            BuildingPrimitives.CreateShadedBox("UpperBlock", root.transform, upperSize, upperOrigin, base500);
            float upperTopY = upperOrigin.y + upperSize.y;

            // ---- Roof cap (S3 addition): steep gable, slight eave overhang. ----
            Vector3 roofSize = new Vector3(upperSize.x * 1.30f, 0.62f, upperSize.z * 1.30f);
            Vector3 roofOrigin = new Vector3(baseOrigin.x, upperTopY, baseOrigin.z);
            BuildingPrimitives.CreateGableRoof("Roof", root.transform, roofSize, roofOrigin, base500);
            // The gable's front cap is a flat vertical triangle at this constant world Z
            // (the prism's local +Z plane), regardless of height within the roof.
            float roofApexFrontZ = baseOrigin.z + roofSize.z * 0.5f;

            // ---- Door: flat ink-coloured panel on the base block's front (+Z) wall. ----
            float baseFrontZ = baseOrigin.z + baseSize.z * 0.5f;
            BuildingPrimitives.CreateAccentBox(
                "Door", root.transform,
                new Vector3(0.20f, 0.40f, 0.04f),
                new Vector3(baseOrigin.x, baseOrigin.y, baseFrontZ + 0.02f),
                ink);

            // ---- Signage plate: T004 #3.2 S2 rule -- a flat category.ink rectangle,
            // reads as "occupied" with no text needed. ----
            BuildingPrimitives.CreateAccentBox(
                "SignagePlate", root.transform,
                new Vector3(0.46f, 0.10f, 0.02f),
                new Vector3(baseOrigin.x, baseOrigin.y + 0.56f, baseFrontZ + 0.015f),
                ink);

            // ---- Arched window on the upper block's front face: rectangular pane + a
            // rounded cap = the archetype's "small arched window," with an ink-coloured
            // frame a size larger sitting just behind both pieces. Round-1 finding: an
            // unframed glass-only window under true-iso projection (which turns a flat
            // front-face rectangle into a slanted parallelogram, not an upright rectangle --
            // see IsoSceneSetup.ScreenRight) read as an unreadable diamond. A darker frame
            // outline gives the eye a second, larger silhouette to anchor "this is a window
            // with a rounded top" even though the glass itself is skewed by the camera.
            //
            // The cap is a squashed icosphere (BuildingPrimitives.CreateAccentBlob) centred
            // ON the pane's top edge -- its lower half sinks into/behind the pane (hidden)
            // and its upper half domes above it, reading as a rounded arch cap. This
            // replaced a hand-authored semicircle mesh (MeshPrimitives.CreateSemicircleCap)
            // that rendered as a sharp, near-invisible point rather than a curve at this
            // camera distance/depth -- the icosphere path is the same primitive already
            // proven visible elsewhere in this render (door lantern, bow, tier ring), so it
            // carries far less risk than a bespoke mesh. ----
            float upperFrontZ = baseOrigin.z + upperSize.z * 0.5f;
            float paneWidth = 0.22f, paneHeight = 0.34f, paneDepth = 0.045f;
            float paneBottomY = upperOrigin.y + 0.09f;
            float paneTopY = paneBottomY + paneHeight;
            float frameMargin = 0.045f; // symmetric margin added on every side of the frame
            float frameDepth = paneDepth * 0.6f; // sits behind the glass, never in front of it
            float frameBottomY = paneBottomY - frameMargin;
            float frameHeight = paneHeight + frameMargin * 2f;
            Vector3 capScale = new Vector3(1f, 0.9f, 0.35f); // flattened dome, not a full ball

            // Frame pane (drawn first == behind, offset back in Z).
            BuildingPrimitives.CreateAccentBox(
                "WindowFramePane", root.transform,
                new Vector3(paneWidth + frameMargin * 2f, frameHeight, frameDepth),
                new Vector3(baseOrigin.x, frameBottomY, upperFrontZ + 0.012f),
                ink);
            var frameCap = BuildingPrimitives.CreateAccentBlob(
                "WindowFrameArch", root.transform,
                paneWidth * 0.5f + frameMargin,
                new Vector3(baseOrigin.x, paneTopY, upperFrontZ + 0.012f),
                ink);
            frameCap.transform.localScale = capScale;

            // Glass pane + arch cap (drawn on top, offset front in Z).
            BuildingPrimitives.CreateAccentBox(
                "WindowPane", root.transform,
                new Vector3(paneWidth, paneHeight, paneDepth),
                new Vector3(baseOrigin.x, paneBottomY, upperFrontZ + 0.03f),
                glass);
            var glassCap = BuildingPrimitives.CreateAccentBlob(
                "WindowArchCap", root.transform,
                paneWidth * 0.5f,
                new Vector3(baseOrigin.x, paneTopY, upperFrontZ + 0.03f),
                glass);
            glassCap.transform.localScale = capScale;

            // ---- Prop (S3 rule: one recolour-only prop, identical geometry across
            // categories): a small wall-mounted lantern beside the door. Round-1 moved this
            // off the roof ridge -- sharing the peak with the coquette bow made both read as
            // "clutter"; a wall sconce beside the entrance keeps the "occupied, lit" prop
            // language without competing with the roof silhouette. ----
            float lanternX = baseOrigin.x + baseSize.x * 0.5f - 0.06f;
            float lanternY = baseOrigin.y + 0.32f;
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

            // ---- Coquette touch: a small tied bow pinned to the front gable, centred on
            // the true on-screen horizontal axis (IsoSceneSetup.ScreenRight) rather than raw
            // world X/Z, and sat lower on the gable face (not at the ridge tip) so it never
            // shares screen space with the roof peak. ----
            float bowY = upperTopY + roofSize.y * 0.30f;
            BuildCoquetteBow(root.transform, new Vector3(baseOrigin.x, bowY, roofApexFrontZ + 0.05f));

            // ---- Tier ring: T004's construction/progress-ring convention, shown here
            // as a maxed-tier indicator glowing in the category's pure 500 hue. ----
            MeshPrimitives.CreateFlatRing(
                "TierRing", root.transform,
                0.56f, 0.63f,
                new Vector3(baseOrigin.x, baseOrigin.y + 0.01f, baseOrigin.z),
                base500);

            return root;
        }

        /// <summary>
        /// Two puffy round loops spread symmetrically along the camera's actual on-screen
        /// horizontal axis (IsoSceneSetup.ScreenRight -- a mix of world X/Z, not raw world
        /// X) plus a small centre knot, all left unrotated. Round-1 bug: the loops were
        /// squashed into thin elongated petals and offset via each blob's own
        /// *post-rotation* local `right` (which differs per side), so the two halves were
        /// not mirror-symmetric in world space and the bow drifted to one side on screen,
        /// reading as a stray sideways appendage. Keeping the loops round removes any need
        /// for directional alignment -- symmetry now depends only on the shared spread axis,
        /// which is guaranteed mirror-symmetric regardless of camera angle.
        /// </summary>
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
                loop.transform.localScale = new Vector3(1.35f, 1.0f, 0.55f); // puffy, not a thin petal
            }
            BuildingPrimitives.CreateAccentBlob("BowKnot", bow.transform, 0.04f, center + IsoSceneSetup.IsoDirection * 0.02f, pink);
        }
    }
}
