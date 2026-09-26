import vue from '@vitejs/plugin-vue';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

const isWatch = process.argv.includes('--watch');
const browserTarget = 'chrome79';
const buildMode = isWatch ? 'development' : 'production';
const browserBundleFiles = ['featured.bundle.js', 'config.bundle.js', 'bootstrap.bundle.js'];

function injectEmittedCss(styleId) {
  return {
    name: 'jellyfin-featured-inject-emitted-css',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const cssAssets = Object.entries(bundle).filter(
        ([, output]) => output.type === 'asset' && output.fileName.endsWith('.css')
      );
      if (!cssAssets.length) return;

      const css = cssAssets
        .map(([, asset]) => (typeof asset.source === 'string' ? asset.source : new TextDecoder().decode(asset.source)))
        .join('\n');
      for (const [fileName] of cssAssets) delete bundle[fileName];

      const injection = [
        `const __styleId=${JSON.stringify(styleId)};`,
        'if(!document.getElementById(__styleId)){',
        'const __style=document.createElement("style");',
        '__style.id=__styleId;',
        `__style.textContent=${JSON.stringify(css)};`,
        '(document.head||document.documentElement).appendChild(__style);',
        '}'
      ].join('');

      for (const output of Object.values(bundle)) {
        if (output.type === 'chunk' && output.isEntry) output.code = injection + output.code;
      }
    }
  };
}

function bundleOptions({ entry, fileName, globalName, plugins = [] }) {
  return {
    configFile: false,
    mode: buildMode,
    logLevel: isWatch ? 'info' : 'warn',
    define: {
      'process.env.NODE_ENV': JSON.stringify(buildMode)
    },
    plugins,
    build: {
      target: browserTarget,
      outDir: 'dist',
      emptyOutDir: false,
      minify: !isWatch,
      sourcemap: isWatch,
      cssCodeSplit: false,
      lib: {
        entry: path.resolve(entry),
        name: globalName,
        formats: ['iife'],
        fileName: () => fileName
      },
      rollupOptions: {
        output: {
          entryFileNames: fileName
        },
        watch: isWatch ? {} : undefined
      }
    }
  };
}

await Promise.all([
  build(
    bundleOptions({
      entry: 'src/main.ts',
      fileName: 'featured.bundle.js',
      globalName: 'JellyfinFeaturedBundle'
    })
  ),
  build(
    bundleOptions({
      entry: 'src/config/main.ts',
      fileName: 'config.bundle.js',
      globalName: 'JellyfinFeaturedConfigBundle',
      plugins: [vue(), injectEmittedCss('jellyfin-featured-component-styles')]
    })
  ),
  build(
    bundleOptions({
      entry: 'src/bootstrap.ts',
      fileName: 'bootstrap.bundle.js',
      globalName: 'JellyfinFeaturedBootstrapBundle'
    })
  )
]);

if (!isWatch) {
  const bundleSources = await Promise.all(
    browserBundleFiles.map(async (fileName) => ({
      fileName,
      source: await readFile(path.join('dist', fileName), 'utf8')
    }))
  );
  const configBundle = bundleSources.find(({ fileName }) => fileName === 'config.bundle.js')?.source ?? '';
  if (!configBundle.includes('jellyfin-featured-component-styles') || !configBundle.includes('[data-v-')) {
    throw new Error('The production configuration bundle is missing compiled Vue component styles.');
  }
  for (const { fileName, source } of bundleSources) {
    if (/\bprocess(?:\.env|\[)/.test(source)) {
      throw new Error(`${fileName} contains a Node.js process reference that is unavailable in Jellyfin clients.`);
    }
  }
  await Promise.all([
    rm('dist/featured.bundle.js.map', { force: true }),
    rm('dist/config.bundle.js.map', { force: true }),
    rm('dist/bootstrap.bundle.js.map', { force: true })
  ]);
}
