using Jellyfin.Plugin.Featured.Api;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;
using MediaBrowser.Model.Tasks;

namespace Jellyfin.Plugin.Featured.ScheduledTasks;

public sealed class WarmUserSettingsCacheTask : IScheduledTask, IConfigurableScheduledTask
{
    private readonly FeaturedPreferenceOptionsCache _preferenceOptionsCache;
    private readonly IUserManager _userManager;
    private readonly ILibraryManager _libraryManager;

    public WarmUserSettingsCacheTask(
        FeaturedPreferenceOptionsCache preferenceOptionsCache,
        IUserManager userManager,
        ILibraryManager libraryManager)
    {
        _preferenceOptionsCache = preferenceOptionsCache;
        _userManager = userManager;
        _libraryManager = libraryManager;
    }

    public string Name => "Warm user settings cache";

    public string Key => "WarmFeaturedUserSettingsCache";

    public string Description => "Preloads the visible genre options used by Jellyfin Featured user settings for every user.";

    public string Category => "Jellyfin Featured";

    public bool IsHidden => false;

    public bool IsEnabled => Plugin.Instance?.Configuration.PersonalizationPolicy.Enabled ?? true;

    public bool IsLogged => true;

    public Task ExecuteAsync(IProgress<double> progress, CancellationToken cancellationToken)
    {
        Jellyfin.Database.Implementations.Entities.User[] users = _userManager.GetUsers().ToArray();
        if (users.Length == 0)
        {
            progress.Report(100);
            return Task.CompletedTask;
        }

        for (int index = 0; index < users.Length; index++)
        {
            cancellationToken.ThrowIfCancellationRequested();
            Jellyfin.Database.Implementations.Entities.User user = users[index];
            _preferenceOptionsCache.GetOrCreate(user.Id, () => QueryVisibleGenres(user));
            progress.Report((index + 1d) / users.Length * 100d);
        }

        return Task.CompletedTask;
    }

    public IEnumerable<TaskTriggerInfo> GetDefaultTriggers() => [];

    private string[] QueryVisibleGenres(Jellyfin.Database.Implementations.Entities.User user)
    {
        InternalItemsQuery query = new(user) { IncludeItemTypes = FeaturedMediaTypes.All };
        return _libraryManager.GetItemList(query)
            .Where(item => item.IsVisible(user))
            .SelectMany(item => item.Genres)
            .Where(genre => !string.IsNullOrWhiteSpace(genre))
            .Distinct(StringComparer.CurrentCultureIgnoreCase)
            .OrderBy(genre => genre, StringComparer.CurrentCultureIgnoreCase)
            .ToArray();
    }
}
