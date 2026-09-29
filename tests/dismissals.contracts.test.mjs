import assert from 'node:assert/strict';
import { readProjectSource as read } from './helpers/readProjectSource.mjs';
import test from 'node:test';

test('dismissals are authenticated, user-scoped, persistent, and cache-safe', async () => {
  const [controller, store, engine, prepared, services] = await Promise.all([
    read('Jellyfin.Plugin.Featured/Api/FeaturedController.Dismissals.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedDismissalStore.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedRuleEngine.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedPreparedCache.cs'),
    read('Jellyfin.Plugin.Featured/PluginServiceRegistrator.cs')
  ]);
  for (const route of ['dismissals', 'dismissals/undo', 'dismissals/reset']) {
    assert.match(controller, new RegExp(`Http(?:Get|Post)\\(\"${route}\"\\)[\\s\\S]*?\\[Authorize\\]`));
  }
  assert.match(controller, /GetActiveUser\(\)[\s\S]*?_config\.DismissalPolicy\.Enabled/);
  assert.match(controller, /IsVisibleStandalone\(activeUser\)/);
  assert.match(controller, /_preparedCache\.RemoveUser\(userId\)[\s\S]*?_preparedCache\.QueueUserRefresh\(userId\)/);
  assert.match(store, /dismissals\.json/);
  assert.match(store, /userId\.ToString\("N"\)/);
  assert.match(
    store,
    /FeaturedDismissalScopes\.Title[\s\S]*?FeaturedDismissalScopes\.Series[\s\S]*?FeaturedDismissalScopes\.Franchise/
  );
  assert.match(engine, /filteredCandidates[\s\S]*?!dismissals\.IsDismissed\(item\)[\s\S]*?FillFromPools/);
  assert.match(prepared, /GetConfigurationFingerprint\(config, personalization, dismissalSnapshot\)/);
  assert.match(prepared, /personalization\.Fingerprint \+ dismissals\.Fingerprint/);
  assert.match(services, /AddSingleton<FeaturedDismissalStore>/);
});

test('dismissal UI offers metadata-aware scopes, undo, and settings management', async () => {
  const [render, dismissals, styles, userTab, displayTab, preview, defaults, runtime] = await Promise.all([
    read('src/slider/render.ts'),
    read('src/slider/dismissals.ts'),
    read('src/styles/featured.css'),
    read('src/config/tabs/UserProfilesTab.vue'),
    read('src/config/tabs/DisplayTab.vue'),
    read('src/config/components/BannerPreview.vue'),
    read('src/config/libs/defaults.ts'),
    read('src/runtime.ts')
  ]);
  assert.match(render, /dismissalOptions[\s\S]*?createDismissalControl/);
  assert.match(dismissals, /requestJson<FeaturedDismissalMutationResponse>\('featured\/dismissals'/);
  assert.match(dismissals, /requestJson\('featured\/dismissals\/undo'/);
  assert.match(dismissals, /carousel\.dismissSeries[\s\S]*?carousel\.dismissFranchise/);
  assert.match(dismissals, /USER_PREFERENCES_CHANGED_EVENT/);
  assert.match(render, /createDismissalControl\(item, 'metadata'\)[\s\S]*?createDismissalControl\(item\)/);
  assert.match(render, /dismissalButtonPlacement === 'metadata'[\s\S]*?dismissalButtonPlacement === 'actions'/);
  assert.match(
    dismissals,
    /button-flat detailButton emby-button featured-dismissal-button featured-dismissal-button-meta/
  );
  assert.match(dismissals, /button\.style\.color = 'var\(--featured-on-media-color, #fff\)'/);
  assert.match(dismissals, /featured-button featured-button-secondary featured-dismissal-button raised emby-button/);
  assert.match(dismissals, /detailButton-icon visibility_off/);
  assert.match(
    dismissals,
    /actionSheet actionsheet-not-fullscreen[\s\S]*?listItem listItem-button actionSheetMenuItem emby-button/
  );
  assert.match(dismissals, /toast toastVisible[\s\S]*?button-link emby-button/);
  assert.doesNotMatch(styles, /\.featured-dismiss-(?:menu|toast|control|option)|\.featured-icon-button/);
  assert.match(
    userTab,
    /DismissalPolicy\.Enabled[\s\S]*?DismissalPolicy\.AllowTitle[\s\S]*?DismissalPolicy\.AllowSeries[\s\S]*?DismissalPolicy\.AllowFranchise/
  );
  assert.doesNotMatch(userTab, /ShowDismissalButton|DismissalButtonPlacement/);
  assert.match(displayTab, /ShowDismissalButton[\s\S]*?DismissalButtonPlacement[\s\S]*?placementOptions/);
  assert.match(preview, /DismissalButtonPlacement === 'metadata'[\s\S]*?DismissalButtonPlacement === 'actions'/);
  assert.match(defaults, /ShowDismissalButton: true[\s\S]*?DismissalButtonPlacement: 'metadata'/);
  assert.match(defaults, /DismissalPolicy:[\s\S]*?Enabled: true[\s\S]*?AllowTitle: true/);
  assert.match(runtime, /response\.personalizationEnabled \|\| response\.dismissalsEnabled/);
});
