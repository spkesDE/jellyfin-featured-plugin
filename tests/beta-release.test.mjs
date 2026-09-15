import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('beta release is manually triggered and keeps the webOS fix selectable without merging it', async () => {
  const workflow = await read('.github/workflows/beta-release.yml');
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /actions\/checkout@v\d+/);
  assert.match(workflow, /git show origin\/main:Jellyfin\.Plugin\.Featured\/Jellyfin\.Plugin\.Featured\.csproj/);
  assert.match(workflow, /git show origin\/main:manifest-beta\.json/);
  assert.match(workflow, /--target "\$\{\{ github\.sha \}\}"/);
  assert.match(workflow, /gh release create beta[\s\S]*?--prerelease/);
  assert.match(workflow, /git push origin main/);
});

test('beta manifest and package image are separate from the stable release', async () => {
  const [betaManifestSource, stableManifestSource, buildScript, updateScript] = await Promise.all([
    read('manifest-beta.json'),
    read('manifest.json'),
    read('build-release.ps1'),
    read('scripts/update-manifest.ps1')
  ]);
  const betaManifest = JSON.parse(betaManifestSource);
  const stableManifest = JSON.parse(stableManifestSource);
  assert.equal(betaManifest[0].guid, stableManifest[0].guid);
  assert.equal(betaManifest[0].imageUrl.endsWith('/logo-beta.png'), true);
  assert.equal(stableManifest[0].imageUrl.endsWith('/logo.png'), true);
  assert.deepEqual(betaManifest[0].versions, []);
  assert.match(buildScript, /\[switch\]\$Beta/);
  assert.match(buildScript, /if \(\$Beta\)[\s\S]*?logo-beta\.png[\s\S]*?else[\s\S]*?logo\.png/);
  assert.match(updateScript, /\[switch\]\$LatestOnly/);
  assert.match(updateScript, /\$existingVersions = if \(\$LatestOnly\)/);
});

test('beta build version synchronizes backend, package metadata, and frontend constant', async () => {
  const [versionScript, frontendScript] = await Promise.all([
    read('scripts/set-build-version.ps1'),
    read('scripts/sync-frontend-version.mjs')
  ]);
  assert.match(versionScript, /"Version", "AssemblyVersion", "FileVersion"/);
  assert.match(versionScript, /sync-frontend-version\.mjs/);
  assert.match(frontendScript, /src', 'constants\.ts'/);
  assert.match(frontendScript, /PLUGIN_VERSION/);
});
