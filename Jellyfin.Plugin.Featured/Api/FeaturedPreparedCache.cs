using System.Collections.Concurrent;
using System.Text.Json;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Featured.Api;

public sealed class FeaturedPreparedCache
{
    private const int MinimumPoolSize = 100;
    private const int MaximumPoolSize = 250;
    private readonly ConcurrentDictionary<Guid, PreparedEntry> _entries = new();
    private readonly ConcurrentDictionary<Guid, byte> _queuedUsers = new();
    private readonly SemaphoreSlim _refreshGate = new(1, 1);
    private readonly IUserManager _userManager;
    private readonly ILibraryManager _libraryManager;
    private readonly IUserDataManager _userDataManager;
    private readonly FeaturedDisplayHistoryStore _historyStore;
    private readonly FeaturedCandidateCache _candidateCache;
    private readonly FeaturedPersonalizationService _personalization;
    private readonly ILogger<FeaturedPreparedCache> _logger;

    public FeaturedPreparedCache(
        IUserManager userManager,
        ILibraryManager libraryManager,
        IUserDataManager userDataManager,
        FeaturedDisplayHistoryStore historyStore,
        FeaturedCandidateCache candidateCache,
        FeaturedPersonalizationService personalization,
        ILogger<FeaturedPreparedCache> logger)
    {
        _userManager = userManager;
        _libraryManager = libraryManager;
        _userDataManager = userDataManager;
        _historyStore = historyStore;
        _candidateCache = candidateCache;
        _personalization = personalization;
        _logger = logger;
    }

    internal bool TryGetItems(
        Jellyfin.Database.Implementations.Entities.User user,
        PluginConfiguration config,
        FeaturedPersonalizationContext personalization,
        HashSet<Guid> excludedIds,
        int requestedCount,
        out List<BaseItem> items)
    {
        items = [];
        if (!config.EnablePreparedCache) return false;
        if (!_entries.TryGetValue(user.Id, out PreparedEntry? entry)
            || !string.Equals(entry.ConfigurationFingerprint, GetConfigurationFingerprint(config, personalization), StringComparison.Ordinal))
        {
            QueueUserRefresh(user.Id);
            return false;
        }

        List<BaseItem> eligibleItems = entry.Items
            .Where(item => !excludedIds.Contains(item.Id))
            .ToList();
        if (eligibleItems.Count < requestedCount)
        {
            QueueUserRefresh(user.Id);
            return false;
        }

        items = SelectRandomItems(eligibleItems, requestedCount);
        return true;
    }

    private static List<BaseItem> SelectRandomItems(List<BaseItem> candidates, int count)
    {
        // The prepared pool has already been filtered and balanced by the rule engine.
        // Shuffle only as much of the pool as needed so reloads do not always return
        // the same first items while preserving a selection without duplicates.
        for (int index = 0; index < count; index++)
        {
            int selectedIndex = Random.Shared.Next(index, candidates.Count);
            (candidates[index], candidates[selectedIndex]) = (candidates[selectedIndex], candidates[index]);
        }

        return candidates.GetRange(0, count);
    }

    internal void RemoveDisplayedItem(Guid userId, Guid itemId)
    {
        if (!_entries.TryGetValue(userId, out PreparedEntry? entry)) return;
        BaseItem[] remaining = entry.Items.Where(item => item.Id != itemId).ToArray();
        _entries[userId] = entry with { Items = remaining };

        PluginConfiguration config = GetCurrentConfiguration();
        int refillThreshold = Math.Max(20, GetPoolSize(config) / 3);
        if (config.EnablePreparedCache && remaining.Length < refillThreshold)
        {
            QueueUserRefresh(userId);
        }
    }

