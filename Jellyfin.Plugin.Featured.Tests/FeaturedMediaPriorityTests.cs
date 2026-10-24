using Xunit;

namespace Jellyfin.Plugin.Featured.Tests;

public sealed class FeaturedMediaPriorityTests
{
    [Fact]
    public void LegacySourceFallbacksMigrateIntoScopeTrailerPriority()
    {
        PluginConfiguration config = new()
        {
            TrailerSourcePriority = FeaturedTrailerSourcePriorities.PreferRemote,
            SourceRules =
            [
                new FeaturedSourceRule
                {
                    Type = FeaturedSourceTypes.Random,
                    UseMediaPreviewFallback = true,
                    UseTrickplayFallback = true
                }
            ],
            Presets =
            [
                new FeaturedPreset
                {
                    Trailers = new FeaturedPresetTrailerSettings
                    {
                        TrailerSourcePriority = FeaturedTrailerSourcePriorities.LocalOnly
                    },
                    SourceRules =
                    [
                        new FeaturedSourceRule
                        {
                            Type = FeaturedSourceTypes.Random,
                            UseMediaPreviewFallback = false,
                            UseTrickplayFallback = false
                        }
                    ]
                }
            ]
        };

        PluginConfiguration normalized = PluginConfigurationNormalizer.Normalize(config);

        FeaturedSourceRule source = normalized.SourceRules.Single();
        Assert.Equal(
            [
                FeaturedMediaPriorityTypes.RemoteTrailer,
                FeaturedMediaPriorityTypes.LocalTrailer,
                FeaturedMediaPriorityTypes.MediaExcerpt,
                FeaturedMediaPriorityTypes.Trickplay
            ],
            FeaturedMediaPriorityTypes.EnabledTypes(source.MediaPriority));
        Assert.Null(source.UseMediaPreviewFallback);
        Assert.Null(source.UseTrickplayFallback);

        FeaturedSourceRule presetSource = normalized.Presets.Single().SourceRules.Single();
        Assert.Equal([FeaturedMediaPriorityTypes.LocalTrailer], FeaturedMediaPriorityTypes.EnabledTypes(presetSource.MediaPriority));
        Assert.Equal(4, presetSource.MediaPriority.Length);
    }

    [Fact]
    public void SavedPriorityKeepsOrderAndRepairsUnknownOrMissingTypes()
    {
        PluginConfiguration config = new()
        {
            SourceRules =
            [
                new FeaturedSourceRule
                {
                    Type = FeaturedSourceTypes.Random,
                    MediaPriority =
                    [
                        new FeaturedMediaPriorityEntry { Type = "TRICKPLAY", Enabled = true },
                        new FeaturedMediaPriorityEntry { Type = "unknown", Enabled = true },
                        new FeaturedMediaPriorityEntry { Type = FeaturedMediaPriorityTypes.RemoteTrailer, Enabled = true },
                        new FeaturedMediaPriorityEntry { Type = FeaturedMediaPriorityTypes.Trickplay, Enabled = false }
                    ]
                }
            ]
        };

        FeaturedSourceRule source = PluginConfigurationNormalizer.Normalize(config).SourceRules.Single();

        Assert.Equal(
            [
                FeaturedMediaPriorityTypes.Trickplay,
                FeaturedMediaPriorityTypes.RemoteTrailer,
                FeaturedMediaPriorityTypes.LocalTrailer,
                FeaturedMediaPriorityTypes.MediaExcerpt
            ],
            source.MediaPriority.Select(entry => entry.Type));
        Assert.Equal(
            [FeaturedMediaPriorityTypes.Trickplay, FeaturedMediaPriorityTypes.RemoteTrailer],
            FeaturedMediaPriorityTypes.EnabledTypes(source.MediaPriority));
    }

    [Fact]
    public void OnlyVideoFallbacksAllowSourcesWithoutArtwork()
    {
        Assert.False(FeaturedMediaPriorityTypes.CanFillMissingImages(FeaturedMediaPriorityTypes.CreateDefault()));
        Assert.True(FeaturedMediaPriorityTypes.CanFillMissingImages(
            FeaturedMediaPriorityTypes.FromTrailerSourcePriority(null, useTrickplayFallback: true)));
    }

    [Fact]
    public void DefaultMediaPriorityMigratesFromTrailerSourcePriorityOnce()
    {
        PluginConfiguration config = new()
        {
            TrailerSourcePriority = FeaturedTrailerSourcePriorities.LocalExcerptRemote,
            Presets =
            [
                new FeaturedPreset
                {
                    Trailers = new FeaturedPresetTrailerSettings
                    {
                        TrailerSourcePriority = FeaturedTrailerSourcePriorities.RemoteOnly,
                        DefaultMediaPriority =
                        [
                            new FeaturedMediaPriorityEntry { Type = FeaturedMediaPriorityTypes.Trickplay, Enabled = true }
                        ]
                    }
                }
            ]
        };

        PluginConfiguration normalized = PluginConfigurationNormalizer.Normalize(config);

        Assert.Equal(
            [FeaturedMediaPriorityTypes.LocalTrailer, FeaturedMediaPriorityTypes.MediaExcerpt, FeaturedMediaPriorityTypes.RemoteTrailer],
            FeaturedMediaPriorityTypes.EnabledTypes(normalized.DefaultMediaPriority!));
        FeaturedMediaPriorityEntry[] preset = normalized.Presets.Single().Trailers.DefaultMediaPriority!;
        Assert.Equal([FeaturedMediaPriorityTypes.Trickplay], FeaturedMediaPriorityTypes.EnabledTypes(preset));
        Assert.Equal(4, preset.Length);
    }
}
