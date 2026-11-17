using Xunit;

namespace Jellyfin.Plugin.Featured.Tests;

public sealed class FeaturedEffectiveConfigurationTests
{
    [Fact]
    public void ReusesTheResolutionUntilTheNextPresetBoundary()
    {
        FeaturedEffectiveConfiguration.Invalidate();
        FeaturedPreset preset = new()
        {
            Id = "evening",
            Name = "evening",
            Enabled = true,
            StartsAt = new DateTimeOffset(2026, 9, 14, 18, 0, 0, TimeSpan.Zero)
        };
        PluginConfiguration source = new() { Presets = [preset] };
        DateTimeOffset before = new(2026, 9, 14, 17, 0, 0, TimeSpan.Zero);

        FeaturedPresetResolution first = FeaturedEffectiveConfiguration.Get(source, before);
        FeaturedPresetResolution cached = FeaturedEffectiveConfiguration.Get(source, before.AddMinutes(30));
        FeaturedPresetResolution afterBoundary = FeaturedEffectiveConfiguration.Get(source, before.AddHours(1));

        Assert.Same(first, cached);
        Assert.Null(first.ActivePresetId);
        Assert.Equal(preset.Id, afterBoundary.ActivePresetId);
    }

    [Fact]
    public void ResolvesAgainWhenTheConfigurationIsReplacedOrInvalidated()
    {
        FeaturedEffectiveConfiguration.Invalidate();
        DateTimeOffset now = new(2026, 9, 14, 12, 0, 0, TimeSpan.Zero);
        PluginConfiguration first = new();

        FeaturedPresetResolution initial = FeaturedEffectiveConfiguration.Get(first, now);
        Assert.NotSame(initial, FeaturedEffectiveConfiguration.Get(new PluginConfiguration(), now));

        FeaturedPresetResolution reloaded = FeaturedEffectiveConfiguration.Get(first, now);
        FeaturedEffectiveConfiguration.Invalidate();
        Assert.NotSame(reloaded, FeaturedEffectiveConfiguration.Get(first, now));
    }

    [Fact]
    public void FingerprintIsComputedOncePerConfigurationInstance()
    {
        PluginConfiguration config = new();

        Assert.Same(FeaturedEffectiveConfiguration.GetFingerprint(config), FeaturedEffectiveConfiguration.GetFingerprint(config));
    }
}
