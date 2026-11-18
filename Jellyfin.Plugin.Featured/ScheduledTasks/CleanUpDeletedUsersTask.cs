using Jellyfin.Plugin.Featured.Api;
using MediaBrowser.Model.Tasks;

namespace Jellyfin.Plugin.Featured.ScheduledTasks;

/// <summary>
/// Catches users deleted while the plugin was not listening. Deletions while it runs are handled immediately by
/// <see cref="FeaturedUserDeletedConsumer"/>.
/// </summary>
public sealed class CleanUpDeletedUsersTask : IScheduledTask, IConfigurableScheduledTask
{
    private readonly FeaturedUserDataCleanup _cleanup;

    public CleanUpDeletedUsersTask(FeaturedUserDataCleanup cleanup)
    {
        _cleanup = cleanup;
    }

    public string Name => "Clean up data of deleted users";

    public string Key => "CleanUpFeaturedDeletedUserData";

    public string Description => "Removes Jellyfin Featured preferences, dismissals and display history of users that no longer exist.";

    public string Category => "Jellyfin Featured";

    public bool IsHidden => false;

    public bool IsEnabled => true;

    public bool IsLogged => true;

    public Task ExecuteAsync(IProgress<double> progress, CancellationToken cancellationToken)
    {
        _cleanup.RemoveDeletedUsers();
        progress.Report(100);
        return Task.CompletedTask;
    }

    public IEnumerable<TaskTriggerInfo> GetDefaultTriggers()
        => [new TaskTriggerInfo { Type = TaskTriggerInfoType.StartupTrigger }];
}
