import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async (path) => await readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('automatic injection uses active helpers before the direct web fallback', async () => {
  const [availability, registration, direct, transformation, javascriptInjector, main] = await Promise.all([
    read('Jellyfin.Plugin.Featured/Integrations/FrontendInjectionAvailability.cs'),
    read('Jellyfin.Plugin.Featured/Integrations/FrontendRegistration.cs'),
    read('Jellyfin.Plugin.Featured/Integrations/DirectScriptInjector.cs'),
    read('Jellyfin.Plugin.Featured/Integrations/FileTransformation/Transformations.cs'),
    read('Jellyfin.Plugin.Featured/Integrations/JavaScriptInjector/JavaScriptInjectorRegistrar.cs'),
    read('src/main.ts')
  ]);

  assert.match(availability, /IPluginManager[\s\S]*?IsEnabledAndSupported/);
  assert.match(registration, /FileTransformation[\s\S]*?JavaScriptInjector[\s\S]*?Direct/);
  assert.match(direct, /WebPath[\s\S]*?index\.html[\s\S]*?FileAccess\.ReadWrite/);
  assert.match(direct, /plugin=\\\"Featured\\\"/);
  assert.match(direct, /\/featured\/script/);
  assert.match(direct, /data-injection-method=\\\"direct\\\"/);
  assert.match(transformation, /data-injection-method=\\\"file-transformation\\\"/);
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
