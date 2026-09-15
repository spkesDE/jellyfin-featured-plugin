import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const requestedVersion = process.argv[2];
const checkOnly = process.argv.includes('--check');

if (!requestedVersion || !/^\d+\.\d+\.\d+\.\d+$/.test(requestedVersion)) {
  throw new Error(`Expected a four-part numeric version, received '${requestedVersion || ''}'.`);
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const packageJsonPath = path.join(repositoryRoot, 'package.json');
const packageLockPath = path.join(repositoryRoot, 'package-lock.json');
const constantsPath = path.join(repositoryRoot, 'src', 'constants.ts');

async function readJson(filePath) {
  const source = await readFile(filePath, 'utf8');
  return {
    data: JSON.parse(source),
    newline: source.includes('\r\n') ? '\r\n' : '\n',
    source
  };
}

function assertVersion(actualVersion, location) {
  if (actualVersion !== requestedVersion) {
    throw new Error(`${location} is '${actualVersion || ''}', expected '${requestedVersion}'.`);
  }
}

async function writeJson(filePath, document) {
  const output = `${JSON.stringify(document.data, null, 2)}\n`.replace(/\n/g, document.newline);
  if (output !== document.source) {
    await writeFile(filePath, output, 'utf8');
  }
}

const packageJson = await readJson(packageJsonPath);
const packageLock = await readJson(packageLockPath);
const constantsSource = await readFile(constantsPath, 'utf8');
const lockRoot = packageLock.data.packages?.[''];

function getConstantsVersion(source) {
  return source.match(/export const PLUGIN_VERSION = '([^']+)'/)?.[1];
}

if (!lockRoot) {
  throw new Error('package-lock.json does not contain the root package entry.');
}

if (checkOnly) {
  assertVersion(packageJson.data.version, 'package.json version');
  assertVersion(packageLock.data.version, 'package-lock.json version');
  assertVersion(lockRoot.version, 'package-lock.json root package version');
  assertVersion(getConstantsVersion(constantsSource), 'src/constants.ts plugin version');
  console.log(`Frontend package version ${requestedVersion} is synchronized.`);
} else {
  packageJson.data.version = requestedVersion;
  packageLock.data.version = requestedVersion;
  lockRoot.version = requestedVersion;
  const updatedConstants = constantsSource.replace(
    /export const PLUGIN_VERSION = '[^']+';/,
    `export const PLUGIN_VERSION = '${requestedVersion}';`
  );
  if (updatedConstants === constantsSource && getConstantsVersion(constantsSource) !== requestedVersion) {
    throw new Error('Could not update PLUGIN_VERSION in src/constants.ts.');
  }
  await Promise.all([
    writeJson(packageJsonPath, packageJson),
    writeJson(packageLockPath, packageLock),
    updatedConstants === constantsSource ? Promise.resolve() : writeFile(constantsPath, updatedConstants, 'utf8')
  ]);
  console.log(`Synchronized frontend package version to ${requestedVersion}.`);
}
