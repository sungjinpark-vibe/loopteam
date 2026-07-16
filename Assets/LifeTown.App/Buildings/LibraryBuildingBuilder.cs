using UnityEngine;
using LifeTown.App.BuildingKit;
using LifeTown.App.Scene;

namespace LifeTown.App.Buildings
{
    /// <summary>
    /// Library (독서/Reading category) -- book-stack archetype, now on its third round.
    /// v1 (docs/design/spike-library-form-v1.png) turned only the ROOF into a tilted open
    /// book on top of an otherwise ordinary house body; at iso scale that read as a
    /// knocked-over card, not a book. v2 (spike-library-form-v2.png) rebuilt the whole
    /// body as a stack of books, which the director approved as a CONCEPT -- but each
    /// volume's front face was cream-and-striations edge to edge, so it read as a striped
    /// slab, not a book with a cover. v3 fixes that specific gap: a real book is a
    /// colored cover WRAPPING a cream page block, and that wrap (the cover framing the
    /// pages, plus a plain spine) is the cue v2 was missing. See <see
    /// cref="BuildingPrimitives.CreateBookVolume"/> and <see
    /// cref="BuildingPrimitives.CreateOpenBookCrown"/> for the actual fix; this builder's
    /// composition (4-book stack, alternating offsets, open-book crown, ribbon bookmark)
    /// is unchanged from v2 -- the director approved the concept, this round only tunes
    /// how each volume renders.
    ///
    /// Door/window/lantern remain dropped (as in v2): with the front faces carrying the
    /// page cue, extra ink accents competing for the same face risk burying it. Camera,
    /// ground tile, tier ring and lighting are unchanged from the prior rounds.
    /// </summary>
    public static class LibraryBuildingBuilder
    {
        public static GameObject Build(Transform parent, Vector3 footprintCenter)
        {
            var root = new GameObject("Library (독서 Tier1-S3)");
            root.transform.SetParent(parent, false);
            root.transform.position = footprintCenter;

            var colors = CategoryPalette.Get(BuildingCategory.Reading);
            Color ink = colors.Ink;
            // Cream/off-white page color -- distinct from every cover color, warm enough
            // to sit comfortably next to the existing warm "lit glass" tone (#FFEFC2)
            // used elsewhere in the kit.
            Color pageCream = CategoryPalette.FromHex("#FBF1DE");
            // Four distinct pastel covers, all in the lilac/lavender/periwinkle/soft-mint
            // range the brief calls for -- a real book stack is not one uniform hue, but
            // every value stays inside the same soft-saturation cozy-pastel family as the
            // rest of the palette (see CategoryPalette's own hex set for the target
            // lightness/saturation band).
            Color lilac = CategoryPalette.FromHex("#C6A9EE");
            Color lavender = CategoryPalette.FromHex("#A6A0E6");
            Color periwinkle = CategoryPalette.FromHex("#93AEEA");
            Color softMint = CategoryPalette.FromHex("#9FE0C4");
            Color bookmarkPink = CategoryPalette.PrimaryPink;

            Vector3 baseOrigin = root.transform.position;

            // ---- Book 1 (bottom, largest): flush, un-rotated -- the stack's "floor". ----
            Vector3 book1Size = new Vector3(0.92f, 0.26f, 0.74f);
            BuildingPrimitives.CreateBookVolume("Book1", root.transform, book1Size, baseOrigin, lilac, pageCream, ink, 5);
            float top1Y = baseOrigin.y + book1Size.y;

            // ---- Book 2: nudged +X, yawed +5 degrees -- first "dropped slightly askew"
            // offset in the pile. ----
            Vector3 book2Size = new Vector3(0.80f, 0.23f, 0.64f);
            Vector3 book2Origin = new Vector3(baseOrigin.x + 0.05f, top1Y, baseOrigin.z);
            var book2 = BuildingPrimitives.CreateBookVolume("Book2", root.transform, book2Size, book2Origin, lavender, pageCream, ink, 4);
            book2.transform.rotation = Quaternion.Euler(0f, 5f, 0f);
            float top2Y = top1Y + book2Size.y;

            // ---- Book 3: nudged -X (opposite side from Book2), yawed -7 degrees. ----
            Vector3 book3Size = new Vector3(0.66f, 0.20f, 0.54f);
            Vector3 book3Origin = new Vector3(baseOrigin.x - 0.06f, top2Y, baseOrigin.z);
            var book3 = BuildingPrimitives.CreateBookVolume("Book3", root.transform, book3Size, book3Origin, periwinkle, pageCream, ink, 4);
            book3.transform.rotation = Quaternion.Euler(0f, -7f, 0f);
            float top3Y = top2Y + book3Size.y;

            // ---- Book 4 (top, smallest): nudged +X again, yawed +6 degrees -- the open
            // book crown hinges directly above this layer. ----
            Vector3 book4Size = new Vector3(0.52f, 0.17f, 0.44f);
            Vector3 book4Origin = new Vector3(baseOrigin.x + 0.03f, top3Y, baseOrigin.z);
            var book4 = BuildingPrimitives.CreateBookVolume("Book4", root.transform, book4Size, book4Origin, softMint, pageCream, ink, 3);
            book4.transform.rotation = Quaternion.Euler(0f, 6f, 0f);
            float top4Y = top3Y + book4Size.y;

            // ---- Crown: one open book, generously sized (wingLength 0.62 is wider than
            // Book4's own 0.52 width, so its tips overhang past Book4's footprint into
            // open air rather than clipping through it) -- reads clearly as "pages
            // splayed open" at iso scale. Cover color reuses Book4's softMint for visual
            // continuity with the book it rests directly on. Ridge centred on the main
            // baseOrigin axis (not Book4's own small offset), same convention the prior
            // round used for the roof, so the crown sits visually centred on the pile. ----
            Vector3 ridgeCenter = new Vector3(baseOrigin.x, top4Y + 0.02f, baseOrigin.z);
            BuildingPrimitives.CreateOpenBookCrown(root.transform, ridgeCenter,
                wingLength: 0.62f, wingThickness: 0.075f, wingDepth: 0.46f, tiltDegrees: 20f,
                coverColor: softMint, pageColor: pageCream, inkColor: ink);

            // ---- Coquette touch: a pink ribbon bookmark hanging out from the seam
            // between Book1 and Book2, pinned to Book1's front face (the widest/most
            // forward one in Z, so it can't be hidden behind a farther-forward book below
            // it -- Book2 sits behind Book1's own front plane the same way Book3 sits
            // behind Book2's) -- a bookmark reinforces "reading" the way the tied bow used
            // elsewhere does not, per the brief's #5. ----
            float bookmarkFrontZ = baseOrigin.z + book1Size.z * 0.5f + 0.03f;
            Vector3 bookmarkTop = new Vector3(baseOrigin.x - 0.30f, top1Y + 0.02f, bookmarkFrontZ);
            BuildRibbonBookmark(root.transform, bookmarkTop, bookmarkPink);

            // ---- Tier ring: unchanged convention, sized to comfortably enclose Book1's
            // wider footprint (0.92 x 0.74, diagonal half-extent ~0.59). ----
            MeshPrimitives.CreateFlatRing(
                "TierRing", root.transform,
                0.62f, 0.70f,
                new Vector3(baseOrigin.x, baseOrigin.y + 0.01f, baseOrigin.z),
                lilac);

            return root;
        }

