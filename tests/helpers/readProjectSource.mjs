import { readFile } from 'node:fs/promises';

const companions = {
  'Jellyfin.Plugin.Featured/Configuration/PluginConfiguration.cs': [
    'Jellyfin.Plugin.Featured/Configuration/PluginConfiguration.Layout.cs',
    'Jellyfin.Plugin.Featured/Configuration/PluginConfiguration.Presets.cs',
    'Jellyfin.Plugin.Featured/Configuration/PluginConfiguration.Sources.cs',
    'Jellyfin.Plugin.Featured/Configuration/PluginConfiguration.Trailers.cs',
    'Jellyfin.Plugin.Featured/Configuration/PluginConfiguration.Personalization.cs'
  ],
  'Jellyfin.Plugin.Featured/Configuration/FeaturedPresetResolver.cs': [
    'Jellyfin.Plugin.Featured/Configuration/FeaturedConfigurationMappings.cs'
  ],
  'Jellyfin.Plugin.Featured/Api/FeaturedResponseDtos.cs': [
    'Jellyfin.Plugin.Featured/Api/FeaturedResponseDtos.Preferences.cs',
    'Jellyfin.Plugin.Featured/Api/FeaturedResponseDtos.Items.cs'
  ],
  'Jellyfin.Plugin.Featured/Api/FeaturedController.Items.cs': [
    'Jellyfin.Plugin.Featured/Api/FeaturedFeedService.cs',
    'Jellyfin.Plugin.Featured/Api/FeaturedRuleEngineFactory.cs'
  ],
  'Jellyfin.Plugin.Featured/Api/FeaturedPreparedCache.cs': ['Jellyfin.Plugin.Featured/Api/FeaturedPreparedEntry.cs'],
  'Jellyfin.Plugin.Featured/Integrations/FrontendBootstrap.cs': [
    'src/bootstrap.ts',
    'src/styles/featured-layout-contract.css',
    'src/styles/bootstrap.css'
  ],
  'src/config/libs/defaults.ts': [
    'src/config/libs/configDefaults.ts',
    'src/config/libs/configFactories.ts',
    'src/config/libs/configNormalization.ts',
    'src/config/libs/configProjection.ts'
  ],
  'src/config/config.css': ['src/config/components/BannerPreview.css'],
  'src/preferences.ts': [
    'src/preferencesActionStatus.ts',
    'src/preferencesApi.ts',
    'src/preferencesDismissals.ts',
    'src/preferencesDom.ts',
    'src/preferencesFields.ts',
    'src/preferencesForm.ts',
    'src/preferencesDialogShell.ts'
  ],
  'src/runtime.ts': [
    'src/core/freshResponseCache.ts',
    'src/core/routeObserver.ts',
    'src/core/runtimeCoordinator.ts',
    'src/core/runtimeMountState.ts',
    'src/core/runtimeMutationPolicy.ts'
  ],
  'src/slider/carousel.ts': [
    'src/slider/heroLayoutGuard.ts',
    'src/slider/carouselControls.ts',
    'src/slider/carouselWindow.ts',
    'src/slider/trailerVolume.ts',
    'src/slider/trailerController.ts'
  ],
  'src/slider/favorites.ts': ['src/slider/actionFeedback.ts'],
  'src/slider/playstate.ts': ['src/slider/actionFeedback.ts'],
  'src/slider/trailer.ts': [
    'src/slider/trailerTypes.ts',
    'src/slider/htmlVideoPlayer.ts',
    'src/slider/trickplayPlayer.ts',
    'src/slider/youtubePlayer.ts',
    'src/slider/trailerFactory.ts'
  ],
  'src/styles/featured.css': [
    'src/styles/featured-layout-contract.css',
    'src/styles/featured-base.css',
    'src/styles/featured-preferences.css',
    'src/styles/featured-controls.css',
    'src/styles/featured-trailers.css',
    'src/styles/featured-hero.css',
    'src/styles/featured-compatibility.css'
  ]
};

export async function readProjectSource(path) {
  const paths = [path, ...(companions[path] ?? [])];
  const sources = await Promise.all(
    paths.map((candidate) => readFile(new URL(`../../${candidate}`, import.meta.url), 'utf8'))
  );
  return sources.join('\n');
}
