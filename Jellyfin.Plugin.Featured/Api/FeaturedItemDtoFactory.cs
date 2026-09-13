using MediaBrowser.Controller.Entities;

namespace Jellyfin.Plugin.Featured.Api;

public sealed class FeaturedItemDtoFactory
{
    private readonly TrailerResolver _trailerResolver;

    public FeaturedItemDtoFactory(TrailerResolver trailerResolver)
    {
        _trailerResolver = trailerResolver;
    }

    internal FeaturedItemDto Create(
        BaseItem item,
        Jellyfin.Database.Implementations.Entities.User activeUser,
        PluginConfiguration config)
    {
        IReadOnlyList<FeaturedTrailerDto> trailers = config.EnableBackgroundTrailers
            ? _trailerResolver.ResolveCandidates(item, activeUser, config)
            : [];
        return new FeaturedItemDto
        {
            Id = item.Id.ToString(),
            Name = item.Name,
            MediaType = item.GetBaseItemKind().ToString(),
            ImageType = item.HasImage(MediaBrowser.Model.Entities.ImageType.Backdrop) ? "Backdrop" : "Primary",
            Tagline = item.Tagline,
            OfficialRating = item.OfficialRating,
            HasLogo = item.HasImage(MediaBrowser.Model.Entities.ImageType.Logo),
            ProductionYear = config.ShowYear ? item.ProductionYear : null,
            RuntimeMinutes = config.ShowRuntime && item.RunTimeTicks.HasValue
                ? (int)Math.Round(TimeSpan.FromTicks(item.RunTimeTicks.Value).TotalMinutes)
                : null,
            Trailer = trailers.FirstOrDefault(),
            Trailers = trailers.Count > 0 ? trailers : null,
            Overview = config.ShowDescription ? item.Overview : null,
            CriticRating = config.ShowRating ? item.CriticRating : null,
            CommunityRating = config.ShowRating && item.CommunityRating.HasValue
                ? Math.Round(Convert.ToDecimal(item.CommunityRating), 2)
                : null
        };
    }
}
