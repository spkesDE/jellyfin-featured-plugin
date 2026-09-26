using System.Collections.Concurrent;
using System.Diagnostics;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Featured.Api;

public sealed class FeaturedPreferenceOptionsCache
{
    internal static readonly TimeSpan EntryLifetime = TimeSpan.FromMinutes(10);

    private readonly IMemoryCache _cache;
    private readonly ConcurrentDictionary<Guid, byte> _queuedUsers = new();
    private readonly ILogger<FeaturedPreferenceOptionsCache> _logger;

    public FeaturedPreferenceOptionsCache(IMemoryCache cache, ILogger<FeaturedPreferenceOptionsCache> logger)
    {
        _cache = cache;
        _logger = logger;
    }

    public string[] GetOrCreate(Guid userId, Func<string[]> factory)
    {
        PreferenceOptionsCacheKey key = new(userId);
        if (_cache.TryGetValue(key, out Lazy<string[]>? cached) && cached is not null)
        {
            Stopwatch lookupTimer = Stopwatch.StartNew();
            string[] genres = EvaluateOrEvict(key, cached);
            _logger.LogDebug(
                "Jellyfin Featured user-settings genre cache hit: {GenreCount} genres returned in {ElapsedMilliseconds:F1} ms.",
                genres.Length,
                lookupTimer.Elapsed.TotalMilliseconds);
            return [.. genres];
        }

        Lazy<string[]> created = new(
            () =>
            {
                Stopwatch loadTimer = Stopwatch.StartNew();
                string[] genres = factory();
                _logger.LogInformation(
                    "Jellyfin Featured user-settings genre cache miss: loaded {GenreCount} genres in {ElapsedMilliseconds:F1} ms.",
                    genres.Length,
                    loadTimer.Elapsed.TotalMilliseconds);
                return genres;
            },
            LazyThreadSafetyMode.ExecutionAndPublication);

        Lazy<string[]> selected = _cache.GetOrCreate(
            key,
            entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = EntryLifetime;
                return created;
            })!;
        return [.. EvaluateOrEvict(key, selected)];
    }

    public void QueueWarmup(Guid userId, Func<string[]> factory)
    {
        PreferenceOptionsCacheKey key = new(userId);
        if (userId == Guid.Empty || _cache.TryGetValue(key, out _) || !_queuedUsers.TryAdd(userId, 0)) return;

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

    private string[] EvaluateOrEvict(PreferenceOptionsCacheKey key, Lazy<string[]> entry)
    {
        try
        {
            return entry.Value;
        }
        catch
        {
            _cache.Remove(key);
            throw;
        }
    }

    private readonly record struct PreferenceOptionsCacheKey(Guid UserId);
}
