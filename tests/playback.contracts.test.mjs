import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async (path) => await readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('hero play action resolves video progress and starts native Jellyfin playback', async () => {
  const [render, playback, english, german] = await Promise.all([
    read('src/slider/render.ts'),
    read('src/slider/playback.ts'),
    read('src/i18n/locales/en.json'),
    read('src/i18n/locales/de.json')
  ]);

  assert.match(render, /createPlaybackButton\(item, response\.playButtonText\)/);
  assert.match(playback, /Users\/\$\{encodeURIComponent\(userId\)\}\/Items\/\$\{encodeURIComponent\(item\.id\)\}/);
  assert.match(playback, /PlaybackPositionTicks/);
  assert.match(playback, /dataset\.action = target\.positionTicks > 0 \? 'resume' : 'play'/);
  assert.match(playback, /dataset\.positionticks = String\(target\.positionTicks\)/);
  assert.match(playback, /className = 'itemAction ec-native-playback-action'/);
  assert.match(playback, /new MouseEvent\('click', \{ bubbles: true, cancelable: true, view: window \}\)/);
  assert.match(english, /"carousel\.resume": "Resume"/);
  assert.match(german, /"carousel\.resume": "Fortsetzen"/);
});

test('series play action resolves an in-progress or next episode with a replay fallback', async () => {
  const playback = await read('src/slider/playback.ts');
  assert.match(playback, /item\.mediaType === 'Series'[\s\S]*?resolveSeriesTarget/);
  assert.match(playback, /requestJson<JellyfinQueryResult>\('Shows\/NextUp', \{ query \}\)/);
  assert.match(playback, /enableResumable: true/);
  assert.match(playback, /Shows\/\$\{encodeURIComponent\(item\.id\)\}\/Episodes/);
  assert.match(playback, /isMissing: false[\s\S]*?isVirtualUnaired: false/);
});

test('playback button refreshes state for remote focus and keeps details as a safe fallback', async () => {
  const playback = await read('src/slider/playback.ts');
  assert.match(playback, /addEventListener\('focus', \(\) => void refresh\(true\)/);
  assert.match(playback, /addEventListener\('pointerdown', \(\) => void refresh\(true\)/);
  assert.match(playback, /target\.positionTicks > 0[\s\S]*?carousel\.resume/);
  assert.match(playback, /if \(!dispatchNativePlayback\(target\)\) openItemDetails\(target\.id\)/);
  assert.match(playback, /catch \(error\)[\s\S]*?openItemDetails\(item\.id\)/);
});
