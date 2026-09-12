import de from './locales/de.json';
import en from './locales/en.json';

export type TranslationKey = keyof typeof en;
type TranslationValues = Record<string, string | number>;
type TranslationDictionary = Partial<Record<TranslationKey, string>>;

const translations: Record<string, TranslationDictionary> = { de, en };

export function getUiLanguage(): string {
  const requested = document.documentElement.lang || navigator.languages?.[0] || navigator.language || 'en';
  const language = requested.trim().replace('_', '-').split('-')[0].toLowerCase();
  return language in translations ? language : 'en';
}

export function t(key: TranslationKey, values: TranslationValues = {}): string {
  const template = translations[getUiLanguage()][key] ?? en[key];
  return template.replace(/\{([^{}]+)\}/g, (placeholder, name: string) => (
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : placeholder
  ));
}
