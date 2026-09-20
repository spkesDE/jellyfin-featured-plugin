import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('favorite toggles update in place without remounting the featured carousel', async () => {
  const favorites = await read('src/slider/favorites.ts');
  assert.match(favorites, /UserFavoriteItems\/\$\{encodeURIComponent\(item\.id\)\}/);
  assert.match(favorites, /featured\/favorites\/changed/);
  assert.match(favorites, /item\.isFavorite = result\.IsFavorite \?\? next;[\s\S]*?updateButton\(button, item\.isFavorite\)/);
  assert.doesNotMatch(favorites, /USER_PREFERENCES_CHANGED_EVENT|dispatchEvent/);
});

test('favorite changes invalidate only the active user caches', async () => {
  const controller = await read('Jellyfin.Plugin.Featured/Api/FeaturedController.Items.cs');
  assert.match(controller, /_candidateCache\.RemoveUser\(activeUser\.Id\)/);
  assert.match(controller, /_preparedCache\.RemoveUser\(activeUser\.Id\)/);
  assert.doesNotMatch(controller, /FavoriteChanged[\s\S]*?_candidateCache\.Clear\(\)/);
  assert.doesNotMatch(controller, /FavoriteChanged[\s\S]*?_preparedCache\.Clear\(\)/);
});
