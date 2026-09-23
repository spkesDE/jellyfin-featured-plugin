using MediaBrowser.Controller;
using MediaBrowser.Controller.Plugins;
using Jellyfin.Plugin.Featured.Api;
using Jellyfin.Plugin.Featured.ScheduledTasks;
using MediaBrowser.Model.Tasks;
using Microsoft.Extensions.DependencyInjection;

namespace Jellyfin.Plugin.Featured;

public sealed class PluginServiceRegistrator : IPluginServiceRegistrator
{
    public void RegisterServices(IServiceCollection serviceCollection, IServerApplicationHost applicationHost)
    {
        serviceCollection.AddSingleton<FeaturedDisplayHistoryStore>();
        serviceCollection.AddSingleton<FeaturedPreferenceStore>();
        serviceCollection.AddSingleton<FeaturedDismissalStore>();
        serviceCollection.AddSingleton<FeaturedPersonalizationService>();
        serviceCollection.AddSingleton<FeaturedPreferenceOptionsCache>();
        serviceCollection.AddSingleton<TrailerResolver>();
        serviceCollection.AddSingleton<FeaturedItemDtoFactory>();
        serviceCollection.AddSingleton<FeaturedCandidateCache>();
        serviceCollection.AddSingleton<FeaturedRecommendationCandidates>();
        serviceCollection.AddSingleton<FeaturedPreparedCache>();
        serviceCollection.AddSingleton<IScheduledTask, RefreshFeaturedCacheTask>();
        serviceCollection.AddSingleton<IScheduledTask, WarmUserSettingsCacheTask>();
        serviceCollection.AddHostedService<FrontendRegistrationHostedService>();
        serviceCollection.AddHostedService<FeaturedCacheConfigurationObserver>();
    }
}
