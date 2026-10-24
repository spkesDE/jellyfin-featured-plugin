using Jellyfin.Data;
using Jellyfin.Database.Implementations.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.Featured.Api;

public sealed partial class FeaturedController
{
    [HttpGet("config/youtube-api-key")]
    [Authorize]
    public ActionResult<YouTubeApiKeyStatusDto> GetYouTubeApiKeyStatus(
        [FromServices] YouTubeTrailerQualityService qualityService)
    {
        Jellyfin.Database.Implementations.Entities.User? activeUser = GetActiveUser();
        if (activeUser is null) return NotFound();
        if (!activeUser.HasPermission(PermissionKind.IsAdministrator)) return Forbid();
        return Ok(new YouTubeApiKeyStatusDto(qualityService.ApiKeyConfigured));
    }

    [HttpGet("trailers/youtube/{videoId}/quality")]
    [Authorize]
    public async Task<ActionResult<YouTubeTrailerQualityDto>> GetYouTubeTrailerQuality(
        string videoId,
        [FromServices] YouTubeTrailerQualityService qualityService)
    {
        if (GetActiveUser() is null) return NotFound();
        string quality = await qualityService.GetQualityAsync(videoId).ConfigureAwait(false);
        return Ok(new YouTubeTrailerQualityDto(quality));
    }
}

public sealed record YouTubeTrailerQualityDto(string Quality);
public sealed record YouTubeApiKeyStatusDto(bool ApiKeyConfigured);
