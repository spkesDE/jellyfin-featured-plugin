import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async (path) => await readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('proper trailer support keeps resolution and playback source independent', async () => {
  const [configuration, normalizer, resolver, response, player, carousel, render, trailerTab, styles] = await Promise.all([
    read('Jellyfin.Plugin.Featured/Configuration/PluginConfiguration.cs'),
    read('Jellyfin.Plugin.Featured/Configuration/PluginConfigurationNormalizer.cs'),
    read('Jellyfin.Plugin.Featured/Api/TrailerResolver.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedResponseDtos.cs'),
    read('src/slider/trailer.ts'),
    read('src/slider/carousel.ts'),
    read('src/slider/render.ts'),
    read('src/config/tabs/TrailersTab.vue'),
    read('src/styles/featured.css')
  ]);
  for (const setting of [
    'TrailerSourcePriority', 'StartTrailersMuted', 'ShowTrailerControls', 'TrailerVolumeSliderDirection',
    'HideYouTubeTrailerUntilControlsFade',
    'WaitForTrailerToFinish', 'TrailerDelayMilliseconds', 'TrailerStartOffsetSeconds',
    'TrailerEndOffsetSeconds', 'MultipleTrailerMode', 'AllowTrailersOnMobile', 'TrailerOverrides'
  ]) {
    assert.equal(configuration.includes(setting), true, `backend misses ${setting}`);
    assert.equal(trailerTab.includes(`store.config.${setting}`), true, `trailer editor misses ${setting}`);
  }
  assert.match(normalizer, /NormalizeTrailerUrl[\s\S]*?Uri\.UriSchemeHttp[\s\S]*?Uri\.UriSchemeHttps/);
  assert.match(resolver, /ResolveManual\(manual, activeUser\)[\s\S]*?if \(manualTrailer is not null\) candidates\.Add\(manualTrailer\)/);
  assert.match(resolver, /LocalOnly:[\s\S]*?AddRange\(local\)[\s\S]*?RemoteOnly:[\s\S]*?AddRange\(remote\)/);
  assert.match(resolver, /provider = videoId is not null[\s\S]*?"youtube"[\s\S]*?"direct"[\s\S]*?"external"/);
  assert.match(response, /public FeaturedTrailerDto\? Trailer \{ get; init; \}/);
  assert.match(response, /IReadOnlyList<FeaturedTrailerDto>\? Trailers \{ get; init; \}/);
  assert.match(resolver, /ResolveCandidates[\s\S]*?DistinctBy\(GetCandidateKey/);
  assert.match(resolver, /PreferRemote[\s\S]*?candidates\.AddRange\(remote\)[\s\S]*?candidates\.AddRange\(local\)/);
  assert.match(resolver, /default:\s*candidates\.AddRange\(local\);\s*candidates\.AddRange\(remote\);/);
  assert.doesNotMatch(resolver, /config\.FallBackToRemoteTrailers/);
  assert.doesNotMatch(trailerTab, /FallBackToRemoteTrailers|trailers\.remoteFallback/);
  assert.match(normalizer, /config\.FallBackToRemoteTrailers == false[\s\S]*?config\.TrailerSourcePriority = FeaturedTrailerSourcePriorities\.LocalOnly/);
  assert.match(normalizer, /trailers\.FallBackToRemoteTrailers == false[\s\S]*?trailers\.TrailerSourcePriority = FeaturedTrailerSourcePriorities\.LocalOnly/);
  assert.doesNotMatch(response, /LocalTrailerId/);
  for (const adapter of ['JellyfinLocalPlayer', 'YouTubePlayer', 'DirectVideoPlayer', 'ExternalPlayer']) {
    assert.match(player, new RegExp(`class ${adapter}`));
  }
  assert.doesNotMatch(player, /youtube[\s\S]{0,120}\.mp4/i);
  assert.match(carousel, /waitForTrailerToFinish[\s\S]*?pauseTimer\(\)/);
  assert.match(carousel, /trailerDelayMilliseconds/);
  assert.match(carousel, /trailerItemId === item\.id[\s\S]*?this\.stopTrailer\(\)/);
  assert.match(player, /pause\(\): Promise<void>[\s\S]*?setMuted\(muted: boolean\): Promise<void>[\s\S]*?setVolume\(volume: number\): Promise<void>/);
  assert.match(carousel, /event\.key\.toLowerCase\(\) === 'm'[\s\S]*?toggleTrailerMuted\(\)/);
  assert.match(carousel, /ec-trailer-mute[\s\S]*?toggleTrailerMuted\(\)/);
  assert.match(carousel, /updateTrailerControls[\s\S]*?volume_off[\s\S]*?volume_up/);
  assert.match(carousel, /toggleTrailerMuted[\s\S]*?setMuted\(this\.trailerMuted\)/);
  assert.match(carousel, /ec-trailer-pause[\s\S]*?toggleTrailerPaused\(\)/);
  assert.match(carousel, /toggleTrailerPaused[\s\S]*?trailerPlayer\.pause\(\)[\s\S]*?trailerPlayer\.play\(\)/);
  assert.match(carousel, /event\.code !== 'Space'[\s\S]*?toggleTrailerPaused\(\)/);
  assert.match(carousel, /type = 'range'[\s\S]*?min = '0'[\s\S]*?max = '100'[\s\S]*?setTrailerVolume/);
  assert.match(carousel, /ec-trailer-volume-control ec-volume-[\s\S]*?appendChild\(this\.trailerMuteButton\)[\s\S]*?ec-trailer-volume-popover[\s\S]*?appendChild\(this\.trailerVolumeInput\)/);
  assert.match(carousel, /if \(controls\.childElementCount\) navigation\.appendChild\(controls\);[\s\S]*?navigation\.appendChild\(dots\);[\s\S]*?if \(this\.trailerControls\) navigation\.appendChild\(this\.trailerControls\)/);
  assert.match(styles, /\.ec-trailer-controls\[hidden\][^}]*display:\s*none/);
  assert.match(styles, /\.ec-trailer-volume-popover\s*\{[^}]*position:\s*absolute/);
  assert.match(styles, /\.ec-volume-side \.ec-trailer-volume-popover[\s\S]*?\.ec-volume-up \.ec-trailer-volume-popover[\s\S]*?\.ec-volume-down \.ec-trailer-volume-popover/);
  assert.match(styles, /\.ec-trailer-volume-control:hover \.ec-trailer-volume-popover,[\s\S]*?pointer-events:\s*auto/);
  assert.match(styles, /\.ec-trailer-volume\s*\{[^}]*width:\s*7rem/);
  assert.match(normalizer, /NormalizeTrailerVolumeSliderDirection[\s\S]*?value is "up" or "down" \? value : "side"/);
  assert.match(carousel, /event\.key === '\+' \|\| event\.code === 'NumpadAdd'[\s\S]*?event\.key === '-' \|\| event\.code === 'NumpadSubtract'[\s\S]*?setTrailerVolume\(this\.trailerVolume \+ \(direction \* 10\)\)/);
  assert.match(carousel, /private setTrailerVolume[\s\S]*?setVolume\(this\.trailerVolume\)/);
  assert.match(carousel, /closest\('input, textarea, select, button,[\s\S]*?\[role="dialog"\]'/);
  assert.match(carousel, /restartTimer[\s\S]*?this\.trailerPaused/);
  assert.match(carousel, /YOUTUBE_CONTROL_CONCEALMENT_MS = 5000/);
  assert.match(carousel, /provider === 'youtube'[\s\S]*?hideYouTubeTrailerUntilControlsFade/);
  assert.match(carousel, /addEventListener\('keydown', this\.onTrailerHotkey, true\)/);
  assert.match(carousel, /onReveal:[\s\S]*?classList\.remove\('ec-youtube-trailer-concealed'\)[\s\S]*?classList\.add\('ec-trailer-active'\)/);
  assert.match(carousel, /launchDelayMilliseconds = concealYouTube \|\| candidateIndex > 0 \? 0 : this\.response\.trailerDelayMilliseconds/);
  assert.match(carousel, /Math\.max\(YOUTUBE_CONTROL_CONCEALMENT_MS, this\.response\.trailerDelayMilliseconds\)/);
  assert.match(carousel, /muted: concealYouTube \? true : this\.trailerMuted/);
  assert.match(player, /concealDurationMilliseconds[\s\S]*?setTimeout[\s\S]*?onReveal/);
  assert.match(player, /onConcealStart\?\.\(duration\)/);
  assert.match(carousel, /startTrailerCountdown\(durationMilliseconds\)[\s\S]*?setInterval\(update, 100\)/);
  assert.match(carousel, /createElementNS\('http:\/\/www\.w3\.org\/2000\/svg', 'svg'\)[\s\S]*?pathLength[\s\S]*?countdownRing\.append/);
  assert.match(styles, /\.ec-countdown-ring[\s\S]*?\.ec-countdown-progress[\s\S]*?stroke-dasharray:\s*100/);
  assert.doesNotMatch(carousel, /trailerCountdownLabel|Math\.ceil\(remaining \/ 1000\)/);
  assert.doesNotMatch(styles, /ec-trailer-countdown/);
  assert.match(styles, /\.ec-youtube-trailer-concealed[\s\S]*?opacity:\s*0/);
  assert.match(render, /className = 'ec-media'[\s\S]*?media\.appendChild\(backdrop\)[\s\S]*?slide\.appendChild\(media\)/);
  assert.match(carousel, /querySelectorAll\('\.ec-media > \.ec-trailer'\)/);
  assert.match(carousel, /classList\.add\('ec-trailer-active'\)[\s\S]*?classList\.remove\('ec-trailer-active'\)/);
  assert.match(styles, /\.ec-trailer\s*\{[\s\S]*?height:\s*max\(100%, 56\.25vw\)[\s\S]*?min-width:\s*100vw[\s\S]*?translate\(-50%, -50%\)/);
  assert.match(styles, /\.ec-trailer\s*\{[\s\S]*?pointer-events:\s*none/);
  assert.match(styles, /--ec-hero-slide-background:\s*linear-gradient\(to bottom,[^;]*#000 54%[^;]*transparent 80%/);
  assert.match(styles, /\.ec-root\.ec-hero \.ec-slide\s*\{[^}]*background:\s*var\(--ec-hero-slide-background\)/);
  assert.match(styles, /\.ec-media\s*\{[^}]*height:\s*var\(--ec-height\)[^}]*inset:\s*0[^}]*position:\s*absolute[^}]*width:\s*100%/);
  assert.match(styles, /--ec-hero-media-mask:\s*linear-gradient\(to bottom,[^;]*#000 18%[^;]*transparent 85%/);
  assert.match(styles, /\.ec-root\.ec-hero \.ec-media\s*\{[^}]*-webkit-mask-image:\s*var\(--ec-hero-media-mask\)[^}]*mask-image:\s*var\(--ec-hero-media-mask\)/);
  assert.match(styles, /\.ec-root\.ec-hero \.ec-slide::after\s*\{[^}]*-webkit-mask-image:\s*var\(--ec-hero-media-mask\)[^}]*mask-image:\s*var\(--ec-hero-media-mask\)/);
  assert.match(styles, /\.ec-slide\.ec-trailer-active \.ec-backdrop\s*\{[\s\S]*?opacity:\s*0/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?--ec-hero-slide-background:\s*linear-gradient\(0deg/);
  assert.doesNotMatch(styles, /\.ec-backdrop::after/);
  assert.match(player, /target\.getIframe\(\)[\s\S]*?tabIndex = -1[\s\S]*?aria-hidden/);
  assert.match(player, /youtube-nocookie\.com'[\s\S]*?youtube\.com'/);
  assert.match(player, /origin: window\.location\.origin/);
  assert.match(player, /cc_load_policy:\s*0/);
  assert.match(player, /setOption\('captions', 'track', \{\}\)/);
  assert.match(player, /class DirectVideoPlayer[\s\S]*?super\(url, options, true\)/);
  assert.match(player, /textTracks\.addEventListener\('addtrack', this\.disableTextTracks\)/);
  assert.match(player, /hostIndex === 0 \? 2500 : 8000/);
  assert.match(player, /hostIndex \+ 1 < YOUTUBE_HOSTS\.length[\s\S]*?startPlayer\(api, videoId, options, hostIndex \+ 1\)/);
  assert.match(player, /defaultMuted = options\.muted[\s\S]*?setAttribute\('webkit-playsinline', ''\)/);
  assert.match(player, /setAttribute\('allow', 'autoplay; encrypted-media; picture-in-picture'\)/);
  assert.match(carousel, /this\.trailerMuted = response\.startTrailersMuted \|\| this\.trailerVolume === 0/);
  assert.doesNotMatch(carousel, /isIosTrailerClient\(\)/);
  assert.match(carousel, /onReveal:[\s\S]*?player\.setMuted\(this\.trailerMuted\)/);
  assert.match(player, /YOUTUBE_API_TIMEOUT_MS = 8_000[\s\S]*?YouTube player API timed out[\s\S]*?YOUTUBE_API_TIMEOUT_MS/);
  assert.match(player, /onError: \(\{ data \}\)[\s\S]*?YouTube trailer failed with player error/);
  assert.match(carousel, /item\.trailers\?\.length[\s\S]*?candidateIndex \+ 1 < candidates\.length[\s\S]*?startTrailer\(slide, item, candidateIndex \+ 1\)/);
  assert.match(carousel, /void player\.play\(\)\.catch\(recover\)/);
  assert.match(player, /addEventListener\('waiting', this\.armPlaybackWatchdog\)[\s\S]*?addEventListener\('stalled', this\.armPlaybackWatchdog\)/);
  assert.match(player, /addEventListener\('error', this\.handleMediaError\)[\s\S]*?addEventListener\('abort', this\.handleMediaError\)/);
  assert.match(player, /Trailer playback stalled[\s\S]*?8000/);
  assert.match(player, /destroyed \|\| this\.failed[\s\S]*?this\.onError\(error\)/);
});
test('trailer volume survives reloads and restricted storage contexts', async () => {
  const carousel = await read('src/slider/carousel.ts');
  assert.match(carousel, /TRAILER_VOLUME_STORAGE_KEY = 'jellyfin-featured\.trailer-volume'/);
  assert.match(carousel, /function readTrailerVolume[\s\S]*?localStorage\.getItem[\s\S]*?catch[\s\S]*?DEFAULT_TRAILER_VOLUME/);
  assert.match(carousel, /function saveTrailerVolume[\s\S]*?localStorage\.setItem[\s\S]*?catch/);
  assert.match(carousel, /this\.trailerVolume = readTrailerVolume\(\)/);
  assert.match(carousel, /this\.trailerVolume = 10[\s\S]*?saveTrailerVolume\(this\.trailerVolume\)/);
  assert.match(carousel, /setTrailerVolume\(this\.trailerVolume \+ \(direction \* 10\)\)/);
  assert.match(carousel, /private setTrailerVolume[\s\S]*?saveTrailerVolume\(this\.trailerVolume\)/);
});

test('YouTube player creation remains load-gated and video errors stay item-specific', async () => {
  const player = await read('src/slider/trailer.ts');
  const appendIndex = player.indexOf('this.element.appendChild(iframe)');
  const loadIndex = player.indexOf("iframe.addEventListener('load'");
  const playerIndex = player.indexOf('this.player = new api.Player(iframe');
  assert.ok(loadIndex >= 0 && playerIndex > loadIndex && appendIndex > playerIndex);
  assert.match(player, /YOUTUBE_ITEM_SPECIFIC_ERRORS = new Set\(\[2, 100, 101, 150\]\)/);
  assert.match(player, /YOUTUBE_ITEM_SPECIFIC_ERRORS\.has\(data\)[\s\S]*?this\.fail\(options, error\)[\s\S]*?recover\(error\)/);
});
