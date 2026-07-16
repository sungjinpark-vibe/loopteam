using UnityEngine;

namespace LifeTown.App.BuildingKit
{
    /// <summary>
    /// Materials for the building kit. Building faces use flat Unlit materials so the
    /// pre-computed T004 tri-tone (top/front/side) renders at its exact intended hex,
    /// unaffected by scene light/ambient exposure -- with a lit shader, an already-light
    /// "top" tone plus ambient plus direct light clips straight to white and the category
    /// hue is lost, which is worse for identity (rubric V2) than a real-time highlight
    /// would have been worth. The ground tile is the one thing that stays Lit (Standard),
    /// so the scene's soft light is still visibly evidenced (docs/design 00-art-design-
    /// system.md's "soft shading" pastel look lives in the pre-baked tri-tone gradient
    /// itself, not in per-pixel lighting -- see 01-asset-strategy.md #3 step 3).
    /// </summary>
    public static class MaterialFactory
    {
        static Shader s_UnlitShader;
        static Shader s_LitShader;

        static Shader UnlitShader => s_UnlitShader ??= Shader.Find("Unlit/Color") ?? Shader.Find("Standard");
        static Shader LitShader => s_LitShader ??= Shader.Find("Standard") ?? Shader.Find("Legacy Shaders/Diffuse");

        /// <summary>Flat, exact-hex, unaffected by scene lighting -- used for every
        /// building face/accent.</summary>
        public static Material CreateFlat(string name, Color color)
        {
            return new Material(UnlitShader) { name = name, color = color };
        }

        /// <summary>Lit + shadow-receiving -- used only for the ground tile, so the
        /// scene's soft directional light has something to visibly act on.</summary>
        public static Material CreateFlatLit(string name, Color color, float smoothness = 0.08f)
        {
            var mat = new Material(LitShader) { name = name, color = color };
            if (mat.HasProperty("_Glossiness")) mat.SetFloat("_Glossiness", smoothness);
            if (mat.HasProperty("_Metallic")) mat.SetFloat("_Metallic", 0f);
            return mat;
        }
    }
}
