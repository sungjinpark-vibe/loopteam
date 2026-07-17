using UnityEngine;
using LifeTown.App.BuildingKit;
using LifeTown.App.Scene;

namespace LifeTown.App.Buildings
{
    /// <summary>
    /// Library (독서/Reading category) -- v4 reshape, a bigger concept change than v2/v3's
    /// tuning passes. Director reference: docs/design/references/library-cottage-ref.png.
    /// v1-v3 were all "a stack of books" (see those files' own history notes); the
    /// director approved that concept's underlying material -- books -- but asked for a
    /// different WHOLE: not a bare stack, but a cozy storybook COTTAGE built out of that
    /// material. So v4 keeps a house's actual anatomy (walls + gabled roof + door +
    /// windows + chimney) and re-skins every part in books:
    ///
    /// 1. Walls = <see cref="BuildingPrimitives.CreateBookSpineWall"/> -- packed rows of
    ///    colorful book spines cladding the front and side faces of an ordinary wood-tone
    ///    wall box. This is the signature cue the reference leads with.
    /// 2. Roof = <see cref="BuildingPrimitives.CreateOpenBookRoof"/> -- a whole gable
    ///    recolored as an open book ("Roof of Wisdom" in the reference). Built on
    ///    CreateGableRoof's proven single-prism shape rather than v2/v3's
    ///    CreateOpenBookCrown (two independently rotated boxes): that primitive has no
    ///    gable-end wall, which small-scale uses never exposed but which left a real
    ///    gap at whole-roof scale (see CreateOpenBookRoof's own doc comment).
    /// 3. Small open-book awnings (<see cref="BuildingPrimitives.CreateOpenBookAwning"/>)
    ///    canopy the two windows.
    /// 4. Cozy extras within a stylized low-poly budget: warm amber-glass windows (<see
    ///    cref="BuildingPrimitives.CreateArchedWindow"/>, reused for the door too), a
    ///    chimney with a two-puff smoke curl, a hanging signboard over the door, potted
    ///    plants by the entrance, and a small loose stack of books
    ///    (<see cref="BuildingPrimitives.CreateBookVolume"/>, v3's book-cover primitive)
    ///    beside the steps.
    ///
    /// The one coquette touch (brief: keep exactly one) is the pink ribbon bookmark,
    /// carried over from v2/v3 but now tucked under the roof's front eave instead of
    /// between two stacked books. Camera, ground tile, and the purple tier ring are
    /// unchanged -- the ring stays the category's own purple rather than the cottage's
    /// warm palette, per the brief's explicit "keep the purple glow ring."
    /// </summary>
    public static class LibraryBuildingBuilder
    {
        public static GameObject Build(Transform parent, Vector3 footprintCenter)
        {
            var root = new GameObject("Library (독서 Tier1-S3)");
            root.transform.SetParent(parent, false);
            root.transform.position = footprintCenter;

            var colors = CategoryPalette.Get(BuildingCategory.Reading);

            // Warm storybook-cottage palette (brief: keep the pastel base but warm it and
            // enrich the book-spine colors -- these are deliberately more saturated than
            // the flat single-hue lilac v2/v3 used, because the wall's whole job now is to
            // look like "many different colorful books", not one uniform tone).
            Color[] spinePalette =
            {
                CategoryPalette.FromHex("#C1543F"), // brick red
                CategoryPalette.FromHex("#4C8C6B"), // forest green
                CategoryPalette.FromHex("#D9A441"), // mustard gold
                CategoryPalette.FromHex("#3D8F94"), // teal
                CategoryPalette.FromHex("#8B5E3C"), // warm brown
                CategoryPalette.FromHex("#7A5A8C"), // plum -- ties back to the category's own purple identity
                CategoryPalette.FromHex("#C97B84"), // dusty rose
                CategoryPalette.FromHex("#EADFC5"), // cream
                CategoryPalette.FromHex("#3E5C82"), // navy
                CategoryPalette.FromHex("#A8763E"), // amber brown
            };
            Color wallBacking = CategoryPalette.FromHex("#5C4430"); // dark warm wood, seam backing
            Color woodTrim = CategoryPalette.FromHex("#8B6B4A");    // warm wood body tone (visible at margins)
            Color roofCover = CategoryPalette.FromHex("#7A4B32");   // leatherbound "roof book" cover
            Color pageCream = CategoryPalette.FromHex("#FBF1DE");   // consistent cream across every round
            Color windowFrame = CategoryPalette.FromHex("#5C4430");
            Color windowGlow = CategoryPalette.FromHex("#FFCE7A");  // warm amber -- "someone's home"
            Color doorColor = CategoryPalette.FromHex("#4A3220");
            Color stoneColor = CategoryPalette.FromHex("#9C8878");
            Color smokeColor = new Color(0.88f, 0.88f, 0.86f, 1f);
            Color potColor = CategoryPalette.FromHex("#B5602E");
            Color leafColor = CategoryPalette.FromHex("#5FA06A");
            Color bookmarkPink = CategoryPalette.PrimaryPink;
            Color purpleRing = colors.Base500; // brief: keep the purple glow ring as-is

            Vector3 baseOrigin = root.transform.position;

            // ---- Cottage body: a plain warm-wood box. Mostly hidden behind the spine
            // cladding and roof -- what shows through is the "timber frame" margin around
            // the books, echoing the reference's exposed wood corners/eaves. ----
            Vector3 bodySize = new Vector3(1.30f, 0.50f, 1.00f);
            BuildingPrimitives.CreateShadedBox("CottageWalls", root.transform, bodySize, baseOrigin, woodTrim);
            float wallTopY = baseOrigin.y + bodySize.y;
            float frontZ = baseOrigin.z + bodySize.z * 0.5f;
            float sideX = baseOrigin.x + bodySize.x * 0.5f;

            // ---- Front wall: packed book spines, proud of the wood body, leaving a
            // narrow wood margin top/bottom/sides as a "frame" around the cladding. ----
            Vector3 frontWallSize = new Vector3(bodySize.x * 0.93f, bodySize.y * 0.74f, 0.05f);
            Vector3 frontWallBase = new Vector3(baseOrigin.x, baseOrigin.y + bodySize.y * 0.10f, frontZ + 0.012f);
            BuildingPrimitives.CreateBookSpineWall("FrontSpines", root.transform, frontWallSize, frontWallBase, spinePalette, wallBacking, columns: 10, rows: 2);

            // ---- Side wall (+X, the face the iso camera actually sees): same panel,
            // built in its native front-facing orientation then rotated 90 degrees around
            // its own already-correctly-placed pivot -- the same rotate-after-creation
            // technique CreateOpenBookCrown's wings use, so its spread axis (wallSize.x)
            // becomes world Z and its thin proud axis (wallSize.z) becomes world X. ----
            Vector3 sideWallSize = new Vector3(bodySize.z * 0.90f, bodySize.y * 0.74f, 0.05f);
            Vector3 sideWallBase = new Vector3(sideX + 0.012f, baseOrigin.y + bodySize.y * 0.10f, baseOrigin.z);
            var sideSpines = BuildingPrimitives.CreateBookSpineWall("SideSpines", root.transform, sideWallSize, sideWallBase, spinePalette, wallBacking, columns: 6, rows: 2);
            sideSpines.transform.rotation = Quaternion.Euler(0f, 90f, 0f);

            // ---- Roof: CreateOpenBookRoof ("Roof of Wisdom") -- a single continuous
            // gable prism (proven gap-free under this iso camera) recolored as an open
            // book: cream sloped "pages", a leatherbound cover-brown gable-end cap, a
            // chunky ridge spine, and page-line striations on both slopes. size.x/size.z
            // deliberately exceed the walls so the roof overhangs on every side, same as a
            // real cottage eave.
            //
            // NOTE (round 2 of this pass): the first attempt reused CreateOpenBookCrown
            // (two independently Z-rotated boxes, no gable-end wall) scaled up to roof
            // size. It rendered as two disconnected-looking flat platforms with the
            // wall's own flat top exposed between them -- CreateOpenBookCrown has no
            // triangular gable-end cap to close that gap, which small-scale uses (a
            // book's own crown, sitting on more books) never exposed. CreateGableRoof's
            // single prism mesh has no such gap (see docs/design/spike-library.png, its
            // own gable renders as one solid connected shape under this exact camera), so
            // CreateOpenBookRoof uses that as its structural base instead. ----
            Vector3 roofBaseCenter = new Vector3(baseOrigin.x, wallTopY, baseOrigin.z);
            Vector3 roofSize = new Vector3(1.66f, 0.48f, 1.20f);
            BuildingPrimitives.CreateOpenBookRoof("Roof", root.transform, roofSize, roofBaseCenter,
                coverColor: roofCover, pageColor: pageCream, inkColor: wallBacking, lineCount: 5);
            float ridgeTopY = wallTopY + roofSize.y;

            // ---- Door: CreateArchedWindow reused with frame color == glass color, which
            // collapses the "glass" into a solid arched panel -- a door, for free, with no
            // second arch primitive needed. ----
            BuildingPrimitives.CreateArchedWindow("Door", root.transform,
                paneWidth: 0.20f, paneHeight: 0.28f, paneDepth: 0.05f,
                paneBottomCenter: new Vector3(baseOrigin.x, baseOrigin.y, frontZ + 0.05f),
                frameColor: doorColor, glassColor: doorColor);
            BuildHangingSign(root.transform, new Vector3(baseOrigin.x, baseOrigin.y + 0.34f, frontZ + 0.05f), doorColor);

            // ---- Windows: warm amber-glass arches flanking the door, each with a small
            // open-book awning canopy above it. Both proud enough in Z to clearly punch
            // through the spine wall's own proud face. ----
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

                Vector3 hinge = new Vector3(wx, windowY + 0.16f + 0.07f, frontZ + 0.015f);
                BuildingPrimitives.CreateOpenBookAwning($"Awning{tag}", root.transform, hinge,
                    width: 0.20f, depth: 0.15f, thickness: 0.022f, tiltDegrees: 32f, roofCover, pageCream);
            }

