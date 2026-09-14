using System.Diagnostics;
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
    private readonly FeaturedItemDtoFactory _itemDtoFactory;
    private readonly ILogger<FeaturedPreparedCache> _logger;

    public FeaturedPreparedCache(
        IUserManager userManager,
        ILibraryManager libraryManager,
        IUserDataManager userDataManager,
        FeaturedDisplayHistoryStore historyStore,
        FeaturedCandidateCache candidateCache,
        FeaturedPersonalizationService personalization,
        FeaturedItemDtoFactory itemDtoFactory,
        ILogger<FeaturedPreparedCache> logger)
    {
        _userManager = userManager;
        _libraryManager = libraryManager;
        _userDataManager = userDataManager;
        _historyStore = historyStore;
        _candidateCache = candidateCache;
        _personalization = personalization;
        _itemDtoFactory = itemDtoFactory;
        _logger = logger;
    }

    internal bool TryGetItems(
        Jellyfin.Database.Implementations.Entities.User user,
        PluginConfiguration config,
        FeaturedPersonalizationContext personalization,
        HashSet<Guid> excludedIds,
        int requestedCount,
        out List<FeaturedItemDto> items,
        out string status,
        out double dtoCreationMilliseconds)
    {
        items = [];
        dtoCreationMilliseconds = 0;
        if (!config.EnablePreparedCache)
        {
            status = "bypass (disabled)";
            return false;
        }

        if (RequiresLiveMixing(config))
        {
            status = "bypass (live mixing required)";
            return false;
        }

        if (!_entries.TryGetValue(user.Id, out PreparedEntry? entry))
        {
            status = _queuedUsers.ContainsKey(user.Id) ? "refreshing" : "miss (no entry)";
            return false;
        }

        if (!string.Equals(entry.ConfigurationFingerprint, GetConfigurationFingerprint(config, personalization), StringComparison.Ordinal))
        {
            status = "miss (fingerprint mismatch)";
            return false;
        }

        if (!entry.TryTake(excludedIds, requestedCount, out items, out dtoCreationMilliseconds, out int eligibleCount))
        {
            status = FormattableString.Invariant($"miss (eligible {eligibleCount} < requested {requestedCount})");
            QueueUserRefresh(user.Id);
            return false;
        }

        status = "hit";
        return true;
    }

    internal static bool CanPopulateFromRequest(string status)
        => status is "miss (no entry)" or "miss (fingerprint mismatch)";

    internal static int GetRequestedPoolSize(PluginConfiguration config) => GetPoolSize(config);

    internal void StoreRequestPool(
        Jellyfin.Database.Implementations.Entities.User user,
        PluginConfiguration config,
        FeaturedPersonalizationContext personalization,
        IReadOnlyList<BaseItem> selectedItems)
        => StorePreparedItems(user, config, personalization, selectedItems, eagerlyBuildDtos: false, replaceExisting: false);

    internal void RemoveDisplayedItem(Guid userId, Guid itemId)
    {
        if (!_entries.TryGetValue(userId, out PreparedEntry? entry)) return;
        int remaining = entry.Remove(itemId);

        PluginConfiguration config = GetCurrentConfiguration();
        int refillThreshold = Math.Max(20, GetPoolSize(config) / 3);
        if (config.EnablePreparedCache && remaining < refillThreshold)
        {
            QueueUserRefresh(userId);
        }
    }

    internal void QueueUserRefresh(Guid userId)
    {
        PluginConfiguration currentConfig = GetCurrentConfiguration();
        if (userId == Guid.Empty || RequiresLiveMixing(currentConfig) || !_queuedUsers.TryAdd(userId, 0)) return;
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

            FeaturedController.WarmItemsResponseSerialization(
                config,
                _personalization.Resolve(config, users[0].Id));

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
        int items = _entries.Values.Sum(entry => entry.Count);
        int remaining = _entries.Values.Sum(entry => entry.RemainingCount);
        DateTimeOffset? newestRefresh = _entries.Count == 0
            ? null
            : _entries.Values.Max(entry => entry.GeneratedAt);
        string refreshed = newestRefresh.HasValue ? newestRefresh.Value.ToString("O") : "never";
        return $"prepared-cache: {_entries.Count} users, {items} items, {remaining} remaining in shuffle bags, {_queuedUsers.Count} queued, refreshed {refreshed}";
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
        if (RequiresLiveMixing(config))
        {
            _entries.TryRemove(user.Id, out _);
            return;
        }

        FeaturedPersonalizationContext personalization = _personalization.Resolve(config, user.Id);
        IReadOnlyDictionary<Guid, DateTimeOffset> recentHistory = _historyStore.GetRecentItems(user.Id, personalization.RepeatCooldownHours);
        FeaturedRuleEngine engine = new(config, _userManager, _libraryManager, _userDataManager, _candidateCache);
        FeaturedSelection selection = engine.SelectItems(user, [], recentHistory, GetPoolSize(config), personalization);
        if (config.Debug) _logger.LogInformation("{RuleEngineTiming}", selection.Timing.FormatReport());
        StorePreparedItems(user, config, personalization, selection.Items, eagerlyBuildDtos: true, replaceExisting: true);
    }

    private void StorePreparedItems(
        Jellyfin.Database.Implementations.Entities.User user,
        PluginConfiguration config,
        FeaturedPersonalizationContext personalization,
        IReadOnlyList<BaseItem> selectedItems,
        bool eagerlyBuildDtos,
        bool replaceExisting)
    {
        string fingerprint = GetConfigurationFingerprint(config, personalization);
        PreparedItem[] items = selectedItems
            .Select(item => new PreparedItem(
                item.Id,
                new Lazy<FeaturedItemDto>(
                    () => _itemDtoFactory.Create(item, user, config, personalization),
                    LazyThreadSafetyMode.ExecutionAndPublication)))
            .ToArray();
        if (eagerlyBuildDtos)
        {
            foreach (PreparedItem item in items) _ = item.Dto.Value;
        }

        PreparedEntry replacement = new(items, fingerprint, DateTimeOffset.UtcNow);
        if (replaceExisting)
        {
            _entries[user.Id] = replacement;
            return;
        }

        _entries.AddOrUpdate(
            user.Id,
            replacement,
            (_, current) => string.Equals(current.ConfigurationFingerprint, fingerprint, StringComparison.Ordinal)
                ? current
                : replacement);
    }

    private static int GetPoolSize(PluginConfiguration config)
        => Math.Clamp(Math.Max(MinimumPoolSize, config.RandomMediaCount * 12), MinimumPoolSize, MaximumPoolSize);

    private static bool RequiresLiveMixing(PluginConfiguration config)
        => config.RelaxRepeatCooldownWhenNeeded
            || config.MaximumItemsPerGenre > 0
            || config.MaximumItemsPerFranchise > 0
            || config.SourceRules.Any(rule => rule.MinimumItems > 0 || rule.MaximumItems > 0 || rule.IsFallback);

    private static PluginConfiguration GetCurrentConfiguration()
    {
        PluginConfiguration baseConfig = PluginConfigurationNormalizer.Normalize(Plugin.Instance?.Configuration);
        return FeaturedPresetResolver.Resolve(baseConfig, DateTimeOffset.UtcNow).Configuration;
    }

    private string GetConfigurationFingerprint(PluginConfiguration config, FeaturedPersonalizationContext personalization)
        => JsonSerializer.Serialize(config) + personalization.Fingerprint;

    private sealed record PreparedItem(Guid Id, Lazy<FeaturedItemDto> Dto);

    private sealed class PreparedEntry
    {
        private readonly object _sync = new();
        private PreparedItem[] _items;
        private Queue<PreparedItem> _remaining;

        internal PreparedEntry(
            PreparedItem[] items,
            string configurationFingerprint,
            DateTimeOffset generatedAt)
        {
            _items = items;
            _remaining = CreateShuffledBag(items);
            ConfigurationFingerprint = configurationFingerprint;
            GeneratedAt = generatedAt;
        }

        internal string ConfigurationFingerprint { get; }

        internal DateTimeOffset GeneratedAt { get; }

        internal int Count
        {
            get
            {
                lock (_sync) return _items.Length;
            }
        }

        internal int RemainingCount
        {
            get
            {
                lock (_sync) return _remaining.Count;
            }
        }

        internal bool TryTake(
            HashSet<Guid> excludedIds,
            int count,
            out List<FeaturedItemDto> items,
            out double dtoCreationMilliseconds,
            out int eligibleCount)
        {
            lock (_sync)
            {
                items = [];
                dtoCreationMilliseconds = 0;
                eligibleCount = _items.Count(item => !excludedIds.Contains(item.Id));
                if (eligibleCount < count) return false;

                if (_remaining.Count(item => !excludedIds.Contains(item.Id)) < count)
                {
                    _remaining = CreateShuffledBag(_items);
                }

                int candidatesToInspect = _remaining.Count;
                for (int index = 0; index < candidatesToInspect && items.Count < count; index++)
                {
                    PreparedItem candidate = _remaining.Dequeue();
                    if (excludedIds.Contains(candidate.Id))
                    {
                        _remaining.Enqueue(candidate);
                    }
                    else
                    {
                        long started = Stopwatch.GetTimestamp();
                        items.Add(candidate.Dto.Value);
                        dtoCreationMilliseconds += Stopwatch.GetElapsedTime(started).TotalMilliseconds;
                    }
                }

                return items.Count == count;
            }
        }

        internal int Remove(Guid itemId)
        {
            lock (_sync)
            {
                _items = _items.Where(item => item.Id != itemId).ToArray();
                _remaining = new Queue<PreparedItem>(_remaining.Where(item => item.Id != itemId));
                return _items.Length;
            }
        }

        private static Queue<PreparedItem> CreateShuffledBag(IEnumerable<PreparedItem> source)
        {
            PreparedItem[] items = source.ToArray();
            for (int index = items.Length - 1; index > 0; index--)
            {
                int swapIndex = Random.Shared.Next(index + 1);
                (items[index], items[swapIndex]) = (items[swapIndex], items[index]);
            }

            return new Queue<PreparedItem>(items);
        }
    }
}
