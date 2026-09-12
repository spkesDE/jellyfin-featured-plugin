using Jellyfin.Plugin.Featured.Api;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Tasks;
using Microsoft.Extensions.Hosting;

namespace Jellyfin.Plugin.Featured.ScheduledTasks;

public sealed class FeaturedCacheConfigurationObserver : IHostedService
{
    private readonly ITaskManager _taskManager;
    private readonly FeaturedPreparedCache _preparedCache;
    private readonly FeaturedCandidateCache _candidateCache;

    public FeaturedCacheConfigurationObserver(
        ITaskManager taskManager,
        FeaturedPreparedCache preparedCache,
        FeaturedCandidateCache candidateCache)
    {
        _taskManager = taskManager;
        _preparedCache = preparedCache;
        _candidateCache = candidateCache;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        if (Plugin.Instance is not null) Plugin.Instance.ConfigurationChanged += OnConfigurationChanged;
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        if (Plugin.Instance is not null) Plugin.Instance.ConfigurationChanged -= OnConfigurationChanged;
        return Task.CompletedTask;
    }

    private void OnConfigurationChanged(object? sender, BasePluginConfiguration configuration)
    {
        _preparedCache.Clear();
        _candidateCache.Clear();
        if (configuration is PluginConfiguration { EnablePreparedCache: true })
        {
            _taskManager.CancelIfRunningAndQueue<RefreshFeaturedCacheTask>();
        }
    }
}