            // ---- Chimney: resting on the roof near the ridge, offset to one side, with a
            // small two-puff smoke curl -- cheap, but it is the single cue that most says
            // "lived-in cottage" rather than "book sculpture". ----
            Vector3 chimneyBase = new Vector3(baseOrigin.x + 0.34f, ridgeTopY - 0.10f, baseOrigin.z - 0.18f);
            BuildChimney(root.transform, chimneyBase, stoneColor, smokeColor);

            // ---- Entrance dressing: a potted plant on each side of the door, and a small
            // loose stack of 2 books beside the steps (CreateBookVolume, v3's book-cover
            // primitive, reused here for "any stacked books" per the brief). ----
            BuildPottedPlant(root.transform, new Vector3(baseOrigin.x - 0.34f, baseOrigin.y, frontZ + 0.10f), potColor, leafColor);
            BuildPottedPlant(root.transform, new Vector3(baseOrigin.x + 0.40f, baseOrigin.y, frontZ + 0.10f), potColor, leafColor);

            Vector3 miniStackBase = new Vector3(baseOrigin.x - 0.46f, baseOrigin.y, frontZ + 0.02f);
            BuildingPrimitives.CreateBookVolume("MiniStackBook1", root.transform,
                new Vector3(0.16f, 0.05f, 0.12f), miniStackBase, spinePalette[1], pageCream, wallBacking, 2);
            float miniTop1Y = miniStackBase.y + 0.05f;
            BuildingPrimitives.CreateBookVolume("MiniStackBook2", root.transform,
                new Vector3(0.13f, 0.045f, 0.10f), new Vector3(miniStackBase.x + 0.01f, miniTop1Y, miniStackBase.z), spinePalette[4], pageCream, wallBacking, 2)
                .transform.rotation = Quaternion.Euler(0f, 8f, 0f);

