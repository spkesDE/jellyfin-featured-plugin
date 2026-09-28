import assert from 'node:assert/strict';
import { readProjectSource as read } from './helpers/readProjectSource.mjs';
import test from 'node:test';

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

test('stable release formats generated metadata before committing it to main', async () => {
  const workflow = await read('.github/workflows/release.yml');
  assert.match(
    workflow,
    /Generate full changelog[\s\S]*?Update manifest[\s\S]*?Format generated release metadata[\s\S]*?npx prettier --write CHANGELOG\.md manifest\.json[\s\S]*?Commit release artifacts/
  );
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
  assert.equal(Array.isArray(betaManifest[0].versions), true);
  assert.equal(
    betaManifest[0].versions.every((version) => version.sourceUrl.endsWith('/releases/download/beta/Featured.zip')),
    true
  );
  assert.equal(
    stableManifest[0].versions.every((version) => !version.sourceUrl.includes('/releases/download/beta/')),
    true
  );
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
