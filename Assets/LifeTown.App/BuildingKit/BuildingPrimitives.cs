using UnityEngine;
using UnityEngine.ProBuilder;
using PBMath = UnityEngine.ProBuilder.Math;

namespace LifeTown.App.BuildingKit
{
    /// <summary>
    /// Modular building-kit primitives built on ProBuilder's ShapeGenerator (the T006
    /// asset-strategy recommendation: real 3D low-poly geometry, Unity's own package, no
    /// external art dependency). Every primitive is a pure function of (size, base
    /// position, category color) -- composing a new archetype means calling these with
    /// different numbers, not sculpting a new mesh. This is the "modular kit, not 49
    /// bespoke models" plan from docs/design/01-asset-strategy.md #3 step 2.
    ///
    /// `baseCenter` everywhere below means the bottom-center of the primitive's bounding
    /// box in world space -- every method places its own pivot at (size.y * 0.5) above
    /// that point, so callers can simply stack primitives by tracking "current top Y".
    /// </summary>
    public static class BuildingPrimitives
    {
        /// <summary>
        /// A box shaded with the T004 #3.1 tri-tone formula: top face, the +Z ("front")
        /// vertical face, and every other face ("side"). Used for wall blocks and any
        /// tier-evolution add-on block (T004 #3.2's "same base + one added upper block").
        /// </summary>
        public static GameObject CreateShadedBox(string name, Transform parent, Vector3 size, Vector3 baseCenter, Color base500)
        {
            var (topC, frontC, sideC) = CategoryPalette.ComputeFaceTones(base500);
            return CreateShadedBoxCustomTones(name, parent, size, baseCenter, topC, frontC, sideC);
        }

        /// <summary>
        /// Same tri-tone box as <see cref="CreateShadedBox"/>, but the caller supplies the
        /// three face colors directly instead of deriving all three from one base500 --
        /// needed for archetypes where a face's color isn't a tint/shade of the body color
        /// at all (e.g. <see cref="CreateBookVolume"/>'s cream page-block front face).
        /// </summary>
        public static GameObject CreateShadedBoxCustomTones(string name, Transform parent, Vector3 size, Vector3 baseCenter, Color topColor, Color frontColor, Color sideColor)
        {
            var pb = ShapeGenerator.GenerateCube(PivotLocation.Center, size);
            var top = MaterialFactory.CreateFlat(name + "_Top", topColor);
            var front = MaterialFactory.CreateFlat(name + "_Front", frontColor);
            var side = MaterialFactory.CreateFlat(name + "_Side", sideColor);

            foreach (var face in pb.faces)
            {
                Vector3 n = PBMath.Normal(pb, face);
                if (n.y > 0.5f) face.submeshIndex = 0;
                else if (n.z > 0.3f) face.submeshIndex = 1;
                else face.submeshIndex = 2;
            }
            // Same critical-order fix as CreateGableRoof: materials before ToMesh()/Refresh().
            pb.GetComponent<MeshRenderer>().sharedMaterials = new[] { top, front, side };
            pb.ToMesh();
            pb.Refresh();

            return Finish(pb, name, parent, baseCenter + Vector3.up * (size.y * 0.5f));
        }

