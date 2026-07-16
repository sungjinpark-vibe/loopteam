using UnityEngine;
using LifeTown.App.BuildingKit;
using LifeTown.App.Scene;

namespace LifeTown.App.Buildings
{
    /// <summary>
    /// Library (독서/Reading category) -- reshaped per the director's "form expresses
    /// meaning" note (docs/design/references/form-expresses-meaning-ref.jpg): the
    /// cozy-pastel tone/manner is kept, but the SILHOUETTE itself should read as
    /// "books," not a generic house with a book icon glued on top. Two changes from the
    /// original tall-tower archetype, both still built from BuildingPrimitives calls with
    /// concrete numbers, no new geometry:
    ///
    /// 1. Body = 3 stacked "book" volumes (progressively smaller, each a slightly
    ///    different pastel-purple tone, each nudged/yawed a few degrees off-axis) instead
    ///    of one uniform tower -- the building itself is a stack of books.
    /// 2. Roof = the same gable-prism shape as before, but recoloured pale (near-white
    ///    lavender, the category's Tint token) with a thin ink "spine" strip along the
    ///    ridge, so the roof itself reads as two open book pages meeting at a spine.
    ///
    /// Everything else (reading-purple palette, rooftop closed-book emblem, coquette bow,
    /// tier ring) is unchanged from the prior round.
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
            Color mid = Color.Lerp(base500, Color.white, 0.35f); // middle book's tone

            // Warm "lit from within" glass tone (T004 #5: window-lights read as occupied
            // regardless of the scene's own light direction).
            Color glass = CategoryPalette.FromHex("#FFEFC2");

            Vector3 baseOrigin = root.transform.position;

            // ---- Book 1 (bottom, largest): the building's "floor" -- door, window and
            // prop all sit on this layer, un-rotated so those flat accents stay flush. ----
            Vector3 book1Size = new Vector3(0.90f, 0.34f, 0.72f);
            BuildingPrimitives.CreateShadedBox("Book1_Walls", root.transform, book1Size, baseOrigin, base500);
            float top1Y = baseOrigin.y + book1Size.y;

            // ---- Book 2 (middle): smaller, lighter tone, nudged +X and yawed a few
            // degrees -- reads as a book dropped slightly askew on the stack, the same
            // small-rotation trick already proven safe on the rooftop book emblem's top
            // cover. ----
            Vector3 book2Size = new Vector3(0.78f, 0.30f, 0.62f);
            Vector3 book2Origin = new Vector3(baseOrigin.x + 0.025f, top1Y, baseOrigin.z);
            var book2 = BuildingPrimitives.CreateShadedBox("Book2_Walls", root.transform, book2Size, book2Origin, mid);
            book2.transform.rotation = Quaternion.Euler(0f, 4f, 0f);
            float top2Y = top1Y + book2Size.y;

            // ---- Book 3 (top, smallest): palest tone (category Tint), nudged -X and
            // yawed the other way -- the roof sits directly on this layer. ----
            Vector3 book3Size = new Vector3(0.64f, 0.26f, 0.52f);
            Vector3 book3Origin = new Vector3(baseOrigin.x - 0.03f, top2Y, baseOrigin.z);
            var book3 = BuildingPrimitives.CreateShadedBox("Book3_Walls", root.transform, book3Size, book3Origin, colors.Tint);
            book3.transform.rotation = Quaternion.Euler(0f, -6f, 0f);
            float top3Y = top2Y + book3Size.y;

            // ---- Roof: same gable-prism primitive as before, recoloured pale (Tint) so
            // its two sloped faces read as open-book pages rather than roof shingles, plus
            // a thin ink spine strip along the ridge -- the "open book" reading the
            // director's reference asked for, at the cost of one recolour + one extra
            // accent box (no new primitive). Centred on the main baseOrigin axis (not
            // Book3's own small offset) so door/window/bow/ring math below stays simple. ----
            Vector3 roofSize = new Vector3(book3Size.x * 1.30f, 0.55f, book3Size.z * 1.30f);
            Vector3 roofOrigin = new Vector3(baseOrigin.x, top3Y, baseOrigin.z);
            BuildingPrimitives.CreateGableRoof("Roof", root.transform, roofSize, roofOrigin, colors.Tint);
            float roofTopY = roofOrigin.y + roofSize.y;
            // The gable's front cap is a flat vertical triangle at this constant world Z
            // (the prism's local +Z plane), regardless of height within the roof.
            float roofApexFrontZ = baseOrigin.z + roofSize.z * 0.5f;

            BuildingPrimitives.CreateAccentBox(
                "RoofSpine", root.transform,
                new Vector3(0.035f, 0.05f, roofSize.z * 0.94f),
                new Vector3(baseOrigin.x, roofTopY, roofOrigin.z),
                ink);

            // ---- Rooftop emblem: the small closed book from the prior round, unchanged,
            // resting on the ridge -- "a book on top of an open book." ----
            BuildBookEmblem(root.transform, new Vector3(baseOrigin.x, roofTopY + 0.015f, roofOrigin.z), ink, colors.Tint);

            // ---- Door: flat ink-coloured panel on Book1's front (+Z) wall. ----
            float baseFrontZ = baseOrigin.z + book1Size.z * 0.5f;
            BuildingPrimitives.CreateAccentBox(
                "Door", root.transform,
                new Vector3(0.20f, 0.40f, 0.04f),
                new Vector3(baseOrigin.x, baseOrigin.y, baseFrontZ + 0.02f),
                ink);

