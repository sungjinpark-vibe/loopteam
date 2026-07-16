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
            var pb = ShapeGenerator.GenerateCube(PivotLocation.Center, size);
            ApplyIsoShadingByNormal(pb, base500);
            return Finish(pb, name, parent, baseCenter + Vector3.up * (size.y * 0.5f));
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

        /// <summary>
        /// Classifies every face by its own normal: top(y&gt;0.5)=brightest, +Z(front,
        /// z&gt;0.3)=medium, everything else=pure/darkest. Correct for axis-aligned boxes
        /// (all normals are exactly +/-1 on one axis), matched to IsoSceneSetup's camera
        /// direction (1,1,1) which makes +Z and +X the two visible vertical faces.
        /// </summary>
        static void ApplyIsoShadingByNormal(ProBuilderMesh pb, Color base500)
        {
            var (topC, frontC, sideC) = CategoryPalette.ComputeFaceTones(base500);
            var top = MaterialFactory.CreateFlat("Top", topC);
            var front = MaterialFactory.CreateFlat("Front", frontC);
            var side = MaterialFactory.CreateFlat("Side", sideC);

            foreach (var face in pb.faces)
            {
                Vector3 n = PBMath.Normal(pb, face);
                if (n.y > 0.5f) face.submeshIndex = 0;
                else if (n.z > 0.3f) face.submeshIndex = 1;
                else face.submeshIndex = 2;
            }
            // Same critical-order fix as CreateGableRoof above: materials before ToMesh().
            pb.GetComponent<MeshRenderer>().sharedMaterials = new[] { top, front, side };
            pb.ToMesh();
            pb.Refresh();
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
