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
    EnableAutoplay: 'true',
    AutoplayInterval: '10',
    UseHeroLayout: 'true',
    HeroHeightMode: "'standard'",
    TabletBannerHeight: '400',
    MobileBannerHeight: '340',
    HeroGradientStrength: '85',
    HeroTextPosition: "'left'",
    TransitionEffect: "'slide'",
    HeroBackdropPosition: "'center'",
    EnableFrontendBootstrap: 'true',
    EnablePreparedCache: 'true',
    BannerHeight: '360',
    ShowPaginationDots: 'true',
    TrailerDelayMilliseconds: '1500',
    StartTrailersMuted: 'true',
    HideYouTubeTrailerUntilControlsFade: 'true',
    FallBackToRemoteTrailers: 'true'
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
  assert.match(resolver, /OrderByDescending\(candidate => candidate\.Preset\.Priority\)[\s\S]*?ThenByDescending\(candidate => candidate\.Preset\.StartsAt/);
  assert.match(resolver, /config\.SourceRules = preset\.SourceRules[\s\S]*?config\.PersonalizationPolicy = preset\.PersonalizationPolicy/);
  assert.match(resolver, /config\.UseHeroLayout = preset\.Layout\.UseHeroLayout[\s\S]*?config\.TrailerSourcePriority = preset\.Trailers\.TrailerSourcePriority/);
  assert.match(resolver, /config\.EnableInfiniteLoading = preset\.Layout\.EnableInfiniteLoading/);
  assert.match(resolver, /config\.TrailerOverrides = preset\.Trailers\.Overrides/);
  assert.match(controller, /FeaturedPresetResolver\.Resolve\(baseConfig, DateTimeOffset\.UtcNow\)/);
  assert.match(response, /public string\? ActivePresetName \{ get; \}/);
  assert.match(response, /public DateTimeOffset\? NextPresetChange \{ get; \}/);
  assert.match(cache, /FeaturedPresetResolver\.Resolve\(baseConfig, DateTimeOffset\.UtcNow\)\.Configuration/);
  assert.match(defaults, /createPresetFromConfig[\s\S]*?SourceRules: structuredClone[\s\S]*?PersonalizationPolicy[\s\S]*?Mixer:[\s\S]*?Layout:[\s\S]*?Trailers:/);
  assert.match(presetTab, /ConfigDateTime v-model="preset\.StartsAt"[\s\S]*?ConfigDateTime v-model="preset\.EndsAt"/);
  assert.match(presetTab, /store\.updatePresetSnapshot\(index\)[\s\S]*?store\.duplicatePreset\(index\)/);
  assert.match(runtime, /schedulePresetRefresh\(response\.nextPresetChange\)/);
  assert.match(runtime, /Date\.now\(\) < boundary[\s\S]*?refreshForPresetBoundary\(\)/);
  assert.match(runtime, /function refreshForPresetBoundary[\s\S]*?instance\.destroy\(\)[\s\S]*?scheduleScan\(\)/);
});

