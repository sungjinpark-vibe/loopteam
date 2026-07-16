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
        /// The book-stack archetype's core volume (docs/design "form expresses meaning" v2
        /// note): a box whose front (+Z) face is a cream page-block with several thin ink
        /// striations -- the #1 cue that reads as "book" at iso render scale -- instead of
        /// the usual tri-tone front, and whose side (+X) face is a darkened "spine" tone
        /// instead of the usual pure base500. Top keeps a standard lightened tone. Pure
        /// function of size/position/three colors, so any future book-shaped building
        /// (a bookstore, a library annex) reuses it by calling with different numbers, same
        /// as every other primitive in this file. Striation lines are parented under the
        /// returned book GameObject (not the caller's `parent`) so a caller who yaws the
        /// returned object afterward (see LibraryBuildingBuilder's stacked-and-nudged books)
        /// carries the lines along with the face they belong to.
        /// </summary>
        public static GameObject CreateBookVolume(string name, Transform parent, Vector3 size, Vector3 baseCenter, Color coverColor, Color pageColor, Color inkColor, int pageLineCount = 4)
        {
            Color topTone = Color.Lerp(coverColor, Color.white, 0.45f);
            Color spineTone = Color.Lerp(coverColor, Color.black, 0.22f);
            var book = CreateShadedBoxCustomTones(name, parent, size, baseCenter, topTone, pageColor, spineTone);

            float frontZ = baseCenter.z + size.z * 0.5f + 0.006f; // proud of the front face, avoids z-fighting
            float lineThickness = 0.014f;
            float lineWidth = size.x * 0.82f;
            for (int i = 1; i <= pageLineCount; i++)
            {
                float t = i / (float)(pageLineCount + 1);
                float lineY = baseCenter.y + size.y * t;
                CreateAccentBox($"{name}_PageLine{i}", book.transform,
                    new Vector3(lineWidth, lineThickness, 0.012f),
                    new Vector3(baseCenter.x, lineY - lineThickness * 0.5f, frontZ),
                    inkColor);
            }
            return book;
        }

        /// <summary>
        /// The book-stack archetype's crown: one open book perched on top, built as two
        /// cream page-slabs hinged at a shared ridge (ridge along local Z, matching
        /// <see cref="CreateGableRoof"/>'s convention) and tilted down and outward from it
        /// -- a gentle tent/V, not a filled triangular roof volume -- with an ink spine
        /// accent at the ridge and a few page-edge striations riding along each slab's own
        /// tilt. Sized generously per the director's v2 form note: this REPLACES the old
        /// peaked-roof archetype, it does not sit under one.
        /// `ridgeCenter` is the world-space hinge point both wings rotate around.
        /// </summary>
        public static void CreateOpenBookCrown(Transform parent, Vector3 ridgeCenter, float wingLength, float wingThickness, float wingDepth, float tiltDegrees, Color pageColor, Color inkColor)
        {
            CreateAccentBox("Crown_Spine", parent, new Vector3(0.045f, 0.035f, wingDepth * 0.96f), ridgeCenter, inkColor);

            foreach (var side in new[] { -1f, 1f })
            {
                string tag = side < 0f ? "Left" : "Right";
                float angleDeg = -side * tiltDegrees;
                var rotation = Quaternion.Euler(0f, 0f, angleDeg);

                Vector3 wingCenter = ridgeCenter + rotation * new Vector3(side * wingLength * 0.5f, 0f, 0f);
                var wing = CreateAccentBox($"Crown_Page{tag}", parent,
                    new Vector3(wingLength, wingThickness, wingDepth),
                    wingCenter - Vector3.up * (wingThickness * 0.5f), pageColor);
                wing.transform.rotation = rotation;

                for (int i = 1; i <= 3; i++)
                {
                    float t = i / 4f; // 0.25 / 0.5 / 0.75 of the way from ridge to tip
                    Vector3 alongSlope = rotation * new Vector3(side * wingLength * t, 0f, 0f);
                    Vector3 nudgeAboveSurface = rotation * (Vector3.up * (wingThickness * 0.5f + 0.006f));
                    Vector3 linePivot = ridgeCenter + alongSlope + nudgeAboveSurface;

                    var line = CreateAccentBox($"Crown_Page{tag}_Line{i}", parent,
                        new Vector3(0.03f, 0.01f, wingDepth * 0.9f),
                        linePivot - Vector3.up * 0.005f, inkColor);
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
