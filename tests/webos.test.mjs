import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readProjectSource as read } from './helpers/readProjectSource.mjs';
import test from 'node:test';

test('webOS 6 gets Chromium 79 compatible output and runtime fallbacks', async () => {
  const [build, clone, dom, defaults, store, preferences, carousel, trailer, navigation, styles, layout, bootstrap] =
    await Promise.all([
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
      read('src/slider/layout.ts'),
      read('Jellyfin.Plugin.Featured/Integrations/FrontendBootstrap.cs')
    ]);
  assert.match(build, /const browserTarget = 'chrome79'/);
  assert.match(build, /target: browserTarget/);
  assert.match(build, /'process\.env\.NODE_ENV': JSON\.stringify\(buildMode\)/);
  assert.match(build, /contains a Node\.js process reference that is unavailable in Jellyfin clients/);
  assert.match(clone, /typeof globalThis\.structuredClone === 'function'/);
  assert.match(clone, /JSON\.parse\(JSON\.stringify\(value\)\)/);
  assert.match(dom, /while \(element\.firstChild\) element\.removeChild\(element\.firstChild\)/);
  assert.match(defaults, /import \{ cloneJsonValue \} from '\.\.\/\.\.\/core\/clone'/);
  assert.doesNotMatch(defaults, /structuredCloneValue/);
  assert.doesNotMatch(`${defaults}\n${store}`, /\bstructuredClone\(/);
  assert.doesNotMatch(`${preferences}\n${carousel}\n${trailer}\n${navigation}`, /\.replaceChildren\(/);
  assert.match(
    styles,
    /--ec-dialog-viewport-height:\s*calc\(100vh - 2rem\)[\s\S]*?height:\s*min\(52rem, var\(--ec-dialog-viewport-height\)\)/
  );
  assert.match(styles, /@supports \(height: 100dvh\)[\s\S]*?--ec-dialog-viewport-height:\s*calc\(100dvh - 2rem\)/);
  const esbuild = await import('esbuild');
  const transformed = await esbuild.transform('.webos { position: absolute; inset: 0; }', {
    loader: 'css',
    target: 'chrome79',
    minify: true
  });
  assert.match(transformed.code, /top:0;right:0;bottom:0;left:0/);
  assert.match(
    styles,
    /\.ec-root\.ec-height-fullscreen,[\s\S]*?--ec-height:\s*100vh !important;[\s\S]*?@supports \(height: 100dvh\)[\s\S]*?\.ec-root\.ec-height-fullscreen,[\s\S]*?--ec-height:\s*100dvh !important;/
  );
  assert.match(bootstrap, /ec-bootstrap-height-fullscreen[\s\S]*?--ec-height:\s*100vh/);
  assert.match(
    bootstrap,
    /@supports \(height: 100dvh\)[\s\S]*?\.ec-bootstrap-placeholder\.ec-bootstrap-height-fullscreen\s*\{[\s\S]*?--ec-height:\s*100dvh !important/
  );
  assert.match(styles, /-webkit-mask-image:\s*var\(--ec-hero-media-mask\)/);
  assert.doesNotMatch(layout, /(?<!-)maskImage\s*=/);
});

test('hero content adapts overview lines and keeps following sections clear', async () => {
  const [main, entry, styles, base, compatibility, heroOverviewFit] = await Promise.all([
    read('src/main.ts'),
    readFile(new URL('../src/styles/featured.css', import.meta.url), 'utf8'),
    read('src/styles/featured.css'),
    read('src/styles/featured-base.css'),
    read('src/styles/featured-compatibility.css'),
    read('src/slider/heroOverviewFit.ts')
  ]);

  assert.match(
    entry,
    /@import '\.\/featured-layout-contract\.css';[\s\S]*?@import '\.\/featured-base\.css';[\s\S]*?@import '\.\/featured-hero\.css';[\s\S]*?@import '\.\/featured-compatibility\.css';/
  );
  assert.equal(
    entry
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^@import[^;]+;\s*$/gm, '')
      .trim(),
    ''
  );
  assert.match(main, /import \{ installAdaptiveHeroOverview \} from '\.\/slider\/heroOverviewFit'/);
  assert.match(main, /installAdaptiveHeroOverview\(\)/);
  assert.match(main, /style\.textContent = styles/);
  assert.match(
    styles,
    /--ec-desktop-overlap-offset:\s*calc\(\(var\(--ec-hero-overlap, 150px\) \* -1\) \+ 52px \+ var\(--ec-media-padding, 0px\)\)/
  );
  assert.match(
    styles,
    /\.ec-root\.ec-ready\.ec-hero\s*\{[^}]*margin-bottom:\s*calc\(var\(--ec-hero-overlap-offset\) \+ var\(--ec-content-clearance, 0px\)\)/
  );
  assert.match(
    compatibility,
    /@media \(min-width: 701px\) and \(hover: none\) and \(pointer: coarse\)[\s\S]*?--ec-hero-overlap-offset:\s*var\(--ec-desktop-overlap-offset\)/
  );
  assert.match(
    compatibility,
    /@media \(min-width: 701px\)[\s\S]*?\.ec-root\.ec-ready\.ec-hero \.ec-content\s*\{[\s\S]*?height:\s*var\(--ec-content-height\);[\s\S]*?overflow:\s*hidden;/
  );
  assert.match(
    compatibility,
    /\.ec-root\.ec-ready\.ec-hero \.ec-logo\s*\{[\s\S]*?flex:\s*0 0 auto;[\s\S]*?height:\s*clamp\(5rem, 11vw, 8\.5rem\);[\s\S]*?max-height:\s*min\(34%, 8\.5rem\);[\s\S]*?max-width:\s*min\(34rem, 82vw\);/
  );
  assert.match(
    compatibility,
    /\.ec-root\.ec-ready\.ec-hero \.ec-meta\s*\{[\s\S]*?font-size:\s*0?\.9rem;[\s\S]*?margin-top:\s*0?\.8rem;/
  );
  assert.match(
    compatibility,
    /\.ec-root\.ec-ready\.ec-hero \.ec-tagline\s*\{[\s\S]*?font-size:\s*0?\.95rem;[\s\S]*?margin-top:\s*0?\.65rem;/
  );
  assert.match(
    compatibility,
    /\.ec-root\.ec-ready\.ec-hero \.ec-overview\s*\{[\s\S]*?-webkit-line-clamp:\s*4;[\s\S]*?flex:\s*0 0 auto;[\s\S]*?font-size:\s*0?\.9rem;[\s\S]*?line-height:\s*1\.38;/
  );
  const overviewRule = base.match(/\.ec-overview\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(overviewRule, /filter:\s*drop-shadow\(0 2px 12px rgba\(0, 0, 0, 0\.72\)\)/);
  assert.match(overviewRule, /text-shadow:\s*none/);
  assert.doesNotMatch(overviewRule, /\bpadding\s*:/);
  for (const lines of [3, 2, 1]) {
    assert.match(compatibility, new RegExp(`ec-overview-lines-${lines}[\\s\\S]*?-webkit-line-clamp:\\s*${lines}`));
  }
  assert.match(compatibility, /ec-overview-hidden \.ec-overview\s*\{[\s\S]*?display:\s*none/);
  assert.match(heroOverviewFit, /for \(const lines of \[3, 2, 1\] as const\)/);
  assert.match(
    heroOverviewFit,
    /getVisibleContentBottom\(content\) <= getAvailableContentBottom\(content\) \+ OVERFLOW_TOLERANCE_PX/
  );
  assert.match(heroOverviewFit, /nextSection\.getBoundingClientRect\(\)\.top - HERO_CONTENT_GAP_PX/);
  assert.match(heroOverviewFit, /classList\.contains\('ec-slide'\)/);
});
