using Newtonsoft.Json;

namespace Jellyfin.Plugin.Featured;

internal static class FrontendBootstrap
{
    internal const string StartMarker = "<!-- Jellyfin Featured bootstrap start -->";
    internal const string EndMarker = "<!-- Jellyfin Featured bootstrap end -->";
    private const string ResourceName = "Jellyfin.Plugin.Featured.dist.bootstrap.bundle.js";
    private static readonly Lazy<string> EmbeddedScript = new(ReadEmbeddedScript, LazyThreadSafetyMode.ExecutionAndPublication);

    internal static string BuildHtml(PluginConfiguration configuration)
        => configuration.EnableFrontendBootstrap
            ? $"{StartMarker}<script>{BuildScript(configuration)}</script>{EndMarker}"
            : string.Empty;

    internal static string BuildScript(PluginConfiguration configuration)
    {
        if (!configuration.EnableFrontendBootstrap) return string.Empty;

        string settings = JsonConvert.SerializeObject(new
        {
            hero = configuration.UseHeroLayout,
            hideOnTv = configuration.HideOnTvLayout,
            heightMode = configuration.HeroHeightMode,
            desktopHeight = configuration.BannerHeight,
            tabletHeight = configuration.TabletBannerHeight,
            mobileHeight = configuration.MobileBannerHeight,
            radius = configuration.HeroBorderRadius,
            mediaPadding = configuration.MediaPadding,
            heroOverlap = FeaturedLayout.GetHeroOverlap(
                FeaturedLayout.GetDesktopHeight(configuration),
                configuration.HeroHeightMode),
            heading = configuration.Heading
        }, new JsonSerializerSettings { StringEscapeHandling = StringEscapeHandling.EscapeHtml });

        return $"window.JellyfinFeaturedBootstrapSettings={settings};{EmbeddedScript.Value}";
    }

    private static string ReadEmbeddedScript()
    {
        using Stream stream = typeof(FrontendBootstrap).Assembly.GetManifestResourceStream(ResourceName)
            ?? throw new InvalidOperationException($"Embedded frontend bootstrap resource '{ResourceName}' was not found.");
        using StreamReader reader = new(stream);
        return reader.ReadToEnd();
    }
}
