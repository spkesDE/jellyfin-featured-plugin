import assert from 'node:assert/strict';
import { readProjectSource as read } from './helpers/readProjectSource.mjs';
import test from 'node:test';

test('played toggle uses Jellyfin playstate markup and updates in place', async () => {
  const [render, playstate, styles] = await Promise.all([
    read('src/slider/render.ts'),
    read('src/slider/playstate.ts'),
    read('src/styles/featured.css')
  ]);

  assert.match(render, /metadata\.appendChild\(createPlaystateButton\(item, 'metadata'\)\)/);
  assert.match(render, /playstateButtonPlacement === 'actions'/);
  assert.match(render, /actions\.appendChild\(createPlaystateButton\(item, 'action'\)\)/);
  assert.match(playstate, /emby-playstatebutton/);
  assert.match(playstate, /button-flat btnPlaystate detailButton emby-button/);
  assert.match(playstate, /UserPlayedItems\/\$\{encodeURIComponent\(item\.id\)\}/);
  assert.match(playstate, /item\.isPlayed = result\.Played \?\? next;[\s\S]*?updateButton\(button, item\.isPlayed\)/);
  assert.match(
    playstate,
    /featured-playstate-button-meta[\s\S]*?--featured-playstate-active-color, #52b54b[\s\S]*?--featured-on-media-color, #fff/
  );
  assert.match(playstate, /featured\/playstate\/changed/);
  assert.match(
    styles,
    /\.featured-playstate-button\[aria-pressed=['"]true['"]\][\s\S]*?color:\s*var\(--featured-playstate-active-color, #52b54b\)/
  );
});

test('favorite toggle uses Jellyfin rating button markup', async () => {
  const favorites = await read('src/slider/favorites.ts');
  assert.match(favorites, /emby-ratingbutton/);
  assert.match(favorites, /button-flat btnUserRating detailButton emby-button/);
  assert.match(favorites, /detailButton-content/);
  assert.match(favorites, /detailButton-icon favorite/);
});

test('playstate changes invalidate only the active user caches', async () => {
  const controller = await read('Jellyfin.Plugin.Featured/Api/FeaturedController.Items.cs');
  assert.match(controller, /PlaystateChanged[\s\S]*?_candidateCache\.RemoveUser\(activeUser\.Id\)/);
  assert.match(controller, /PlaystateChanged[\s\S]*?_preparedCache\.RemoveUser\(activeUser\.Id\)/);
  assert.doesNotMatch(controller, /PlaystateChanged[\s\S]*?_candidateCache\.Clear\(\)/);
  assert.doesNotMatch(controller, /PlaystateChanged[\s\S]*?_preparedCache\.Clear\(\)/);
});
