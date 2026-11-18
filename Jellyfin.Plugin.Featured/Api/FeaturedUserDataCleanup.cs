using MediaBrowser.Controller.Library;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Featured.Api;

/// <summary>Removes the per-user data the plugin stores once the Jellyfin user no longer exists.</summary>
public sealed class FeaturedUserDataCleanup
{
    private readonly FeaturedDisplayHistoryStore _historyStore;
    private readonly FeaturedPreferenceStore _preferenceStore;
    private readonly FeaturedDismissalStore _dismissalStore;
    private readonly FeaturedPreparedCache _preparedCache;
    private readonly FeaturedCandidateCache _candidateCache;
    private readonly IUserManager _userManager;
    private readonly ILogger<FeaturedUserDataCleanup> _logger;

    public FeaturedUserDataCleanup(
        FeaturedDisplayHistoryStore historyStore,
        FeaturedPreferenceStore preferenceStore,
        FeaturedDismissalStore dismissalStore,
        FeaturedPreparedCache preparedCache,
        FeaturedCandidateCache candidateCache,
        IUserManager userManager,
        ILogger<FeaturedUserDataCleanup> logger)
    {
        _historyStore = historyStore;
        _preferenceStore = preferenceStore;
        _dismissalStore = dismissalStore;
        _preparedCache = preparedCache;
        _candidateCache = candidateCache;
        _userManager = userManager;
        _logger = logger;
    }

    internal void RemoveUser(Guid userId)
    {
        if (userId == Guid.Empty) return;
        _historyStore.Clear([userId]);
        _preferenceStore.Remove(userId);
        _dismissalStore.Clear(userId);
        _preparedCache.RemoveUser(userId);
        _candidateCache.RemoveUser(userId);
    }

    /// <summary>Removes stored data of users deleted while the plugin was not listening, e.g. before this cleanup existed.</summary>
    internal int RemoveDeletedUsers()
    {
        // An empty user list means Jellyfin is not ready to answer; removing everything would be destructive.
        if (!_userManager.GetUsers().Any()) return 0;

        Guid[] deletedUserIds = _historyStore.GetUserIds()
            .Concat(_preferenceStore.GetUserIds())
            .Concat(_dismissalStore.GetUserIds())
            .Distinct()
            .Where(userId => _userManager.GetUserById(userId) is null)
            .ToArray();
        foreach (Guid userId in deletedUserIds) RemoveUser(userId);
        if (deletedUserIds.Length > 0)
        {
            _logger.LogInformation(
                "Jellyfin Featured removed stored data of {UserCount} deleted users.",
                deletedUserIds.Length);
        }

        return deletedUserIds.Length;
    }
}
