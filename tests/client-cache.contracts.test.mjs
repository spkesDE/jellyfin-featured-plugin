import assert from 'node:assert/strict';
import { readProjectSource as read } from './helpers/readProjectSource.mjs';
import test from 'node:test';

test('startup cache is scoped, bounded, expiring, and storage-safe', async () => {
  const cache = await read('src/core/featuredCache.ts');
  assert.match(cache, /getCurrentUserId\(\)/);
  assert.match(cache, /serverId\?\.\(\) \|\| window\.location\.origin/);
  assert.match(cache, /CACHE_ITEM_LIMIT = 5/);
  assert.match(cache, /CACHE_MAX_AGE_MS = 24 \* 60 \* 60 \* 1000/);
  assert.match(cache, /Math\.min\(maximumExpiry, presetBoundary\)/);
  assert.match(cache, /items: response\.items\.slice\(0, CACHE_ITEM_LIMIT\)/);
  assert.match(cache, /entry\.pluginVersion === PLUGIN_VERSION/);
  assert.match(cache, /localStorage\.getItem[\s\S]*?catch/);
  assert.match(cache, /localStorage\.setItem[\s\S]*?catch/);
});

test('cached items paint before revalidation and preserve the visible item', async () => {
  const [runtime, cache, carousel] = await Promise.all([
    read('src/runtime.ts'),
    read('src/core/featuredCache.ts'),
    read('src/slider/carousel.ts')
  ]);
  assert.match(runtime, /const freshResponse = getFreshFeaturedResponse\(\);[\s\S]*?readFeaturedCache\(\)/);
  assert.match(runtime, /attachCarousel\(container, cachedCarousel, cachedResponse\)[\s\S]*?await freshResponse/);
  assert.match(runtime, /saveFeaturedCache\(response\)/);
  assert.match(runtime, /cachedCarousel\?\.getActiveItem\(\)[\s\S]*?keepCurrentItem\(response, currentItem\)/);
  assert.match(cache, /freshCurrentItem[\s\S]*?filter\(\(item\) => item\.id !== currentItem\.id\)/);
  assert.match(carousel, /getActiveItem\(\): FeaturedItem \| undefined/);
  assert.match(runtime, /createCarousel\(displayResponse, currentItem\?\.id\)/);
});

test('startup cache is invalidated for preferences and preset boundaries', async () => {
  const runtime = await read('src/runtime.ts');
  assert.match(runtime, /refreshForPresetBoundary[\s\S]*?resetMountedContent\(false\)/);
  assert.match(runtime, /refreshForPreferenceChange[\s\S]*?resetMountedContent\(true\)/);
  assert.match(
    runtime,
    /function resetMountedContent[\s\S]*?clearFeaturedCache\(\)[\s\S]*?clearFreshResponseMemory\(\)/
  );
});

test('rapid remounts reuse or join the same fresh response', async () => {
  const runtime = await read('src/runtime.ts');
  assert.match(runtime, /new FreshResponseCache<FeaturedResponse>\([\s\S]*?30_000/);
  assert.match(runtime, /this\.recent\?\.scope === scope[\s\S]*?this\.reuseMilliseconds/);
  assert.match(runtime, /this\.pending\?\.scope === scope[\s\S]*?return this\.pending\.promise/);
  assert.match(
    runtime,
    /requestKind: FreshRequestKind = this\.requestedScopes\.has\(requestScope\) \? 'remount' : 'initial'/
  );
  assert.match(runtime, /query: \{ requestKind \}/);
  assert.match(runtime, /resetMountedContent[\s\S]*?clearFreshResponseMemory\(\)/);
});

test('server timing distinguishes initial, remount, and batch requests', async () => {
  const controller = await read('Jellyfin.Plugin.Featured/Api/FeaturedController.Items.cs');
  assert.match(
    controller,
    /BuildItemsResponse\(ParseExcludedItemIds\(excludeItemIds\), NormalizeRequestKind\(requestKind\)\)/
  );
  assert.match(controller, /BuildItemsResponse\(excludedIds, "batch"\)/);
  assert.match(controller, /Featured request timing \(\{requestKind\.ToUpperInvariant\(\)\}\)/);
});