        /// <summary>
        /// A thin pink ribbon hanging straight down from `topAttach`, ending in a
        /// swallowtail: two shorter tails splayed +/-16 degrees from the main strip's
        /// bottom, faked without any boolean/CSG cut (this kit is pure additive boxes) by
        /// hinging two extra thin boxes at the same bottom pivot, same rotate-around-a-
        /// shared-pivot technique <see cref="BuildingPrimitives.CreateOpenBookCrown"/>
        /// uses for its wings.
        /// </summary>
        static void BuildRibbonBookmark(Transform parent, Vector3 topAttach, Color pink)
        {
            float stripWidth = 0.065f, stripDepth = 0.018f;
            float mainLength = 0.26f;
            Vector3 tailPivot = new Vector3(topAttach.x, topAttach.y - mainLength, topAttach.z);

            BuildingPrimitives.CreateAccentBox("BookmarkRibbon", parent,
                new Vector3(stripWidth, mainLength, stripDepth),
                new Vector3(topAttach.x, topAttach.y - mainLength, topAttach.z), pink);

            float tailLength = 0.09f;
            foreach (var side in new[] { -1f, 1f })
            {
                float angle = side * 16f;
                var rotation = Quaternion.Euler(0f, 0f, angle);
                Vector3 tailCenter = tailPivot + rotation * (Vector3.down * (tailLength * 0.5f));

                var tail = BuildingPrimitives.CreateAccentBox($"BookmarkTail{(side < 0f ? "L" : "R")}", parent,
                    new Vector3(stripWidth * 0.7f, tailLength, stripDepth),
                    tailCenter - Vector3.up * (tailLength * 0.5f), pink);
                tail.transform.rotation = rotation;
            }
        }
    }
}
