using UnityEngine;

namespace TouchRPG.Combat.Core
{
    /// <summary>
    /// Runtime-generated placeholder shapes. GDD §0 grants placeholder art to team
    /// discretion for P0 ("연출 디테일, 임시(placeholder) 아트" is a no-query decision).
    /// Generating primitives in code means the project ships with zero missing-asset
    /// risk and no external art dependency — every shape used by the combat scene
    /// (squirrel silhouette, HP bar fill, parry ring, burst) traces back to here.
    /// Sprites are tinted per-instance via Image.color, so one white texture per
    /// shape is enough; textures are cached and built once.
    /// </summary>
    public static class PlaceholderSprites
    {
        private static Sprite _circle;
        private static Sprite _ring;
        private static Sprite _roundedRect;

        public static Sprite Circle => _circle != null ? _circle : (_circle = CreateCircle(128));
        public static Sprite Ring => _ring != null ? _ring : (_ring = CreateRing(128, 0.72f));
        public static Sprite RoundedRect => _roundedRect != null ? _roundedRect : (_roundedRect = CreateRoundedRect(64, 0.28f));

        public static Sprite CreateCircle(int size)
        {
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false) { name = "Placeholder_Circle" };
            float radius = size * 0.5f;
            Vector2 center = new Vector2(radius, radius);
            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    float dist = Vector2.Distance(new Vector2(x + 0.5f, y + 0.5f), center);
                    float alpha = Mathf.Clamp01(radius - dist);
                    tex.SetPixel(x, y, new Color(1f, 1f, 1f, alpha > 0.5f ? 1f : alpha));
                }
            }
            tex.Apply();
            tex.wrapMode = TextureWrapMode.Clamp;
            return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f);
        }

        public static Sprite CreateRing(int size, float innerRadiusRatio)
        {
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false) { name = "Placeholder_Ring" };
            float outerRadius = size * 0.5f;
            float innerRadius = outerRadius * innerRadiusRatio;
            Vector2 center = new Vector2(outerRadius, outerRadius);
            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    float dist = Vector2.Distance(new Vector2(x + 0.5f, y + 0.5f), center);
                    float outerAlpha = Mathf.Clamp01(outerRadius - dist);
                    float innerAlpha = Mathf.Clamp01(dist - innerRadius);
                    float alpha = Mathf.Min(outerAlpha, innerAlpha);
                    tex.SetPixel(x, y, new Color(1f, 1f, 1f, alpha > 0.5f ? 1f : alpha));
                }
            }
            tex.Apply();
            tex.wrapMode = TextureWrapMode.Clamp;
            return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f);
        }

        public static Sprite CreateRoundedRect(int size, float cornerRatio)
        {
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false) { name = "Placeholder_RoundedRect" };
            float corner = size * cornerRatio;
            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    float alpha = 1f;
                    float px = x + 0.5f;
                    float py = y + 0.5f;
                    float cx = px < corner ? corner : (px > size - corner ? size - corner : px);
                    float cy = py < corner ? corner : (py > size - corner ? size - corner : py);
                    bool inCornerZone = (px < corner || px > size - corner) && (py < corner || py > size - corner);
                    if (inCornerZone)
                    {
                        float dist = Vector2.Distance(new Vector2(px, py), new Vector2(cx, cy));
                        alpha = dist <= corner ? 1f : 0f;
                    }
                    tex.SetPixel(x, y, new Color(1f, 1f, 1f, alpha));
                }
            }
            tex.Apply();
            tex.wrapMode = TextureWrapMode.Clamp;
            return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f);
        }
    }
}
