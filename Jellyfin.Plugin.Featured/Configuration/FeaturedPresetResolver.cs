using System.Text.Json;

namespace Jellyfin.Plugin.Featured;

internal sealed record FeaturedPresetResolution(
    PluginConfiguration Configuration,
    string? ActivePresetId,
    string? ActivePresetName,
    DateTimeOffset? NextScheduleChange);

internal static class FeaturedPresetResolver
{
    private static readonly JsonSerializerOptions CloneOptions = new();

    internal static FeaturedPresetResolution Resolve(PluginConfiguration source, DateTimeOffset now)
    {
        FeaturedPreset[] presets = source.Presets ?? [];
        FeaturedPreset? active = presets
            .Select((preset, index) => new { Preset = preset, Index = index })
            .Where(candidate => IsActive(candidate.Preset, now))
            .OrderByDescending(candidate => candidate.Preset.Priority)
            .ThenByDescending(candidate => candidate.Preset.StartsAt ?? DateTimeOffset.MinValue)
            .ThenBy(candidate => candidate.Index)
            .Select(candidate => candidate.Preset)
            .FirstOrDefault();

        DateTimeOffset? nextChange = presets
            .Where(preset => preset.Enabled)
            .SelectMany(preset => new[] { preset.StartsAt, preset.EndsAt })
            .Where(boundary => boundary.HasValue && boundary.Value > now)
            .Select(boundary => boundary!.Value)
            .OrderBy(boundary => boundary)
            .Cast<DateTimeOffset?>()
            .FirstOrDefault();

        if (active is null)
        {
            return new FeaturedPresetResolution(source, null, null, nextChange);
        }

        PluginConfiguration effective = Clone(source);
        Apply(effective, active);
        return new FeaturedPresetResolution(effective, active.Id, active.Name, nextChange);
    }

    private static bool IsActive(FeaturedPreset preset, DateTimeOffset now)
        => preset.Enabled
            && (!preset.StartsAt.HasValue || preset.StartsAt.Value <= now)
            && (!preset.EndsAt.HasValue || preset.EndsAt.Value > now);

    private static PluginConfiguration Clone(PluginConfiguration source)
        => JsonSerializer.Deserialize<PluginConfiguration>(JsonSerializer.Serialize(source, CloneOptions), CloneOptions)
            ?? new PluginConfiguration();

    private static void Apply(PluginConfiguration config, FeaturedPreset preset)
    {
        config.SourceRules = preset.SourceRules;
        config.GlobalFilters = preset.GlobalFilters;
        config.PersonalizationPolicy = preset.PersonalizationPolicy;

        config.RepeatCooldownDays = preset.Mixer.RepeatCooldownDays;
        config.RelaxRepeatCooldownWhenNeeded = preset.Mixer.RelaxRepeatCooldownWhenNeeded;
        config.MaximumItemsPerGenre = preset.Mixer.MaximumItemsPerGenre;
        config.MaximumItemsPerFranchise = preset.Mixer.MaximumItemsPerFranchise;
        config.RandomMediaCount = preset.Mixer.RandomMediaCount;

        config.EnableInfiniteLoading = preset.Layout.EnableInfiniteLoading;
        config.EnableAutoplay = preset.Layout.EnableAutoplay;
        config.ShowAutoplayButton = preset.Layout.ShowAutoplayButton;
        config.AutoplayInterval = preset.Layout.AutoplayInterval;
        config.ShowPlayButton = preset.Layout.ShowPlayButton;
        config.ShowNavigationArrows = preset.Layout.ShowNavigationArrows;
        config.ShowSlidePosition = preset.Layout.ShowSlidePosition;
        config.MediaPadding = preset.Layout.MediaPadding;
        config.TitleDisplayMode = preset.Layout.TitleDisplayMode;
        config.ShowRating = preset.Layout.ShowRating;
        config.ShowDescription = preset.Layout.ShowDescription;
        config.HideOnTvLayout = preset.Layout.HideOnTvLayout;
        config.UseHeroLayout = preset.Layout.UseHeroLayout;
        config.HeroHeightMode = preset.Layout.HeroHeightMode;
        config.TabletBannerHeight = preset.Layout.TabletBannerHeight;
        config.MobileBannerHeight = preset.Layout.MobileBannerHeight;
        config.HeroBorderRadius = preset.Layout.HeroBorderRadius;
        config.HeroGradientStrength = preset.Layout.HeroGradientStrength;
        config.HeroTextPosition = preset.Layout.HeroTextPosition;
        config.TransitionEffect = preset.Layout.TransitionEffect;
        config.HeroBackdropPosition = preset.Layout.HeroBackdropPosition;
        config.BannerHeight = preset.Layout.BannerHeight;
        config.ShowYear = preset.Layout.ShowYear;
        config.ShowRuntime = preset.Layout.ShowRuntime;
        config.ShowSecondaryButton = preset.Layout.ShowSecondaryButton;
        config.SecondaryButtonText = preset.Layout.SecondaryButtonText;
        config.ShowPaginationDots = preset.Layout.ShowPaginationDots;
        config.Heading = preset.Layout.Heading;
        config.PlayButtonText = preset.Layout.PlayButtonText;

        config.EnableBackgroundTrailers = preset.Trailers.EnableBackgroundTrailers;
        config.TrailerSourcePriority = preset.Trailers.TrailerSourcePriority;
        config.FallBackToRemoteTrailers = preset.Trailers.FallBackToRemoteTrailers;
        config.StartTrailersMuted = preset.Trailers.StartTrailersMuted;
        config.WaitForTrailerToFinish = preset.Trailers.WaitForTrailerToFinish;
        config.TrailerDelayMilliseconds = preset.Trailers.TrailerDelayMilliseconds;
        config.TrailerStartOffsetSeconds = preset.Trailers.TrailerStartOffsetSeconds;
        config.TrailerEndOffsetSeconds = preset.Trailers.TrailerEndOffsetSeconds;
        config.MultipleTrailerMode = preset.Trailers.MultipleTrailerMode;
        config.AllowTrailersOnMobile = preset.Trailers.AllowTrailersOnMobile;
        config.TrailerOverrides = preset.Trailers.Overrides;
    }
}
