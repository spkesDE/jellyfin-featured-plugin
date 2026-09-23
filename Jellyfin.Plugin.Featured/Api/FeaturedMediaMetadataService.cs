using Jellyfin.Data.Enums;
using Jellyfin.Database.Implementations.Enums;
using MediaBrowser.Controller.Dto;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.TV;
using MediaBrowser.Model.Entities;
using MediaBrowser.Model.Querying;

namespace Jellyfin.Plugin.Featured.Api;

public sealed class FeaturedMediaMetadataService
{
    private readonly ILibraryManager _libraryManager;
    private readonly IMediaSourceManager _mediaSourceManager;
    private readonly ITVSeriesManager _tvSeriesManager;

    public FeaturedMediaMetadataService(
        ILibraryManager libraryManager,
        IMediaSourceManager mediaSourceManager,
        ITVSeriesManager tvSeriesManager)
    {
        _libraryManager = libraryManager;
        _mediaSourceManager = mediaSourceManager;
        _tvSeriesManager = tvSeriesManager;
    }

    internal IReadOnlyList<BaseItem> GetContinueWatching(
        Jellyfin.Database.Implementations.Entities.User user,
        int limit)
    {
        InternalItemsQuery query = new(user)
        {
            IncludeItemTypes =
            [
                BaseItemKind.Movie,
                BaseItemKind.Episode,
                BaseItemKind.Video,
                BaseItemKind.MusicVideo,
                BaseItemKind.AudioBook
            ],
            IsResumable = true,
            Recursive = true,
            IsVirtualItem = false,
            CollapseBoxSetItems = false,
            IncludeOwnedItems = true,
            Limit = limit,
            OrderBy = [(ItemSortBy.DatePlayed, SortOrder.Descending)]
        };
        return _libraryManager.GetItemList(query).ToList();
    }

    internal IReadOnlyList<BaseItem> GetNextUp(
        Jellyfin.Database.Implementations.Entities.User user,
        int limit)
        => _tvSeriesManager.GetNextUp(
            new NextUpQuery
            {
                User = user,
                Limit = limit,
                NextUpDateCutoff = DateTime.MinValue,
                EnableResumable = true,
                EnableRewatching = false
            },
            new DtoOptions()).Items;

    internal FeaturedMediaMetadataSnapshot BuildSnapshot(
        IReadOnlyList<BaseItem> items,
        IEnumerable<FeaturedFilterRule> filters,
        Jellyfin.Database.Implementations.Entities.User? user = null)
    {
        HashSet<string> fields = filters.Select(filter => filter.Field).ToHashSet(StringComparer.OrdinalIgnoreCase);
        bool needsPeople = fields.Contains(FeaturedFilterFields.Actor) || fields.Contains(FeaturedFilterFields.Director);
        bool needsOriginalLanguage = fields.Contains(FeaturedFilterFields.OriginalLanguage);
        bool needsAudioLanguage = fields.Contains(FeaturedFilterFields.AudioLanguage);
        if (!needsPeople && !needsOriginalLanguage && !needsAudioLanguage) return FeaturedMediaMetadataSnapshot.Empty;

        IReadOnlyDictionary<Guid, IReadOnlyList<PersonInfo>> peopleByItem = needsPeople
            ? _libraryManager.GetPeopleByItems(items.Select(item => item.Id).ToArray())
            : new Dictionary<Guid, IReadOnlyList<PersonInfo>>();
        Dictionary<Guid, FeaturedItemMetadata> result = [];
        foreach (BaseItem item in items)
        {
            string[] actors = [];
            string[] directors = [];
            if (needsPeople)
            {
                IReadOnlyList<PersonInfo> people = peopleByItem.GetValueOrDefault(item.Id) ?? [];
                actors = people
                    .Where(person => person.Type == PersonKind.Actor)
                    .Select(person => person.Name)
                    .Where(name => !string.IsNullOrWhiteSpace(name))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray();
                directors = people
                    .Where(person => person.Type == PersonKind.Director)
                    .Select(person => person.Name)
                    .Where(name => !string.IsNullOrWhiteSpace(name))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray();
            }

            string[] originalLanguages = needsOriginalLanguage
                ? NormalizeLanguages([item.GetInheritedOriginalLanguage()])
                : [];
            string[] audioLanguages = needsAudioLanguage
                ? GetAudioLanguages(item, user)
                : [];
            result[item.Id] = new FeaturedItemMetadata(actors, directors, originalLanguages, audioLanguages);
        }

        return new FeaturedMediaMetadataSnapshot(result);
    }