            // ---- Coquette touch: the pink ribbon bookmark, hanging from the roof's own
            // front gable-cap face (the open book's cover edge) -- an open, uncluttered
            // area of the render, and thematically the brief's own suggestion ("hang it
            // from the open book roof"). ----
            Vector3 bookmarkTop = new Vector3(baseOrigin.x + 0.14f, wallTopY + 0.16f, baseOrigin.z + roofSize.z * 0.5f + 0.02f);
            BuildRibbonBookmark(root.transform, bookmarkTop, bookmarkPink);

            // ---- Tier ring: unchanged convention and color (purple, per the brief),
            // sized to enclose the wider cottage footprint. ----
            MeshPrimitives.CreateFlatRing(
                "TierRing", root.transform,
                0.85f, 0.95f,
                new Vector3(baseOrigin.x, baseOrigin.y + 0.01f, baseOrigin.z),
                purpleRing);

            return root;
        }

        /// <summary>Small stone chimney (a plain shaded box) with a two-puff smoke curl
        /// above it -- the puffs grow in radius with height, the cheapest way to suggest
        /// "rising smoke" with two icosphere accents.</summary>
        static void BuildChimney(Transform parent, Vector3 baseCenter, Color stoneColor, Color smokeColor)
        {
            Vector3 chimneySize = new Vector3(0.09f, 0.16f, 0.09f);
            BuildingPrimitives.CreateShadedBox("Chimney", parent, chimneySize, baseCenter, stoneColor);
            float topY = baseCenter.y + chimneySize.y;
            BuildingPrimitives.CreateAccentBlob("SmokePuff1", parent, 0.032f, new Vector3(baseCenter.x, topY + 0.03f, baseCenter.z), smokeColor);
            BuildingPrimitives.CreateAccentBlob("SmokePuff2", parent, 0.048f, new Vector3(baseCenter.x + 0.02f, topY + 0.09f, baseCenter.z), smokeColor);
        }

