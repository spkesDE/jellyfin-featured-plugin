using Jellyfin.Plugin.Featured.Api;
using MediaBrowser.Model.Tasks;

namespace Jellyfin.Plugin.Featured.ScheduledTasks;

public sealed class RefreshFeaturedCacheTask : IScheduledTask, IConfigurableScheduledTask
{
    private readonly FeaturedPreparedCache _preparedCache;

    public RefreshFeaturedCacheTask(FeaturedPreparedCache preparedCache)
    {
        _preparedCache = preparedCache;
    }

    public string Name => "Refresh prepared featured cache";

    public string Key => "RefreshPreparedFeaturedCache";

    public string Description => "Prepares featured items for every Jellyfin user so page requests do not need to query the library.";

    public string Category => "Jellyfin Featured";

    public bool IsHidden => false;

    public bool IsEnabled => Plugin.Instance?.Configuration.EnablePreparedCache ?? true;

    public bool IsLogged => true;

    public Task ExecuteAsync(IProgress<double> progress, CancellationToken cancellationToken)
        => _preparedCache.RefreshAllAsync(progress, cancellationToken);

    public IEnumerable<TaskTriggerInfo> GetDefaultTriggers()
    {
        return
        [
            new TaskTriggerInfo { Type = TaskTriggerInfoType.StartupTrigger },
            new TaskTriggerInfo
            {
                Type = TaskTriggerInfoType.IntervalTrigger,
                IntervalTicks = TimeSpan.FromHours(1).Ticks
            }
        ];
    }
}
