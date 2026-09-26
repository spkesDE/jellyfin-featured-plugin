import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async (path) => await readFile(new URL(`../${path}`, import.meta.url), 'utf8');

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
  assert.match(runtime, /function refreshForPresetBoundary\(\): void \{\s*clearFeaturedCache\(\)/);
  assert.match(runtime, /function refreshForPreferenceChange\(\): void \{\s*clearFeaturedCache\(\)/);
});

test('rapid remounts reuse or join the same fresh response', async () => {
  const runtime = await read('src/runtime.ts');
  assert.match(runtime, /FRESH_RESPONSE_REUSE_MS = 30_000/);
  assert.match(runtime, /recentFreshResponse\?\.scope === scope[\s\S]*?FRESH_RESPONSE_REUSE_MS/);
  assert.match(runtime, /pendingFreshResponse\?\.scope === scope[\s\S]*?return pendingFreshResponse\.promise/);
  assert.match(runtime, /requestKind = requestedFreshScopes\.has\(requestScope\) \? 'remount' : 'initial'/);
  assert.match(runtime, /query: \{ requestKind \}/);
  assert.match(runtime, /function refreshForPresetBoundary[\s\S]*?clearFreshResponseMemory\(\)/);
  assert.match(runtime, /function refreshForPreferenceChange[\s\S]*?clearFreshResponseMemory\(\)/);
});

test('server timing distinguishes initial, remount, and batch requests', async () => {
  const controller = await read('Jellyfin.Plugin.Featured/Api/FeaturedController.Items.cs');
  assert.match(controller, /BuildItemsResponse\(ParseExcludedItemIds\(excludeItemIds\), NormalizeRequestKind\(requestKind\)\)/);
  assert.match(controller, /BuildItemsResponse\(excludedIds, "batch"\)/);
  assert.match(controller, /Featured request timing \(\{requestKind\.ToUpperInvariant\(\)\}\)/);
});
