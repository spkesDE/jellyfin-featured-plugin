using System.Collections.Concurrent;
using System.Diagnostics;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Featured.Api;

public sealed class FeaturedPreferenceOptionsCache
{
    internal static readonly TimeSpan EntryLifetime = TimeSpan.FromMinutes(10);

    private readonly ConcurrentDictionary<Guid, Lazy<CacheEntry>> _entries = new();
    private readonly ConcurrentDictionary<Guid, byte> _queuedUsers = new();
    private readonly ILogger<FeaturedPreferenceOptionsCache> _logger;

    public FeaturedPreferenceOptionsCache(ILogger<FeaturedPreferenceOptionsCache> logger)
    {
        _logger = logger;
    }

    public string[] GetOrCreate(Guid userId, Func<string[]> factory)
    {
        while (true)
        {
            if (_entries.TryGetValue(userId, out Lazy<CacheEntry>? existing))
            {
                Stopwatch lookupTimer = Stopwatch.StartNew();
                CacheEntry cached = existing.Value;
                if (cached.ExpiresAt > DateTimeOffset.UtcNow)
                {
                    _logger.LogDebug(
                        "Jellyfin Featured user-settings genre cache hit: {GenreCount} genres returned in {ElapsedMilliseconds:F1} ms.",
                        cached.Genres.Length,
                        lookupTimer.Elapsed.TotalMilliseconds);
                    return [.. cached.Genres];
                }

                _logger.LogDebug("Jellyfin Featured user-settings genre cache entry expired.");
                _entries.TryRemove(new KeyValuePair<Guid, Lazy<CacheEntry>>(userId, existing));
            }

            Lazy<CacheEntry> created = new(
                () =>
                {
                    Stopwatch loadTimer = Stopwatch.StartNew();
                    string[] genres = factory();
                    _logger.LogInformation(
                        "Jellyfin Featured user-settings genre cache miss: loaded {GenreCount} genres in {ElapsedMilliseconds:F1} ms.",
                        genres.Length,
                        loadTimer.Elapsed.TotalMilliseconds);
                    return new CacheEntry(genres, DateTimeOffset.UtcNow.Add(EntryLifetime));
                },
                LazyThreadSafetyMode.ExecutionAndPublication);
            Lazy<CacheEntry> selected = _entries.GetOrAdd(userId, created);
            try
            {
                CacheEntry entry = selected.Value;
                if (entry.ExpiresAt > DateTimeOffset.UtcNow) return [.. entry.Genres];
                _entries.TryRemove(new KeyValuePair<Guid, Lazy<CacheEntry>>(userId, selected));
            }
            catch
            {
                _entries.TryRemove(new KeyValuePair<Guid, Lazy<CacheEntry>>(userId, selected));
                throw;
            }
        }
    }

    public void QueueWarmup(Guid userId, Func<string[]> factory)
    {
        if (userId == Guid.Empty || HasFreshOrPendingEntry(userId) || !_queuedUsers.TryAdd(userId, 0)) return;

        _logger.LogDebug("Queued Jellyfin Featured user-settings genre cache warmup.");
        _ = Task.Run(() =>
        {
            try
            {
                _ = GetOrCreate(userId, factory);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not warm the Jellyfin Featured user-settings genre cache.");
            }
            finally
            {
                _queuedUsers.TryRemove(userId, out _);
            }
        });
    }

    private bool HasFreshOrPendingEntry(Guid userId)
    {
        if (!_entries.TryGetValue(userId, out Lazy<CacheEntry>? entry)) return false;
        if (!entry.IsValueCreated) return true;
        return entry.Value.ExpiresAt > DateTimeOffset.UtcNow;
    }

    private sealed record CacheEntry(string[] Genres, DateTimeOffset ExpiresAt);
}
