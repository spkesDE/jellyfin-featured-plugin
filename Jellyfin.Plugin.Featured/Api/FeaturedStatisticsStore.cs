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
        => Update(itemId, entry =>
        {
            entry.Impressions += 1;
            entry.LastShownAt = DateTimeOffset.UtcNow;
        });

    internal bool RecordInteraction(Guid itemId, string? kind)
    {
        switch (kind?.Trim().ToLowerInvariant())
        {
            case FeaturedInteractionKinds.Open:
                Update(itemId, entry => entry.Opens += 1);
                return true;
            case FeaturedInteractionKinds.Play:
                Update(itemId, entry => entry.Plays += 1);
                return true;
            default:
                return false;
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

    private void Update(Guid itemId, Action<FeaturedItemStatistics> change)
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

            change(entry);
            QueueSave();
        }
    }

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
                StringComparer.OrdinalIgnoreCase)
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

    internal static FeaturedStatisticsSnapshot CreateEmpty() => new() { Since = DateTimeOffset.UtcNow };

    internal FeaturedStatisticsSnapshot Copy() => new()
    {
        Since = Since,
        Items = Items.ToDictionary(pair => pair.Key, pair => pair.Value.Copy(), StringComparer.OrdinalIgnoreCase)
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
