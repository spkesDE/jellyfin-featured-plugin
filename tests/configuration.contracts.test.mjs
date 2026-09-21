import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async (path) => await readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('backend and frontend supported media types stay in parity', async () => {
  const [backend, frontend] = await Promise.all([
    read('Jellyfin.Plugin.Featured/Configuration/FeaturedMediaTypes.cs'),
    read('src/mediaTypes.ts')
  ]);
  const backendTypes = [...backend.matchAll(/BaseItemKind\.(\w+)/g)].map((match) => match[1]);
  const array = frontend.match(/FEATURED_MEDIA_TYPES\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? '';
  const frontendTypes = [...array.matchAll(/'(\w+)'/g)].map((match) => match[1]);
  assert.deepEqual(frontendTypes, backendTypes);
});

test('critical C# and TypeScript defaults stay in parity', async () => {
  const [backend, frontend] = await Promise.all([
    read('Jellyfin.Plugin.Featured/Configuration/PluginConfiguration.cs'),
    read('src/config/libs/defaults.ts')
  ]);
  const expected = {
    RandomMediaCount: '5',
    RepeatCooldownDays: '1',
    RelaxRepeatCooldownWhenNeeded: 'false',
    MaximumItemsPerGenre: '0',
    MaximumItemsPerFranchise: '0',
    EnableAutoplay: 'true',
    AutoplayInterval: '10',
    UseHeroLayout: 'true',
    HeroHeightMode: "'standard'",
    TabletBannerHeight: '400',
    MobileBannerHeight: '340',
    HeroGradientStrength: '85',
    HeroFadeStart: '40',
    HeroFadeEnd: '90',
    HeroFadeCurve: "'balanced'",
    HeroTextPosition: "'left'",
    TransitionEffect: "'slide'",
    HeroBackdropPosition: "'center'",
    EnableFrontendBootstrap: 'true',
    EnablePreparedCache: 'true',
    BannerHeight: '360',
    ShowPaginationDots: 'true',
    TrailerDelayMilliseconds: '1500',
    EnableBackgroundTrailers: 'false',
    StartTrailersMuted: 'true',
    ShowTrailerControls: 'true',
    TrailerVolumeSliderDirection: "'down'",
    HideYouTubeTrailerUntilControlsFade: 'true',
    AllowTrailersOnMobile: 'false',
    AllowSourceSelection: 'false',
    AllowSourceWeights: 'false',
    AllowPreferredGenres: 'true',
    AllowUnplayedBoost: 'true',
    AllowFavouriteBoost: 'true',
    AllowInProgressSeriesBoost: 'true'
  };
  for (const [name, value] of Object.entries(expected)) {
    const csharpValue = value.startsWith("'") ? `"${value.slice(1, -1)}"` : value;
    assert.match(backend, new RegExp(`public\\s+\\w+\\s+${name}\\s*\\{[^}]+\\}\\s*=\\s*${csharpValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*;`));
    assert.match(frontend, new RegExp(`\\b${name}:\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*,`));
  }
});

test('item and runtime contracts retain their established names and interval units', async () => {
  const [controller, dtos] = await Promise.all([
    read('Jellyfin.Plugin.Featured/Api/FeaturedController.Items.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedResponseDtos.cs')
  ]);
  assert.match(dtos, /public int AutoplayInterval \{ get; \}/);
  assert.match(dtos, /AutoplayInterval = config\.AutoplayInterval;/);
  assert.match(dtos, /AutoplayInterval = config\.AutoplayInterval \* 1000;/);
  assert.match(dtos, /public bool ReduceImageSize \{ get; \}/);
  assert.match(dtos, /public bool ReduceImageSizes \{ get; \}/);
  assert.match(dtos, /JsonPropertyName\("official_rating"\)/);
  assert.match(dtos, /JsonPropertyName\("critic_rating"\)/);
  assert.match(dtos, /JsonPropertyName\("community_rating"\)/);
  assert.match(controller, /new FeaturedItemsResponseDto\([\s\S]*?_config,[\s\S]*?items,[\s\S]*?personalization,[\s\S]*?_presetResolution\.ActivePresetId/);
});

test('featured presets resolve schedules and override all roadmap sections', async () => {
  const [configuration, normalizer, resolver, controller, response, cache, defaults, presetTab, runtime] = await Promise.all([
    read('Jellyfin.Plugin.Featured/Configuration/PluginConfiguration.cs'),
    read('Jellyfin.Plugin.Featured/Configuration/PluginConfigurationNormalizer.cs'),
    read('Jellyfin.Plugin.Featured/Configuration/FeaturedPresetResolver.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedController.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedResponseDtos.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedPreparedCache.cs'),
    read('src/config/libs/defaults.ts'),
    read('src/config/tabs/PresetsTab.vue'),
    read('src/runtime.ts')
  ]);
  for (const section of ['SourceRules', 'GlobalFilters', 'PersonalizationPolicy', 'Mixer', 'Layout', 'Trailers']) {
    assert.match(configuration, new RegExp(`class FeaturedPreset[\\s\\S]*?${section}`), `preset misses ${section}`);
  }
  assert.match(normalizer, /NormalizePresets[\s\S]*?NormalizeSchedule[\s\S]*?DistinctBy\(preset => preset\.Id/);
  assert.match(resolver, /preset\.StartsAt\.Value <= now[\s\S]*?preset\.EndsAt\.Value > now/);
  assert.match(resolver, /OrderByDescending\(candidate => candidate\.Preset\.Priority\)[\s\S]*?ThenByDescending\(candidate => candidate\.Window!\.Start/);
  assert.match(configuration, /FeaturedPresetScheduleTypes[\s\S]*?OneTime[\s\S]*?Weekly[\s\S]*?Annual/);
  assert.match(resolver, /GetWeeklyWindows[\s\S]*?GetAnnualWindows[\s\S]*?GetNextBoundary/);
  assert.match(resolver, /config\.SourceRules = preset\.SourceRules[\s\S]*?config\.PersonalizationPolicy = preset\.PersonalizationPolicy/);
  assert.match(resolver, /config\.UseHeroLayout = preset\.Layout\.UseHeroLayout[\s\S]*?config\.TrailerSourcePriority = preset\.Trailers\.TrailerSourcePriority/);
  assert.match(resolver, /config\.EnableInfiniteLoading = preset\.Layout\.EnableInfiniteLoading/);
  assert.match(resolver, /config\.TrailerOverrides = preset\.Trailers\.Overrides/);
  assert.match(controller, /FeaturedPresetResolver\.Resolve\(baseConfig, DateTimeOffset\.UtcNow\)/);
  assert.match(response, /public string\? ActivePresetName \{ get; \}/);
  assert.match(response, /public DateTimeOffset\? NextPresetChange \{ get; \}/);
  assert.match(cache, /FeaturedPresetResolver\.Resolve\(baseConfig, DateTimeOffset\.UtcNow\)\.Configuration/);
  assert.match(defaults, /createPresetFromConfig[\s\S]*?SourceRules: cloneJsonValue[\s\S]*?PersonalizationPolicy[\s\S]*?Mixer:[\s\S]*?Layout:[\s\S]*?Trailers:/);
  assert.match(presetTab, /preset\.ScheduleType === 'one_time'[\s\S]*?ConfigDateTime v-model="preset\.StartsAt"[\s\S]*?ConfigDateTime v-model="preset\.EndsAt"/);
  assert.match(presetTab, /store\.updatePresetSnapshot\(index\)[\s\S]*?store\.duplicatePreset\(index\)/);
  assert.match(runtime, /schedulePresetRefresh\(response\.nextPresetChange\)/);
  assert.match(runtime, /Date\.now\(\) < boundary[\s\S]*?refreshForPresetBoundary\(\)/);
  assert.match(runtime, /function refreshForPresetBoundary[\s\S]*?instance\.destroy\(\)[\s\S]*?scheduleScan\(\)/);
});

test('frontend bootstrap can be disabled independently of frontend injection', async () => {
  const [configuration, defaults, advancedTab, bootstrap] = await Promise.all([
    read('Jellyfin.Plugin.Featured/Configuration/PluginConfiguration.cs'),
    read('src/config/libs/defaults.ts'),
    read('src/config/tabs/AdvancedTab.vue'),
    read('Jellyfin.Plugin.Featured/Integrations/FrontendBootstrap.cs')
  ]);
  assert.match(configuration, /public bool EnableFrontendBootstrap \{ get; set; \} = true;/);
  assert.match(defaults, /EnableFrontendBootstrap:\s*true/);
  assert.match(advancedTab, /v-model="store\.config\.EnableFrontendBootstrap"/);
  assert.match(bootstrap, /if \(!configuration\.EnableFrontendBootstrap\)/);
  assert.match(bootstrap, /configuration\.EnableFrontendBootstrap[\s\S]*?string\.Empty/);
});

test('normalization retains the saved 12.x bounds', async () => {
  const normalizer = await read('Jellyfin.Plugin.Featured/Configuration/PluginConfigurationNormalizer.cs');
  for (const expression of [
    'RepeatCooldownDays, 0, 3650',
    'RandomMediaCount, 1, 100',
    'AutoplayInterval, 1, 3600',
    'BannerHeight, 240, 900',
    'HeroBorderRadius, 0, 48',
    'HeroGradientStrength, 0, 100',
    'MediaPadding, -240, 240'
  ]) assert.equal(normalizer.includes(expression), true, `missing normalization contract: ${expression}`);
});

test('fullscreen height flows through normalization, settings, and runtime styles', async () => {
  const [normalizer, types, displayTab, styles] = await Promise.all([
    read('Jellyfin.Plugin.Featured/Configuration/PluginConfigurationNormalizer.cs'),
    read('src/types/config.ts'),
    read('src/config/tabs/DisplayTab.vue'),
    read('src/styles/featured.css')
  ]);

  assert.match(types, /HeroHeightMode = [^;]*'fullscreen'/);
  assert.match(displayTab, /value: 'fullscreen'/);
  assert.match(normalizer, /HeroHeightMode is [^\n]*"fullscreen"/);
  assert.match(styles, /\.ec-height-fullscreen\s*\{[\s\S]*?--ec-height:\s*100vh/);
  assert.match(styles, /@supports \(height: 100dvh\)[\s\S]*?--ec-height:\s*100dvh/);
});

test('vertical hero fade flows through backend display contracts', async () => {
  const [configuration, normalizer, resolver, responses, defaults] = await Promise.all([
    read('Jellyfin.Plugin.Featured/Configuration/PluginConfiguration.cs'),
    read('Jellyfin.Plugin.Featured/Configuration/PluginConfigurationNormalizer.cs'),
    read('Jellyfin.Plugin.Featured/Configuration/FeaturedPresetResolver.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedResponseDtos.cs'),
    read('src/config/libs/defaults.ts')
  ]);

  for (const property of ['HeroFadeStart', 'HeroFadeEnd', 'HeroFadeCurve']) {
    assert.match(configuration, new RegExp(`class FeaturedPreset[\\s\\S]*?${property}`));
    assert.match(responses, new RegExp(`public \\w+ ${property} \\{ get; \\}`));
    assert.match(defaults, new RegExp(`${property}: config\\.${property}`));
    assert.match(resolver, new RegExp(`config\\.${property} = preset\\.Layout\\.${property}`));
  }
  assert.match(normalizer, /HeroFadeStart = Math\.Clamp\([^;]+, 0, 100\)/);
  assert.match(normalizer, /HeroFadeEnd = Math\.Clamp\([^;]+, 0, 100\)/);
  assert.match(normalizer, /HeroFadeEnd <= [^\n]*HeroFadeStart[\s\S]*?HeroFadeStart = 40;[\s\S]*?HeroFadeEnd = 90;/);
});

test('configuration discovery uses the authenticated server options fallback', async () => {
  const [discovery, filtersTab, sourcesTab, styles] = await Promise.all([
    read('src/config/libs/jellyfinApi.ts'),
    read('src/config/tabs/FiltersTab.vue'),
    read('src/config/tabs/SourcesTab.vue'),
    read('src/config/config.css')
  ]);
  assert.match(discovery, /requestJson<FeaturedConfigOptions>\('featured\/config\/options'\)/);
  assert.match(discovery, /mergeStrings\(filterPayload\.Genres, configOptions\.genres\)/);
  assert.match(filtersTab, /store\.config\.MaximumItemsPerGenre[\s\S]*?store\.config\.MaximumItemsPerFranchise/);
  assert.doesNotMatch(sourcesTab, /MaximumItemsPerGenre|ExcludeItemsFromSameSeries/);
  assert.match(styles, /\.jmp-configForm\s*\{[\s\S]*?box-sizing:\s*border-box/);
  assert.match(styles, /\.jmp-configForm,[\s\S]*?width:\s*100%[\s\S]*?max-width:\s*none\s*!important/);
  assert.match(styles, /\.jmp-section-plain\s*>\s*\.jmp-subsection\s*\{[\s\S]*?margin-bottom:\s*1rem/);
});
