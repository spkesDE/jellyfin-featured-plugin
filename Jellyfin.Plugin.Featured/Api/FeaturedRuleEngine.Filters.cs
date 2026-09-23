using System.Globalization;
using System.Text.RegularExpressions;
using Jellyfin.Extensions;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.Library;

namespace Jellyfin.Plugin.Featured.Api;

internal sealed partial class FeaturedRuleEngine
{
    private static readonly Regex SampleFileNameRegex = new(
        @"(?:^|[._-])sample(?:[._-]*\d+)?$",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled);

    private bool MatchesAllFilters(
        BaseItem item,
        IEnumerable<FeaturedFilterRule> filters,
        IReadOnlyDictionary<Guid, UserItemData>? userDataById,
        FeaturedMediaMetadataSnapshot metadata)
    {
        return filters.All(filter => MatchesFilter(item, filter, userDataById, metadata));
    }

    private static bool MatchesFilter(
        BaseItem item,
        FeaturedFilterRule filter,
        IReadOnlyDictionary<Guid, UserItemData>? userDataById,
        FeaturedMediaMetadataSnapshot metadata)
    {
        if (filter.Values.Length == 0) return true;
        FeaturedItemMetadata itemMetadata = metadata.Get(item.Id);
        return filter.Field switch
        {
            FeaturedFilterFields.Library => MatchBoolean(IsInAnyLibrary(item, filter.Values), filter.Operator),
            FeaturedFilterFields.Genre => MatchCollection(item.Genres, filter.Values, filter.Operator),
            FeaturedFilterFields.Tag => MatchCollection(item.Tags, filter.Values, filter.Operator),
            FeaturedFilterFields.MediaType => MatchCollection([item.GetBaseItemKind().ToString()], filter.Values, filter.Operator),
            FeaturedFilterFields.Played => MatchBoolean(
                GetPlayed(item.Id, userDataById) == ParseBoolean(filter.Values[0]),
                filter.Operator),
            FeaturedFilterFields.CommunityRating => MatchNumber(item.CommunityRating, filter.Values[0], filter.Operator),
            FeaturedFilterFields.CriticRating => MatchNumber(item.CriticRating, filter.Values[0], filter.Operator),
            FeaturedFilterFields.ProductionYear => MatchNumber(item.ProductionYear, filter.Values[0], filter.Operator),
            FeaturedFilterFields.RuntimeMinutes => MatchNumber(
                item.RunTimeTicks.HasValue ? TimeSpan.FromTicks(item.RunTimeTicks.Value).TotalMinutes : null,
                filter.Values[0],
                filter.Operator),
            FeaturedFilterFields.VideoResolution => MatchNumber(
                GetVideoResolution(item),
                filter.Values[0],
                filter.Operator),
            FeaturedFilterFields.Actor => MatchMetadataCollection(itemMetadata.Actors, filter.Values, filter.Operator),
            FeaturedFilterFields.Director => MatchMetadataCollection(itemMetadata.Directors, filter.Values, filter.Operator),
            FeaturedFilterFields.OriginalLanguage => MatchMetadataCollection(itemMetadata.OriginalLanguages, filter.Values, filter.Operator),
            FeaturedFilterFields.AudioLanguage => MatchMetadataCollection(itemMetadata.AudioLanguages, filter.Values, filter.Operator),
            _ => true
        };
    }

    private static double? GetVideoResolution(BaseItem item)
    {
        if (item is not Video video) return null;
        MediaBrowser.Model.Entities.MediaStream? stream = video.GetDefaultVideoStream();
        if (stream is null) return null;
        if (!stream.Width.HasValue) return stream.Height;
        if (!stream.Height.HasValue) return stream.Width;
        return Math.Min(stream.Width.Value, stream.Height.Value);
    }

    private static bool MatchCollection(IEnumerable<string> actualValues, IEnumerable<string> expectedValues, string filterOperator)
    {
        HashSet<string> actual = actualValues.ToHashSet(StringComparer.OrdinalIgnoreCase);
        string[] expected = expectedValues.ToArray();
        bool any = expected.Any(actual.Contains);
        return filterOperator switch
        {
            FeaturedFilterOperators.NotEquals => !any,
            FeaturedFilterOperators.ContainsAll => expected.All(actual.Contains),
            _ => any
        };
    }

