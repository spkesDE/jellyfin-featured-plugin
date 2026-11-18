using MediaBrowser.Controller.Dto;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;

namespace Jellyfin.Plugin.Featured.Api;

/// <summary>Lists the genres a user can see without loading every library item.</summary>
internal static class FeaturedGenreOptions
{
    internal static string[] Query(ILibraryManager libraryManager, Jellyfin.Database.Implementations.Entities.User user)
    {
        // A user-bound query applies the user's library access and parental limits inside Jellyfin's genre lookup.
        InternalItemsQuery query = new(user)
        {
            IncludeItemTypes = FeaturedMediaTypes.All,
            Recursive = true,
            DtoOptions = new DtoOptions(false)
        };
        return libraryManager.GetGenres(query).Items
            .Select(entry => entry.Item.Name)
            .Where(genre => !string.IsNullOrWhiteSpace(genre))
            .Distinct(StringComparer.CurrentCultureIgnoreCase)
            .OrderBy(genre => genre, StringComparer.CurrentCultureIgnoreCase)
            .ToArray();
    }
}
