import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { transform } from 'esbuild';

const read = async (path) => await readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('all details interactions use the shared navigation helper', async () => {
  const [render, navigation] = await Promise.all([
    read('src/slider/render.ts'),
    read('src/slider/navigation.ts')
  ]);
  assert.equal(render.includes('#/details'), false);
  assert.equal((render.match(/openItemDetails\(item\.id\)/g) ?? []).length, 3);
  assert.match(render, /addEventListener\('keydown'[\s\S]*?target\?\.closest\('button'\)[\s\S]*?openItemDetails\(item\.id\)/);
  assert.match(navigation, /window\.Emby\?\.Page\?\.showItem/);
  assert.match(navigation, /#\/details\?id=/);
});

test('critic ratings render as percentages without item-page-only icon classes', async () => {
  const [render, preview] = await Promise.all([
    read('src/slider/render.ts'),
    read('src/config/components/BannerPreview.vue')
  ]);
  for (const source of [render, preview]) {
    assert.doesNotMatch(source, /mediaInfoCriticRating/);
    assert.doesNotMatch(source, /(?:carousel|preview)\.critics/);
  }
  assert.match(render, /critic\.textContent = `\$\{Math\.round\(item\.critic_rating\)\}%`/);
});

test('settings preview mirrors the Jellyfin home layout with varied real library artwork', async () => {
  const [preview, store, styles] = await Promise.all([
    read('src/config/components/BannerPreview.vue'),
    read('src/config/libs/store.ts'),
    read('src/config/config.css')
  ]);

  assert.match(preview, /backendItems = computed[\s\S]*?store\.preview\.value\?\.items/);
  assert.match(preview, /TitleDisplayMode === 'logo'[\s\S]*?candidate\.hasLogo && candidate\.hasImage/);
  assert.match(preview, /UseHeroLayout \? 0\.76 : 0\.44/);
  assert.match(preview, /mediaCardStyle[\s\S]*?heroImageUrl\(cardItem\.id, cardItem\.imageType/);
  assert.match(preview, /ec-jellyfinMockBrandLogo[\s\S]*?ec-jellyfin-logo-inner[\s\S]*?#aa5cc3[\s\S]*?#00a4dc/);
  assert.match(preview, /--ec-preview-media-offset[^\n]*store\.config\.MediaPadding \* previewScale\.value/);
  assert.match(store, /targetCount = 5[\s\S]*?featured\/items\/batch[\s\S]*?excludedItemIds/);
  assert.match(preview, /ec-jellyfinMockHeader[\s\S]*?ec-jellyfinMockNav[\s\S]*?ec-jellyfinMockHeaderActions/);
  assert.doesNotMatch(preview, /ec-jellyfinMockHeader\s*\{\s*display:\s*none/);
  assert.match(styles, /\.ec-jellyfinMockHeader\s*\{[\s\S]*?position:\s*absolute/);
  assert.match(styles, /\.ec-jellyfinMockMedia\s*\{[\s\S]*?margin-top:\s*var\(--ec-preview-media-offset/);
  assert.match(styles, /\.ec-configPreviewImageLogo\s*\{[\s\S]*?max-height:\s*clamp\(3\.5rem, 12cqw, 5\.25rem\)[\s\S]*?max-width:\s*min\(18rem, 68%\)/);
  assert.match(styles, /\.ec-configPreview:not\(\.is-hero\)\s*\{[\s\S]*?margin:\s*3\.15rem 3\.3% 0/);
  assert.match(styles, /@container \(max-width: 59\.99rem\)[\s\S]*?ec-jellyfinMockCard:nth-child\(n \+ 4\)[\s\S]*?display:\s*none/);
});

test('bootstrap and runtime placeholders share responsive and reduced-motion values', async () => {
  const [runtimeCss, bootstrap] = await Promise.all([
    read('src/styles/featured.css'),
    read('Jellyfin.Plugin.Featured/Integrations/FrontendBootstrap.cs')
  ]);
  for (const value of ['360px', '500px', '750px', '400px', '340px', '100px', '75px', '1.5s', '220%']) {
    assert.equal(runtimeCss.includes(value), true, `runtime placeholder misses ${value}`);
    assert.equal(bootstrap.includes(value), true, `bootstrap placeholder misses ${value}`);
  }
  assert.match(runtimeCss, /prefers-reduced-motion:[^)]+\)[\s\S]*?ec-placeholder-viewport[\s\S]*?animation:\s*none/);
  assert.match(bootstrap, /prefers-reduced-motion:reduce[^\n]+animation:none/);
});

test('touch layouts keep the first Jellyfin section below the hero', async () => {
  const [styles, bootstrap] = await Promise.all([
    read('src/styles/featured.css'),
    read('Jellyfin.Plugin.Featured/Integrations/FrontendBootstrap.cs')
  ]);
  assert.match(styles, /@media \(max-width: 700px\),\s*\(hover: none\) and \(pointer: coarse\)[\s\S]*?--ec-hero-overlap-offset:\s*calc\(1\.25rem \+ var\(--ec-media-padding, 0px\)\)[\s\S]*?margin-bottom:\s*var\(--ec-hero-overlap-offset\)/);
  assert.match(bootstrap, /@media\(max-width:700px\),\(hover:none\) and \(pointer:coarse\)[\s\S]*?\.ec-bootstrap-placeholder\.ec-bootstrap-hero\{margin-bottom:calc\(1\.25rem \+ var\(--ec-media-padding,0px\)\)\}/);
});

test('hero hit-testing ends at the first Jellyfin section without clipping the visual fade', async () => {
  const [render, styles] = await Promise.all([
    read('src/slider/render.ts'),
    read('src/styles/featured.css')
  ]);
  assert.match(render, /className = 'ec-slide-hitbox'/);
  assert.match(styles, /\.ec-root\.ec-ready\.ec-hero\s*\{[^}]*pointer-events:\s*none/);
  assert.match(styles, /--ec-desktop-content-height:\s*clamp\(0px, calc\(var\(--ec-height\) - var\(--ec-hero-overlap, 150px\) \+ 52px \+ var\(--ec-media-padding, 0px\)\), var\(--ec-height\)\)/);
  assert.match(styles, /\.ec-slide-hitbox\s*\{[^}]*height:\s*var\(--ec-content-height\)[^}]*pointer-events:\s*none/);
  assert.match(styles, /\.ec-whole-banner-interactive \.ec-slide\.is-active \.ec-slide-hitbox\s*\{[^}]*pointer-events:\s*auto/);
  assert.doesNotMatch(styles, /\.ec-whole-banner-interactive \.ec-slide-hitbox\s*\{[^}]*pointer-events:\s*auto/);
  assert.match(styles, /\.ec-root\.ec-ready\.ec-hero \.ec-slide\.is-active \.ec-button,[\s\S]*?pointer-events:\s*auto/);
  assert.match(render, /slide\.addEventListener\('click', \(event\) => \{\s*if \(!slide\.classList\.contains\('is-active'\)\) return/);
  assert.doesNotMatch(styles, /\.ec-root\.ec-ready\.ec-hero \+ \.verticalSection/);
});

test('whole-banner interaction is configurable while buttons remain independent', async () => {
  const [configuration, resolver, response, defaults, displayTab, carousel, render, styles] = await Promise.all([
    read('Jellyfin.Plugin.Featured/Configuration/PluginConfiguration.cs'),
    read('Jellyfin.Plugin.Featured/Configuration/FeaturedPresetResolver.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedResponseDtos.cs'),
    read('src/config/libs/defaults.ts'),
    read('src/config/tabs/DisplayTab.vue'),
    read('src/slider/carousel.ts'),
    read('src/slider/render.ts'),
    read('src/styles/featured.css')
  ]);
  assert.match(configuration, /InteractOnWholeBanner\s*\{\s*get;\s*set;\s*\}\s*=\s*true/);
  assert.match(resolver, /config\.InteractOnWholeBanner = preset\.Layout\.InteractOnWholeBanner/);
  assert.match(response, /InteractOnWholeBanner = config\.InteractOnWholeBanner/);
  assert.match(defaults, /InteractOnWholeBanner:\s*true/);
  assert.match(displayTab, /v-model="store\.config\.InteractOnWholeBanner"/);
  assert.match(carousel, /response\.interactOnWholeBanner \? ' ec-whole-banner-interactive'/);
  assert.match(carousel, /isActive && this\.response\.interactOnWholeBanner \? 0 : -1/);
  assert.match(render, /if \(response\.interactOnWholeBanner\)[\s\S]*?slide\.addEventListener\('click'/);
  assert.match(styles, /\.ec-slide\.is-active:focus-visible::before/);
  assert.doesNotMatch(styles, /\.ec-slide\.is-active:focus::before/);
});

test('carousel controls can be hidden until hover without affecting touch input', async () => {
  const [configuration, resolver, response, defaults, displayTab, preview, carousel, styles] = await Promise.all([
    read('Jellyfin.Plugin.Featured/Configuration/PluginConfiguration.cs'),
    read('Jellyfin.Plugin.Featured/Configuration/FeaturedPresetResolver.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedResponseDtos.cs'),
    read('src/config/libs/defaults.ts'),
    read('src/config/tabs/DisplayTab.vue'),
    read('src/config/components/BannerPreview.vue'),
    read('src/slider/carousel.ts'),
    read('src/styles/featured.css')
  ]);
  assert.match(configuration, /ShowControlsOnHoverOnly/);
  assert.match(resolver, /config\.ShowControlsOnHoverOnly = preset\.Layout\.ShowControlsOnHoverOnly/);
  assert.match(response, /ShowControlsOnHoverOnly = config\.ShowControlsOnHoverOnly/);
  assert.match(defaults, /ShowControlsOnHoverOnly:\s*false/);
  assert.match(displayTab, /v-model="store\.config\.ShowControlsOnHoverOnly"/);
  assert.match(preview, /'controls-on-hover': store\.config\.ShowControlsOnHoverOnly/);
  assert.match(carousel, /showControlsOnHoverOnly \? ' ec-controls-hover'/);
  assert.match(styles, /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*?\.ec-root\.ec-controls-hover \.ec-controls[\s\S]*?opacity:\s*0[\s\S]*?:focus-within \.ec-controls[\s\S]*?opacity:\s*1/);
});

test('frontend theming inherits Jellyfin palette tokens and exposes a Custom CSS API', async () => {
  const [tokens, main, configMain, devMain, render, playback, runtimeStyles, configStyles, preview, guide, readme] = await Promise.all([
    read('src/styles/jellyfin-theme.ts'),
    read('src/main.ts'),
    read('src/config/main.ts'),
    read('src/config/dev/main.ts'),
    read('src/slider/render.ts'),
    read('src/slider/playback.ts'),
    read('src/styles/featured.css'),
    read('src/config/config.css'),
    read('src/config/components/BannerPreview.vue'),
    read('docs/custom-css.md'),
    read('README.md')
  ]);
  for (const jellyfinToken of [
    '--jf-palette-primary-main',
    '--jf-palette-primary-contrastText',
    '--jf-palette-background-default',
    '--jf-palette-background-paper',
    '--jf-palette-text-primary',
    '--jf-palette-divider',
    '--jf-palette-action-hover',
    '--jf-card-borderRadius'
  ]) assert.match(tokens, new RegExp(jellyfinToken));
  assert.match(tokens, /--theme-primary-color[\s\S]*?--primary-accent-color[\s\S]*?--accent/);
  assert.match(tokens, /getComputedStyle\(document\.documentElement\)/);
  assert.match(tokens, /computed\.getPropertyValue\(name\)\.trim\(\)\.length === 0/);
  assert.match(main, /injectJellyfinThemeTokens\(\)/);
  assert.match(configMain, /injectJellyfinThemeTokens\(\)/);
  assert.match(devMain, /injectJellyfinThemeTokens\(\)/);
  assert.match(render + playback, /raised button-submit emby-button/);
  assert.match(render, /ec-button ec-button-secondary raised emby-button/);
  assert.match(runtimeStyles, /\.ec-button\s*\{[^}]*background:\s*var\(--ec-button-primary-background, var\(--ec-theme-primary\)\)[^}]*color:\s*var\(--ec-button-primary-color, var\(--ec-theme-primary-contrast\)\)/);
  assert.match(runtimeStyles, /\.ec-preferences-dialog\s*\{[^}]*background:\s*var\(--ec-dialog-background, var\(--ec-theme-background\)\)[^}]*color:\s*var\(--ec-dialog-color, var\(--ec-theme-text-primary\)\)/);
  assert.match(configStyles, /\.ec-configPreviewButton\s*\{[^}]*background:\s*var\(--ec-button-primary-background, var\(--ec-theme-primary\)\)[^}]*color:\s*var\(--ec-button-primary-color, var\(--ec-theme-primary-contrast\)\)/);
  assert.match(configStyles, /\.jmp-tabButton\.is-active\s*\{[^}]*background:\s*var\(--ec-theme-primary\)/);
  assert.match(preview, /ec-configPreviewButton raised button-submit emby-button/);
  for (const publicHook of [
    '--ec-banner-radius',
    '--ec-button-primary-background',
    '--ec-button-primary-hover-background',
    '--ec-button-secondary-background',
    '--ec-button-secondary-hover-background',
    '--ec-dialog-background',
    '.ec-button-secondary',
    '.ec-preferences-dialog'
  ]) assert.match(guide, new RegExp(publicHook.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(readme, /docs\/custom-css\.md/);
});

test('vertical hero fade generates and applies the runtime mask', async () => {
  const [layout, styles] = await Promise.all([
    read('src/slider/layout.ts'),
    read('src/styles/featured.css')
  ]);

  assert.match(layout, /HERO_FADE_PRESETS:[\s\S]*?soft:[\s\S]*?balanced:[\s\S]*?strong:/);
  assert.match(layout, /getHeroFadePoints\(curve: HeroFadeCurve, customPoints:/);
  assert.match(layout, /normalizedStrength === 0\) return 'none'/);
  assert.match(layout, /1 - \(\(fade \/ 100\) \* normalizedStrength\)/);
  assert.match(layout, /normalizedStart \+ \(span \* point\.Position \/ 100\)/);
  assert.match(styles, /-webkit-mask-image:\s*var\(--ec-hero-media-mask\)/);
  assert.match(styles, /mask-image:\s*var\(--ec-hero-media-mask\)/);
  assert.match(layout, /setProperty\('--ec-hero-media-mask', createHeroFadeMask/);
});

test('full-strength hero fade emits a valid transparent endpoint', async () => {
  const source = await read('src/slider/layout.ts');
  const compiled = await transform(source, { format: 'esm', loader: 'ts', target: 'es2020' });
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.code).toString('base64')}`;
  const { createHeroFadeMask, getHeroFadePoints } = await import(moduleUrl);

  const mask = createHeroFadeMask(55, 95, 'soft', 100);
  assert.match(mask, /rgba\(0,0,0,0\) 95%\)$/);
  assert.doesNotMatch(mask, /rgba\(0,0,0,\)/);
  assert.equal(createHeroFadeMask(55, 95, 'soft', 0), 'none');
  assert.equal(
    createHeroFadeMask(20, 80, 'custom', 100, [
      { Position: 0, Fade: 0 }, { Position: 50, Fade: 25 }, { Position: 100, Fade: 100 }
    ]),
    'linear-gradient(to bottom, #000 0%, #000 20%, rgba(0,0,0,.75) 50%, rgba(0,0,0,0) 80%)'
  );
  assert.deepEqual(getHeroFadePoints('custom', [
    { Position: 100, Fade: 100 }, { Position: 45, Fade: 70 }, { Position: 0, Fade: 0 }
  ]), [
    { Position: 0, Fade: 0 }, { Position: 45, Fade: 70 }, { Position: 100, Fade: 100 }
  ]);
});

test('gradient strength only controls the vertical fade', async () => {
  const [styles, configStyles] = await Promise.all([
    read('src/styles/featured.css'),
    read('src/config/config.css')
  ]);

  assert.match(styles, /--ec-media-shade:\s*linear-gradient\(0deg,[^;]*var\(--ec-gradient-strength\)[^;]*transparent 45%\)/);
  assert.doesNotMatch(styles, /--ec-media-shade:[^;]*linear-gradient\(90deg/);
  assert.match(styles, /\.ec-root\.ec-hero\s*\{[^}]*--ec-media-shade:\s*none/);
  assert.match(configStyles, /--ec-preview-shade:\s*linear-gradient\(0deg,[^;]*var\(--ec-preview-gradient, \.85\)[^;]*transparent 45%\)/);
  assert.doesNotMatch(configStyles, /--ec-preview-shade:[^;]*linear-gradient\(90deg/);
  assert.match(configStyles, /\.ec-configPreview\.is-hero\s*\{[^}]*--ec-preview-shade:\s*none/);
});

test('vertical hero fade is editable and rendered in the banner preview', async () => {
  const [displayTab, editor, preview] = await Promise.all([
    read('src/config/tabs/DisplayTab.vue'),
    read('src/config/components/HeroFadeCurveEditor.vue'),
    read('src/config/components/BannerPreview.vue')
  ]);

  assert.match(preview, /createHeroFadeMask\([\s\S]*?HeroFadeStart[\s\S]*?HeroFadeEnd[\s\S]*?HeroFadeCurve[\s\S]*?HeroGradientStrength[\s\S]*?HeroFadePoints/);
  assert.match(displayTab, /v-model:curve="store\.config\.HeroFadeCurve"[\s\S]*?v-model:points="store\.config\.HeroFadePoints"[\s\S]*?v-model:strength="store\.config\.HeroGradientStrength"[\s\S]*?v-model:start="store\.config\.HeroFadeStart"[\s\S]*?v-model:end="store\.config\.HeroFadeEnd"/);
  assert.doesNotMatch(displayTab, /display\.(?:gradientStrength|fadeStart|fadeEnd)/);
  assert.match(editor, /function commitCustom[\s\S]*?function updateSelected[\s\S]*?function drag/);
  assert.match(editor, /@pointermove="drag"/);
  assert.doesNotMatch(editor, /presetOptions|selectPreset|selectCustom/);
  assert.match(editor, /selectedActualPosition[\s\S]*?relativePosition\(Number\(value\)\)/);
  assert.match(editor, /emit\('update:start'[\s\S]*?emit\('update:end'/);
  assert.match(editor, /kind === 'endPoint'[\s\S]*?emit\('update:strength'/);
  assert.match(editor, /@selectstart\.prevent[\s\S]*?@dragstart\.prevent/);
  assert.match(editor, /fadeAddPoint[\s\S]*?fadeRemovePoint/);
});
