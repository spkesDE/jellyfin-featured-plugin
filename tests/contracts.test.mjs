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
    HideYouTubeTrailerUntilControlsFade: 'true',
    FallBackToRemoteTrailers: 'true',
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
  assert.match(defaults, /createPresetFromConfig[\s\S]*?SourceRules: structuredClone[\s\S]*?PersonalizationPolicy[\s\S]*?Mixer:[\s\S]*?Layout:[\s\S]*?Trailers:/);
  assert.match(presetTab, /preset\.ScheduleType === 'one_time'[\s\S]*?ConfigDateTime v-model="preset\.StartsAt"[\s\S]*?ConfigDateTime v-model="preset\.EndsAt"/);
  assert.match(presetTab, /store\.updatePresetSnapshot\(index\)[\s\S]*?store\.duplicatePreset\(index\)/);
  assert.match(runtime, /schedulePresetRefresh\(response\.nextPresetChange\)/);
  assert.match(runtime, /Date\.now\(\) < boundary[\s\S]*?refreshForPresetBoundary\(\)/);
  assert.match(runtime, /function refreshForPresetBoundary[\s\S]*?instance\.destroy\(\)[\s\S]*?scheduleScan\(\)/);
});

test('personalization is authenticated, policy-bound, user scoped, and fast to reopen', async () => {
  const [controller, service, store, response, frontend, navigation, carousel, engine, optionsCache, services, styles, history] = await Promise.all([
    read('Jellyfin.Plugin.Featured/Api/FeaturedController.Preferences.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedPersonalizationService.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedPreferenceStore.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedResponseDtos.cs'),
    read('src/preferences.ts'),
    read('src/admin/navigation.ts'),
    read('src/slider/carousel.ts'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedRuleEngine.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedPreferenceOptionsCache.cs'),
    read('Jellyfin.Plugin.Featured/PluginServiceRegistrator.cs'),
    read('src/styles/featured.css'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedDisplayHistoryStore.cs')
  ]);
  assert.match(controller, /\[HttpGet\("preferences"\)\][\s\S]*?\[Authorize\]/);
  assert.match(controller, /\[HttpPut\("preferences"\)\][\s\S]*?\[Authorize\]/);
  assert.match(controller, /\[HttpGet\("preferences\/options"\)\][\s\S]*?\[Authorize\]/);
  assert.match(controller, /\[HttpGet\("preferences\/bootstrap"\)\][\s\S]*?\[Authorize\]/);
  assert.match(controller, /GetVisibleGenres\(activeUser\)/);
  assert.equal((controller.match(/RuntimeConfigJsonOptions/g) ?? []).length, 4);
  assert.match(controller, /new JsonResult\(CreatePreferencesResponse\(activeUser\), RuntimeConfigJsonOptions\)/);
  assert.match(controller, /CreatePreferenceOptionsResponse\(activeUser, effective\)/);
  assert.match(optionsCache, /ConcurrentDictionary<Guid, Lazy<CacheEntry>>/);
  assert.match(optionsCache, /TimeSpan\.FromMinutes\(2\)/);
  assert.match(optionsCache, /LazyThreadSafetyMode\.ExecutionAndPublication/);
  assert.match(services, /AddSingleton<FeaturedPreferenceOptionsCache>/);
  assert.match(service, /policy\.AllowSourceSelection[\s\S]*?sourceIds\.Contains/);
  assert.match(service, /policy\.AllowPreferredGenres[\s\S]*?allowedGenres\.Contains/);
  assert.match(service, /submitted\.ExcludedGenres[\s\S]*?allowedGenres\.Contains[\s\S]*?!preferredGenres\.Contains/);
  assert.match(engine, /excludedGenres[\s\S]*?!ContainsAny\(item\.Genres, excludedGenres\)/);
  assert.match(service, /ResolveDefaults\(PluginConfiguration config, Guid userId\)[\s\S]*?Resolve\(config, userId, null\)/);
  assert.match(service, /if \(IsEmpty\(normalized\)\) _store\.Remove\(userId\)/);
  assert.match(service, /config\.RepeatCooldownDays \* 24[\s\S]*?saved\?\.RepeatCooldownHours[\s\S]*?saved\?\.RepeatCooldownDays/);
  assert.match(service, /submitted\.RepeatCooldownHours[\s\S]*?3650 \* 24/);
  assert.match(store, /userId\.ToString\("N"\)/);
  assert.match(store, /public int\? RepeatCooldownHours/);
  assert.match(history, /GetRecentItems\(Guid userId, int cooldownHours\)[\s\S]*?AddHours\(-cooldownHours\)/);
  assert.match(response, /public bool PersonalizationEnabled \{ get; \}/);
  assert.match(response, /public int RepeatCooldownHours/);
  assert.match(frontend, /body: \{ reset: true \}/);
  assert.match(frontend, /body: \{ preferences \}/);
  assert.match(frontend, /GenrePreferenceState = 'neutral' \| 'preferred' \| 'excluded'/);
  assert.match(frontend, /state === 'neutral' \? 'preferred' : state === 'preferred' \? 'excluded' : 'neutral'/);
  assert.doesNotMatch(frontend, /JellyfinFeatured\?\.refresh/);
  assert.match(frontend, /current\.defaults\.sourceEnabled/);
  assert.match(frontend, /featured\/preferences\/bootstrap/);
  assert.match(frontend, /bootstrapCacheLifetime = 30_000/);
  assert.match(frontend, /className = 'emby-checkbox'/);
  assert.match(frontend, /raised button-submit emby-button/);
  assert.match(frontend, /\[1, 'preferences\.cooldown\.1h'\]/);
  assert.match(frontend, /\[24, 'preferences\.cooldown\.24h'\]/);
  assert.match(frontend, /dataset\.cooldownHours = 'true'/);
  assert.match(frontend, /preferences\.repeatCooldownHours = value/);
  assert.match(navigation, /USER_PREFERENCES_SELECTOR[\s\S]*?#\/mypreferencesmenu/);
  assert.match(navigation, /settingsEntry\.after\(entry\)/);
  assert.match(navigation, /#myPreferencesMenuPage/);
  assert.match(navigation, /USER_SETTINGS_PAGE_LINK_ATTR[\s\S]*?section\.appendChild\(entry\)/);
  assert.match(navigation, /\.lnkHomePreferences/);
  assert.match(navigation, /openPreferencesDialog\(\)/);
  assert.doesNotMatch(navigation, /preloadPreferencesDialog|preferences\/bootstrap/);
  assert.match(navigation, /userSettingsEnabled = config\.personalizationEnabled/);
  assert.match(styles, /ec-preferences-spinner/);
  assert.match(styles, /env\(safe-area-inset-top\)/);
  assert.match(styles, /\.ec-preferences-dialog[^}]*height: min\(52rem, calc\(100dvh - 2rem\)\)[^}]*width: 64rem/);
  assert.match(styles, /\.ec-preferences-content[^}]*flex: 1 1 auto/);
  assert.match(styles, /@media \(max-width: 600px\)[\s\S]*?\.ec-preferences-dialog[^}]*width: 100%/);
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
  assert.match(player, /onConcealStart\?\.\(duration\)/);
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
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?\.ec-root\.ec-hero \.ec-slide::after\s*\{[\s\S]*?linear-gradient\(0deg/);
  assert.doesNotMatch(styles, /\.ec-backdrop::after/);
  assert.match(player, /target\.getIframe\(\)[\s\S]*?tabIndex = -1[\s\S]*?aria-hidden/);
  assert.match(player, /youtube-nocookie\.com'[\s\S]*?youtube\.com'/);
  assert.match(player, /origin: window\.location\.origin/);
  assert.match(player, /hostIndex === 0 \? 2500 : 8000/);
  assert.match(player, /hostIndex \+ 1 < YOUTUBE_HOSTS\.length[\s\S]*?startPlayer\(api, videoId, options, hostIndex \+ 1\)/);
  assert.match(player, /defaultMuted = options\.muted[\s\S]*?setAttribute\('webkit-playsinline', ''\)/);
  assert.match(player, /setAttribute\('allow', 'autoplay; encrypted-media; picture-in-picture'\)/);
  assert.match(player, /isIosTrailerClient[\s\S]*?navigator\.platform === 'MacIntel'[\s\S]*?navigator\.maxTouchPoints > 1/);
  assert.match(carousel, /startTrailersMuted \|\| isIosTrailerClient\(\)/);
  assert.match(player, /YOUTUBE_API_TIMEOUT_MS = 8_000[\s\S]*?YouTube player API timed out[\s\S]*?YOUTUBE_API_TIMEOUT_MS/);
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
  assert.match(render, /addEventListener\('keydown'[\s\S]*?target\?\.closest\('button'\)[\s\S]*?openItemDetails\(item\.id\)/);
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

test('touch layouts keep the first Jellyfin section below the hero', async () => {
  const [styles, bootstrap] = await Promise.all([
    read('src/styles/featured.css'),
    read('Jellyfin.Plugin.Featured/Integrations/FrontendBootstrap.cs')
  ]);
  assert.match(styles, /@media \(max-width: 700px\), \(hover: none\) and \(pointer: coarse\)[\s\S]*?\.ec-root\.ec-ready\.ec-hero,[\s\S]*?\.ec-root\.ec-placeholder\.ec-hero[\s\S]*?margin-bottom:\s*calc\(1\.25rem \+ var\(--ec-media-padding, 0px\)\)/);
  assert.match(bootstrap, /@media\(max-width:700px\),\(hover:none\) and \(pointer:coarse\)[\s\S]*?\.ec-bootstrap-placeholder\.ec-bootstrap-hero\{margin-bottom:calc\(1\.25rem \+ var\(--ec-media-padding,0px\)\)\}/);
});

test('hero hit-testing ends at the first Jellyfin section without clipping the visual fade', async () => {
  const [render, styles] = await Promise.all([
    read('src/slider/render.ts'),
    read('src/styles/featured.css')
  ]);
  assert.match(render, /className = 'ec-slide-hitbox'/);
  assert.match(styles, /\.ec-root\.ec-ready\.ec-hero\s*\{[^}]*pointer-events:\s*none/);
  assert.match(styles, /\.ec-slide-hitbox\s*\{[^}]*height:\s*clamp\(0px, calc\(var\(--ec-height\) - var\(--ec-hero-overlap, 150px\) \+ 52px \+ var\(--ec-media-padding, 0px\)\), var\(--ec-height\)\)[^}]*pointer-events:\s*none/);
  assert.match(styles, /\.ec-whole-banner-interactive \.ec-slide-hitbox\s*\{[^}]*pointer-events:\s*auto/);
  assert.doesNotMatch(styles, /\.ec-root\.ec-ready\.ec-hero \+ \.verticalSection/);
});

test('whole-banner interaction is configurable while buttons remain independent', async () => {
  const [configuration, resolver, response, defaults, displayTab, carousel, render] = await Promise.all([
    read('Jellyfin.Plugin.Featured/Configuration/PluginConfiguration.cs'),
    read('Jellyfin.Plugin.Featured/Configuration/FeaturedPresetResolver.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedResponseDtos.cs'),
    read('src/config/libs/defaults.ts'),
    read('src/config/tabs/DisplayTab.vue'),
    read('src/slider/carousel.ts'),
    read('src/slider/render.ts')
  ]);
  assert.match(configuration, /InteractOnWholeBanner\s*\{\s*get;\s*set;\s*\}\s*=\s*true/);
  assert.match(resolver, /config\.InteractOnWholeBanner = preset\.Layout\.InteractOnWholeBanner/);
  assert.match(response, /InteractOnWholeBanner = config\.InteractOnWholeBanner/);
  assert.match(defaults, /InteractOnWholeBanner:\s*true/);
  assert.match(displayTab, /v-model="store\.config\.InteractOnWholeBanner"/);
  assert.match(carousel, /response\.interactOnWholeBanner \? ' ec-whole-banner-interactive'/);
  assert.match(carousel, /isActive && this\.response\.interactOnWholeBanner \? 0 : -1/);
  assert.match(render, /if \(response\.interactOnWholeBanner\)[\s\S]*?slide\.addEventListener\('click'/);
});

test('feed preview reuses mixer diagnostics for unsaved configs, users, and forced presets', async () => {
  const [previewController, requests, responses, engine, allocation, store, modal, sources] = await Promise.all([
    read('Jellyfin.Plugin.Featured/Api/FeaturedController.Preview.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedController.Requests.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedResponseDtos.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedRuleEngine.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedRuleEngine.Allocation.cs'),
    read('src/config/libs/store.ts'),
    read('src/config/components/FeedPreviewModal.vue'),
    read('src/config/tabs/SourcesTab.vue')
  ]);
  assert.match(previewController, /HttpPost\("config\/preview"\)[\s\S]*?PermissionKind\.IsAdministrator/);
  assert.match(previewController, /PluginConfigurationNormalizer\.Normalize\(request\.Configuration\)[\s\S]*?ResolvePreview/);
  assert.match(previewController, /_personalization\.Resolve\(effective, previewUser\.Id\)[\s\S]*?SelectItems/);
  assert.match(previewController, /JsonSerializer\.Serialize\(payload, RuntimeConfigJsonOptions\)/);
  assert.match(requests, /class FeaturedFeedPreviewRequest[\s\S]*?UserId[\s\S]*?PresetId[\s\S]*?UseDefaultConfiguration/);
  assert.match(responses, /class FeaturedFeedPreviewResponse[\s\S]*?DuplicatesRemoved[\s\S]*?CooldownExcluded[\s\S]*?DiversitySkipped/);
  assert.match(engine + allocation, /ItemReasons[\s\S]*?FeaturedItemSelectionReason|itemReasons\[item\.Id\]/);
  assert.match(store, /cloneConfig[\s\S]*?JSON\.parse\(snapshot\(value\)\)/);
  assert.match(store, /featured\/config\/preview[\s\S]*?configuration: cloneConfig\(config\)/);
  assert.match(modal, /feedPreview\.value\.items[\s\S]*?feedPreview\.value\.rules[\s\S]*?duplicatesRemoved/);
  assert.match(sources, /#actions[\s\S]*?ec-feedPreviewAction[\s\S]*?store\.openFeedPreview\(\)/);
});

test('API failures expose HTTP status instead of object stringification', async () => {
  const apiClient = await read('src/core/apiClient.ts');
  assert.match(apiClient, /catch \(error\)[\s\S]*?createRequestError\(path, error\)/);
  assert.match(apiClient, /statusPart[\s\S]*?HTTP \$\{status\}/);
  assert.match(apiClient, /parseErrorDetail\(body\)/);
});

test('border radius clips every composited slide with and without trailers', async () => {
  const styles = await read('src/styles/featured.css');
  assert.match(styles, /\.ec-viewport\s*\{[^}]*border-radius:\s*var\(--ec-banner-radius, var\(--ec-radius\)\)[^}]*overflow:\s*hidden/);
  assert.match(styles, /\.ec-slide\s*\{[^}]*border-radius:\s*var\(--ec-banner-radius, var\(--ec-radius\)\)[^}]*clip-path:\s*inset\(0 round var\(--ec-banner-radius, var\(--ec-radius\)\)\)[^}]*overflow:\s*hidden/);
  assert.match(styles, /\.ec-trailer\s*\{[^}]*position:\s*absolute/);
  assert.match(styles, /\.ec-slide::after\s*\{[^}]*position:\s*absolute/);
});

test('carousel controls can be hidden until hover without affecting touch input', async () => {
  const [configuration, resolver, response, defaults, displayTab, preview, carousel, styles] = await Promise.all([
    read('Jellyfin.Plugin.Featured/Configuration/PluginConfiguration.cs'),
    read('Jellyfin.Plugin.Featured/Configuration/FeaturedPresetResolver.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedResponseDtos.cs'),
    read('src/config/libs/defaults.ts'),
    read('src/config/tabs/DisplayTab.vue'),
    read('src/config/components/BannerPreview.vue'),
    read('src/slider/carousel.ts'),
    read('src/styles/featured.css')
  ]);
  assert.match(configuration, /ShowControlsOnHoverOnly/);
  assert.match(resolver, /config\.ShowControlsOnHoverOnly = preset\.Layout\.ShowControlsOnHoverOnly/);
  assert.match(response, /ShowControlsOnHoverOnly = config\.ShowControlsOnHoverOnly/);
  assert.match(defaults, /ShowControlsOnHoverOnly:\s*false/);
  assert.match(displayTab, /v-model="store\.config\.ShowControlsOnHoverOnly"/);
  assert.match(preview, /'controls-on-hover': store\.config\.ShowControlsOnHoverOnly/);
  assert.match(carousel, /showControlsOnHoverOnly \? ' ec-controls-hover'/);
  assert.match(styles, /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*?\.ec-root\.ec-controls-hover \.ec-controls[\s\S]*?opacity:\s*0[\s\S]*?:focus-within \.ec-controls[\s\S]*?opacity:\s*1/);
});

test('frontend theming inherits Jellyfin palette tokens and exposes a Custom CSS API', async () => {
  const [tokens, main, configMain, devMain, render, runtimeStyles, configStyles, preview, guide, readme] = await Promise.all([
    read('src/styles/jellyfin-theme.ts'),
    read('src/main.ts'),
    read('src/config/main.ts'),
    read('src/config/dev/main.ts'),
    read('src/slider/render.ts'),
    read('src/styles/featured.css'),
    read('src/config/config.css'),
    read('src/config/components/BannerPreview.vue'),
    read('docs/custom-css.md'),
    read('README.md')
  ]);
  for (const jellyfinToken of [
    '--jf-palette-primary-main',
    '--jf-palette-primary-contrastText',
    '--jf-palette-background-default',
    '--jf-palette-background-paper',
    '--jf-palette-text-primary',
    '--jf-palette-divider',
    '--jf-palette-action-hover',
    '--jf-card-borderRadius'
  ]) assert.match(tokens, new RegExp(jellyfinToken));
  assert.match(tokens, /--theme-primary-color[\s\S]*?--primary-accent-color[\s\S]*?--accent/);
  assert.match(tokens, /getComputedStyle\(document\.documentElement\)/);
  assert.match(tokens, /computed\.getPropertyValue\(name\)\.trim\(\)\.length === 0/);
  assert.match(main, /injectJellyfinThemeTokens\(\)/);
  assert.match(configMain, /injectJellyfinThemeTokens\(\)/);
  assert.match(devMain, /injectJellyfinThemeTokens\(\)/);
  assert.match(render, /ec-button raised button-submit emby-button/);
  assert.match(render, /ec-button ec-button-secondary raised emby-button/);
  assert.match(runtimeStyles, /\.ec-button\s*\{[^}]*background:\s*var\(--ec-button-primary-background, var\(--ec-theme-primary\)\)[^}]*color:\s*var\(--ec-button-primary-color, var\(--ec-theme-primary-contrast\)\)/);
  assert.match(runtimeStyles, /\.ec-preferences-dialog\s*\{[^}]*background:\s*var\(--ec-dialog-background, var\(--ec-theme-background\)\)[^}]*color:\s*var\(--ec-dialog-color, var\(--ec-theme-text-primary\)\)/);
  assert.match(configStyles, /\.ec-configPreviewButton\s*\{[^}]*background:\s*var\(--ec-button-primary-background, var\(--ec-theme-primary\)\)[^}]*color:\s*var\(--ec-button-primary-color, var\(--ec-theme-primary-contrast\)\)/);
  assert.match(configStyles, /\.jmp-tabButton\.is-active\s*\{[^}]*background:\s*var\(--ec-theme-primary\)/);
  assert.match(preview, /ec-configPreviewButton raised button-submit emby-button/);
  for (const publicHook of [
    '--ec-banner-radius',
    '--ec-button-primary-background',
    '--ec-button-primary-hover-background',
    '--ec-button-secondary-background',
    '--ec-button-secondary-hover-background',
    '--ec-dialog-background',
    '.ec-button-secondary',
    '.ec-preferences-dialog'
  ]) assert.match(guide, new RegExp(publicHook.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(readme, /docs\/custom-css\.md/);
});

test('localization falls back safely and documents the translation contribution workflow', async () => {
  const [i18n, contributing, readme] = await Promise.all([
    read('src/i18n/index.ts'),
    read('CONTRIBUTING.md'),
    read('README.md')
  ]);
  assert.match(i18n, /if \(locale in translations\) return locale;[\s\S]*?language in translations \? language : 'en'/);
  assert.match(i18n, /value\.trim\(\)\.length > 0/);
  assert.match(i18n, /const template = localized \?\? english \?\? key/);
  assert.match(i18n, /reportedMissingTranslations\.has\(reportKey\)[\s\S]*?console\.warn/);
  assert.match(contributing, /## Translation Workflow[\s\S]*?reference locale[\s\S]*?falls back to English/);
  assert.match(contributing, /npm run i18n:status[\s\S]*?npm test[\s\S]*?npm run typecheck/);
  assert.match(contributing, /preserve placeholders such as `\{count\}`, `\{name\}`, or `\{score\}` exactly/);
  assert.match(readme, /CONTRIBUTING\.md#translation-workflow/);
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

test('prepared cache rotates through a shuffle bag before repeating items', async () => {
  const preparedCache = await read('Jellyfin.Plugin.Featured/Api/FeaturedPreparedCache.cs');
  assert.match(preparedCache, /TryTake\(excludedIds, requestedCount, out items, out dtoCreationMilliseconds, out int eligibleCount\)/);
  assert.match(preparedCache, /_remaining\.Count\(item => !excludedIds\.Contains\(item\.Id\)\) < count[\s\S]*?CreateShuffledBag\(_items\)/);
  assert.match(preparedCache, /PreparedItem candidate = _remaining\.Dequeue\(\)[\s\S]*?_remaining\.Enqueue\(candidate\)[\s\S]*?items\.Add\(candidate\.Dto\.Value\)/);
  assert.match(preparedCache, /Random\.Shared\.Next\(index \+ 1\)/);
  assert.doesNotMatch(preparedCache, /SelectRandomItems/);
});

test('prepared cache fingerprint includes excluded genres', async () => {
  const personalization = await read('Jellyfin.Plugin.Featured/Api/FeaturedPersonalizationService.cs');
  const fingerprint = personalization.slice(
    personalization.indexOf('internal string Fingerprint'),
    personalization.indexOf('public sealed class FeaturedPersonalizationService')
  );
  assert.match(fingerprint, /SourceRules/);
  assert.match(fingerprint, /Profile/);
  assert.match(fingerprint, /ExcludedGenres/);
  assert.match(fingerprint, /RepeatCooldownHours/);
});

test('warm prepared responses reuse prebuilt DTOs and expose bypass diagnostics', async () => {
  const [preparedCache, itemsController, dtoFactory] = await Promise.all([
    read('Jellyfin.Plugin.Featured/Api/FeaturedPreparedCache.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedController.Items.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedItemDtoFactory.cs')
  ]);
  assert.match(preparedCache, /new Lazy<FeaturedItemDto>[\s\S]*?_itemDtoFactory\.Create\(item, user, config\)/);
  assert.match(preparedCache, /out string status/);
  for (const status of ['bypass (disabled)', 'bypass (live mixing required)', 'miss (no entry)', 'miss (fingerprint mismatch)', 'refreshing', 'hit']) {
    assert.equal(preparedCache.includes(`\"${status}\"`), true, `missing prepared-cache status ${status}`);
  }
  assert.match(itemsController, /X-Featured-Prepared-Cache/);
  assert.match(itemsController, /Server-Timing/);
  assert.match(itemsController, /Featured request timing/);
  assert.match(itemsController, /JsonSerializer\.Serialize\(payload, RuntimeConfigJsonOptions\)/);
  assert.match(preparedCache, /FeaturedController\.WarmItemsResponseSerialization/);
  assert.match(itemsController, /CanPopulateFromRequest\(preparedCacheStatus\)[\s\S]*?GetRequestedPoolSize\(_config\)[\s\S]*?StoreRequestPool/);
  assert.match(itemsController, /\$"cold-filled \(\{initialPreparedCacheStatus\}\)"/);
  assert.match(preparedCache, /eagerlyBuildDtos: false, replaceExisting: false/);
  assert.match(preparedCache, /eagerlyBuildDtos: true, replaceExisting: true/);
  assert.match(dtoFactory, /ResolveCandidates\(item, activeUser, config\)/);
});

test('rule engine debug timing separates query, filtering, scoring, and allocation phases', async () => {
  const [engine, models, controller, diagnostics, preparedCache] = await Promise.all([
    read('Jellyfin.Plugin.Featured/Api/FeaturedRuleEngine.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedRuleEngine.Models.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedController.Items.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedController.Diagnostics.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedPreparedCache.cs')
  ]);
  for (const label of [
    'source candidates', 'allowed-items access', 'user-data batch', 'global filters',
    'rule filters', 'personalization/scoring', 'pool allocation'
  ]) assert.equal(models.includes(label), true, `missing rule timing phase ${label}`);
  assert.match(engine, /GetSourceCandidates[\s\S]*?sourceCandidatesMilliseconds/);
  assert.match(engine, /GetAllowedItemIds[\s\S]*?allowedItemsAccessMilliseconds/);
  assert.match(engine, /GetUserDataBatch[\s\S]*?userDataBatchMilliseconds/);
  assert.match(engine, /globallyFilteredItemIds[\s\S]*?globalFiltersMilliseconds/);
  assert.match(engine, /OrderForProfile[\s\S]*?personalizationScoringMilliseconds/);
  assert.match(engine, /FillFromPools[\s\S]*?poolAllocationMilliseconds/);
  assert.match(controller, /LogRuleEngineTiming\(coldPool\.Timing\)/);
  assert.match(controller, /LogRuleEngineTiming\(liveSelection\.Timing\)/);
  assert.match(diagnostics, /LogRuleEngineTiming\(selection\.Timing\)/);
  assert.match(preparedCache, /config\.Debug[\s\S]*?selection\.Timing\.FormatReport\(\)/);
});

test('rule engine user access stays in memory and is evaluated once per distinct candidate', async () => {
  const [engine, access, filters] = await Promise.all([
    read('Jellyfin.Plugin.Featured/Api/FeaturedRuleEngine.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedUserAccess.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedRuleEngine.Filters.cs')
  ]);
  assert.match(engine, /DistinctBy\(item => item\.Id\)[\s\S]*?FeaturedUserAccess\.GetAllowedItemIds/);
  assert.match(access, /item\.IsVisibleStandalone\(activeUser\)/);
  assert.doesNotMatch(access, /InternalItemsQuery|GetItemList|ItemIds\s*=/);
  const eligibility = filters.slice(
    filters.indexOf('private static bool IsEligibleItem'),
    filters.indexOf('private static bool IsSupportedItemType')
  );
  assert.doesNotMatch(eligibility, /activeUser|\.IsVisible\(/);
});

test('infinite loading waits for navigation before prefetching and ignores vertical swipes', async () => {
  const carousel = await read('src/slider/carousel.ts');
  assert.match(carousel, /hasLeftInitialSlide = false/);
  assert.match(carousel, /if \(!this\.hasLeftInitialSlide\) return false/);
  assert.match(carousel, /this\.hasLeftInitialSlide \|\|= this\.index > 0/);
  assert.match(carousel, /Math\.abs\(deltaX\) > Math\.abs\(deltaY\) \* 1\.2/);
  assert.match(carousel, /suppressClickUntil = performance\.now\(\) \+ 500/);
  assert.match(carousel, /event\.stopImmediatePropagation\(\)/);
});

test('infinite-loading batches reject both old and same-response duplicates', async () => {
  const carousel = await read('src/slider/carousel.ts');
  assert.match(carousel, /this\.loadItems\(\[\.\.\.this\.seenItemIds\]\)/);
  assert.match(carousel, /filter\(\(item\) => \{[\s\S]*?this\.seenItemIds\.has\(item\.id\)[\s\S]*?this\.seenItemIds\.add\(item\.id\)[\s\S]*?return true/);
  assert.match(carousel, /MAX_SEEN_ITEM_IDS = 500/);
});

test('trailer volume survives reloads and restricted storage contexts', async () => {
  const carousel = await read('src/slider/carousel.ts');
  assert.match(carousel, /TRAILER_VOLUME_STORAGE_KEY = 'jellyfin-featured\.trailer-volume'/);
  assert.match(carousel, /function readTrailerVolume[\s\S]*?localStorage\.getItem[\s\S]*?catch[\s\S]*?DEFAULT_TRAILER_VOLUME/);
  assert.match(carousel, /function saveTrailerVolume[\s\S]*?localStorage\.setItem[\s\S]*?catch/);
  assert.match(carousel, /this\.trailerVolume = readTrailerVolume\(\)/);
  assert.match(carousel, /this\.trailerVolume = 10[\s\S]*?saveTrailerVolume\(this\.trailerVolume\)/);
  assert.match(carousel, /direction \* 10[\s\S]*?saveTrailerVolume\(this\.trailerVolume\)/);
});

test('YouTube player creation remains load-gated and video errors stay item-specific', async () => {
  const player = await read('src/slider/trailer.ts');
  const appendIndex = player.indexOf('this.element.appendChild(iframe)');
  const loadIndex = player.indexOf("iframe.addEventListener('load'");
  const playerIndex = player.indexOf('this.player = new api.Player(iframe');
  assert.ok(loadIndex >= 0 && playerIndex > loadIndex && appendIndex > playerIndex);
  assert.match(player, /YOUTUBE_ITEM_SPECIFIC_ERRORS = new Set\(\[2, 100, 101, 150\]\)/);
  assert.match(player, /YOUTUBE_ITEM_SPECIFIC_ERRORS\.has\(data\)[\s\S]*?this\.fail\(options, error\)[\s\S]*?recover\(error\)/);
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
