using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;
using MediaBrowser.Model.Entities;

namespace Jellyfin.Plugin.Featured.Api;

public sealed class TrailerResolver
{
    private static readonly string[] DirectVideoExtensions = [".mp4", ".webm", ".ogv", ".ogg"];
    private readonly ILibraryManager _libraryManager;

    public TrailerResolver(ILibraryManager libraryManager)
    {
        _libraryManager = libraryManager;
    }

    public FeaturedTrailerDto? Resolve(
        BaseItem item,
        Jellyfin.Database.Implementations.Entities.User activeUser,
        PluginConfiguration config)
        => ResolveCandidates(item, activeUser, config).FirstOrDefault();

    public IReadOnlyList<FeaturedTrailerDto> ResolveCandidates(
        BaseItem item,
        Jellyfin.Database.Implementations.Entities.User activeUser,
        PluginConfiguration config)
    {
        List<FeaturedTrailerDto> candidates = [];
        FeaturedTrailerOverride? manual = config.TrailerOverrides
            .FirstOrDefault(entry => string.Equals(entry.ItemId, item.Id.ToString(), StringComparison.OrdinalIgnoreCase));
        FeaturedTrailerDto? manualTrailer = ResolveManual(manual, activeUser);
        if (manualTrailer is not null) candidates.Add(manualTrailer);

        if (item is IHasTrailers trailers)
        {
            IReadOnlyList<FeaturedTrailerDto> local = ResolveLocal(trailers, activeUser, config.MultipleTrailerMode);
            IReadOnlyList<FeaturedTrailerDto> remote = ResolveRemote(trailers, config.MultipleTrailerMode);
            switch (config.TrailerSourcePriority)
            {
                case FeaturedTrailerSourcePriorities.LocalOnly:
                    candidates.AddRange(local);
                    break;
                case FeaturedTrailerSourcePriorities.RemoteOnly:
                    candidates.AddRange(remote);
                    break;
                case FeaturedTrailerSourcePriorities.PreferRemote:
                    candidates.AddRange(remote);
                    candidates.AddRange(local);
                    break;
                case FeaturedTrailerSourcePriorities.Automatic:
                    candidates.AddRange(local);
                    candidates.AddRange(remote);
                    break;
                default:
                    candidates.AddRange(local);
                    if (config.FallBackToRemoteTrailers) candidates.AddRange(remote);
                    break;
            }
        }

        return candidates
            .DistinctBy(GetCandidateKey, StringComparer.OrdinalIgnoreCase)
            .ToArray();
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
        for (int index = candidates.Count - 1; index > 0; index--)
        {
            int swapIndex = Random.Shared.Next(index + 1);
            (candidates[index], candidates[swapIndex]) = (candidates[swapIndex], candidates[index]);
        }

        return candidates;
    }

    private static string GetCandidateKey(FeaturedTrailerDto trailer)
        => $"{trailer.Provider}|{trailer.ItemId ?? trailer.VideoId ?? trailer.Url}";

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
