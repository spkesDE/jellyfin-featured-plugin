using Jellyfin.Data.Enums;

namespace Jellyfin.Plugin.Featured;

internal static class FeaturedMediaTypes
{
    internal static readonly BaseItemKind[] All =
    [
        BaseItemKind.Movie,
        BaseItemKind.Series,
        BaseItemKind.MusicVideo,
        BaseItemKind.Video,
        BaseItemKind.AudioBook,
        BaseItemKind.Book,
        BaseItemKind.MusicAlbum,
        BaseItemKind.Photo,
        BaseItemKind.PhotoAlbum
    ];

    internal static bool Contains(BaseItemKind itemType) => Array.IndexOf(All, itemType) >= 0;
}
