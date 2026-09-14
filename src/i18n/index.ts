import de from './locales/de.json';
import en from './locales/en.json';
import { CONSOLE_PREFIX } from '../constants';

export type TranslationKey = keyof typeof en;
type TranslationValues = Record<string, string | number>;
type TranslationDictionary = Partial<Record<TranslationKey, string>>;

const translations: Record<string, TranslationDictionary> = { de, en };
const reportedMissingTranslations = new Set<string>();

function getTranslation(dictionary: TranslationDictionary, key: TranslationKey): string | undefined {
  const value = dictionary[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function reportMissingTranslation(language: string, key: TranslationKey, hasEnglishFallback: boolean): void {
  const reportKey = `${language}:${key}`;
  if (reportedMissingTranslations.has(reportKey)) return;
  reportedMissingTranslations.add(reportKey);
  console.warn(
    `${CONSOLE_PREFIX} Missing translation "${key}" for locale "${language}"; ${hasEnglishFallback ? 'using English.' : 'showing the translation key.'}`
  );
}

export function getUiLanguage(): string {
  const requested = document.documentElement.lang || navigator.languages?.[0] || navigator.language || 'en';
  const locale = requested.trim().replace(/_/g, '-').toLowerCase();
  const language = locale.split('-')[0];
  if (locale in translations) return locale;
  return language in translations ? language : 'en';
}

export function t(key: TranslationKey, values: TranslationValues = {}): string {
  const language = getUiLanguage();
  const localized = getTranslation(translations[language], key);
  const english = getTranslation(en, key);
  if (!localized) reportMissingTranslation(language, key, english !== undefined);
  const template = localized ?? english ?? key;
  return template.replace(/\{([^{}]+)\}/g, (placeholder, name: string) => (
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : placeholder
  ));
}
