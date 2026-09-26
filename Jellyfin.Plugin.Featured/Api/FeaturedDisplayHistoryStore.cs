using MediaBrowser.Common.Configuration;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Featured.Api;

public sealed class FeaturedDisplayHistoryStore : IDisposable
{
    private const int MaximumEntriesPerUser = 500;
    private const string ConfigurationDirectoryName = "Jellyfin.Plugin.Featured";
    private static readonly TimeSpan PersistenceDelay = TimeSpan.FromSeconds(1);
    private readonly object _syncRoot = new();
    private readonly object _saveRoot = new();
    private readonly AtomicJsonFileStore<Dictionary<string, List<FeaturedDisplayHistoryEntry>>> _persistence;
    private readonly Timer _saveTimer;
    private Dictionary<string, List<FeaturedDisplayHistoryEntry>>? _entries;
    private bool _dirty;

    public FeaturedDisplayHistoryStore(
        IApplicationPaths applicationPaths,
        ILogger<FeaturedDisplayHistoryStore> logger)
    {
        string filePath = Path.Combine(
            applicationPaths.PluginConfigurationsPath,
            ConfigurationDirectoryName,
            "display-history.json");
        _persistence = new(filePath, "display history", logger);
        _saveTimer = new Timer(
            _ => PersistPendingChanges(),
            null,
            Timeout.InfiniteTimeSpan,
            Timeout.InfiniteTimeSpan);
    }

    internal HashSet<Guid> GetRecentItemIds(Guid userId, int cooldownHours)
        => GetRecentItems(userId, cooldownHours).Keys.ToHashSet();

    internal IReadOnlyDictionary<Guid, DateTimeOffset> GetRecentItems(Guid userId, int cooldownHours)
    {
        if (cooldownHours <= 0) return new Dictionary<Guid, DateTimeOffset>();
        lock (_syncRoot)
        {
            EnsureLoaded();
            string key = userId.ToString("N");
            if (!_entries!.TryGetValue(key, out List<FeaturedDisplayHistoryEntry>? history) || history is null)
            {
                return new Dictionary<Guid, DateTimeOffset>();
            }

            DateTimeOffset cutoff = DateTimeOffset.UtcNow.AddHours(-cooldownHours);
            return history
                .Where(entry => entry.DisplayedAt >= cutoff)
                .Select(entry => new
                {
                    Id = Guid.TryParse(entry.ItemId, out Guid id) ? id : Guid.Empty,
                    entry.DisplayedAt
                })
                .Where(entry => entry.Id != Guid.Empty)
                .GroupBy(entry => entry.Id)
                .ToDictionary(group => group.Key, group => group.Max(entry => entry.DisplayedAt));
        }
    }

    internal int GetEntryCount(Guid userId)
    {
        lock (_syncRoot)
        {
            EnsureLoaded();
            return _entries!.TryGetValue(userId.ToString("N"), out List<FeaturedDisplayHistoryEntry>? history)
                ? history?.Count ?? 0
                : 0;
        }
    }

    internal void Record(Guid userId, Guid itemId)
    {
        if (userId == Guid.Empty || itemId == Guid.Empty) return;
        lock (_syncRoot)
        {
            EnsureLoaded();
            string key = userId.ToString("N");
            if (!_entries!.TryGetValue(key, out List<FeaturedDisplayHistoryEntry>? history) || history is null)
            {
                history = [];
                _entries[key] = history;
            }

            history.RemoveAll(entry => string.Equals(entry.ItemId, itemId.ToString("N"), StringComparison.OrdinalIgnoreCase));
            history.Insert(0, new FeaturedDisplayHistoryEntry(itemId.ToString("N"), DateTimeOffset.UtcNow));
            if (history.Count > MaximumEntriesPerUser)
            {
                history.RemoveRange(MaximumEntriesPerUser, history.Count - MaximumEntriesPerUser);
            }

            QueueSave();
        }
    }

    internal int Clear(IEnumerable<Guid> userIds)
    {
        lock (_syncRoot)
        {
            EnsureLoaded();
            int removedUsers = 0;
            foreach (Guid userId in userIds.Where(userId => userId != Guid.Empty).Distinct())
            {
                if (_entries!.Remove(userId.ToString("N"))) removedUsers += 1;
            }

            if (removedUsers > 0) QueueSave();
            return removedUsers;
        }
    }

    public void Dispose()
    {
        _saveTimer.Change(Timeout.InfiniteTimeSpan, Timeout.InfiniteTimeSpan);
        PersistPendingChanges();
        _saveTimer.Dispose();
        GC.SuppressFinalize(this);
    }

    private void EnsureLoaded()
    {
        if (_entries is not null) return;
        _entries = _persistence.Load(
            () => new(StringComparer.OrdinalIgnoreCase),
            loaded => new Dictionary<string, List<FeaturedDisplayHistoryEntry>>(loaded, StringComparer.OrdinalIgnoreCase));
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
            while (true)
            {
                Dictionary<string, List<FeaturedDisplayHistoryEntry>> snapshot;
                lock (_syncRoot)
                {
                    if (!_dirty || _entries is null) return;
                    _dirty = false;
                    snapshot = _entries.ToDictionary(
                        pair => pair.Key,
                        pair => pair.Value.ToList(),
                        StringComparer.OrdinalIgnoreCase);
                }

                _persistence.Save(snapshot);
            }
        }
    }
}

internal sealed record FeaturedDisplayHistoryEntry(string ItemId, DateTimeOffset DisplayedAt);
