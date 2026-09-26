import assert from 'node:assert/strict';
import { readProjectSource as read } from './helpers/readProjectSource.mjs';
import test from 'node:test';

test('automatic injection uses active helpers before the direct web fallback', async () => {
  const [availability, registration, direct, transformation, markup, javascriptInjector, main] = await Promise.all([
    read('Jellyfin.Plugin.Featured/Integrations/FrontendInjectionAvailability.cs'),
    read('Jellyfin.Plugin.Featured/Integrations/FrontendRegistration.cs'),
    read('Jellyfin.Plugin.Featured/Integrations/DirectScriptInjector.cs'),
    read('Jellyfin.Plugin.Featured/Integrations/FileTransformation/Transformations.cs'),
    read('Jellyfin.Plugin.Featured/Integrations/FrontendInjectionMarkup.cs'),
    read('Jellyfin.Plugin.Featured/Integrations/JavaScriptInjector/JavaScriptInjectorRegistrar.cs'),
    read('src/main.ts')
  ]);

  assert.match(availability, /IPluginManager[\s\S]*?IsEnabledAndSupported/);
  assert.match(registration, /FileTransformation[\s\S]*?JavaScriptInjector[\s\S]*?Direct/);
  assert.match(direct, /WebPath[\s\S]*?index\.html[\s\S]*?FileAccess\.ReadWrite/);
  assert.match(direct, /FrontendInjectionMarkup\.BuildScriptTag\("DirectInjection", "direct"\)/);
  assert.match(
    transformation,
    /FrontendInjectionMarkup\.BuildScriptTag\("FileTransformation", "file-transformation"\)/
  );
  assert.match(markup, /plugin=\\\"Featured\\\"/);
  assert.match(markup, /\/featured\/script/);
  assert.match(markup, /FrontendBootstrap\.StartMarker[\s\S]*?FrontendBootstrap\.EndMarker/);
  assert.match(javascriptInjector, /script\.dataset\.injectionMethod = 'javascript-injector'/);
  assert.match(main, /console\.debug\([\s\S]*?frontend injection method/);
  assert.match(main, /console\.debug\([\s\S]*?Initialized/);
  assert.match(main, /Existing v\$\{existingApi\.version\} instance found/);
});

test('injection settings disable unavailable methods and remind about restart', async () => {
  const [select, advanced] = await Promise.all([
    read('src/config/components/ConfigSelect.vue'),
    read('src/config/tabs/AdvancedTab.vue')
  ]);

  assert.match(select, /<option[\s\S]*?:disabled="option\.disabled"/);
  assert.match(advanced, /value: 'direct'/);
  assert.match(advanced, /FrontendInjectionMethod[\s\S]*?!store\.loading\.value[\s\S]*?showRestartReminder/);
  assert.match(advanced, /Dashboard\?\.alert[\s\S]*?window\.alert/);
});
