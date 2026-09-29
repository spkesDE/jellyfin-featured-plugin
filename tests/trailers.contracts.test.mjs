import assert from 'node:assert/strict';
import { readProjectSource as read } from './helpers/readProjectSource.mjs';
import test from 'node:test';

test('persisted trailer settings and serialized responses retain their public contract', async () => {
  const [configuration, normalizer, resolver, response, trailerTab, displayTab, styles] = await Promise.all([
    read('Jellyfin.Plugin.Featured/Configuration/PluginConfiguration.cs'),
    read('Jellyfin.Plugin.Featured/Configuration/PluginConfigurationNormalizer.cs'),
    read('Jellyfin.Plugin.Featured/Api/TrailerResolver.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedResponseDtos.cs'),
    read('src/config/tabs/TrailersTab.vue'),
    read('src/config/tabs/DisplayTab.vue'),
    read('src/styles/featured.css')
  ]);
  for (const setting of [
    'TrailerSourcePriority',
    'StartTrailersMuted',
    'ShowTrailerControls',
    'HideYouTubeTrailerUntilControlsFade',
    'WaitForTrailerToFinish',
    'TrailerDelayMilliseconds',
    'TrailerStartOffsetSeconds',
    'TrailerEndOffsetSeconds',
    'MultipleTrailerMode',
    'AllowTrailersOnMobile',
    'TrailerOverrides'
  ]) {
    assert.equal(configuration.includes(setting), true, `backend misses ${setting}`);
    const editor = setting === 'ShowTrailerControls' ? displayTab : trailerTab;
    assert.equal(editor.includes(`store.config.${setting}`), true, `settings editor misses ${setting}`);
  }
  assert.equal(configuration.includes('TrailerVolumeSliderDirection'), true);
  assert.doesNotMatch(trailerTab, /TrailerVolumeSliderDirection|trailers\.volumeDirection/);
  assert.doesNotMatch(displayTab, /TrailerVolumeSliderDirection|trailers\.volumeDirection/);
  assert.match(normalizer, /NormalizeTrailerUrl[\s\S]*?Uri\.UriSchemeHttp[\s\S]*?Uri\.UriSchemeHttps/);
  assert.match(resolver, /LocalOnly:[\s\S]*?AddRange\(local\)[\s\S]*?RemoteOnly:[\s\S]*?AddRange\(remote\)/);
  assert.match(resolver, /provider = videoId is not null[\s\S]*?"youtube"[\s\S]*?"direct"[\s\S]*?"external"/);
  assert.match(response, /public FeaturedTrailerDto\? Trailer \{ get; init; \}/);
  assert.match(response, /IReadOnlyList<FeaturedTrailerDto>\? Trailers \{ get; init; \}/);
  assert.doesNotMatch(response, /LocalTrailerId/);
  assert.doesNotMatch(resolver, /config\.FallBackToRemoteTrailers/);
  assert.match(configuration, /FallBackToRemoteTrailers/);
  assert.doesNotMatch(styles, /slider-vertical/);
  assert.match(
    styles,
    /\.featured-volume-up \.featured-trailer-volume,[\s\S]*?direction:\s*rtl;[\s\S]*?writing-mode:\s*vertical-lr/
  );
});

// These are browser/API integration boundaries rather than private implementation details:
// YT.Player must not race the iframe load, and only item-specific errors may skip a candidate.
test('YouTube player creation remains load-gated and video errors stay item-specific', async () => {
  const player = await read('src/slider/trailer.ts');
  assert.match(
    player,
    /iframe\.addEventListener\(\s*'load'[\s\S]*?this\.player = new api\.Player\(iframe[\s\S]*?this\.element\.appendChild\(iframe\)/
  );
  assert.match(player, /YOUTUBE_ITEM_SPECIFIC_ERRORS = new Set\(\[2, 100, 101, 150\]\)/);
  assert.match(
    player,
    /YOUTUBE_ITEM_SPECIFIC_ERRORS\.has\(data\)[\s\S]*?this\.fail\(options, error\)[\s\S]*?recover\(error\)/
  );
});
