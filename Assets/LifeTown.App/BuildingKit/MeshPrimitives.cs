using UnityEngine;

namespace LifeTown.App.BuildingKit
{
    /// <summary>
    /// Two small hand-built meshes for shapes ProBuilder's ShapeGenerator does not offer
    /// directly: a solid semicircle (the arched window's rounded top -- GenerateArch
    /// builds an archway/tunnel band, not a solid arched panel) and a flat annulus (the
    /// tier/construction ring on the ground -- GenerateTorus's default orientation risked
    /// standing the ring on its edge rather than lying flat, which is not worth the
    /// uncertainty for a two-shape spike). Everything else in the building routes through
    /// ProBuilder (see BuildingPrimitives); these two are plain UnityEngine.Mesh, still
    /// real 3D low-poly geometry, just not authored via the ShapeGenerator API.
    /// </summary>
    public static class MeshPrimitives
    {
        /// <summary>Solid half-disc extruded by `depth`, flat side down -- caps the top of
        /// a rectangular window pane to read as an arched window.
        ///
        /// NOTE (round 2): kept for reuse, but LibraryBuildingBuilder no longer calls this
        /// for its window -- at spike scale/camera distance this rendered as a sharp point
        /// rather than a visible curve (even after the double-winding fix below), so the
        /// window's arch cap was switched to a squashed BuildingPrimitives.CreateAccentBlob
        /// icosphere instead, which was already proven visible elsewhere in the render.</summary>
        public static GameObject CreateSemicircleCap(string name, Transform parent, float radius, float depth, Vector3 baseCenter, Color color, int segments = 10)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.position = baseCenter;

            var mf = go.AddComponent<MeshFilter>();
            var mr = go.AddComponent<MeshRenderer>();
            mr.sharedMaterial = MaterialFactory.CreateFlat(name + "_Mat", color);

            var mesh = new Mesh { name = name };
            int ringVerts = segments + 1;
            var vertices = new Vector3[ringVerts * 2]; // front ring + back ring
            for (int i = 0; i <= segments; i++)
            {
                float t = i / (float)segments;
                float angle = t * Mathf.PI; // 0..180 degrees, flat edge along X at y=0
                float x = Mathf.Cos(angle) * radius;
                float y = Mathf.Sin(angle) * radius;
                vertices[i] = new Vector3(x, y, 0f);
                vertices[ringVerts + i] = new Vector3(x, y, depth);
            }

            var triangles = new System.Collections.Generic.List<int>();

            // Front fan (apex at flat-edge center, index count = ringVerts, plus the
            // implicit center point appended after both rings).
            int centerFrontIdx = vertices.Length;
            int centerBackIdx = vertices.Length + 1;
            var vertList = new System.Collections.Generic.List<Vector3>(vertices)
            {
                new Vector3(0, 0, 0f),
                new Vector3(0, 0, depth)
            };

            // Both winding orders, deliberately, for every triangle (front cap, back cap,
            // and the curved band) -- same "never accidentally back-face culled" defense
            // as CreateFlatRing below. Round-1 evidence showed the arch cap coded but not
            // visible in the render (LibraryBuildingBuilder.cs findings V1/V5); getting a
            // one-off winding sign wrong on a hand-authored fan mesh is an easy, silent
            // failure (wrong side gets culled, nothing errors), so this primitive is worth
            // making winding-proof rather than re-deriving the "correct" sign by hand.
            for (int i = 0; i < segments; i++)
            {
                // front cap (both winds)
                triangles.Add(centerFrontIdx); triangles.Add(i + 1); triangles.Add(i);
                triangles.Add(centerFrontIdx); triangles.Add(i); triangles.Add(i + 1);
                // back cap (both winds)
                triangles.Add(centerBackIdx); triangles.Add(ringVerts + i); triangles.Add(ringVerts + i + 1);
                triangles.Add(centerBackIdx); triangles.Add(ringVerts + i + 1); triangles.Add(ringVerts + i);
                // curved side band (both winds)
                triangles.Add(i); triangles.Add(i + 1); triangles.Add(ringVerts + i);
                triangles.Add(i + 1); triangles.Add(ringVerts + i + 1); triangles.Add(ringVerts + i);
                triangles.Add(ringVerts + i); triangles.Add(i + 1); triangles.Add(i);
                triangles.Add(ringVerts + i); triangles.Add(ringVerts + i + 1); triangles.Add(i + 1);
            }

            mesh.SetVertices(vertList);
            mesh.SetTriangles(triangles, 0);
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            mf.sharedMesh = mesh;

            return go;
        }

        /// <summary>Flat ring lying in the XZ plane -- the T004 "construction/tier
        /// progress ring" convention, reused here as a maxed-tier indicator at the
        /// building's base.</summary>
        public static GameObject CreateFlatRing(string name, Transform parent, float innerRadius, float outerRadius, Vector3 center, Color color, int segments = 48)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.position = center;

            var mf = go.AddComponent<MeshFilter>();
            var mr = go.AddComponent<MeshRenderer>();
            mr.sharedMaterial = MaterialFactory.CreateFlat(name + "_Mat", color);

            var vertices = new Vector3[(segments + 1) * 2];
            for (int i = 0; i <= segments; i++)
            {
                float t = i / (float)segments;
                float angle = t * Mathf.PI * 2f;
                float cos = Mathf.Cos(angle), sin = Mathf.Sin(angle);
                vertices[i] = new Vector3(cos * outerRadius, 0f, sin * outerRadius);
                vertices[segments + 1 + i] = new Vector3(cos * innerRadius, 0f, sin * innerRadius);
            }

            // Both winding orders, deliberately -- a flat ring only needs to be visible
            // from above, but getting Unity's front-face winding convention right by hand
            // for a custom XZ-plane mesh is easy to get backwards (and silently invisible,
            // not an error). Emitting both directions trades a few extra triangles for a
            // guarantee this primitive is never accidentally back-face culled.
            var triangles = new System.Collections.Generic.List<int>();
            for (int i = 0; i < segments; i++)
            {
                int outerA = i, outerB = i + 1;
                int innerA = segments + 1 + i, innerB = segments + 1 + i + 1;
                triangles.Add(outerA); triangles.Add(outerB); triangles.Add(innerA);
                triangles.Add(outerB); triangles.Add(innerB); triangles.Add(innerA);
                triangles.Add(innerA); triangles.Add(outerB); triangles.Add(outerA);
                triangles.Add(innerA); triangles.Add(innerB); triangles.Add(outerB);
            }

            var mesh = new Mesh { name = name };
            mesh.SetVertices(vertices);
            mesh.SetTriangles(triangles, 0);
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            mf.sharedMesh = mesh;

            return go;
        }
    }
}
