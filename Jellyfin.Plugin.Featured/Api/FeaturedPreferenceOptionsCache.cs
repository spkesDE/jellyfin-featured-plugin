using System.Collections.Concurrent;

namespace Jellyfin.Plugin.Featured.Api;

public sealed class FeaturedPreferenceOptionsCache
{
    internal static readonly TimeSpan EntryLifetime = TimeSpan.FromMinutes(2);

    private readonly ConcurrentDictionary<Guid, Lazy<CacheEntry>> _entries = new();

    public string[] GetOrCreate(Guid userId, Func<string[]> factory)
    {
        while (true)
        {
            if (_entries.TryGetValue(userId, out Lazy<CacheEntry>? existing))
            {
                CacheEntry cached = existing.Value;
                if (cached.ExpiresAt > DateTimeOffset.UtcNow) return [.. cached.Genres];
                _entries.TryRemove(new KeyValuePair<Guid, Lazy<CacheEntry>>(userId, existing));
            }

            Lazy<CacheEntry> created = new(
                () => new CacheEntry(factory(), DateTimeOffset.UtcNow.Add(EntryLifetime)),
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

    private sealed record CacheEntry(string[] Genres, DateTimeOffset ExpiresAt);
}
