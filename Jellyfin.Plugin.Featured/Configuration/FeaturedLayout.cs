namespace Jellyfin.Plugin.Featured;

internal static class FeaturedLayout
{
    internal static int GetDesktopHeight(PluginConfiguration config)
        => config.HeroHeightMode switch
        {
            "compact" => 360,
            "standard" => 500,
            "cinematic" => 750,
            "fullscreen" => 900,
            "custom" => config.BannerHeight,
            _ => 500
        };

    internal static int GetHeroOverlap(int height, string? mode = null)
    {
        if (mode == "fullscreen") return 52;
        if (height <= 400) return 50;
        if (height <= 500) return 100;
        return 280;
    }
}
