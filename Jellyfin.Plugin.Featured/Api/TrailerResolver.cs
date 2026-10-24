using Jellyfin.Data.Enums;
using Jellyfin.Database.Implementations.Enums;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.Library;
using MediaBrowser.Model.Entities;

namespace Jellyfin.Plugin.Featured.Api;

public sealed class TrailerResolver
{
    internal const string MediaExcerptProvider = "media-excerpt";
    private static readonly string[] DirectVideoExtensions = [".mp4", ".webm", ".ogv", ".ogg"];
    private readonly ILibraryManager _libraryManager;

    public TrailerResolver(ILibraryManager libraryManager)
    {
        _libraryManager = libraryManager;
    }

    /// <summary>
    /// Resolves playback candidates in the source's media priority order. Trailers, including the manual override,
    /// are only offered when <paramref name="includeTrailers"/> is set; excerpts and trickplay come from the item's
    /// own video and also stand in for missing artwork.
    /// </summary>
    public IReadOnlyList<FeaturedTrailerDto> ResolveCandidates(
        BaseItem item,
        Jellyfin.Database.Implementations.Entities.User activeUser,
        PluginConfiguration config,
        IReadOnlyList<string> mediaPriority,
        bool includeTrailers,
        string youTubeQualityFilter = "inherit")
    {
        List<FeaturedTrailerDto> candidates = [];
        if (includeTrailers)
        {
            // The manual override is the administrator's explicit per-item choice, so it always plays first.
            FeaturedTrailerOverride? manual = config.TrailerOverrides
                .FirstOrDefault(entry => string.Equals(entry.ItemId, item.Id.ToString(), StringComparison.OrdinalIgnoreCase));
            FeaturedTrailerDto? manualTrailer = ResolveManual(manual, activeUser);
            if (manualTrailer is not null) candidates.Add(manualTrailer);
        }

        foreach (string type in mediaPriority)
        {
            switch (type)
            {
                case FeaturedMediaPriorityTypes.LocalTrailer when includeTrailers && item is IHasTrailers trailers:
                    candidates.AddRange(ResolveLocal(trailers, activeUser, config.MultipleTrailerMode));
                    break;
                case FeaturedMediaPriorityTypes.RemoteTrailer when includeTrailers && item is IHasTrailers trailers:
                    candidates.AddRange(ResolveRemote(trailers, config.MultipleTrailerMode));
                    break;
                case FeaturedMediaPriorityTypes.MediaExcerpt:
                    FeaturedTrailerDto? excerpt = ResolveExcerpt(item, activeUser, config);
                    if (excerpt is not null) candidates.Add(excerpt);
                    break;
                case FeaturedMediaPriorityTypes.Trickplay when item is Video:
                    candidates.Add(CreateTrickplay(item));
                    break;
            }
        }

        bool filterEnabled = IsYouTubeQualityFilterEnabled(youTubeQualityFilter, config.YouTubeQualityFilter);
        foreach (FeaturedTrailerDto candidate in candidates)
        {
            candidate.YouTubeQualityFilterEnabled = candidate.Provider == "youtube" && filterEnabled;
        }

        return candidates
            .DistinctBy(GetCandidateKey, StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    /// <summary>
    /// Picks a random excerpt start inside the configured window. Items too short for the window get the window
    /// scaled down proportionally so the excerpt still finishes before the end of the video.
    /// </summary>
    internal static int? ComputeExcerptStartSeconds(
        double runtimeSeconds,
        int windowStartMinutes,
        int windowEndMinutes,
        int durationSeconds,
        double randomValue)
    {
        if (!double.IsFinite(runtimeSeconds) || durationSeconds <= 0 || runtimeSeconds <= durationSeconds) return null;
        double windowStart = Math.Max(0, windowStartMinutes) * 60d;
        double windowEnd = Math.Max(windowStart, windowEndMinutes * 60d);
        double latestStart = runtimeSeconds - durationSeconds;
        if (windowEnd > latestStart)
        {
            windowStart *= latestStart / windowEnd;
            windowEnd = latestStart;
        }

        double position = windowStart + ((windowEnd - windowStart) * Math.Clamp(randomValue, 0, 1));
        return (int)Math.Floor(Math.Clamp(position, 0, latestStart));
    }

    private FeaturedTrailerDto? ResolveExcerpt(
        BaseItem item,
        Jellyfin.Database.Implementations.Entities.User activeUser,
        PluginConfiguration config)
    {
        BaseItem? source = item switch
        {
            Series series => FindFirstEpisode(series, activeUser),
            Video video when video.GetBaseItemKind() != BaseItemKind.Trailer && !video.IsVirtualItem => video,
            _ => null
        };
        if (source?.RunTimeTicks is not > 0) return null;

        int? start = ComputeExcerptStartSeconds(
            TimeSpan.FromTicks(source.RunTimeTicks.Value).TotalSeconds,
            config.MediaExcerptWindowStartMinutes,
            config.MediaExcerptWindowEndMinutes,
            config.MediaExcerptDurationSeconds,
            Random.Shared.NextDouble());
        if (start is null) return null;

        return new FeaturedTrailerDto
        {
            Type = "local",
            Provider = MediaExcerptProvider,
            ItemId = source.Id.ToString(),
            Name = string.IsNullOrWhiteSpace(source.Name) ? null : source.Name,
            StartSeconds = start.Value,
            DurationSeconds = config.MediaExcerptDurationSeconds
        };
    }

    private BaseItem? FindFirstEpisode(Series series, Jellyfin.Database.Implementations.Entities.User activeUser)
    {
        InternalItemsQuery query = new(activeUser)
        {
            AncestorIds = [series.Id],
            IncludeItemTypes = [BaseItemKind.Episode],
            Recursive = true,
            IsVirtualItem = false,
            // Season 0 holds specials; the first regular episode is the least spoiler-prone choice.
            MinParentAndIndexNumber = (1, 0),
            OrderBy =
            [
                (ItemSortBy.ParentIndexNumber, SortOrder.Ascending),
                (ItemSortBy.IndexNumber, SortOrder.Ascending)
            ],
            Limit = 1
        };
        BaseItem? episode = _libraryManager.GetItemList(query).FirstOrDefault();
        if (episode is not null) return episode;

        query.MinParentAndIndexNumber = null;
        return _libraryManager.GetItemList(query).FirstOrDefault();
    }

    private FeaturedTrailerDto? ResolveManual(
        FeaturedTrailerOverride? entry,
        Jellyfin.Database.Implementations.Entities.User activeUser)
    {
        if (entry is null) return null;
        if (Guid.TryParse(entry.LocalTrailerItemId, out Guid trailerId))
        {
            BaseItem? local = _libraryManager.GetItemById(trailerId);
            if (local is not null && local.IsVisible(activeUser)) return CreateLocal(local.Id, entry.Name);
        }

        return string.IsNullOrWhiteSpace(entry.Url) ? null : CreateRemote(entry.Url, entry.Name);
    }

    private static IReadOnlyList<FeaturedTrailerDto> ResolveLocal(
        IHasTrailers trailers,
        Jellyfin.Database.Implementations.Entities.User activeUser,
        string multipleMode)
    {
        return OrderCandidates(trailers.LocalTrailers.Where(candidate => candidate.IsVisible(activeUser)), multipleMode)
            .Select(candidate => CreateLocal(candidate.Id, candidate.Name))
            .ToArray();
    }

    private static IReadOnlyList<FeaturedTrailerDto> ResolveRemote(IHasTrailers trailers, string multipleMode)
    {
        return OrderCandidates(trailers.RemoteTrailers.Where(candidate => IsHttpUrl(candidate.Url)), multipleMode)
            .Select(candidate => CreateRemote(candidate.Url, candidate.Name))
            .ToArray();
    }

    private static IReadOnlyList<T> OrderCandidates<T>(IEnumerable<T> source, string multipleMode)
    {
        List<T> candidates = source.ToList();
        if (multipleMode != FeaturedMultipleTrailerModes.Random) return candidates;
        return CollectionRandomizer.ShuffledCopy(candidates);
    }

    internal static bool IsYouTubeQualityFilterEnabled(string? sourceOverride, string? globalSetting)
        => sourceOverride switch
        {
            "enabled" => true,
            "disabled" => false,
            _ => globalSetting == "hd_only"
        };

    private static string GetCandidateKey(FeaturedTrailerDto trailer)
        => $"{trailer.Provider}|{trailer.ItemId ?? trailer.VideoId ?? trailer.Url}";

    private static FeaturedTrailerDto CreateTrickplay(BaseItem item) => new()
    {
        Type = "trickplay",
        Provider = "trickplay",
        Name = item.Name,
        ItemId = item.Id.ToString()
    };

    private static FeaturedTrailerDto CreateLocal(Guid itemId, string? name) => new()
    {
        Type = "local",
        Provider = "jellyfin",
        ItemId = itemId.ToString(),
        Name = string.IsNullOrWhiteSpace(name) ? null : name
    };

    private static FeaturedTrailerDto CreateRemote(string url, string? name)
    {
        string? videoId = TryGetYouTubeVideoId(url);
        string provider = videoId is not null
            ? "youtube"
            : IsDirectVideo(url) ? "direct" : "external";
        return new FeaturedTrailerDto
        {
            Type = "remote",
            Provider = provider,
            Name = string.IsNullOrWhiteSpace(name) ? null : name,
            Url = url,
            VideoId = videoId
        };
    }

    private static bool IsHttpUrl(string? value) => Uri.TryCreate(value, UriKind.Absolute, out Uri? uri)
        && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);

    private static bool IsDirectVideo(string value)
    {
        if (!Uri.TryCreate(value, UriKind.Absolute, out Uri? uri)) return false;
        return DirectVideoExtensions.Any(extension => uri.AbsolutePath.EndsWith(extension, StringComparison.OrdinalIgnoreCase));
    }

    internal static string? TryGetYouTubeVideoId(string value)
    {
        if (!Uri.TryCreate(value, UriKind.Absolute, out Uri? uri)) return null;
        string host = uri.Host.TrimStart('.').ToLowerInvariant();
        if (host is "youtu.be" or "www.youtu.be") return NormalizeVideoId(uri.AbsolutePath.Trim('/'));
        if (host is not ("youtube.com" or "www.youtube.com" or "m.youtube.com" or "music.youtube.com")) return null;

        if (uri.AbsolutePath.Equals("/watch", StringComparison.OrdinalIgnoreCase))
        {
            string? queryValue = uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries)
                .Select(part => part.Split('=', 2))
                .Where(part => part.Length == 2 && part[0].Equals("v", StringComparison.OrdinalIgnoreCase))
                .Select(part => Uri.UnescapeDataString(part[1]))
                .FirstOrDefault();
            return NormalizeVideoId(queryValue);
        }

        string[] segments = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
        return segments.Length >= 2 && segments[0] is "embed" or "shorts" or "live"
            ? NormalizeVideoId(segments[1])
            : null;
    }

    private static string? NormalizeVideoId(string? value)
    {
        string candidate = value?.Trim() ?? string.Empty;
        return candidate.Length is >= 6 and <= 32 && candidate.All(character => char.IsLetterOrDigit(character) || character is '-' or '_')
            ? candidate
            : null;
    }
}