        /// <summary>A small wooden sign hanging from a short bracket -- the reference's
        /// "책의 집" plaque, minus any text this stylized kit can't render.</summary>
        static void BuildHangingSign(Transform parent, Vector3 doorTopCenter, Color woodColor)
        {
            Vector3 bracketSize = new Vector3(0.03f, 0.03f, 0.05f);
            BuildingPrimitives.CreateAccentBox("SignBracket", parent, bracketSize, doorTopCenter, woodColor);
            Vector3 signSize = new Vector3(0.22f, 0.055f, 0.02f);
            Vector3 signBase = new Vector3(doorTopCenter.x, doorTopCenter.y + bracketSize.y - 0.015f, doorTopCenter.z + 0.02f);
            BuildingPrimitives.CreateAccentBox("SignBoard", parent, signSize, signBase, woodColor);
        }

        /// <summary>A small potted plant: a box pot plus a squashed-tall icosphere for
        /// foliage -- the reference's entrance greenery, at spike-appropriate cost.</summary>
        static void BuildPottedPlant(Transform parent, Vector3 baseCenter, Color potColor, Color leafColor)
        {
            Vector3 potSize = new Vector3(0.07f, 0.06f, 0.07f);
            BuildingPrimitives.CreateAccentBox("PlantPot", parent, potSize, baseCenter, potColor);
            var leaf = BuildingPrimitives.CreateAccentBlob("PlantLeaf", parent, 0.055f,
                new Vector3(baseCenter.x, baseCenter.y + potSize.y + 0.035f, baseCenter.z), leafColor);
            leaf.transform.localScale = new Vector3(1f, 1.3f, 1f);
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
