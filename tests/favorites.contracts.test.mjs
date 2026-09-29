import assert from 'node:assert/strict';
import { readProjectSource as read } from './helpers/readProjectSource.mjs';
import test from 'node:test';

test('favorite toggles update in place without remounting the featured carousel', async () => {
  const favorites = await read('src/slider/favorites.ts');
  assert.match(favorites, /UserFavoriteItems\/\$\{encodeURIComponent\(item\.id\)\}/);
  assert.match(favorites, /featured\/favorites\/changed/);
  assert.match(
    favorites,
    /item\.isFavorite = result\.IsFavorite \?\? next;[\s\S]*?updateButton\(button, item\.isFavorite\)/
  );
  assert.doesNotMatch(favorites, /USER_PREFERENCES_CHANGED_EVENT|dispatchEvent/);
});

test('favorite changes invalidate only the active user caches', async () => {
  const controller = await read('Jellyfin.Plugin.Featured/Api/FeaturedController.Items.cs');
  assert.match(controller, /_candidateCache\.RemoveUser\(activeUser\.Id\)/);
  assert.match(controller, /_preparedCache\.RemoveUser\(activeUser\.Id\)/);
  assert.doesNotMatch(controller, /FavoriteChanged[\s\S]*?_candidateCache\.Clear\(\)/);
  assert.doesNotMatch(controller, /FavoriteChanged[\s\S]*?_preparedCache\.Clear\(\)/);
});

test('favorite control supports compact metadata and standalone action placement', async () => {
  const [render, favorites, styles] = await Promise.all([
    read('src/slider/render.ts'),
    read('src/slider/favorites.ts'),
    read('src/styles/featured.css')
  ]);

  assert.match(render, /metadata\.appendChild\(createFavoriteButton\(item, 'metadata'\)\)/);
  assert.match(render, /favoriteButtonPlacement === 'metadata'/);
  assert.match(render, /favoriteButtonPlacement === 'actions'/);
  assert.match(render, /actions\.appendChild\(createFavoriteButton\(item, 'action'\)\)/);
  assert.match(favorites, /featured-favorite-button-meta/);
  assert.match(favorites, /favorite \? '#ff4058' : 'var\(--featured-on-media-color, #fff\)'/);
  assert.match(favorites, /icon\.style\.fontSize = '1\.35rem'/);
  assert.doesNotMatch(favorites, /icon\.textContent/);
  assert.match(
    styles,
    /\.featured-root\.featured-ready\.featured-hero \.featured-slide\.is-active \.featured-favorite-button-meta,[\s\S]*?pointer-events:\s*auto/
  );
  assert.match(
    styles,
    /\.featured-root \.featured-meta\s*>\s*button\.featured-favorite-button-meta,[\s\S]*?margin:\s*0 !important;[\s\S]*?padding:\s*0?\.15rem !important/
  );
  assert.match(
    styles,
    /button\.featured-favorite-button-meta:hover,[\s\S]*?button\.featured-playstate-button-meta:hover/
  );
});
