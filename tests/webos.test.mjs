import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('webOS 6 gets Chromium 79 compatible output and runtime fallbacks', async () => {
  const [build, clone, dom, defaults, store, preferences, carousel, trailer, navigation, styles, webosOverrides, layout, bootstrap] = await Promise.all([
    read('scripts/build.mjs'),
    read('src/core/clone.ts'),
    read('src/core/dom.ts'),
    read('src/config/libs/defaults.ts'),
    read('src/config/libs/store.ts'),
    read('src/preferences.ts'),
    read('src/slider/carousel.ts'),
    read('src/slider/trailer.ts'),
    read('src/admin/navigation.ts'),
    read('src/styles/featured.css'),
    read('src/styles/webos-overrides.css'),
    read('src/slider/layout.ts'),
    read('Jellyfin.Plugin.Featured/Integrations/FrontendBootstrap.cs')
  ]);
  assert.match(build, /const browserTarget = 'chrome79'/);
  assert.match(build, /target: browserTarget/);
  assert.match(clone, /typeof globalThis\.structuredClone === 'function'/);
  assert.match(clone, /JSON\.parse\(JSON\.stringify\(value\)\)/);
  assert.match(dom, /while \(element\.firstChild\) element\.removeChild\(element\.firstChild\)/);
  assert.match(defaults, /import \{ cloneJsonValue \} from '\.\.\/\.\.\/core\/clone'/);
  assert.doesNotMatch(defaults, /structuredCloneValue/);
  assert.doesNotMatch(`${defaults}\n${store}`, /\bstructuredClone\(/);
  assert.doesNotMatch(`${preferences}\n${carousel}\n${trailer}\n${navigation}`, /\.replaceChildren\(/);
  assert.match(styles, /--ec-dialog-viewport-height:\s*calc\(100vh - 2rem\)[\s\S]*?height:\s*min\(52rem, var\(--ec-dialog-viewport-height\)\)/);
  assert.match(styles, /@supports \(height: 100dvh\)[\s\S]*?--ec-dialog-viewport-height:\s*calc\(100dvh - 2rem\)/);
  const esbuild = await import('esbuild');
  const transformed = await esbuild.transform('.webos { position: absolute; inset: 0; }', {
    loader: 'css', target: 'chrome79', minify: true
  });
  assert.match(transformed.code, /top:0;right:0;bottom:0;left:0/);
  assert.match(styles, /\.ec-root\.ec-height-fullscreen\s*\{[\s\S]*?--ec-height:\s*100vh !important;[\s\S]*?@supports \(height: 100dvh\)[\s\S]*?--ec-height:\s*100dvh !important;/);
  assert.match(bootstrap, /ec-bootstrap-height-fullscreen\{--ec-height:100vh\}/);
  assert.match(bootstrap, /@supports\(height:100dvh\)\{\.ec-bootstrap-placeholder\.ec-bootstrap-height-fullscreen\{--ec-height:100dvh!important\}\}/);
  assert.match(styles, /-webkit-mask-image:\s*var\(--ec-hero-media-mask\)/);
  assert.doesNotMatch(layout, /(?<!-)maskImage\s*=/);
});

test('hero content adapts overview lines without moving following sections', async () => {
  const [main, styles, webosOverrides, heroOverviewFit] = await Promise.all([
    read('src/main.ts'),
    read('src/styles/featured.css'),
    read('src/styles/webos-overrides.css'),
    read('src/slider/heroOverviewFit.ts')
  ]);

  assert.match(main, /import webosOverrides from '\.\/styles\/webos-overrides\.css'/);
  assert.match(main, /import \{ installAdaptiveHeroOverview \} from '\.\/slider\/heroOverviewFit'/);
  assert.match(main, /installAdaptiveHeroOverview\(\)/);
  assert.match(main, /style\.textContent = `\$\{styles\}\\n\$\{webosOverrides\}`/);
  assert.match(styles, /--ec-desktop-overlap-offset:\s*calc\(\(var\(--ec-hero-overlap, 150px\) \* -1\) \+ 52px \+ var\(--ec-media-padding, 0px\)\)/);
  assert.match(styles, /\.ec-root\.ec-ready\.ec-hero\s*\{[^}]*margin-bottom:\s*var\(--ec-hero-overlap-offset\)/);
  assert.doesNotMatch(`${styles}\n${webosOverrides}`, /margin-bottom:[^;]+var\(--ec-content-clearance/);
  assert.match(webosOverrides, /@media \(min-width: 701px\) and \(hover: none\) and \(pointer: coarse\)[\s\S]*?--ec-hero-overlap-offset:\s*var\(--ec-desktop-overlap-offset\)/);
  assert.match(webosOverrides, /@media \(min-width: 701px\)[\s\S]*?\.ec-root\.ec-ready\.ec-hero \.ec-content\s*\{[\s\S]*?height:\s*var\(--ec-content-height\);[\s\S]*?overflow:\s*hidden;/);
  assert.match(webosOverrides, /\.ec-root\.ec-ready\.ec-hero \.ec-logo\s*\{[\s\S]*?flex:\s*0 0 auto;[\s\S]*?height:\s*clamp\(5rem, 11vw, 8\.5rem\);[\s\S]*?max-height:\s*min\(34%, 8\.5rem\);[\s\S]*?max-width:\s*min\(34rem, 82vw\);/);
  assert.match(webosOverrides, /\.ec-root\.ec-ready\.ec-hero \.ec-meta\s*\{[\s\S]*?font-size:\s*\.9rem;[\s\S]*?margin-top:\s*\.8rem;/);
  assert.match(webosOverrides, /\.ec-root\.ec-ready\.ec-hero \.ec-tagline\s*\{[\s\S]*?font-size:\s*\.95rem;[\s\S]*?margin-top:\s*\.65rem;/);
  assert.match(webosOverrides, /\.ec-root\.ec-ready\.ec-hero \.ec-overview\s*\{[\s\S]*?-webkit-line-clamp:\s*4;[\s\S]*?flex:\s*0 0 auto;[\s\S]*?font-size:\s*\.9rem;[\s\S]*?line-height:\s*1\.38;/);
  for (const lines of [3, 2, 1]) {
    assert.match(webosOverrides, new RegExp(`ec-overview-lines-${lines}[\\s\\S]*?-webkit-line-clamp:\\s*${lines}`));
  }
  assert.match(webosOverrides, /ec-overview-hidden \.ec-overview\s*\{[\s\S]*?display:\s*none/);
  assert.match(heroOverviewFit, /for \(const lines of \[3, 2, 1\] as const\)/);
  assert.match(heroOverviewFit, /getVisibleContentBottom\(content\) <= getAvailableContentBottom\(content\) \+ OVERFLOW_TOLERANCE_PX/);
  assert.match(heroOverviewFit, /nextSection\.getBoundingClientRect\(\)\.top - HERO_CONTENT_GAP_PX/);
  assert.match(heroOverviewFit, /classList\.contains\('ec-slide'\)/);
});