        /// <summary>
        /// The book-stack archetype's core volume -- v3 revision (director feedback on v2:
        /// "the concept reads, but each volume reads as a striped slab, not a book -- a
        /// real book is a colored COVER wrapping a cream PAGE block, the cover frames the
        /// pages"). So unlike v2 (whole front face = cream + bold lines), v3 keeps the
        /// front face itself a lightened COVER tone (same family as top/spine, no pages),
        /// and the page block is a separate cream panel INSET from that face's edges --
        /// leaving a visible cover-colored lip on all four sides, which is the single cue
        /// that turns "slab" into "book with pages inside its cover." Striations live only
        /// on that inset panel, fine and muted (pages are a texture, not the hero) -- never
        /// on the top (solid cover board) or the +X side (the spine, kept plain and darker,
        /// with its own proud ridge strip so it reads as the bound edge, not just a dark
        /// face). Pure function of size/position/three colors, so any future book-shaped
        /// building reuses it by calling with different numbers. The page panel, its
        /// striations, and the spine ridge are parented under the returned book GameObject
        /// (not the caller's `parent`) so a caller who yaws the returned object afterward
        /// (see LibraryBuildingBuilder's stacked-and-nudged books) carries them all along
        /// with the face they belong to.
        /// </summary>
        public static GameObject CreateBookVolume(string name, Transform parent, Vector3 size, Vector3 baseCenter, Color coverColor, Color pageColor, Color inkColor, int pageLineCount = 4)
        {
            Color topTone = Color.Lerp(coverColor, Color.white, 0.35f);
            Color frontCoverTone = Color.Lerp(coverColor, Color.white, 0.16f);
            Color spineTone = Color.Lerp(coverColor, Color.black, 0.22f);
            var book = CreateShadedBoxCustomTones(name, parent, size, baseCenter, topTone, frontCoverTone, spineTone);

            // Page block: a cream panel inset from the cover's own edges on every side --
            // the cover-colored lip left showing (front face tone peeking around the
            // panel) is what reads as "pages sitting inside a cover" instead of "pages
            // running edge to edge".
            float marginX = size.x * 0.11f;
            float marginY = size.y * 0.16f;
            float pageWidth = size.x - marginX * 2f;
            float pageHeight = size.y - marginY * 2f;
            float frontZ = baseCenter.z + size.z * 0.5f + 0.005f; // proud of the front face, avoids z-fighting
            Vector3 pageBase = new Vector3(baseCenter.x, baseCenter.y + marginY, frontZ);
            CreateAccentBox($"{name}_PageBlock", book.transform, new Vector3(pageWidth, pageHeight, 0.01f), pageBase, pageColor);

            // Page striations: fine and low-contrast -- a soft muted line blended toward
            // the page color, not the bold dark-purple ink v2 used, and confined to the
            // inset panel so they never touch the cover lip, top, or spine.
            Color lineColor = Color.Lerp(pageColor, inkColor, 0.35f);
            float lineThickness = 0.008f;
            float lineWidth = pageWidth * 0.84f;
            float lineZ = frontZ + 0.006f;
            for (int i = 1; i <= pageLineCount; i++)
            {
                float t = i / (float)(pageLineCount + 1);
                float lineY = pageBase.y + pageHeight * t;
                CreateAccentBox($"{name}_PageLine{i}", book.transform,
                    new Vector3(lineWidth, lineThickness, 0.006f),
                    new Vector3(baseCenter.x, lineY - lineThickness * 0.5f, lineZ),
                    lineColor);
            }

            // Spine ridge: a thin, slightly proud strip along the +X edge -- the bound
            // edge sticking out a hair further than the rest of the cover, the "slightly
            // thicker" cue a real hardcover spine has. Plain spineTone, no lines.
            float spineOuterX = baseCenter.x + size.x * 0.5f + 0.006f;
            CreateAccentBox($"{name}_SpineRidge", book.transform,
                new Vector3(0.022f, size.y * 0.96f, size.z * 0.94f),
                new Vector3(spineOuterX - 0.011f, baseCenter.y + size.y * 0.02f, baseCenter.z),
                spineTone);

            return book;
        }

        /// <summary>
        /// The book-stack archetype's crown: one open book perched on top -- v3 revision
        /// (director feedback on v2: the crown was two tilted striped planes with no
        /// visible cover, so it read as roof shingles, not a book). Each wing is now a
        /// cream page-slab riding on top of a slightly larger, slightly thicker
        /// cover-colored board underneath it -- the same "cover wraps pages" cue
        /// <see cref="CreateBookVolume"/> uses, just tilted -- and the ridge is a solid
        /// cover-colored spine block (not a thin ink line), so the hinge reads as an
        /// actual binding. Wings hinge at a shared ridge (ridge along local Z, matching
        /// <see cref="CreateGableRoof"/>'s convention) and tilt down and outward -- a
        /// gentle tent/V, not a filled triangular roof volume. Page-edge striations are
        /// muted and reduced to two per wing (pages are texture, cover is the hero, same
        /// balance as CreateBookVolume). `ridgeCenter` is the world-space hinge point both
        /// wings and their cover boards rotate around.
        /// </summary>
        public static void CreateOpenBookCrown(Transform parent, Vector3 ridgeCenter, float wingLength, float wingThickness, float wingDepth, float tiltDegrees, Color coverColor, Color pageColor, Color inkColor)
        {
            Color spineTone = Color.Lerp(coverColor, Color.black, 0.15f);
            Color lineColor = Color.Lerp(pageColor, inkColor, 0.35f);
            CreateAccentBox("Crown_Spine", parent, new Vector3(0.10f, 0.055f, wingDepth * 0.98f), ridgeCenter, spineTone);

            foreach (var side in new[] { -1f, 1f })
            {
                string tag = side < 0f ? "Left" : "Right";
                float angleDeg = -side * tiltDegrees;
                var rotation = Quaternion.Euler(0f, 0f, angleDeg);

                Vector3 wingCenter = ridgeCenter + rotation * new Vector3(side * wingLength * 0.5f, 0f, 0f);

                // Cover board: larger + thicker than the page wing, sitting just beneath
                // it (offset along the wing's own rotated "down"), so a rim of cover
                // color shows past the page edge on every side -- the crown's "cover
                // wraps pages" cue.
                float boardThickness = wingThickness * 0.7f;
                Vector3 boardCenter = wingCenter - rotation * (Vector3.up * (wingThickness * 0.5f + boardThickness * 0.5f + 0.004f));
                var board = CreateAccentBox($"Crown_Cover{tag}", parent,
                    new Vector3(wingLength * 1.06f, boardThickness, wingDepth * 1.06f),
                    boardCenter - Vector3.up * (boardThickness * 0.5f), coverColor);
                board.transform.rotation = rotation;

                var wing = CreateAccentBox($"Crown_Page{tag}", parent,
                    new Vector3(wingLength, wingThickness, wingDepth),
                    wingCenter - Vector3.up * (wingThickness * 0.5f), pageColor);
                wing.transform.rotation = rotation;

                for (int i = 1; i <= 2; i++)
                {
                    float t = i / 3f; // 0.33 / 0.67 of the way from ridge to tip
                    Vector3 alongSlope = rotation * new Vector3(side * wingLength * t, 0f, 0f);
                    Vector3 nudgeAboveSurface = rotation * (Vector3.up * (wingThickness * 0.5f + 0.005f));
                    Vector3 linePivot = ridgeCenter + alongSlope + nudgeAboveSurface;

                    var line = CreateAccentBox($"Crown_Page{tag}_Line{i}", parent,
                        new Vector3(0.022f, 0.007f, wingDepth * 0.86f),
                        linePivot - Vector3.up * 0.0035f, lineColor);
                    line.transform.rotation = rotation;
                }
            }
        }

