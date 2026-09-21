import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async (path) => await readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('personalization is authenticated, policy-bound, user scoped, and fast to reopen', async () => {
  const [controller, itemsController, service, store, response, itemFactory, frontend, navigation, carousel, slideRender, runtime, constants, engine, optionsCache, warmupTask, services, styles, history] = await Promise.all([
    read('Jellyfin.Plugin.Featured/Api/FeaturedController.Preferences.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedController.Items.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedPersonalizationService.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedPreferenceStore.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedResponseDtos.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedItemDtoFactory.cs'),
    read('src/preferences.ts'),
    read('src/admin/navigation.ts'),
    read('src/slider/carousel.ts'),
    read('src/slider/render.ts'),
    read('src/runtime.ts'),
    read('src/constants.ts'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedRuleEngine.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedPreferenceOptionsCache.cs'),
    read('Jellyfin.Plugin.Featured/ScheduledTasks/WarmUserSettingsCacheTask.cs'),
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
  assert.match(optionsCache, /TimeSpan\.FromMinutes\(10\)/);
  assert.match(optionsCache, /LazyThreadSafetyMode\.ExecutionAndPublication/);
  assert.match(optionsCache, /genre cache hit:[\s\S]*?genre cache miss:/);
  assert.match(optionsCache, /QueueWarmup[\s\S]*?HasFreshOrPendingEntry[\s\S]*?_queuedUsers\.TryAdd[\s\S]*?Task\.Run/);
  assert.match(itemsController, /Response\.OnCompleted[\s\S]*?_preferenceOptionsCache\.QueueWarmup/);
  assert.match(controller, /user-settings bootstrap resolved preferences[\s\S]*?user-settings bootstrap built options[\s\S]*?user-settings bootstrap completed/);
  assert.match(controller, /genre scan inspected[\s\S]*?library query/);
  assert.match(services, /AddSingleton<FeaturedPreferenceOptionsCache>/);
  assert.match(services, /AddSingleton<IScheduledTask, WarmUserSettingsCacheTask>/);
  assert.match(warmupTask, /IScheduledTask, IConfigurableScheduledTask/);
  assert.match(warmupTask, /Name => "Warm user settings cache"/);
  assert.match(warmupTask, /GetDefaultTriggers\(\) => \[\]/);
  assert.match(warmupTask, /GetUsers\(\)[\s\S]*?GetOrCreate[\s\S]*?progress\.Report/);
  assert.match(service, /policy\.AllowSourceSelection[\s\S]*?sourceIds\.Contains/);
  assert.match(service, /policy\.AllowPreferredGenres[\s\S]*?allowedGenres\.Contains/);
  assert.match(service, /submitted\.ExcludedGenres[\s\S]*?allowedGenres\.Contains[\s\S]*?!preferredGenres\.Contains/);
  assert.match(engine, /excludedGenres[\s\S]*?!ContainsAny\(item\.Genres, excludedGenres\)/);
  assert.match(service, /ResolveDefaults\(PluginConfiguration config, Guid userId\)[\s\S]*?Resolve\(config, userId, null\)/);
  assert.match(service, /if \(IsEmpty\(normalized\)\) _store\.Remove\(userId\)/);
  assert.match(service, /config\.RepeatCooldownDays \* 24[\s\S]*?saved\?\.RepeatCooldownHours[\s\S]*?saved\?\.RepeatCooldownDays/);
  assert.match(service, /submitted\.RepeatCooldownHours[\s\S]*?3650 \* 24/);
  assert.match(service, /config\.EnableBackgroundTrailers && display\?\.EnableBackgroundTrailers is not false/);
  assert.match(service, /config\.ShowRating && display\?\.ShowRating is not false/);
  assert.match(service, /submittedDisplay\.ShowDescription is false \? false : null/);
  assert.match(store, /userId\.ToString\("N"\)/);
  assert.match(store, /public int\? RepeatCooldownHours/);
  assert.match(store, /class FeaturedUserDisplayPreferences[\s\S]*?bool\? EnableBackgroundTrailers[\s\S]*?bool\? ShowRuntime/);
  assert.match(history, /GetRecentItems\(Guid userId, int cooldownHours\)[\s\S]*?AddHours\(-cooldownHours\)/);
  assert.match(response, /public bool PersonalizationEnabled \{ get; \}/);
  assert.match(response, /public int RepeatCooldownHours/);
  assert.match(response, /base\(config, personalization\)/);
  assert.match(itemFactory, /personalization\.Display\.EnableBackgroundTrailers[\s\S]*?Tagline = personalization\.Display\.ShowDescription[\s\S]*?OfficialRating = personalization\.Display\.ShowRating[\s\S]*?Overview = personalization\.Display\.ShowDescription[\s\S]*?CriticRating = personalization\.Display\.ShowRating/);
  assert.match(slideRender, /if \(response\.showDescription\)[\s\S]*?appendText\(content, 'ec-tagline'[\s\S]*?appendText\(content, 'ec-overview'/);
  assert.match(frontend, /body: \{ reset: true \}/);
  assert.match(frontend, /body: \{ preferences \}/);
  assert.match(frontend, /GenrePreferenceState = 'neutral' \| 'preferred' \| 'excluded'/);
  assert.match(frontend, /state === 'neutral' \? 'preferred' : state === 'preferred' \? 'excluded' : 'neutral'/);
  assert.doesNotMatch(frontend, /JellyfinFeatured\?\.refresh/);
  assert.match(frontend, /current\.defaults\.sourceEnabled/);
  assert.match(frontend, /featured\/preferences\/bootstrap/);
  assert.match(frontend, /bootstrapCacheLifetime = 5 \* 60_000/);
  assert.match(frontend, /export function preloadPreferencesDialog\(\)[\s\S]*?loadPreferencesBootstrap\(\)\.catch/);
  assert.match(frontend, /className = 'emby-checkbox'/);
  assert.match(frontend, /raised button-submit emby-button/);
  assert.match(frontend, /\[1, 'preferences\.cooldown\.1h'\]/);
  assert.match(frontend, /\[24, 'preferences\.cooldown\.24h'\]/);
  assert.match(frontend, /dataset\.cooldownHours = 'true'/);
  assert.match(frontend, /preferences\.repeatCooldownHours = value/);
  assert.match(frontend, /if \(!current\.defaults\.display\[key\]\) continue/);
  assert.match(frontend, /preferences\.display\[key\] = checked === current\.defaults\.display\[key\] \? null : checked/);
  assert.match(constants, /USER_PREFERENCES_CHANGED_EVENT = 'jellyfin-featured:preferences-changed'/);
  assert.match(frontend, /new CustomEvent\(USER_PREFERENCES_CHANGED_EVENT\)/);
  assert.equal((frontend.match(/notifyPreferencesChanged\(\)/g) ?? []).length, 3);
  assert.match(runtime, /addEventListener\(USER_PREFERENCES_CHANGED_EVENT, refreshForPreferenceChange\)/);
  assert.match(runtime, /function refreshForPreferenceChange[\s\S]*?instance\.destroy\(\)[\s\S]*?resetMountFailures\(\)[\s\S]*?scheduleScan\(\)/);
  assert.match(runtime, /const lifecycleChanged = mountToken !== lifecycleToken[\s\S]*?if \(lifecycleChanged[\s\S]*?scheduleScan\(\)/);
  assert.match(runtime, /removeEventListener\(USER_PREFERENCES_CHANGED_EVENT, refreshForPreferenceChange\)/);
  assert.match(navigation, /USER_PREFERENCES_SELECTOR[\s\S]*?#\/mypreferencesmenu/);
  assert.match(navigation, /settingsEntry\.after\(entry\)/);
  assert.match(navigation, /#myPreferencesMenuPage/);
  assert.match(navigation, /USER_SETTINGS_PAGE_LINK_ATTR[\s\S]*?section\.appendChild\(entry\)/);
  assert.match(navigation, /\.lnkHomePreferences/);
  assert.match(navigation, /openPreferencesDialog\(\)/);
  assert.match(navigation, /pointerenter', preloadPreferencesDialog, \{ once: true \}/);
  assert.match(navigation, /focus', preloadPreferencesDialog, \{ once: true \}/);
  assert.doesNotMatch(navigation, /section\.appendChild\(entry\);\s*preloadPreferencesDialog\(\)/);
  assert.match(navigation, /userSettingsEnabled = config\.personalizationEnabled/);
  assert.match(navigation, /function updateAdminNavigationEntry[\s\S]*?\.MuiListItemIcon-root[\s\S]*?createUserSettingsIcon\(\)/);
  assert.match(styles, /ec-preferences-spinner/);
  assert.match(styles, /env\(safe-area-inset-top\)/);
  assert.match(styles, /\.ec-preferences-dialog[^}]*--ec-dialog-viewport-height:\s*calc\(100vh - 2rem\)[^}]*height:\s*min\(52rem, var\(--ec-dialog-viewport-height\)\)[^}]*width:\s*64rem/);
  assert.match(styles, /@supports \(height: 100dvh\)[\s\S]*?--ec-dialog-viewport-height:\s*calc\(100dvh - 2rem\)/);
  assert.match(styles, /\.ec-preferences-content[^}]*flex: 1 1 auto/);
  assert.match(styles, /\.ec-preference-display[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 600px\)[\s\S]*?\.ec-preferences-dialog[^}]*width: 100%/);
  assert.match(styles, /@media \(max-width: 600px\)[\s\S]*?\.ec-preference-display,[\s\S]*?grid-template-columns:\s*1fr/);
  assert.doesNotMatch(carousel, /ec-personalize|openPreferencesDialog/);
});

test('source mixer constraints survive personalized source cloning', async () => {
  const service = await read('Jellyfin.Plugin.Featured/Api/FeaturedPersonalizationService.cs');
  for (const property of ['MinimumItems', 'MaximumItems', 'IsFallback']) {
    assert.match(service, new RegExp(`${property}\\s*=\\s*rule\\.${property}`));
  }
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
  assert.match(fingerprint, /Display/);
});

test('warm prepared responses reuse prebuilt DTOs and expose bypass diagnostics', async () => {
  const [preparedCache, itemsController, dtoFactory] = await Promise.all([
    read('Jellyfin.Plugin.Featured/Api/FeaturedPreparedCache.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedController.Items.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedItemDtoFactory.cs')
  ]);
  assert.match(preparedCache, /new Lazy<FeaturedItemDto>[\s\S]*?_itemDtoFactory\.Create\(item, user, config, personalization,/);
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

test('featured selection excludes samples and other video extras', async () => {
  const ruleEngine = await read('Jellyfin.Plugin.Featured/Api/FeaturedRuleEngine.Filters.cs');
  assert.match(ruleEngine, /IsSupportedItemType\(BaseItem item\)[\s\S]*?item\.ExtraType is null[\s\S]*?FeaturedMediaTypes\.Contains/);
  assert.match(ruleEngine, /SampleFileNameRegex[\s\S]*?Path\.GetFileNameWithoutExtension\(item\.Path\)[\s\S]*?SampleFileNameRegex\.IsMatch\(fileName\)/);
});