test('personalization is authenticated, policy-bound, and user scoped', async () => {
  const [controller, service, store, response, frontend, navigation, carousel, engine] = await Promise.all([
    read('Jellyfin.Plugin.Featured/Api/FeaturedController.Preferences.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedPersonalizationService.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedPreferenceStore.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedResponseDtos.cs'),
    read('src/preferences.ts'),
    read('src/admin/navigation.ts'),
    read('src/slider/carousel.ts'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedRuleEngine.cs')
  ]);
  assert.match(controller, /\[HttpGet\("preferences"\)\][\s\S]*?\[Authorize\]/);
  assert.match(controller, /\[HttpPut\("preferences"\)\][\s\S]*?\[Authorize\]/);
  assert.match(controller, /\[HttpGet\("preferences\/options"\)\][\s\S]*?\[Authorize\]/);
  assert.match(controller, /GetVisibleGenres\(activeUser\)/);
  assert.equal((controller.match(/RuntimeConfigJsonOptions/g) ?? []).length, 3);
  assert.match(controller, /new JsonResult\(CreatePreferencesResponse\(activeUser\), RuntimeConfigJsonOptions\)/);
  assert.match(service, /policy\.AllowSourceSelection[\s\S]*?sourceIds\.Contains/);
  assert.match(service, /policy\.AllowPreferredGenres[\s\S]*?allowedGenres\.Contains/);
  assert.match(service, /submitted\.ExcludedGenres[\s\S]*?allowedGenres\.Contains[\s\S]*?!preferredGenres\.Contains/);
  assert.match(engine, /excludedGenres[\s\S]*?!ContainsAny\(item\.Genres, excludedGenres\)/);
  assert.match(service, /ResolveDefaults\(PluginConfiguration config, Guid userId\)[\s\S]*?Resolve\(config, userId, null\)/);
  assert.match(service, /if \(IsEmpty\(normalized\)\) _store\.Remove\(userId\)/);
  assert.match(store, /userId\.ToString\("N"\)/);
  assert.match(response, /public bool PersonalizationEnabled \{ get; \}/);
  assert.match(frontend, /body: \{ reset: true \}/);
  assert.match(frontend, /body: \{ preferences \}/);
  assert.match(frontend, /GenrePreferenceState = 'neutral' \| 'preferred' \| 'excluded'/);
  assert.match(frontend, /state === 'neutral' \? 'preferred' : state === 'preferred' \? 'excluded' : 'neutral'/);
  assert.doesNotMatch(frontend, /JellyfinFeatured\?\.refresh/);
  assert.match(frontend, /current\.defaults\.sourceEnabled/);
  assert.match(navigation, /USER_PREFERENCES_SELECTOR[\s\S]*?#\/mypreferencesmenu/);
  assert.match(navigation, /settingsEntry\.after\(entry\)/);
  assert.match(navigation, /#myPreferencesMenuPage/);
  assert.match(navigation, /USER_SETTINGS_PAGE_LINK_ATTR[\s\S]*?section\.appendChild\(entry\)/);
  assert.match(navigation, /\.lnkHomePreferences/);
  assert.match(navigation, /openPreferencesDialog\(\)/);
  assert.match(navigation, /userSettingsEnabled = config\.personalizationEnabled/);
  assert.doesNotMatch(carousel, /ec-personalize|openPreferencesDialog/);
});

test('proper trailer support keeps resolution and playback source independent', async () => {
  const [configuration, normalizer, resolver, response, player, carousel, trailerTab, styles] = await Promise.all([
    read('Jellyfin.Plugin.Featured/Configuration/PluginConfiguration.cs'),
    read('Jellyfin.Plugin.Featured/Configuration/PluginConfigurationNormalizer.cs'),
    read('Jellyfin.Plugin.Featured/Api/TrailerResolver.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedResponseDtos.cs'),
    read('src/slider/trailer.ts'),
    read('src/slider/carousel.ts'),
    read('src/config/tabs/TrailersTab.vue'),
    read('src/styles/featured.css')
  ]);
  for (const setting of [
    'TrailerSourcePriority', 'FallBackToRemoteTrailers', 'StartTrailersMuted',
    'HideYouTubeTrailerUntilControlsFade',
    'WaitForTrailerToFinish', 'TrailerDelayMilliseconds', 'TrailerStartOffsetSeconds',
    'TrailerEndOffsetSeconds', 'MultipleTrailerMode', 'AllowTrailersOnMobile', 'TrailerOverrides'
  ]) {
    assert.equal(configuration.includes(setting), true, `backend misses ${setting}`);
    assert.equal(trailerTab.includes(`store.config.${setting}`), true, `trailer editor misses ${setting}`);
  }
  assert.match(normalizer, /NormalizeTrailerUrl[\s\S]*?Uri\.UriSchemeHttp[\s\S]*?Uri\.UriSchemeHttps/);
  assert.match(resolver, /ResolveManual\(manual, activeUser\)[\s\S]*?if \(manualTrailer is not null\) candidates\.Add\(manualTrailer\)/);
  assert.match(resolver, /LocalOnly:[\s\S]*?AddRange\(local\)[\s\S]*?RemoteOnly:[\s\S]*?AddRange\(remote\)/);
  assert.match(resolver, /provider = videoId is not null[\s\S]*?"youtube"[\s\S]*?"direct"[\s\S]*?"external"/);
  assert.match(response, /public FeaturedTrailerDto\? Trailer \{ get; init; \}/);
  assert.match(response, /IReadOnlyList<FeaturedTrailerDto>\? Trailers \{ get; init; \}/);
  assert.match(resolver, /ResolveCandidates[\s\S]*?DistinctBy\(GetCandidateKey/);
  assert.match(resolver, /PreferRemote[\s\S]*?candidates\.AddRange\(remote\)[\s\S]*?candidates\.AddRange\(local\)/);
  assert.doesNotMatch(response, /LocalTrailerId/);
  for (const adapter of ['JellyfinLocalPlayer', 'YouTubePlayer', 'DirectVideoPlayer', 'ExternalPlayer']) {
    assert.match(player, new RegExp(`class ${adapter}`));
  }
  assert.doesNotMatch(player, /youtube[\s\S]{0,120}\.mp4/i);
  assert.match(carousel, /waitForTrailerToFinish[\s\S]*?pauseTimer\(\)/);
  assert.match(carousel, /trailerDelayMilliseconds/);
  assert.match(carousel, /trailerItemId === item\.id[\s\S]*?this\.stopTrailer\(\)/);
  assert.match(player, /pause\(\): Promise<void>[\s\S]*?setMuted\(muted: boolean\): Promise<void>[\s\S]*?setVolume\(volume: number\): Promise<void>/);
  assert.match(carousel, /event\.key\.toLowerCase\(\) === 'm'[\s\S]*?setMuted\(this\.trailerMuted\)/);
  assert.match(carousel, /event\.code !== 'Space'[\s\S]*?trailerPlayer\.pause\(\)[\s\S]*?trailerPlayer\.play\(\)/);
  assert.match(carousel, /event\.key === '\+' \|\| event\.code === 'NumpadAdd'[\s\S]*?event\.key === '-' \|\| event\.code === 'NumpadSubtract'[\s\S]*?direction \* 10[\s\S]*?setVolume\(this\.trailerVolume\)/);
  assert.match(carousel, /closest\('input, textarea, select, button,[\s\S]*?\[role="dialog"\]'/);
  assert.match(carousel, /restartTimer[\s\S]*?this\.trailerPaused/);
  assert.match(carousel, /YOUTUBE_CONTROL_CONCEALMENT_MS = 5000/);
  assert.match(carousel, /provider === 'youtube'[\s\S]*?hideYouTubeTrailerUntilControlsFade/);
  assert.match(carousel, /addEventListener\('keydown', this\.onTrailerHotkey, true\)/);
  assert.match(carousel, /onReveal:[\s\S]*?classList\.remove\('ec-youtube-trailer-concealed'\)[\s\S]*?classList\.add\('ec-trailer-active'\)/);
  assert.match(carousel, /launchDelayMilliseconds = concealYouTube \|\| candidateIndex > 0 \? 0 : this\.response\.trailerDelayMilliseconds/);
  assert.match(carousel, /Math\.max\(YOUTUBE_CONTROL_CONCEALMENT_MS, this\.response\.trailerDelayMilliseconds\)/);
  assert.match(carousel, /muted: concealYouTube \? true : this\.trailerMuted/);
  assert.match(player, /concealDurationMilliseconds[\s\S]*?setTimeout[\s\S]*?onReveal/);
  assert.match(player, /onConcealStart\?\.\(options\.concealDurationMilliseconds/);
  assert.match(carousel, /startTrailerCountdown\(durationMilliseconds\)[\s\S]*?setInterval\(update, 100\)/);
  assert.match(carousel, /createElementNS\('http:\/\/www\.w3\.org\/2000\/svg', 'svg'\)[\s\S]*?pathLength[\s\S]*?countdownRing\.append/);
  assert.match(styles, /\.ec-countdown-ring[\s\S]*?\.ec-countdown-progress[\s\S]*?stroke-dasharray:\s*100/);
  assert.doesNotMatch(carousel, /trailerCountdownLabel|Math\.ceil\(remaining \/ 1000\)/);
  assert.doesNotMatch(styles, /ec-trailer-countdown/);
  assert.match(styles, /\.ec-youtube-trailer-concealed[\s\S]*?opacity:\s*0/);
  assert.match(carousel, /querySelectorAll\(':scope > \.ec-trailer'\)/);
  assert.match(carousel, /classList\.add\('ec-trailer-active'\)[\s\S]*?classList\.remove\('ec-trailer-active'\)/);
  assert.match(styles, /\.ec-trailer\s*\{[\s\S]*?height:\s*max\(100%, 56\.25vw\)[\s\S]*?min-width:\s*100vw[\s\S]*?translate\(-50%, -50%\)/);
  assert.match(styles, /\.ec-trailer\s*\{[\s\S]*?pointer-events:\s*none/);
  assert.match(styles, /\.ec-slide\.ec-trailer-active\s*\{[\s\S]*?linear-gradient\(to bottom,[\s\S]*?#000 54%[\s\S]*?transparent 80%/);
  assert.match(styles, /\.ec-root\.ec-hero \.ec-backdrop,[\s\S]*?transparent 74%/);
  assert.match(styles, /\.ec-root\.ec-hero \.ec-slide::after[\s\S]*?transparent 78%/);
  assert.match(styles, /\.ec-slide\.ec-trailer-active \.ec-backdrop\s*\{[\s\S]*?opacity:\s*0/);
  assert.match(player, /target\.getIframe\(\)[\s\S]*?tabIndex = -1[\s\S]*?aria-hidden/);
  assert.match(player, /defaultMuted = options\.muted[\s\S]*?setAttribute\('webkit-playsinline', ''\)/);
  assert.match(player, /setAttribute\('allow', 'autoplay; encrypted-media; picture-in-picture'\)/);
  assert.match(player, /isIosTrailerClient[\s\S]*?navigator\.platform === 'MacIntel'[\s\S]*?navigator\.maxTouchPoints > 1/);
  assert.match(carousel, /startTrailersMuted \|\| isIosTrailerClient\(\)/);
  assert.match(player, /YouTube player API timed out[\s\S]*?8000/);
  assert.match(player, /onError: \(\{ data \}\)[\s\S]*?YouTube trailer failed with player error/);
  assert.match(carousel, /item\.trailers\?\.length[\s\S]*?candidateIndex \+ 1 < candidates\.length[\s\S]*?startTrailer\(slide, item, candidateIndex \+ 1\)/);
  assert.match(carousel, /void player\.play\(\)\.catch\(recover\)/);
  assert.match(player, /addEventListener\('waiting', this\.armPlaybackWatchdog\)[\s\S]*?addEventListener\('stalled', this\.armPlaybackWatchdog\)/);
  assert.match(player, /addEventListener\('error', this\.handleMediaError\)[\s\S]*?addEventListener\('abort', this\.handleMediaError\)/);
  assert.match(player, /Trailer playback stalled[\s\S]*?8000/);
  assert.match(player, /destroyed \|\| this\.failed[\s\S]*?this\.onError\(error\)/);
});

test('source mixer constraints survive personalized source cloning', async () => {
  const service = await read('Jellyfin.Plugin.Featured/Api/FeaturedPersonalizationService.cs');
  for (const property of ['MinimumItems', 'MaximumItems', 'IsFallback']) {
    assert.match(service, new RegExp(`${property}\\s*=\\s*rule\\.${property}`));
  }
});

test('all details interactions use the shared navigation helper', async () => {
  const [render, navigation] = await Promise.all([
    read('src/slider/render.ts'),
    read('src/slider/navigation.ts')
  ]);
  assert.equal(render.includes('#/details'), false);
  assert.equal((render.match(/openItemDetails\(item\.id\)/g) ?? []).length, 3);
  assert.match(navigation, /window\.Emby\?\.Page\?\.showItem/);
  assert.match(navigation, /#\/details\?id=/);
});

test('bootstrap and runtime placeholders share responsive and reduced-motion values', async () => {
  const [runtimeCss, bootstrap] = await Promise.all([
    read('src/styles/featured.css'),
    read('Jellyfin.Plugin.Featured/Integrations/FrontendBootstrap.cs')
  ]);
  for (const value of ['360px', '500px', '750px', '400px', '340px', '100px', '75px', '1.5s', '220%']) {
    assert.equal(runtimeCss.includes(value), true, `runtime placeholder misses ${value}`);
    assert.equal(bootstrap.includes(value), true, `bootstrap placeholder misses ${value}`);
  }
  assert.match(runtimeCss, /prefers-reduced-motion:[^)]+\)[\s\S]*?ec-placeholder-viewport[\s\S]*?animation:\s*none/);
  assert.match(bootstrap, /prefers-reduced-motion:reduce[^\n]+animation:none/);
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

test('prepared cache samples eligible items instead of always returning the first items', async () => {
  const preparedCache = await read('Jellyfin.Plugin.Featured/Api/FeaturedPreparedCache.cs');
  assert.match(preparedCache, /Where\(item => !excludedIds\.Contains\(item\.Id\)\)[\s\S]*?SelectRandomItems\(eligibleItems, requestedCount\)/);
  assert.match(preparedCache, /Random\.Shared\.Next\(index, candidates\.Count\)/);
  assert.doesNotMatch(preparedCache, /entry\.Items[\s\S]{0,160}?\.Take\(requestedCount\)/);
});

test('source mixer v2 applies limits, fallbacks, diversity, and cooldown recovery', async () => {
  const [configuration, normalizer, engine, history, preparedCache, defaults, sourceCard, sourcesTab, filtersTab] = await Promise.all([
    read('Jellyfin.Plugin.Featured/Configuration/PluginConfiguration.cs'),
    read('Jellyfin.Plugin.Featured/Configuration/PluginConfigurationNormalizer.cs'),
    Promise.all([
      read('Jellyfin.Plugin.Featured/Api/FeaturedRuleEngine.cs'),
      read('Jellyfin.Plugin.Featured/Api/FeaturedRuleEngine.Allocation.cs'),
      read('Jellyfin.Plugin.Featured/Api/FeaturedRuleEngine.Candidates.cs'),
      read('Jellyfin.Plugin.Featured/Api/FeaturedRuleEngine.Filters.cs'),
      read('Jellyfin.Plugin.Featured/Api/FeaturedRuleEngine.Models.cs')
    ]).then((parts) => parts.join('\n')),
    read('Jellyfin.Plugin.Featured/Api/FeaturedDisplayHistoryStore.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedPreparedCache.cs'),
    read('src/config/libs/defaults.ts'),
    read('src/config/components/SourceRuleCard.vue'),
    read('src/config/tabs/SourcesTab.vue'),
    read('src/config/tabs/FiltersTab.vue')
  ]);
  for (const property of ['MinimumItems', 'MaximumItems', 'IsFallback']) {
    assert.equal(configuration.includes(property), true, `backend misses ${property}`);
    assert.equal(defaults.includes(property), true, `frontend defaults miss ${property}`);
    assert.equal(sourceCard.includes(`rule.${property}`), true, `source editor misses ${property}`);
  }
  for (const property of ['MaximumItemsPerGenre', 'MaximumItemsPerFranchise']) {
    assert.equal(configuration.includes(property), true, `backend misses ${property}`);
    assert.equal(defaults.includes(property), true, `frontend defaults miss ${property}`);
    assert.equal(filtersTab.includes(`store.config.${property}`), true, `global diversity editor misses ${property}`);
  }
  assert.match(normalizer, /MinimumItems > rule\.MaximumItems[\s\S]*?MinimumItems = rule\.MaximumItems/);
  assert.match(engine, /primaryPools[\s\S]*?fallbackPools/);
  assert.match(engine, /GetItemIdentity[\s\S]*?ProviderIds\.TryGetValue/);
  assert.match(engine, /FeaturedDiversityTracker[\s\S]*?TmdbCollectionName/);
  assert.match(history, /GetRecentItems[\s\S]*?DisplayedAt/);
  assert.match(engine, /ActivateCooldownItems[\s\S]*?cooldownRelaxed:\s*true/);
  assert.match(preparedCache, /RequiresLiveMixing[\s\S]*?MinimumItems[\s\S]*?IsFallback/);
  assert.match(filtersTab, /RelaxRepeatCooldownWhenNeeded/);
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

test('featured selection excludes samples and other video extras', async () => {
  const ruleEngine = await read('Jellyfin.Plugin.Featured/Api/FeaturedRuleEngine.Filters.cs');
  assert.match(ruleEngine, /IsSupportedItemType\(BaseItem item\)[\s\S]*?item\.ExtraType is null[\s\S]*?FeaturedMediaTypes\.Contains/);
  assert.match(ruleEngine, /SampleFileNameRegex[\s\S]*?Path\.GetFileNameWithoutExtension\(item\.Path\)[\s\S]*?SampleFileNameRegex\.IsMatch\(fileName\)/);
});

test('DOM observation cannot trigger destructive remount scans', async () => {
  const runtime = await read('src/runtime.ts');
  assert.match(runtime, /trackedMountNeedsRecovery\(\) \|\| \(!hasTrackedMount && mutations\.some\(mutationAffectsHome\)\)/);
  assert.match(runtime, /\(removeInactive && !isActiveHomeContainer\(container\)\)/);
  assert.match(runtime, /\.\.\.mutation\.addedNodes, \.\.\.mutation\.removedNodes/);
  assert.match(runtime, /rootWasUnexpectedlyRemoved[\s\S]*?recordMountFailure\(\)/);
  assert.match(runtime, /Math\.min\(300_000, 10_000 \* \(3 \*\*/);
  assert.doesNotMatch(runtime, /if \(relevantChange\) scheduleFullRefresh\(\);/);
});

test('browser console messages use the short Featured prefix', async () => {
  const [constants, runtime, carousel] = await Promise.all([
    read('src/constants.ts'),
    read('src/runtime.ts'),
    read('src/slider/carousel.ts')
  ]);
  assert.match(constants, /CONSOLE_PREFIX\s*=\s*'\[Featured\]'/);
  assert.doesNotMatch(`${runtime}\n${carousel}`, /\[Jellyfin Featured\]/);
  assert.equal((`${runtime}\n${carousel}`.match(/console\.(?:debug|warn|error)/g) ?? []).length, 5);
  assert.equal((`${runtime}\n${carousel}`.match(/CONSOLE_PREFIX/g) ?? []).length, 7);
});
