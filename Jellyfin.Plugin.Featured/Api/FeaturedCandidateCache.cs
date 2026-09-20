using System.Collections.Concurrent;
using System.Threading;
using MediaBrowser.Controller.Entities;

namespace Jellyfin.Plugin.Featured.Api;

public sealed class FeaturedCandidateCache
{
    private const int MaximumEntries = 256;
    internal static readonly TimeSpan SharedEntryLifetime = TimeSpan.FromMinutes(65);
    internal static readonly TimeSpan UserEntryLifetime = TimeSpan.FromMinutes(2);
    private readonly ConcurrentDictionary<string, Lazy<CacheEntry>> _entries = new(StringComparer.Ordinal);
    private long _hits;
    private long _misses;

    internal List<BaseItem> GetOrCreate(string key, TimeSpan lifetime, Func<List<BaseItem>> factory)
    {
        while (true)
        {
            if (_entries.TryGetValue(key, out Lazy<CacheEntry>? existing))
            {
                CacheEntry cached = existing.Value;
                if (cached.ExpiresAt > DateTimeOffset.UtcNow)
                {
                    Interlocked.Increment(ref _hits);
                    return [.. cached.Items];
                }

                _entries.TryRemove(key, out _);
                continue;
            }

            Lazy<CacheEntry> created = new(
                () => new CacheEntry([.. factory()], DateTimeOffset.UtcNow.Add(lifetime)),
                LazyThreadSafetyMode.ExecutionAndPublication);
            Lazy<CacheEntry> selected = _entries.GetOrAdd(key, created);
            if (!ReferenceEquals(selected, created)) continue;

            try
            {
                CacheEntry entry = selected.Value;
                Interlocked.Increment(ref _misses);
                TrimIfNeeded();
                return [.. entry.Items];
            }
            catch
            {
                _entries.TryRemove(key, out _);
                throw;
            }
        }
    }

    internal string GetStatus()
        => $"candidate-cache: {_entries.Count} entries, {Interlocked.Read(ref _hits)} hits, {Interlocked.Read(ref _misses)} misses";

    internal void Clear() => _entries.Clear();

    internal void RemoveUser(Guid userId)
    {
        string scope = $"\"Scope\":\"{userId:N}\"";
        foreach (string key in _entries.Keys.Where(key => key.Contains(scope, StringComparison.OrdinalIgnoreCase)))
        {
            _entries.TryRemove(key, out _);
        }
    }

    private void TrimIfNeeded()
    {
        if (_entries.Count <= MaximumEntries) return;
        DateTimeOffset now = DateTimeOffset.UtcNow;
        foreach ((string key, Lazy<CacheEntry> value) in _entries)
        {
            if (!value.IsValueCreated || value.Value.ExpiresAt <= now || _entries.Count > MaximumEntries)
            {
                _entries.TryRemove(key, out _);
            }
        }
    }

    private sealed record CacheEntry(IReadOnlyList<BaseItem> Items, DateTimeOffset ExpiresAt);
}
