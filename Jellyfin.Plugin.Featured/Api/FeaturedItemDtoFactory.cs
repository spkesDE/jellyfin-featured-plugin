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
        PluginConfiguration config,
        FeaturedPersonalizationContext personalization,
        bool allowBackgroundTrailers = true)
    {
        IReadOnlyList<FeaturedTrailerDto> trailers = personalization.Display.EnableBackgroundTrailers && allowBackgroundTrailers
            ? _trailerResolver.ResolveCandidates(item, activeUser, config)
            : [];
        return new FeaturedItemDto
        {
            Id = item.Id.ToString(),
            Name = item.Name,
            MediaType = item.GetBaseItemKind().ToString(),
            ImageType = item.HasImage(MediaBrowser.Model.Entities.ImageType.Backdrop) ? "Backdrop" : "Primary",
            Tagline = personalization.Display.ShowDescription ? item.Tagline : null,
            OfficialRating = personalization.Display.ShowRating ? item.OfficialRating : null,
            HasLogo = item.HasImage(MediaBrowser.Model.Entities.ImageType.Logo),
            ProductionYear = personalization.Display.ShowYear ? item.ProductionYear : null,
            RuntimeMinutes = personalization.Display.ShowRuntime && item.RunTimeTicks.HasValue
                ? (int)Math.Round(TimeSpan.FromTicks(item.RunTimeTicks.Value).TotalMinutes)
                : null,
            Trailer = trailers.FirstOrDefault(),
            Trailers = trailers.Count > 0 ? trailers : null,
            Overview = personalization.Display.ShowDescription ? item.Overview : null,
            CriticRating = personalization.Display.ShowRating ? item.CriticRating : null,
            CommunityRating = personalization.Display.ShowRating && item.CommunityRating.HasValue
                ? Math.Round(Convert.ToDecimal(item.CommunityRating), 2)
                : null
        };
    }
}
