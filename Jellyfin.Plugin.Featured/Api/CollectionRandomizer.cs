namespace Jellyfin.Plugin.Featured.Api;

internal static class CollectionRandomizer
{
    internal static T[] ShuffledCopy<T>(IEnumerable<T> source)
    {
        T[] items = source.ToArray();
        Random.Shared.Shuffle(items);
        return items;
    }
}