    internal FeaturedFilterOptions GetFilterOptions(IEnumerable<BaseItem> items)
    {
        BaseItem[] source = items.ToArray();
        FeaturedMediaMetadataSnapshot snapshot = BuildSnapshot(source,
        [
            new FeaturedFilterRule { Field = FeaturedFilterFields.Actor },
            new FeaturedFilterRule { Field = FeaturedFilterFields.Director },
            new FeaturedFilterRule { Field = FeaturedFilterFields.OriginalLanguage }
        ]);
        FeaturedItemMetadata[] metadata = source
            .Select(item => snapshot.Get(item.Id))
            .ToArray();
        return new FeaturedFilterOptions(
            SortDistinct(metadata.SelectMany(value => value.Actors)),
            SortDistinct(metadata.SelectMany(value => value.Directors)),
            SortDistinct(metadata.SelectMany(value => value.OriginalLanguages)),
            SortDistinct(_libraryManager.GetMediaStreamLanguages(MediaStreamType.Audio)));
    }

    private static string[] NormalizeLanguages(IEnumerable<string?> values)
        => values
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value!.Trim().ToLowerInvariant())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

    private string[] GetAudioLanguages(
        BaseItem item,
        Jellyfin.Database.Implementations.Entities.User? user)
    {
        IEnumerable<BaseItem> playableItems = [item];
        if (item.GetBaseItemKind() == BaseItemKind.Series && item is Folder folder)
        {
            playableItems = folder.GetRecursiveChildren()
                .Where(child => child.GetBaseItemKind() == BaseItemKind.Episode)
                .Where(child => user is null || child.IsVisibleStandalone(user));
        }

        return NormalizeLanguages(playableItems
            .SelectMany(playable => _mediaSourceManager.GetMediaStreams(playable.Id))
            .Where(stream => stream.Type == MediaStreamType.Audio)
            .Select(stream => stream.Language));
    }

    private static string[] SortDistinct(IEnumerable<string> values)
        => values
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Distinct(StringComparer.CurrentCultureIgnoreCase)
            .OrderBy(value => value, StringComparer.CurrentCultureIgnoreCase)
            .ToArray();
}

internal sealed record FeaturedFilterOptions(
    string[] Actors,
    string[] Directors,
    string[] OriginalLanguages,
    string[] AudioLanguages);

internal sealed record FeaturedItemMetadata(
    string[] Actors,
    string[] Directors,
    string[] OriginalLanguages,
    string[] AudioLanguages)
{
    internal static readonly FeaturedItemMetadata Empty = new([], [], [], []);
}

internal sealed class FeaturedMediaMetadataSnapshot
{
    internal static readonly FeaturedMediaMetadataSnapshot Empty = new(
        new Dictionary<Guid, FeaturedItemMetadata>());

    private readonly IReadOnlyDictionary<Guid, FeaturedItemMetadata> _items;

    internal FeaturedMediaMetadataSnapshot(IReadOnlyDictionary<Guid, FeaturedItemMetadata> items)
    {
        _items = items;
    }

    internal FeaturedItemMetadata Get(Guid itemId)
        => _items.GetValueOrDefault(itemId) ?? FeaturedItemMetadata.Empty;
}
