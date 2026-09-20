import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async (path) => await readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('API failures expose HTTP status instead of object stringification', async () => {
  const apiClient = await read('src/core/apiClient.ts');
  assert.match(apiClient, /catch \(error\)[\s\S]*?createRequestError\(path, error\)/);
  assert.match(apiClient, /statusPart[\s\S]*?HTTP \$\{status\}/);
  assert.match(apiClient, /parseErrorDetail\(body\)/);
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

test('DOM observation cannot trigger destructive remount scans', async () => {
  const runtime = await read('src/runtime.ts');
  assert.match(runtime, /trackedMountNeedsRecovery\(\) \|\| \(!hasTrackedMount && mutations\.some\(mutationAffectsHome\)\)/);
  assert.match(runtime, /\(removeInactive && !isActiveHomeContainer\(container\)\)/);
  assert.match(runtime, /\.\.\.mutation\.addedNodes, \.\.\.mutation\.removedNodes/);
  assert.match(runtime, /rootWasUnexpectedlyRemoved[\s\S]*?recordMountFailure\(\)/);
  assert.match(runtime, /Math\.min\(300_000, 10_000 \* \(3 \*\*/);
  assert.doesNotMatch(runtime, /if \(relevantChange\) scheduleFullRefresh\(\);/);
});
