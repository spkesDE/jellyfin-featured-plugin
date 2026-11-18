using MediaBrowser.Common.Configuration;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Featured.Api;

public static class FeaturedInteractionKinds
{
    public const string Open = "open";
    public const string Play = "play";
}

/// <summary>
/// Counts per title how often the banner showed it and how often viewers opened or played it. The counts are summed
/// over all users; nothing is stored per user.
/// </summary>
public sealed class FeaturedStatisticsStore : IDisposable
{
    internal const int MaximumItems = 5000;
    internal const int RetainedDays = 90;
    private const string ConfigurationDirectoryName = "Jellyfin.Plugin.Featured";
    private static readonly TimeSpan PersistenceDelay = TimeSpan.FromSeconds(5);
    private readonly object _syncRoot = new();
    private readonly object _saveRoot = new();
    private readonly AtomicJsonFileStore<FeaturedStatisticsSnapshot> _persistence;
    private readonly Timer _saveTimer;
    private FeaturedStatisticsSnapshot? _snapshot;
    private bool _dirty;

    public FeaturedStatisticsStore(IApplicationPaths applicationPaths, ILogger<FeaturedStatisticsStore> logger)
    {
        string filePath = Path.Combine(
            applicationPaths.PluginConfigurationsPath,
            ConfigurationDirectoryName,
            "statistics.json");
        _persistence = new(filePath, "statistics", logger);
        _saveTimer = new Timer(_ => PersistPendingChanges(), null, Timeout.InfiniteTimeSpan, Timeout.InfiniteTimeSpan);
    }

    internal void RecordImpression(Guid itemId)
        => Update(itemId, (entry, day) =>
        {
            entry.Impressions += 1;
            day.Impressions += 1;
            entry.LastShownAt = DateTimeOffset.UtcNow;
        });

    internal bool RecordInteraction(Guid itemId, string? kind)
    {
        switch (kind?.Trim().ToLowerInvariant())
        {
            case FeaturedInteractionKinds.Open:
                Update(itemId, (entry, day) =>
                {
                    entry.Opens += 1;
                    day.Opens += 1;
                });
                return true;
            case FeaturedInteractionKinds.Play:
                Update(itemId, (entry, day) =>
                {
                    entry.Plays += 1;
                    day.Plays += 1;
                });
                return true;
            default:
                return false;
        }
    }

    /// <summary>Daily totals for the last <paramref name="days"/> UTC days, oldest first, including empty days.</summary>
    internal FeaturedDailyStatistics[] GetDailyTotals(int days, DateTimeOffset? now = null)
    {
        DateOnly today = DateOnly.FromDateTime((now ?? DateTimeOffset.UtcNow).UtcDateTime);
        int count = Math.Clamp(days, 1, RetainedDays);
        lock (_syncRoot)
        {
            EnsureLoaded();
            return Enumerable.Range(0, count)
                .Select(offset => today.AddDays(offset - count + 1))
                .Select(date =>
                {
                    string key = DayKey(date);
                    FeaturedDailyStatistics day = _snapshot!.Days.TryGetValue(key, out FeaturedDailyStatistics? value)
                        ? value.Copy()
                        : new FeaturedDailyStatistics();
                    day.Date = key;
                    return day;
                })
                .ToArray();
        }
    }

    internal FeaturedStatisticsSnapshot GetSnapshot()
    {
        lock (_syncRoot)
        {
            EnsureLoaded();
            return _snapshot!.Copy();
        }
    }

    internal void Reset()
    {
        lock (_syncRoot)
        {
            _snapshot = FeaturedStatisticsSnapshot.CreateEmpty();
            QueueSave();
        }
    }

    public void Dispose()
    {
        _saveTimer.Change(Timeout.InfiniteTimeSpan, Timeout.InfiniteTimeSpan);
        PersistPendingChanges();
        _saveTimer.Dispose();
        GC.SuppressFinalize(this);
    }

