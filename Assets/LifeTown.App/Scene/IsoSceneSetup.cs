using UnityEngine;
using LifeTown.App.BuildingKit;

namespace LifeTown.App.Scene
{
    /// <summary>
    /// Minimal scene shell for the spike: one isometric ground tile, an orthographic
    /// camera at the T004 isometric angle, one soft directional light, cozy-pastel
    /// background. Everything is built in code (not hand-authored in the .unity file) so
    /// SpikeRenderer's batchmode render is fully reproducible from a single method call.
    /// </summary>
    public static class IsoSceneSetup
    {
        /// <summary>
        /// True isometric camera direction (1,1,1) normalized -- elevation
        /// arcsin(1/sqrt(3)) ~= 35.264 degrees, azimuth 45 degrees. This is the direction
        /// that projects a horizontal square to a 2:1 diamond, matching T004's Tilemap
        /// Cell Size (1, 0.5, 1). BuildingPrimitives' front/side face classification
        /// (+Z=front, +X=side) assumes the camera looks from this same octant.
        /// </summary>
        public static readonly Vector3 IsoDirection = new Vector3(1f, 1f, 1f).normalized;

        /// <summary>
        /// The on-screen "horizontal" axis for a camera looking along -IsoDirection with
        /// world-up as its up vector: world Y stays screen-vertical (the standard true-iso
        /// property), so this is the only axis needed to place two things symmetrically
        /// left/right *as seen on screen* -- offsetting along raw world X or world Z alone
        /// looks symmetric in the scene view but skewed once the iso camera projects it
        /// (round-1 finding: the coquette bow's two loops were offset via the accent's own
        /// post-rotation local `right`, which is not this axis, so the bow read as a
        /// lopsided sideways appendage instead of a centered tied bow).
        /// </summary>
        public static readonly Vector3 ScreenRight = Vector3.Normalize(Vector3.Cross(Vector3.up, -IsoDirection));

        public static Camera BuildScene(Vector3 buildingFootprintCenter, float focusHeight)
        {
            BuildGroundTile(buildingFootprintCenter);
            BuildLight();
            ApplyAmbient();
            return BuildCamera(buildingFootprintCenter + Vector3.up * focusHeight);
        }

        static void BuildGroundTile(Vector3 center)
        {
            var tile = GameObject.CreatePrimitive(PrimitiveType.Cube);
            tile.name = "GroundTile";
            tile.transform.position = center + new Vector3(0f, -0.025f, 0f);
            tile.transform.localScale = new Vector3(2.0f, 0.05f, 2.0f);
            var mat = MaterialFactory.CreateFlatLit("GroundTile_Mat", CategoryPalette.FromHex("#BFE6CC"));
            tile.GetComponent<MeshRenderer>().sharedMaterial = mat;
        }

        static void BuildLight()
        {
            var lightGo = new GameObject("SoftSun");
            var light = lightGo.AddComponent<Light>();
            light.type = LightType.Directional;
            light.color = CategoryPalette.FromHex("#FFE9C7");
            light.intensity = 0.75f;
            light.shadows = LightShadows.Soft;
            lightGo.transform.rotation = Quaternion.Euler(50f, -30f, 0f);
        }

        static void ApplyAmbient()
        {
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            RenderSettings.ambientLight = CategoryPalette.FromHex("#8F84A3");
        }

        static Camera BuildCamera(Vector3 target)
        {
            var camGo = new GameObject("IsoCamera");
            var cam = camGo.AddComponent<Camera>();
            cam.orthographic = true;
            cam.orthographicSize = 1.65f;
            cam.nearClipPlane = 0.1f;
            cam.farClipPlane = 20f;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = CategoryPalette.FromHex("#FFEFE3"); // cozy pastel background

            float distance = 6f;
            camGo.transform.position = target + IsoDirection * distance;
            camGo.transform.LookAt(target, Vector3.up);

            return cam;
        }
    }
}
