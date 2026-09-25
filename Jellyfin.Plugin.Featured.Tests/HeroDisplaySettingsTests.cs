using Jellyfin.Plugin.Featured;
using Xunit;

namespace Jellyfin.Plugin.Featured.Tests;

public sealed class HeroDisplaySettingsTests
{
    [Fact]
    public void Normalize_AcceptsFullscreenAndClampsFadeValues()
    {
        PluginConfiguration config = new()
        {
            HeroHeightMode = "fullscreen",
            HeroFadeStart = -12,
            HeroFadeEnd = 120,
            HeroFadeCurve = "strong"
        };

        PluginConfiguration normalized = PluginConfigurationNormalizer.Normalize(config);

        Assert.Equal("fullscreen", normalized.HeroHeightMode);
        Assert.Equal(0, normalized.HeroFadeStart);
        Assert.Equal(100, normalized.HeroFadeEnd);
        Assert.Equal("strong", normalized.HeroFadeCurve);
        Assert.Equal(52, FeaturedLayout.GetHeroOverlap(FeaturedLayout.GetDesktopHeight(normalized), normalized.HeroHeightMode));
    }

    [Fact]
    public void Normalize_FallsBackWhenFadeRangeAndCurveAreInvalid()
    {
        PluginConfiguration config = new()
        {
            HeroFadeStart = 90,
            HeroFadeEnd = 40,
            HeroFadeCurve = "unexpected"
        };

        PluginConfiguration normalized = PluginConfigurationNormalizer.Normalize(config);

        Assert.Equal(50, normalized.HeroFadeStart);
        Assert.Equal(100, normalized.HeroFadeEnd);
        Assert.Equal("custom", normalized.HeroFadeCurve);
    }

    [Fact]
    public void Normalize_AppliesFadeValidationToPresetLayouts()
    {
        PluginConfiguration config = new()
        {
            Presets =
            [
                new FeaturedPreset
                {
                    Layout = new FeaturedPresetLayoutSettings
                    {
                        HeroHeightMode = "fullscreen",
                        HeroFadeStart = 70,
                        HeroFadeEnd = 70,
                        HeroFadeCurve = "soft"
                    }
                }
            ]
        };

        FeaturedPresetLayoutSettings layout = PluginConfigurationNormalizer.Normalize(config).Presets[0].Layout;

        Assert.Equal("fullscreen", layout.HeroHeightMode);
        Assert.Equal(50, layout.HeroFadeStart);
        Assert.Equal(100, layout.HeroFadeEnd);
        Assert.Equal("soft", layout.HeroFadeCurve);
    }

    [Fact]
    public void Normalize_SanitizesCustomFadePointsAndKeepsEndpoints()
    {
        PluginConfiguration config = new()
        {
            HeroFadeCurve = "custom",
            HeroFadePoints =
            [
                new HeroFadePoint { Position = 100, Fade = 25 },
                new HeroFadePoint { Position = 65, Fade = 120 },
                new HeroFadePoint { Position = 35, Fade = -20 },
                new HeroFadePoint { Position = 35, Fade = 80 },
                new HeroFadePoint { Position = 0, Fade = 90 }
            ]
        };

        PluginConfiguration normalized = PluginConfigurationNormalizer.Normalize(config);

        Assert.Equal("custom", normalized.HeroFadeCurve);
        Assert.Collection(
            normalized.HeroFadePoints,
            point => Assert.Equal((0, 0), (point.Position, point.Fade)),
            point => Assert.Equal((35, 0), (point.Position, point.Fade)),
            point => Assert.Equal((65, 100), (point.Position, point.Fade)),
            point => Assert.Equal((100, 100), (point.Position, point.Fade)));
    }
}