    private void Update(Guid itemId, Action<FeaturedItemStatistics, FeaturedDailyStatistics> change)
    {
        if (itemId == Guid.Empty) return;
        lock (_syncRoot)
        {
            EnsureLoaded();
            string key = itemId.ToString("N");
            if (!_snapshot!.Items.TryGetValue(key, out FeaturedItemStatistics? entry))
            {
                if (_snapshot.Items.Count >= MaximumItems) TrimOldest();
                entry = new FeaturedItemStatistics();
                _snapshot.Items[key] = entry;
            }

            DateOnly today = DateOnly.FromDateTime(DateTime.UtcNow);
            string dayKey = DayKey(today);
            if (!_snapshot.Days.TryGetValue(dayKey, out FeaturedDailyStatistics? day))
            {
                day = new FeaturedDailyStatistics();
                _snapshot.Days[dayKey] = day;
                TrimDays(today);
            }

            change(entry, day);
            QueueSave();
        }
    }

    private void TrimDays(DateOnly today)
    {
        string oldestKept = DayKey(today.AddDays(1 - RetainedDays));
        foreach (string key in _snapshot!.Days.Keys.Where(key => string.CompareOrdinal(key, oldestKept) < 0).ToArray())
        {
            _snapshot.Days.Remove(key);
        }
    }

    private static string DayKey(DateOnly date) => date.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);

    private void TrimOldest()
    {
        int removeCount = Math.Max(1, MaximumItems / 10);
        foreach (string key in _snapshot!.Items
            .OrderBy(pair => pair.Value.LastShownAt ?? DateTimeOffset.MinValue)
            .Take(removeCount)
            .Select(pair => pair.Key)
            .ToArray())
        {
            _snapshot.Items.Remove(key);
        }
    }

    private void EnsureLoaded()
    {
        if (_snapshot is not null) return;
        _snapshot = _persistence.Load(FeaturedStatisticsSnapshot.CreateEmpty, loaded => new FeaturedStatisticsSnapshot
        {
            Since = loaded.Since,
            Items = new Dictionary<string, FeaturedItemStatistics>(
                loaded.Items ?? new Dictionary<string, FeaturedItemStatistics>(),
                StringComparer.OrdinalIgnoreCase),
            Days = new Dictionary<string, FeaturedDailyStatistics>(
                loaded.Days ?? new Dictionary<string, FeaturedDailyStatistics>(),
                StringComparer.Ordinal)
        });
    }

    private void QueueSave()
    {
        _dirty = true;
        _saveTimer.Change(PersistenceDelay, Timeout.InfiniteTimeSpan);
    }

    private void PersistPendingChanges()
    {
        lock (_saveRoot)
        {
            FeaturedStatisticsSnapshot snapshot;
            lock (_syncRoot)
            {
                if (!_dirty || _snapshot is null) return;
                _dirty = false;
                snapshot = _snapshot.Copy();
            }

            _persistence.Save(snapshot);
        }
    }
}

public sealed class FeaturedStatisticsSnapshot
{
    public DateTimeOffset Since { get; set; }

    public Dictionary<string, FeaturedItemStatistics> Items { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>Totals per UTC day (yyyy-MM-dd) for the history charts.</summary>
    public Dictionary<string, FeaturedDailyStatistics> Days { get; set; } = new(StringComparer.Ordinal);

    internal static FeaturedStatisticsSnapshot CreateEmpty() => new() { Since = DateTimeOffset.UtcNow };

    internal FeaturedStatisticsSnapshot Copy() => new()
    {
        Since = Since,
        Items = Items.ToDictionary(pair => pair.Key, pair => pair.Value.Copy(), StringComparer.OrdinalIgnoreCase),
        Days = Days.ToDictionary(pair => pair.Key, pair => pair.Value.Copy(), StringComparer.Ordinal)
    };
}

public sealed class FeaturedDailyStatistics
{
    public string? Date { get; set; }

    public long Impressions { get; set; }

    public long Opens { get; set; }

    public long Plays { get; set; }

    internal FeaturedDailyStatistics Copy() => new()
    {
        Date = Date,
        Impressions = Impressions,
        Opens = Opens,
        Plays = Plays
    };
}

public sealed class FeaturedItemStatistics
{
    public long Impressions { get; set; }

    public long Opens { get; set; }

    public long Plays { get; set; }

    public DateTimeOffset? LastShownAt { get; set; }

    internal FeaturedItemStatistics Copy() => new()
    {
        Impressions = Impressions,
        Opens = Opens,
        Plays = Plays,
        LastShownAt = LastShownAt
    };
}