            // ---- Title-band ribs: thin ink stripes across Book1 and Book3's front faces,
            // read as a book's spine-title band repeated at two heights on the stack (the
            // "spine ribs" reading from the director's brief), replacing the single
            // generic signage plate from the prior round. ----
            BuildingPrimitives.CreateAccentBox(
                "TitleBand_Book1", root.transform,
                new Vector3(0.50f, 0.05f, 0.02f),
                new Vector3(baseOrigin.x, baseOrigin.y + 0.20f, baseFrontZ + 0.015f),
                ink);
            float book3FrontZ = baseOrigin.z + book3Size.z * 0.5f;
            BuildingPrimitives.CreateAccentBox(
                "TitleBand_Book3", root.transform,
                new Vector3(0.36f, 0.04f, 0.02f),
                new Vector3(baseOrigin.x, top2Y + 0.12f, book3FrontZ + 0.015f),
                ink);

            // ---- Arched window on Book2's front face -- same framed-pane + icosphere-cap
            // construction as before (an unframed glass rectangle skews into an unreadable
            // parallelogram under true-iso projection; see IsoSceneSetup.ScreenRight),
            // resized to fit Book2's shorter layer height. ----
            float book2FrontZ = baseOrigin.z + book2Size.z * 0.5f;
            float paneWidth = 0.16f, paneHeight = 0.20f, paneDepth = 0.04f;
            float paneBottomY = top1Y + 0.05f;
            float paneTopY = paneBottomY + paneHeight;
            float frameMargin = 0.03f;
            float frameDepth = paneDepth * 0.6f;
            float frameBottomY = paneBottomY - frameMargin;
            float frameHeight = paneHeight + frameMargin * 2f;
            Vector3 capScale = new Vector3(1f, 0.9f, 0.35f); // flattened dome, not a full ball

            BuildingPrimitives.CreateAccentBox(
                "WindowFramePane", root.transform,
                new Vector3(paneWidth + frameMargin * 2f, frameHeight, frameDepth),
                new Vector3(baseOrigin.x, frameBottomY, book2FrontZ + 0.012f),
                ink);
            var frameCap = BuildingPrimitives.CreateAccentBlob(
                "WindowFrameArch", root.transform,
                paneWidth * 0.5f + frameMargin,
                new Vector3(baseOrigin.x, paneTopY, book2FrontZ + 0.012f),
                ink);
            frameCap.transform.localScale = capScale;

            BuildingPrimitives.CreateAccentBox(
                "WindowPane", root.transform,
                new Vector3(paneWidth, paneHeight, paneDepth),
                new Vector3(baseOrigin.x, paneBottomY, book2FrontZ + 0.03f),
                glass);
            var glassCap = BuildingPrimitives.CreateAccentBlob(
                "WindowArchCap", root.transform,
                paneWidth * 0.5f,
                new Vector3(baseOrigin.x, paneTopY, book2FrontZ + 0.03f),
                glass);
            glassCap.transform.localScale = capScale;

            // ---- Prop: the wall-mounted lantern beside the door, unchanged geometry,
            // repositioned to Book1's shorter wall height. ----
            float lanternX = baseOrigin.x + book1Size.x * 0.5f - 0.06f;
            float lanternY = baseOrigin.y + 0.24f;
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

            // ---- Coquette touch: unchanged tied-bow construction, pinned lower on the
            // (now pale) roof face, in front of the ridge spine/book emblem. ----
            float bowY = top3Y + roofSize.y * 0.30f;
            BuildCoquetteBow(root.transform, new Vector3(baseOrigin.x, bowY, roofApexFrontZ + 0.05f));

            // ---- Tier ring: unchanged convention, radius nudged to this narrower base
            // footprint (Book1 is narrower than the old base+upper tower). ----
            MeshPrimitives.CreateFlatRing(
                "TierRing", root.transform,
                0.60f, 0.68f,
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

        /// <summary>
        /// A small closed book: ink cover / tint pages / ink cover, three flat boxes
        /// stacked bottom-up (T004's "flat coloured rectangle" accent convention, same as
        /// the door and signage plate -- no new geometry). The top cover gets a small yaw
        /// so it reads as sitting slightly askew rather than a plain flat slab, which is
        /// what actually sells "book" instead of "box" at this render scale.
        /// `ridgeCenter` is the book's bottom-center resting point.
        /// </summary>
        static void BuildBookEmblem(Transform parent, Vector3 ridgeCenter, Color coverColor, Color pageColor)
        {
            Vector3 coverSize = new Vector3(0.20f, 0.035f, 0.13f);
            Vector3 pageSize = new Vector3(0.17f, 0.028f, 0.10f);

            BuildingPrimitives.CreateAccentBox("BookCoverBottom", parent, coverSize, ridgeCenter, coverColor);
            float pagesY = ridgeCenter.y + coverSize.y;

            BuildingPrimitives.CreateAccentBox("BookPages", parent, pageSize, new Vector3(ridgeCenter.x, pagesY, ridgeCenter.z), pageColor);
            float topCoverY = pagesY + pageSize.y;

            var topCover = BuildingPrimitives.CreateAccentBox("BookCoverTop", parent, coverSize, new Vector3(ridgeCenter.x, topCoverY, ridgeCenter.z), coverColor);
            topCover.transform.rotation = Quaternion.Euler(0f, 12f, 0f);
        }
    }
}