        /// <summary>
        /// A steep gable roof (ProBuilder's Prism primitive): ridge along Z, triangular
        /// gable-end caps at +/-Z. The +Z cap (world front, where the door/window sit) is
        /// explicitly mapped to the "front" tone and the two sloped faces to the "top"
        /// tone regardless of pitch steepness -- normal-based auto-classification would
        /// mis-tone a very steep pitch, so the roof gets its own explicit face map.
        /// </summary>
        public static GameObject CreateGableRoof(string name, Transform parent, Vector3 size, Vector3 baseCenter, Color base500)
        {
            var pb = ShapeGenerator.GeneratePrism(PivotLocation.Center, size);
            var (topC, frontC, sideC) = CategoryPalette.ComputeFaceTones(base500);
            var top = MaterialFactory.CreateFlat(name + "_Top", topC);
            var front = MaterialFactory.CreateFlat(name + "_Front", frontC);
            var side = MaterialFactory.CreateFlat(name + "_Side", sideC);

            // Face order from ShapeGenerator.GeneratePrism: [0]=front cap (local -Z),
            // [1]=right slope, [2]=back cap (local +Z), [3]=left slope, [4]=bottom.
            // Local +Z is world front here (no rotation applied), so face[2] is the
            // gable end that actually faces the camera/front wall.
            var faces = pb.faces;
            if (faces.Count >= 5)
            {
                faces[0].submeshIndex = 2; // local -Z cap -> hidden back -> side tone
                faces[1].submeshIndex = 0; // sloped face -> top tone
                faces[2].submeshIndex = 1; // local +Z cap -> front gable -> front tone
                faces[3].submeshIndex = 0; // sloped face -> top tone
                faces[4].submeshIndex = 2; // bottom -> hidden -> side tone
            }
            // CRITICAL ORDER: ProBuilder's ToMesh() clamps every face.submeshIndex into
            // [0, MaterialUtility.GetMaterialCount(renderer)-1] (see Submesh.GetSubmeshes,
            // com.unity.probuilder Submesh.cs L139) -- it reads the *current* renderer
            // material count, not the count we are about to assign. The renderer still has
            // its 1-slot default material at this point, so materials MUST be assigned
            // before ToMesh()/Refresh() or every face collapses onto submesh 0 (this was
            // the round-1 bug: the whole body rendered in a single top tone).
            pb.GetComponent<MeshRenderer>().sharedMaterials = new[] { top, front, side };
            pb.ToMesh();
            pb.Refresh();

            return Finish(pb, name, parent, baseCenter + Vector3.up * (size.y * 0.5f));
        }

        /// <summary>Single-material accent block (door panel, signage plate, prop pole) --
        /// no tri-tone, these are the T004 "flat coloured rectangle" accents, not building
        /// mass.</summary>
        public static GameObject CreateAccentBox(string name, Transform parent, Vector3 size, Vector3 baseCenter, Color color)
        {
            var pb = ShapeGenerator.GenerateCube(PivotLocation.Center, size);
            pb.GetComponent<MeshRenderer>().sharedMaterial = MaterialFactory.CreateFlat(name + "_Mat", color);
            return Finish(pb, name, parent, baseCenter + Vector3.up * (size.y * 0.5f));
        }

        /// <summary>Small icosphere accent (coquette bow loops, prop lantern head) --
        /// robust regardless of scale/subdivision, easy to squash into a petal shape via
        /// non-uniform localScale after creation.</summary>
        public static GameObject CreateAccentBlob(string name, Transform parent, float radius, Vector3 worldCenter, Color color)
        {
            var pb = ShapeGenerator.GenerateIcosahedron(PivotLocation.Center, radius, 1);
            pb.GetComponent<MeshRenderer>().sharedMaterial = MaterialFactory.CreateFlat(name + "_Mat", color);
            return Finish(pb, name, parent, worldCenter);
        }

        static GameObject Finish(ProBuilderMesh pb, string name, Transform parent, Vector3 worldPosition)
        {
            pb.gameObject.name = name;
            pb.transform.SetParent(parent, false);
            pb.transform.position = worldPosition;
            return pb.gameObject;
        }
    }
}
