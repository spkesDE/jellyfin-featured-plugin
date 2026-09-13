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
    {
        FeaturedTrailerOverride? manual = config.TrailerOverrides
            .FirstOrDefault(entry => string.Equals(entry.ItemId, item.Id.ToString(), StringComparison.OrdinalIgnoreCase));
        FeaturedTrailerDto? manualTrailer = ResolveManual(manual, activeUser);
        if (manualTrailer is not null) return manualTrailer;

        if (item is not IHasTrailers trailers) return null;

        Func<FeaturedTrailerDto?> local = () => ResolveLocal(trailers, activeUser, config.MultipleTrailerMode);
        Func<FeaturedTrailerDto?> remote = () => ResolveRemote(trailers, config.MultipleTrailerMode);
        return config.TrailerSourcePriority switch
        {
            FeaturedTrailerSourcePriorities.LocalOnly => local(),
            FeaturedTrailerSourcePriorities.RemoteOnly => remote(),
            FeaturedTrailerSourcePriorities.PreferRemote => remote() ?? local(),
            FeaturedTrailerSourcePriorities.Automatic => local() ?? remote(),
            _ => local() ?? (config.FallBackToRemoteTrailers ? remote() : null)
        };
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

    private static FeaturedTrailerDto? ResolveLocal(
        IHasTrailers trailers,
        Jellyfin.Database.Implementations.Entities.User activeUser,
        string multipleMode)
    {
        BaseItem[] candidates = trailers.LocalTrailers.Where(candidate => candidate.IsVisible(activeUser)).ToArray();
        BaseItem? selected = Select(candidates, multipleMode);
        return selected is null ? null : CreateLocal(selected.Id, selected.Name);
    }

    private static FeaturedTrailerDto? ResolveRemote(IHasTrailers trailers, string multipleMode)
    {
        MediaUrl[] candidates = trailers.RemoteTrailers
            .Where(candidate => IsHttpUrl(candidate.Url))
            .ToArray();
        MediaUrl? selected = Select(candidates, multipleMode);
        return selected is null ? null : CreateRemote(selected.Url, selected.Name);
    }

    private static T? Select<T>(IReadOnlyList<T> candidates, string multipleMode) where T : class
    {
        if (candidates.Count == 0) return null;
        return multipleMode == FeaturedMultipleTrailerModes.Random
            ? candidates[Random.Shared.Next(candidates.Count)]
            : candidates[0];
    }

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
