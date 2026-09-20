import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

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
  assert.match(styles, /@media \(max-width: 700px\), \(hover: none\) and \(pointer: coarse\)[\s\S]*?--ec-hero-overlap-offset:\s*calc\(1\.25rem \+ var\(--ec-media-padding, 0px\)\)[\s\S]*?margin-bottom:\s*var\(--ec-hero-overlap-offset\)/);
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
  const [configuration, resolver, response, defaults, displayTab, carousel, render] = await Promise.all([
    read('Jellyfin.Plugin.Featured/Configuration/PluginConfiguration.cs'),
    read('Jellyfin.Plugin.Featured/Configuration/FeaturedPresetResolver.cs'),
    read('Jellyfin.Plugin.Featured/Api/FeaturedResponseDtos.cs'),
    read('src/config/libs/defaults.ts'),
    read('src/config/tabs/DisplayTab.vue'),
    read('src/slider/carousel.ts'),
    read('src/slider/render.ts')
  ]);
  assert.match(configuration, /InteractOnWholeBanner\s*\{\s*get;\s*set;\s*\}\s*=\s*true/);
  assert.match(resolver, /config\.InteractOnWholeBanner = preset\.Layout\.InteractOnWholeBanner/);
  assert.match(response, /InteractOnWholeBanner = config\.InteractOnWholeBanner/);
  assert.match(defaults, /InteractOnWholeBanner:\s*true/);
  assert.match(displayTab, /v-model="store\.config\.InteractOnWholeBanner"/);
  assert.match(carousel, /response\.interactOnWholeBanner \? ' ec-whole-banner-interactive'/);
  assert.match(carousel, /isActive && this\.response\.interactOnWholeBanner \? 0 : -1/);
  assert.match(render, /if \(response\.interactOnWholeBanner\)[\s\S]*?slide\.addEventListener\('click'/);
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
  const [tokens, main, configMain, devMain, render, runtimeStyles, configStyles, preview, guide, readme] = await Promise.all([
    read('src/styles/jellyfin-theme.ts'),
    read('src/main.ts'),
    read('src/config/main.ts'),
    read('src/config/dev/main.ts'),
    read('src/slider/render.ts'),
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
  assert.match(render, /ec-button raised button-submit emby-button/);
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

  assert.match(layout, /FADE_STOP_OFFSETS = \[0\.16, 0\.3, 0\.5, 0\.7, 0\.92\]/);
  assert.match(layout, /balanced: \[0\.92, 0\.72, 0\.48, 0\.24, 0\.08\]/);
  assert.match(layout, /normalizedStart \+ \(span \* offset\)/);
  assert.match(styles, /-webkit-mask-image:\s*var\(--ec-hero-media-mask\)/);
  assert.match(styles, /mask-image:\s*var\(--ec-hero-media-mask\)/);
  assert.match(layout, /setProperty\('--ec-hero-media-mask', createHeroFadeMask/);
});

test('vertical hero fade is editable and rendered in the banner preview', async () => {
  const [displayTab, preview] = await Promise.all([
    read('src/config/tabs/DisplayTab.vue'),
    read('src/config/components/BannerPreview.vue')
  ]);

  assert.match(preview, /createHeroFadeMask\([\s\S]*?HeroFadeStart[\s\S]*?HeroFadeEnd[\s\S]*?HeroFadeCurve/);
  assert.match(displayTab, /v-model="store\.config\.HeroFadeStart"[\s\S]*?v-model="store\.config\.HeroFadeEnd"[\s\S]*?v-model="store\.config\.HeroFadeCurve"/);
});
