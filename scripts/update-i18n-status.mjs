import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const localesDir = path.join(repoRoot, 'src', 'i18n', 'locales');
const outputDir = path.join(repoRoot, 'docs');
const outputFile = path.join(outputDir, 'i18n-status.svg');
const referenceLocale = 'en';

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function languageName(locale) {
  const overrides = {
    en: 'English',
    de: 'German',
  };

  if (overrides[locale]) {
    return overrides[locale];
  }

  try {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
    return displayNames.of(locale) || locale;
  } catch {
    return locale;
  }
}

function progressColor(percent) {
  if (percent >= 100) return '#2dd4bf';
  if (percent >= 60) return '#3b82f6';
  return '#f97360';
}

async function loadJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

const localeFiles = (await readdir(localesDir))
  .filter((file) => file.endsWith('.json'))
  .sort((a, b) => a.localeCompare(b));

if (!localeFiles.includes(`${referenceLocale}.json`)) {
  throw new Error(`Reference locale ${referenceLocale}.json was not found.`);
}

const reference = await loadJson(path.join(localesDir, `${referenceLocale}.json`));
const referenceKeys = Object.keys(reference);

if (referenceKeys.length === 0) {
  throw new Error('Reference locale contains no translation keys.');
}

const rows = [];

for (const file of localeFiles) {
  const locale = path.basename(file, '.json');
  const translations = await loadJson(path.join(localesDir, file));
  const translated = referenceKeys.filter((key) => {
    const value = translations[key];
    return typeof value === 'string' && value.trim().length > 0;
  }).length;
  const percent = Math.round((translated / referenceKeys.length) * 100);

  rows.push({
    locale,
    name: languageName(locale),
    translated,
    total: referenceKeys.length,
    percent,
  });
}

rows.sort((a, b) => {
  if (a.locale === referenceLocale) return -1;
  if (b.locale === referenceLocale) return 1;
  return a.name.localeCompare(b.name);
});

const width = 720;
const headerHeight = 48;
const rowHeight = 38;
const bottomPadding = 16;
const height = headerHeight + rows.length * rowHeight + bottomPadding;
const labelX = 30;
const barX = 210;
const barWidth = 390;
const barHeight = 10;
const percentX = 662;

const rowSvg = rows.map((row, index) => {
  const y = headerHeight + index * rowHeight + 18;
  const fillWidth = Math.max(0, Math.min(barWidth, (barWidth * row.percent) / 100));
  const color = progressColor(row.percent);

  return `
    <g>
      <text x="${labelX}" y="${y}" class="language">${escapeXml(row.name)}</text>
      <rect x="${barX}" y="${y - 9}" width="${barWidth}" height="${barHeight}" rx="5" class="track"/>
      <rect x="${barX}" y="${y - 9}" width="${fillWidth.toFixed(1)}" height="${barHeight}" rx="5" fill="${color}"/>
      <text x="${percentX}" y="${y}" text-anchor="end" class="percent">${row.percent}%</text>
    </g>`;
}).join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">Jellyfin Featured translation status</title>
  <desc id="desc">Translation completion by language.</desc>
  <style>
    .background { fill: #0d1117; }
    .title { fill: #f0f6fc; font: 600 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .language { fill: #c9d1d9; font: 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .percent { fill: #c9d1d9; font: 600 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .track { fill: #30363d; }
  </style>
  <rect width="${width}" height="${height}" rx="10" class="background"/>
  <text x="28" y="30" class="title">Translation status</text>${rowSvg}
</svg>
`;

await mkdir(outputDir, { recursive: true });
await writeFile(outputFile, svg, 'utf8');

for (const row of rows) {
  console.log(`${row.name.padEnd(20)} ${String(row.percent).padStart(3)}%  (${row.translated}/${row.total})`);
}

console.log(`\nWrote ${path.relative(repoRoot, outputFile)}`);
