using Jellyfin.Data.Events.Users;
using MediaBrowser.Controller;
using MediaBrowser.Controller.Events;
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
        serviceCollection.AddMemoryCache();
        serviceCollection.AddSingleton<FeaturedDisplayHistoryStore>();
        serviceCollection.AddSingleton<FeaturedPreferenceStore>();
        serviceCollection.AddSingleton<FeaturedDismissalStore>();
        serviceCollection.AddSingleton<FeaturedStatisticsStore>();
        serviceCollection.AddSingleton<FeaturedPersonalizationService>();
        serviceCollection.AddSingleton<FeaturedPreferenceOptionsCache>();
        serviceCollection.AddHttpClient(YouTubeTrailerQualityService.HttpClientName)
            .RedactLoggedHeaders(["X-Goog-Api-Key"]);
        serviceCollection.AddSingleton<YouTubeTrailerQualityService>();
        serviceCollection.AddSingleton<TrailerResolver>();
        serviceCollection.AddSingleton<FeaturedItemDtoFactory>();
        serviceCollection.AddSingleton<FeaturedCandidateCache>();
        serviceCollection.AddSingleton<FeaturedRecommendationCandidates>();
        serviceCollection.AddSingleton<FeaturedMediaMetadataService>();
        serviceCollection.AddSingleton<FeaturedRuleEngineFactory>();
        serviceCollection.AddSingleton<FeaturedFeedService>();
        serviceCollection.AddSingleton<FeaturedPreparedCache>();
        serviceCollection.AddSingleton<FrontendInjectionAvailabilityService>();
        serviceCollection.AddSingleton<FeaturedUserDataCleanup>();
        serviceCollection.AddScoped<IEventConsumer<UserDeletedEventArgs>, FeaturedUserDeletedConsumer>();
        serviceCollection.AddSingleton<IScheduledTask, RefreshFeaturedCacheTask>();
        serviceCollection.AddSingleton<IScheduledTask, WarmUserSettingsCacheTask>();
        serviceCollection.AddSingleton<IScheduledTask, CleanUpDeletedUsersTask>();
        serviceCollection.AddHostedService<FrontendRegistrationHostedService>();
        serviceCollection.AddHostedService<FeaturedCacheConfigurationObserver>();
    }
}
