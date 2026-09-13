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
    ShowPaginationDots: 'true'
  };
  for (const [name, value] of Object.entries(expected)) {
    const csharpValue = value.startsWith("'") ? `"${value.slice(1, -1)}"` : value;
    assert.match(backend, new RegExp(`public\\s+\\w+\\s+${name}\\s*\\{[^}]+\\}\\s*=\\s*${csharpValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*;`));
    assert.match(frontend, new RegExp(`\\b${name}:\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*,`));
  }
});

test('item and runtime contracts retain their established names and interval units', async () => {
  const [controller, dtos] = await Promise.all([
    read('Jellyfin.Plugin.Featured/Api/FeaturedController.cs'),
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
  assert.match(controller, /new FeaturedItemsResponseDto\(_config, items, InfiniteBatchSize, requestedCount, personalization\),\s*RuntimeConfigJsonOptions/);
});

test('personalization is authenticated, policy-bound, and user scoped', async () => {
  const [controller, service, store, response, frontend] = await Promise.all([
    read('Jellyfin.Plugin.Featured/Api/FeaturedController.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedPersonalizationService.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedPreferenceStore.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedResponseDtos.cs'),
    read('src/preferences.ts')
  ]);
  assert.match(controller, /\[HttpGet\("preferences"\)\][\s\S]*?\[Authorize\]/);
  assert.match(controller, /\[HttpPut\("preferences"\)\][\s\S]*?\[Authorize\]/);
  assert.match(controller, /\[HttpGet\("preferences\/options"\)\][\s\S]*?\[Authorize\]/);
  assert.match(controller, /GetVisibleGenres\(activeUser\)/);
  assert.match(service, /policy\.AllowSourceSelection[\s\S]*?sourceIds\.Contains/);
  assert.match(service, /policy\.AllowPreferredGenres[\s\S]*?allowedGenres\.Contains/);
  assert.match(service, /ResolveDefaults\(PluginConfiguration config, Guid userId\)[\s\S]*?Resolve\(config, userId, null\)/);
  assert.match(service, /if \(IsEmpty\(normalized\)\) _store\.Remove\(userId\)/);
  assert.match(store, /userId\.ToString\("N"\)/);
  assert.match(response, /public bool PersonalizationEnabled \{ get; \}/);
  assert.match(frontend, /body: \{ reset: true \}/);
  assert.match(frontend, /body: \{ preferences \}/);
  assert.match(frontend, /current\.defaults\.sourceEnabled/);
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
  for (const property of ['MaximumItemsPerGenre', 'MaximumItemsPerFranchise', 'ExcludeItemsFromSameSeries']) {
    assert.equal(configuration.includes(property), true, `backend misses ${property}`);
    assert.equal(defaults.includes(property), true, `frontend defaults miss ${property}`);
    assert.equal(sourcesTab.includes(`store.config.${property}`), true, `diversity editor misses ${property}`);
  }
  assert.match(normalizer, /MinimumItems > rule\.MaximumItems[\s\S]*?MinimumItems = rule\.MaximumItems/);
  assert.match(engine, /primaryPools[\s\S]*?fallbackPools/);
  assert.match(engine, /GetItemIdentity[\s\S]*?ProviderIds\.TryGetValue/);
  assert.match(engine, /FeaturedDiversityTracker[\s\S]*?TmdbCollectionName[\s\S]*?IHasSeries/);
  assert.match(history, /GetRecentItems[\s\S]*?DisplayedAt/);
  assert.match(engine, /ActivateCooldownItems[\s\S]*?cooldownRelaxed:\s*true/);
  assert.match(preparedCache, /RequiresLiveMixing[\s\S]*?MinimumItems[\s\S]*?IsFallback/);
  assert.match(filtersTab, /RelaxRepeatCooldownWhenNeeded/);
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
