using Xunit;

namespace Jellyfin.Plugin.Featured.Tests;

public sealed class FeaturedPresetResolverTests
{
    [Fact]
    public void OneTimeSchedulesRemainBackwardCompatible()
    {
        FeaturedPreset preset = CreatePreset("one-time");
        preset.StartsAt = new DateTimeOffset(2026, 9, 14, 10, 0, 0, TimeSpan.Zero);
        preset.EndsAt = new DateTimeOffset(2026, 9, 14, 12, 0, 0, TimeSpan.Zero);

        FeaturedPresetResolution resolution = FeaturedPresetResolver.Resolve(
            new PluginConfiguration { Presets = [preset] },
            new DateTimeOffset(2026, 9, 14, 11, 0, 0, TimeSpan.Zero));

        Assert.Equal(preset.Id, resolution.ActivePresetId);
        Assert.Equal(preset.EndsAt, resolution.NextScheduleChange);
    }

    [Fact]
    public void WeeklyScheduleUsesConfiguredTimeZoneAndFindsNextBoundary()
    {
        FeaturedPreset preset = CreatePreset("friday");
        preset.ScheduleType = FeaturedPresetScheduleTypes.Weekly;
        preset.TimeZoneId = "Europe/Berlin";
        preset.DaysOfWeek = [DayOfWeek.Friday];
        preset.StartTime = "18:00";
        preset.EndTime = "23:59";

        FeaturedPresetResolution resolution = FeaturedPresetResolver.Resolve(
            new PluginConfiguration { Presets = [preset] },
            new DateTimeOffset(2026, 7, 10, 17, 0, 0, TimeSpan.Zero));

        Assert.Equal(preset.Id, resolution.ActivePresetId);
        Assert.Equal(new DateTimeOffset(2026, 7, 10, 21, 59, 0, TimeSpan.Zero), resolution.NextScheduleChange);
    }

    [Fact]
    public void WeeklyScheduleCanCrossMidnight()
    {
        FeaturedPreset preset = CreatePreset("late-friday");
        preset.ScheduleType = FeaturedPresetScheduleTypes.Weekly;
        preset.TimeZoneId = "UTC";
        preset.DaysOfWeek = [DayOfWeek.Friday];
        preset.StartTime = "22:00";
        preset.EndTime = "02:00";

        FeaturedPresetResolution resolution = FeaturedPresetResolver.Resolve(
            new PluginConfiguration { Presets = [preset] },
            new DateTimeOffset(2026, 7, 11, 1, 0, 0, TimeSpan.Zero));

        Assert.Equal(preset.Id, resolution.ActivePresetId);
        Assert.Equal(new DateTimeOffset(2026, 7, 11, 2, 0, 0, TimeSpan.Zero), resolution.NextScheduleChange);
    }

    [Fact]
    public void AnnualScheduleCanWrapAcrossNewYear()
    {
        FeaturedPreset preset = CreatePreset("holidays");
        preset.ScheduleType = FeaturedPresetScheduleTypes.Annual;
        preset.TimeZoneId = "UTC";
        preset.AnnualStart = "12-20";
        preset.AnnualEnd = "01-05";
        preset.StartTime = "00:00";
        preset.EndTime = "12:00";

        FeaturedPresetResolution resolution = FeaturedPresetResolver.Resolve(
            new PluginConfiguration { Presets = [preset] },
            new DateTimeOffset(2027, 1, 2, 0, 0, 0, TimeSpan.Zero));

        Assert.Equal(preset.Id, resolution.ActivePresetId);
        Assert.Equal(new DateTimeOffset(2027, 1, 5, 12, 0, 0, TimeSpan.Zero), resolution.NextScheduleChange);
    }