    internal static bool MatchMetadataCollection(
        IEnumerable<string> actualValues,
        IEnumerable<string> expectedValues,
        string filterOperator)
    {
        string[] actual = actualValues.ToArray();
        // Missing metadata never satisfies an inclusion rule and is retained by an exclusion rule.
        return actual.Length == 0
            ? filterOperator == FeaturedFilterOperators.NotEquals
            : MatchCollection(actual, expectedValues, filterOperator);
    }

    private static bool MatchNumber(double? actual, string expectedValue, string filterOperator)
    {
        if (!actual.HasValue || !double.TryParse(expectedValue, NumberStyles.Float, CultureInfo.InvariantCulture, out double expected)) return false;
        return filterOperator switch
        {
            FeaturedFilterOperators.LessThanOrEqual => actual.Value <= expected,
            FeaturedFilterOperators.Equal => Math.Abs(actual.Value - expected) < 0.0001,
            FeaturedFilterOperators.NotEquals => Math.Abs(actual.Value - expected) >= 0.0001,
            _ => actual.Value >= expected
        };
    }

    private static bool MatchBoolean(bool equals, string filterOperator)
        => filterOperator == FeaturedFilterOperators.NotEquals ? !equals : equals;

    private static bool ParseBoolean(string value)
        => bool.TryParse(value, out bool result) && result;

    private static bool GetPlayed(Guid itemId, IReadOnlyDictionary<Guid, UserItemData>? userDataById)
        => userDataById?.TryGetValue(itemId, out UserItemData? data) == true && data.Played;

    private static bool ContainsAny(IEnumerable<string> actualValues, IEnumerable<string> expectedValues)
    {
        HashSet<string> actual = actualValues.ToHashSet(StringComparer.OrdinalIgnoreCase);
        return expectedValues.Any(actual.Contains);
    }

    private static bool IsInAnyLibrary(BaseItem item, IEnumerable<string> libraryIds)
    {
        HashSet<Guid> ancestors = item.GetAncestorIds().ToHashSet();
        return libraryIds.Any(value => Guid.TryParse(value, out Guid id) && ancestors.Contains(id));
    }

    private static bool IsEligibleItem(
        BaseItem item,
        HashSet<Guid> allowedItemIds,
        HashSet<Guid> excludedIds,
        bool allowEpisodes,
        bool useTrickplayFallback)
    {
        return allowedItemIds.Contains(item.Id)
            && !excludedIds.Contains(item.Id)
            && IsSupportedItemType(item, allowEpisodes)
            && ((useTrickplayFallback && item is Video)
                || item.HasImage(MediaBrowser.Model.Entities.ImageType.Backdrop)
                || item.HasImage(MediaBrowser.Model.Entities.ImageType.Primary));
    }

    private static bool IsSupportedItemType(BaseItem item)
        => IsSupportedItemType(item, false);

    private static bool IsSupportedItemType(BaseItem item, bool allowEpisodes)
        => (allowEpisodes || item is not Episode)
            && item is not Season
            && item.ExtraType is null
            && !IsSampleFile(item)
            && (FeaturedMediaTypes.Contains(item.GetBaseItemKind())
                || (allowEpisodes && item.GetBaseItemKind() == Jellyfin.Data.Enums.BaseItemKind.Episode));

    private static bool IsSampleFile(BaseItem item)
    {
        if (string.IsNullOrWhiteSpace(item.Path)) return false;
        string fileName = Path.GetFileNameWithoutExtension(item.Path);
        return SampleFileNameRegex.IsMatch(fileName);
    }

    private MediaBrowser.Model.Entities.ParentalRatingScore? GetParentalRatingScore(
        Jellyfin.Database.Implementations.Entities.User activeUser,
        out bool? mustHaveParentRating)
    {
        int maximumRating = _config.MaximumParentRating == -2
            ? activeUser.MaxParentalRatingScore ?? -1
            : _config.MaximumParentRating;
        int subscore = _config.MaximumParentRating == -2 ? 0 : _config.MaximumParentRatingSubscore;
        mustHaveParentRating = maximumRating >= 0 ? true : null;
        return maximumRating >= 0
            ? new MediaBrowser.Model.Entities.ParentalRatingScore(maximumRating, subscore)
            : null;
    }
}
