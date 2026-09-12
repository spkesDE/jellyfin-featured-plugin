import * as esbuild from 'esbuild';
import { createHash } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { compileScript, compileStyle, compileTemplate, parse } from '@vue/compiler-sfc';

const isWatch = process.argv.includes('--watch');
const isProduction = !isWatch;

const cssTextPlugin = {
  name: 'css-text',
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, async (args) => {
      const source = await readFile(args.path, 'utf8');
      const result = await esbuild.transform(source, { loader: 'css', minify: isProduction });
      return { contents: `export default ${JSON.stringify(result.code.trim())};`, loader: 'js' };
    });
  }
};

const vueSfcPlugin = {
  name: 'vue-sfc',
  setup(build) {
    let compileQueue = Promise.resolve();
    build.onLoad({ filter: /\.vue$/ }, async (args) => {
      const compile = async () => {
        const source = await readFile(args.path, 'utf8');
        const { descriptor, errors } = parse(source, { filename: args.path });
        if (errors.length) {
          return { errors: errors.map((error) => ({ text: error instanceof Error ? error.message : String(error) })) };
        }
        const id = createHash('sha256').update(args.path).digest('hex').slice(0, 12);
        const scopeId = `data-v-${id}`;
        const hasScopedStyles = descriptor.styles.some((style) => style.scoped);
        const compiledStyles = descriptor.styles.map((style) => compileStyle({
          source: style.content,
          filename: args.path,
          id: scopeId,
          scoped: style.scoped,
          isProd: isProduction
        }));
        const styleErrors = compiledStyles.flatMap((style) => style.errors);
        if (styleErrors.length) {
          return { errors: styleErrors.map((error) => ({ text: error.message })) };
        }
        const transformedCss = compiledStyles.length
          ? await esbuild.transform(compiledStyles.map((style) => style.code).join('\n'), { loader: 'css', minify: isProduction })
          : null;
        const styleCode = transformedCss?.code.trim()
          ? [
              `const __styleId = ${JSON.stringify(`jellyfin-featured-${id}`)};`,
              'if (!document.getElementById(__styleId)) {',
              '  const __style = document.createElement("style");',
              '  __style.id = __styleId;',
              `  __style.textContent = ${JSON.stringify(transformedCss.code.trim())};`,
              '  (document.head || document.documentElement).appendChild(__style);',
              '}'
            ].join('\n')
          : '';
        if (!descriptor.script && !descriptor.scriptSetup) {
          const compiledTemplate = compileTemplate({
            source: descriptor.template?.content ?? '',
            filename: args.path,
            id,
            scoped: hasScopedStyles,
            isProd: isProduction
          });
          if (compiledTemplate.errors.length) {
            return { errors: compiledTemplate.errors.map((error) => ({ text: typeof error === 'string' ? error : error.message })) };
          }
          return {
            contents: [
              compiledTemplate.code,
              'const __script = {};',
              '__script.render = render;',
              hasScopedStyles ? `__script.__scopeId = ${JSON.stringify(scopeId)};` : '',
              styleCode,
              'export default __script;'
            ].filter(Boolean).join('\n'),
            loader: 'js',
            resolveDir: path.dirname(args.path)
          };
        }
        const compiledScript = compileScript(descriptor, {
          id,
          inlineTemplate: true,
          genDefaultAs: '__script',
          isProd: isProduction,
          templateOptions: { scoped: hasScopedStyles, isProd: isProduction }
        });
        return {
          contents: [
            compiledScript.content,
            hasScopedStyles ? `__script.__scopeId = ${JSON.stringify(scopeId)};` : '',
            styleCode,
            'export default __script;'
          ].filter(Boolean).join('\n'),
          loader: descriptor.script?.lang === 'js' ? 'js' : 'ts',
          resolveDir: path.dirname(args.path)
        };
      };
      const result = compileQueue.then(compile);
      compileQueue = result.then(() => undefined, () => undefined);
      return result;
    });
  }
};

const sharedOptions = {
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: isProduction,
  sourcemap: !isProduction,
  legalComments: 'inline'
};

const contexts = await Promise.all([
  esbuild.context({
    ...sharedOptions,
    entryPoints: ['src/main.ts'],
    globalName: 'JellyfinFeaturedBundle',
    outfile: 'dist/featured.bundle.js',
    plugins: [cssTextPlugin]
  }),
  esbuild.context({
    ...sharedOptions,
    entryPoints: ['src/config/main.ts'],
    globalName: 'JellyfinFeaturedConfigBundle',
    outfile: 'dist/config.bundle.js',
    plugins: [vueSfcPlugin, cssTextPlugin]
  })
]);

if (isWatch) {
  await Promise.all(contexts.map((context) => context.watch()));
} else {
  await Promise.all(contexts.map((context) => context.rebuild()));
  await Promise.all(contexts.map((context) => context.dispose()));
  const configBundle = await readFile('dist/config.bundle.js', 'utf8');
  if (!configBundle.includes('jellyfin-featured-') || !configBundle.includes('[data-v-')) {
    throw new Error('The production configuration bundle is missing compiled Vue component styles.');
  }
  await Promise.all([
    rm('dist/featured.bundle.js.map', { force: true }),
    rm('dist/config.bundle.js.map', { force: true })
  ]);
}
