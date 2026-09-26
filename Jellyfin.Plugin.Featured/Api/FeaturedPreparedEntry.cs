using System.Diagnostics;

namespace Jellyfin.Plugin.Featured.Api;

internal sealed record PreparedItem(Guid Id, Lazy<FeaturedItemDto> Dto);

/// <summary>
/// Maintains one user's prepared shuffle bag. Items are not repeated until the
/// eligible remainder can no longer satisfy a request, at which point a new bag is shuffled.
/// </summary>
internal sealed class FeaturedPreparedEntry
{
    private readonly object _sync = new();
    private PreparedItem[] _items;
    private Queue<PreparedItem> _remaining;

    internal FeaturedPreparedEntry(
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
        => new(CollectionRandomizer.ShuffledCopy(source));
}
