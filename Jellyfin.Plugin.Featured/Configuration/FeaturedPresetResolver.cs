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
    private static readonly TimeOnly LastMinuteOfDay = new(23, 59);

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
        FeaturedConfigurationMappings.ApplyPreset(effective, active.Preset);
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
        FeaturedConfigurationMappings.ApplyPreset(effective, preset);
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
        TimeSpan startTime = ParseTime(preset.StartTime, new TimeOnly(18, 0)).ToTimeSpan();
        TimeSpan endTime = ToEndOfWindow(ParseTime(preset.EndTime, LastMinuteOfDay));
        for (int dayOffset = -1; dayOffset <= 8; dayOffset++)
        {
            DateTime date = localDate.AddDays(dayOffset);
            if (!selectedDays.Contains(date.DayOfWeek)) continue;
            DateTime localStart = date.Add(startTime);
            DateTime localEnd = date.Add(endTime);
            if (localEnd <= localStart) localEnd = localEnd.AddDays(1);
            yield return new ScheduleWindow(ToUtc(localStart, zone), ToUtc(localEnd, zone));
        }
    }

    private static IEnumerable<ScheduleWindow> GetAnnualWindows(FeaturedPreset preset, DateTimeOffset now)
    {
        TimeZoneInfo zone = FindTimeZone(preset.TimeZoneId);
        int localYear = TimeZoneInfo.ConvertTime(now, zone).Year;
        TimeSpan startTime = ParseTime(preset.StartTime, TimeOnly.MinValue).ToTimeSpan();
        TimeSpan endTime = ToEndOfWindow(ParseTime(preset.EndTime, LastMinuteOfDay));
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
        TimeSpan timeOfDay,
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
        return new DateTime(year, month, day, 0, 0, 0, DateTimeKind.Unspecified).Add(timeOfDay);
    }

    /// <summary>
    /// End times are exclusive so back-to-back presets tile without overlap. The editor cannot enter 24:00,
    /// so its last minute (23:59) stands for the end of the day; otherwise the final minute would be lost.
    /// </summary>
    private static TimeSpan ToEndOfWindow(TimeOnly endTime)
        => endTime == LastMinuteOfDay ? TimeSpan.FromDays(1) : endTime.ToTimeSpan();

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

    private sealed record PresetCandidate(FeaturedPreset Preset, int Index, ScheduleWindow? Window);
    private sealed record ScheduleWindow(DateTimeOffset Start, DateTimeOffset End);
}
