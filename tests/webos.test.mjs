import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('webOS 6 gets Chromium 79 compatible output and runtime fallbacks', async () => {
  const [build, clone, dom, defaults, store, preferences, carousel, trailer, navigation, styles] = await Promise.all([
    read('scripts/build.mjs'),
    read('src/core/clone.ts'),
    read('src/core/dom.ts'),
    read('src/config/libs/defaults.ts'),
    read('src/config/libs/store.ts'),
    read('src/preferences.ts'),
    read('src/slider/carousel.ts'),
    read('src/slider/trailer.ts'),
    read('src/admin/navigation.ts'),
    read('src/styles/featured.css')
  ]);
  assert.match(build, /const browserTarget = 'chrome79'/);
  assert.match(build, /target: browserTarget/);
  assert.match(clone, /typeof globalThis\.structuredClone === 'function'/);
  assert.match(clone, /JSON\.parse\(JSON\.stringify\(value\)\)/);
  assert.match(dom, /while \(element\.firstChild\) element\.removeChild\(element\.firstChild\)/);
  assert.doesNotMatch(`${defaults}\n${store}`, /\bstructuredClone\(/);
  assert.doesNotMatch(`${preferences}\n${carousel}\n${trailer}\n${navigation}`, /\.replaceChildren\(/);
  assert.match(styles, /height:\s*min\(52rem, calc\(100vh - 2rem\)\);[\s\S]*?height:\s*min\(52rem, calc\(100dvh - 2rem\)\);/);

  const esbuild = await import('esbuild');
  const transformed = await esbuild.transform('.webos { position: absolute; inset: 0; }', {
    loader: 'css', target: 'chrome79', minify: true
  });
  assert.match(transformed.code, /top:0;right:0;bottom:0;left:0/);
});