    [Fact]
    public void HigherPriorityWinsAndForcedPreviewAllowsDisabledPreset()
    {
        FeaturedPreset low = CreatePreset("low");
        FeaturedPreset high = CreatePreset("high");
        low.Priority = 1;
        high.Priority = 10;
        PluginConfiguration config = new() { Presets = [low, high] };
        DateTimeOffset now = new(2026, 9, 14, 12, 0, 0, TimeSpan.Zero);

        Assert.Equal(high.Id, FeaturedPresetResolver.Resolve(config, now).ActivePresetId);
        high.Enabled = false;
        Assert.Equal(low.Id, FeaturedPresetResolver.Resolve(config, now).ActivePresetId);
        Assert.Equal(high.Id, FeaturedPresetResolver.ResolvePreview(config, now, high.Id, false).ActivePresetId);
    }

    [Fact]
    public void MissingDaylightSavingTimeUsesNextValidMinute()
    {
        FeaturedPreset preset = CreatePreset("dst");
        preset.ScheduleType = FeaturedPresetScheduleTypes.Weekly;
        preset.TimeZoneId = "Europe/Berlin";
        preset.DaysOfWeek = [DayOfWeek.Sunday];
        preset.StartTime = "02:30";
        preset.EndTime = "04:00";
        PluginConfiguration config = new() { Presets = [preset] };

        FeaturedPresetResolution before = FeaturedPresetResolver.Resolve(
            config,
            new DateTimeOffset(2026, 3, 29, 0, 30, 0, TimeSpan.Zero));
        FeaturedPresetResolution during = FeaturedPresetResolver.Resolve(
            config,
            new DateTimeOffset(2026, 3, 29, 1, 30, 0, TimeSpan.Zero));

        Assert.Null(before.ActivePresetId);
        Assert.Equal(new DateTimeOffset(2026, 3, 29, 1, 0, 0, TimeSpan.Zero), before.NextScheduleChange);
        Assert.Equal(preset.Id, during.ActivePresetId);
        Assert.Equal(new DateTimeOffset(2026, 3, 29, 2, 0, 0, TimeSpan.Zero), during.NextScheduleChange);
    }

    [Fact]
    public void NormalizerRepairsInvalidRecurringValues()
    {
        FeaturedPreset preset = CreatePreset("invalid");
        preset.ScheduleType = "something-else";
        preset.TimeZoneId = "Mars/Olympus_Mons";
        preset.DaysOfWeek = [(DayOfWeek)99, DayOfWeek.Friday, DayOfWeek.Friday];
        preset.StartTime = "99:00";
        preset.AnnualStart = "13-40";

        FeaturedPreset normalized = PluginConfigurationNormalizer.Normalize(
            new PluginConfiguration { Presets = [preset] }).Presets.Single();

        Assert.Equal(FeaturedPresetScheduleTypes.OneTime, normalized.ScheduleType);
        Assert.Equal("UTC", normalized.TimeZoneId);
        Assert.Equal([DayOfWeek.Friday], normalized.DaysOfWeek);
        Assert.Equal("18:00", normalized.StartTime);
        Assert.Equal("12-01", normalized.AnnualStart);
    }

    [Fact]
    public void LegacyDisabledRemoteFallbackBecomesLocalOnly()
    {
        FeaturedPreset preset = CreatePreset("local-trailers");
        preset.Trailers.FallBackToRemoteTrailers = false;
        PluginConfiguration config = new()
        {
            FallBackToRemoteTrailers = false,
            Presets = [preset]
        };

        PluginConfiguration normalized = PluginConfigurationNormalizer.Normalize(config);

        Assert.Equal(FeaturedTrailerSourcePriorities.LocalOnly, normalized.TrailerSourcePriority);
        Assert.Null(normalized.FallBackToRemoteTrailers);
        Assert.Equal(FeaturedTrailerSourcePriorities.LocalOnly, normalized.Presets.Single().Trailers.TrailerSourcePriority);
        Assert.Null(normalized.Presets.Single().Trailers.FallBackToRemoteTrailers);
    }

    private static FeaturedPreset CreatePreset(string name) => new()
    {
        Id = name,
        Name = name,
        Enabled = true,
        SourceRules = [new FeaturedSourceRule { Id = $"{name}-source" }]
    };
}
