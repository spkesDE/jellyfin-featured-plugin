using System.Globalization;
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
        PresetCandidate? active = presets
            .Select((preset, index) => new PresetCandidate(preset, index, GetActiveWindow(preset, now)))
            .Where(candidate => candidate.Window is not null)
            .OrderByDescending(candidate => candidate.Preset.Priority)
            .ThenByDescending(candidate => candidate.Window!.Start)
            .ThenBy(candidate => candidate.Index)
            .FirstOrDefault();

        DateTimeOffset? nextChange = presets
            .Where(preset => preset.Enabled)
            .Select(preset => GetNextBoundary(preset, now))
            .Where(boundary => boundary.HasValue)
            .OrderBy(boundary => boundary)
            .FirstOrDefault();

        if (active is null)
        {
            return new FeaturedPresetResolution(source, null, null, nextChange);
        }

        PluginConfiguration effective = Clone(source);
        Apply(effective, active.Preset);
        return new FeaturedPresetResolution(effective, active.Preset.Id, active.Preset.Name, nextChange);
    }

    internal static FeaturedPresetResolution ResolvePreview(
        PluginConfiguration source,
        DateTimeOffset now,
        string? presetId,
        bool useDefaultConfiguration)
    {
        if (useDefaultConfiguration)
        {
            return new FeaturedPresetResolution(source, null, null, Resolve(source, now).NextScheduleChange);
        }

        if (string.IsNullOrWhiteSpace(presetId)) return Resolve(source, now);
        FeaturedPreset? preset = (source.Presets ?? [])
            .FirstOrDefault(candidate => string.Equals(candidate.Id, presetId, StringComparison.OrdinalIgnoreCase));
        if (preset is null) throw new ArgumentException("The requested preset does not exist.", nameof(presetId));

        PluginConfiguration effective = Clone(source);
        Apply(effective, preset);
        return new FeaturedPresetResolution(effective, preset.Id, preset.Name, null);
    }

    private static ScheduleWindow? GetActiveWindow(FeaturedPreset preset, DateTimeOffset now)
    {
        if (!preset.Enabled) return null;
        return preset.ScheduleType switch
        {
            FeaturedPresetScheduleTypes.Weekly => GetWeeklyWindows(preset, now)
                .Where(window => window.Start <= now && window.End > now)
                .OrderByDescending(window => window.Start)
                .FirstOrDefault(),
            FeaturedPresetScheduleTypes.Annual => GetAnnualWindows(preset, now)
                .Where(window => window.Start <= now && window.End > now)
                .OrderByDescending(window => window.Start)
                .FirstOrDefault(),
            _ => IsOneTimeActive(preset, now)
                ? new ScheduleWindow(preset.StartsAt ?? DateTimeOffset.MinValue, preset.EndsAt ?? DateTimeOffset.MaxValue)
                : null
        };
    }

    private static DateTimeOffset? GetNextBoundary(FeaturedPreset preset, DateTimeOffset now)
    {
        IEnumerable<DateTimeOffset> boundaries = preset.ScheduleType switch
        {
            FeaturedPresetScheduleTypes.Weekly => GetWeeklyWindows(preset, now)
                .SelectMany(window => new[] { window.Start, window.End }),
            FeaturedPresetScheduleTypes.Annual => GetAnnualWindows(preset, now)
                .SelectMany(window => new[] { window.Start, window.End }),
            _ => new[] { preset.StartsAt, preset.EndsAt }
                .Where(boundary => boundary.HasValue)
                .Select(boundary => boundary!.Value)
        };
        return boundaries.Where(boundary => boundary > now).OrderBy(boundary => boundary).Cast<DateTimeOffset?>().FirstOrDefault();
    }

    private static bool IsOneTimeActive(FeaturedPreset preset, DateTimeOffset now)
        => (!preset.StartsAt.HasValue || preset.StartsAt.Value <= now)
            && (!preset.EndsAt.HasValue || preset.EndsAt.Value > now);

    private static IEnumerable<ScheduleWindow> GetWeeklyWindows(FeaturedPreset preset, DateTimeOffset now)
    {
        DayOfWeek[] selectedDays = preset.DaysOfWeek ?? [];
        if (selectedDays.Length == 0) yield break;

        TimeZoneInfo zone = FindTimeZone(preset.TimeZoneId);
        DateTime localDate = TimeZoneInfo.ConvertTime(now, zone).Date;
        TimeOnly startTime = ParseTime(preset.StartTime, new TimeOnly(18, 0));
        TimeOnly endTime = ParseTime(preset.EndTime, new TimeOnly(23, 59));
        for (int dayOffset = -1; dayOffset <= 8; dayOffset++)
        {
            DateTime date = localDate.AddDays(dayOffset);
            if (!selectedDays.Contains(date.DayOfWeek)) continue;
            DateTime localStart = date.Add(startTime.ToTimeSpan());
            DateTime localEnd = date.Add(endTime.ToTimeSpan());
            if (localEnd <= localStart) localEnd = localEnd.AddDays(1);
            yield return new ScheduleWindow(ToUtc(localStart, zone), ToUtc(localEnd, zone));
        }
    }

    private static IEnumerable<ScheduleWindow> GetAnnualWindows(FeaturedPreset preset, DateTimeOffset now)
    {
        TimeZoneInfo zone = FindTimeZone(preset.TimeZoneId);
        int localYear = TimeZoneInfo.ConvertTime(now, zone).Year;
        TimeOnly startTime = ParseTime(preset.StartTime, TimeOnly.MinValue);
        TimeOnly endTime = ParseTime(preset.EndTime, new TimeOnly(23, 59));
        for (int year = localYear - 1; year <= localYear + 2; year++)
        {
            DateTime localStart = CreateAnnualBoundary(year, preset.AnnualStart, startTime, 12, 1);
            DateTime localEnd = CreateAnnualBoundary(year, preset.AnnualEnd, endTime, 12, 31);
            if (localEnd <= localStart)
            {
                localEnd = CreateAnnualBoundary(year + 1, preset.AnnualEnd, endTime, 12, 31);
            }

            yield return new ScheduleWindow(ToUtc(localStart, zone), ToUtc(localEnd, zone));
        }
    }

    private static DateTime CreateAnnualBoundary(
        int year,
        string? monthDay,
        TimeOnly time,
        int fallbackMonth,
        int fallbackDay)
    {
        string[] parts = (monthDay ?? string.Empty).Split('-');
        int month = parts.Length == 2 && int.TryParse(parts[0], NumberStyles.None, CultureInfo.InvariantCulture, out int parsedMonth)
            ? Math.Clamp(parsedMonth, 1, 12)
            : fallbackMonth;
        int day = parts.Length == 2 && int.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out int parsedDay)
            ? Math.Clamp(parsedDay, 1, DateTime.DaysInMonth(year, month))
            : fallbackDay;
        return new DateTime(year, month, day, time.Hour, time.Minute, 0, DateTimeKind.Unspecified);
    }

    private static TimeOnly ParseTime(string? value, TimeOnly fallback)
        => TimeOnly.TryParseExact(value, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out TimeOnly parsed)
            ? parsed
            : fallback;

    private static TimeZoneInfo FindTimeZone(string? id)
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(string.IsNullOrWhiteSpace(id) ? "UTC" : id);
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.Utc;
        }
        catch (InvalidTimeZoneException)
        {
            return TimeZoneInfo.Utc;
        }
    }

    private static DateTimeOffset ToUtc(DateTime local, TimeZoneInfo zone)
    {
        DateTime boundary = DateTime.SpecifyKind(local, DateTimeKind.Unspecified);
        while (zone.IsInvalidTime(boundary)) boundary = boundary.AddMinutes(1);
        return new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(boundary, zone), TimeSpan.Zero);
    }

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
        config.ShowControlsOnHoverOnly = preset.Layout.ShowControlsOnHoverOnly;
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
        config.HideYouTubeTrailerUntilControlsFade = preset.Trailers.HideYouTubeTrailerUntilControlsFade;
        config.WaitForTrailerToFinish = preset.Trailers.WaitForTrailerToFinish;
        config.TrailerDelayMilliseconds = preset.Trailers.TrailerDelayMilliseconds;
        config.TrailerStartOffsetSeconds = preset.Trailers.TrailerStartOffsetSeconds;
        config.TrailerEndOffsetSeconds = preset.Trailers.TrailerEndOffsetSeconds;
        config.MultipleTrailerMode = preset.Trailers.MultipleTrailerMode;
        config.AllowTrailersOnMobile = preset.Trailers.AllowTrailersOnMobile;
        config.TrailerOverrides = preset.Trailers.Overrides;
    }

    private sealed record PresetCandidate(FeaturedPreset Preset, int Index, ScheduleWindow? Window);
    private sealed record ScheduleWindow(DateTimeOffset Start, DateTimeOffset End);
}
