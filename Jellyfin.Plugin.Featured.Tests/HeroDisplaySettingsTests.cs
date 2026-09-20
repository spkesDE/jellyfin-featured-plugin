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

        Assert.Equal(40, normalized.HeroFadeStart);
        Assert.Equal(90, normalized.HeroFadeEnd);
        Assert.Equal("balanced", normalized.HeroFadeCurve);
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
        Assert.Equal(40, layout.HeroFadeStart);
        Assert.Equal(90, layout.HeroFadeEnd);
        Assert.Equal("soft", layout.HeroFadeCurve);
    }
}