    internal void QueueUserRefresh(Guid userId)
    {
        if (userId == Guid.Empty || !_queuedUsers.TryAdd(userId, 0)) return;
        _ = Task.Run(async () =>
        {
            try
            {
                await RefreshUserWithGateAsync(userId, CancellationToken.None).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not refresh the prepared Jellyfin Featured cache for user {UserId}.", userId);
            }
            finally
            {
                _queuedUsers.TryRemove(userId, out _);
            }
        });
    }

    internal async Task RefreshAllAsync(IProgress<double> progress, CancellationToken cancellationToken)
    {
        PluginConfiguration config = GetCurrentConfiguration();
        if (!config.EnablePreparedCache)
        {
            Clear();
            progress.Report(100);
            return;
        }

        await _refreshGate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            Jellyfin.Database.Implementations.Entities.User[] users = _userManager.GetUsers().ToArray();
            if (users.Length == 0)
            {
                progress.Report(100);
                return;
            }

            for (int index = 0; index < users.Length; index++)
            {
                cancellationToken.ThrowIfCancellationRequested();
                RefreshUser(users[index], config);
                progress.Report((index + 1d) / users.Length * 100d);
                await Task.Yield();
            }

            HashSet<Guid> currentUserIds = users.Select(user => user.Id).ToHashSet();
            foreach (Guid cachedUserId in _entries.Keys.Where(id => !currentUserIds.Contains(id)))
            {
                _entries.TryRemove(cachedUserId, out _);
            }
        }
        finally
        {
            _refreshGate.Release();
        }
    }

    internal void Clear()
    {
        _entries.Clear();
    }

    internal string GetStatus()
    {
        int items = _entries.Values.Sum(entry => entry.Items.Count);
        DateTimeOffset? newestRefresh = _entries.Count == 0
            ? null
            : _entries.Values.Max(entry => entry.GeneratedAt);
        string refreshed = newestRefresh.HasValue ? newestRefresh.Value.ToString("O") : "never";
        return $"prepared-cache: {_entries.Count} users, {items} items, {_queuedUsers.Count} queued, refreshed {refreshed}";
    }

    private async Task RefreshUserWithGateAsync(Guid userId, CancellationToken cancellationToken)
    {
        await _refreshGate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            PluginConfiguration config = GetCurrentConfiguration();
            if (!config.EnablePreparedCache)
            {
                _entries.TryRemove(userId, out _);
                return;
            }

            Jellyfin.Database.Implementations.Entities.User? user = _userManager.GetUserById(userId);
            if (user is not null) RefreshUser(user, config);
        }
        finally
        {
            _refreshGate.Release();
        }
    }

    private void RefreshUser(Jellyfin.Database.Implementations.Entities.User user, PluginConfiguration config)
    {
        FeaturedPersonalizationContext personalization = _personalization.Resolve(config, user.Id);
        HashSet<Guid> historyIds = _historyStore.GetRecentItemIds(user.Id, personalization.RepeatCooldownDays);
        FeaturedRuleEngine engine = new(config, _userManager, _libraryManager, _userDataManager, _candidateCache);
        FeaturedSelection selection = engine.SelectItems(user, [], historyIds, GetPoolSize(config), personalization);
        _entries[user.Id] = new PreparedEntry(
            selection.Items.ToArray(),
            GetConfigurationFingerprint(config, personalization),
            DateTimeOffset.UtcNow);
    }

    private static int GetPoolSize(PluginConfiguration config)
        => Math.Clamp(Math.Max(MinimumPoolSize, config.RandomMediaCount * 12), MinimumPoolSize, MaximumPoolSize);

    private static PluginConfiguration GetCurrentConfiguration()
        => PluginConfigurationNormalizer.Normalize(Plugin.Instance?.Configuration);

    private string GetConfigurationFingerprint(PluginConfiguration config, FeaturedPersonalizationContext personalization)
        => JsonSerializer.Serialize(config) + personalization.Fingerprint;

    private sealed record PreparedEntry(
        IReadOnlyList<BaseItem> Items,
        string ConfigurationFingerprint,
        DateTimeOffset GeneratedAt);
}
